//! Traitements du protocole de synchronisation.
//!
//! Règle impérative de ce module : **tout** travail SQLite est exécuté dans
//! `tokio::task::spawn_blocking` et le verrou `Mutex<Connection>` n'est jamais
//! tenu au-dessus d'un `await`. Les fonctions `*_au_poste` sont donc
//! synchrones : elles se testent sans serveur HTTP.
//!
//! Ordre d'application d'une ligne poussée :
//! 1. la ligne a déjà été auditée au bureau (`validee` / `rejete`) → le poste
//!    gagne, la poussée est `rejected` et l'image serveur est renvoyée ;
//! 2. une clé métier (immatriculation, nom d'intervenant, nom de pièce)
//!    correspond à une autre ligne → `merged` avec l'UUID retenu ;
//! 3. `updated_at` du téléphone plus récent que celui du poste → écriture,
//!    sinon `rejected` (`plus_recent_au_bureau`).

use axum::extract::{ConnectInfo, Json, Path, State};
use axum::http::HeaderMap;
use axum::response::Response;
use rusqlite::{params, Connection, OptionalExtension};
use std::net::SocketAddr;
use std::sync::Arc;
use uuid::Uuid;

use super::auth::{self};
use super::payloads::{
    CamionWire, Changement, DepenseWire, HelloResponse, IntervenantWire, PairRequest,
    PairResponse, PhotoWire, PhotosRequest, PhotosResponse, PieceWire, PullRequest,
    PullResponse, PushRequest, PushResponse, ResultatLigne, ResultatPhoto, SaisonActive,
};
use super::{ErreurHttp, EtatServeur, SCHEMA_VERSION};
use crate::models::depense::categorie_valide;
use crate::models::intervenant::role_valide;
use crate::services::justificatif;

/// Nombre de lignes de journal servies par tirage.
const TAILLE_TIRAGE_DEFAUT: u32 = 500;
/// Plafond d'un tirage, pour ménager le poste.
const TAILLE_TIRAGE_MAX: u32 = 2000;
/// Taille maximale d'une photo décodée (le terrain compresse avant d'envoyer).
const TAILLE_PHOTO_MAX: usize = 4 * 1024 * 1024;

// ─── GET /sync/hello ──────────────────────────────────────────────────────────

/// Détection du poste, sans jeton : le téléphone vérifie qu'il parle bien à un
/// ABAF avant de demander un appairage.
pub async fn hello(State(etat): State<EtatServeur>) -> Result<Json<HelloResponse>, ErreurHttp> {
    etat.sync.compter_requete();
    au_bloc(etat.db.clone(), |conn| {
        Ok(Json(HelloResponse {
            server_name: "ABAF".to_string(),
            schema_version: SCHEMA_VERSION.to_string(),
            time: temps_serveur(conn)?,
        }))
    })
    .await
}

// ─── POST /sync/pair ──────────────────────────────────────────────────────────

/// Appairage sur code à 6 chiffres : seul parcours sans jeton, donc seul limité
/// en tentatives.
pub async fn pair(
    State(etat): State<EtatServeur>,
    ConnectInfo(adresse): ConnectInfo<SocketAddr>,
    Json(corps): Json<PairRequest>,
) -> Result<Json<PairResponse>, ErreurHttp> {
    etat.sync.compter_requete();
    let origin = adresse.ip().to_string();
    if !etat.sync.autoriser_pair(&origin) {
        return Err(ErreurHttp::trop_de_tentatives());
    }

    let reponse = au_bloc(etat.db.clone(), move |conn| pair_au_poste(conn, &corps)).await?;
    etat.sync.reinitialiser_pair(&origin);
    Ok(reponse)
}

/// Enregistre l'appareil, remet un jeton et brûle le code (usage unique).
pub fn pair_au_poste(conn: &mut Connection, corps: &PairRequest) -> Result<Json<PairResponse>, ErreurHttp> {
    auth::verifier_code(conn, &corps.code)?;

    let device_uuid = Uuid::new_v4().to_string();
    let token = auth::generer_token();
    conn.execute(
        "INSERT INTO appareils (uuid, nom, agent, token_hash)
         VALUES (?1, ?2, ?3, ?4)",
        params![
            device_uuid,
            corps.nom_appareil.trim(),
            corps.agent.trim(),
            auth::hacher_hex(token.as_bytes())
        ],
    )
    .map_err(|e| ErreurHttp::interne(e.to_string()))?;
    auth::consommer_code(conn)?;

    let saison_active: Option<SaisonActive> = conn
        .query_row(
            "SELECT uuid, libelle FROM saisons
             WHERE statut = 'ouverte' ORDER BY id DESC LIMIT 1",
            [],
            |row| Ok(SaisonActive { uuid: row.get(0)?, libelle: row.get(1)? }),
        )
        .optional()
        .map_err(|e| ErreurHttp::interne(e.to_string()))?
        .filter(|saison| !saison.uuid.is_empty());

    Ok(Json(PairResponse { token, device_uuid, saison_active, server_time: temps_serveur(conn)? }))
}

// ─── POST /sync/pull ──────────────────────────────────────────────────────────

/// Tirage du journal des changements à partir d'un curseur.
pub async fn pull(
    State(etat): State<EtatServeur>,
    headers: HeaderMap,
    Json(corps): Json<PullRequest>,
) -> Result<Json<PullResponse>, ErreurHttp> {
    etat.sync.compter_requete();
    let ids = auth::extraire_identifiants(&headers)?;
    au_bloc(etat.db.clone(), move |conn| {
        auth::verifier(conn, &ids)?;
        Ok(Json(pull_au_poste(conn, &corps, &ids.device)?))
    })
    .await
}

pub fn pull_au_poste(conn: &mut Connection, corps: &PullRequest, device: &str) -> Result<PullResponse, ErreurHttp> {
    let limite = corps.limit.unwrap_or(TAILLE_TIRAGE_DEFAUT).clamp(1, TAILLE_TIRAGE_MAX);

    // Le journal est compacté : un appareil plus ancien que sa première entrée
    // a manqué des lignes. Il doit se réinitialiser (tirer depuis 0) au lieu de
    // croire que rien ne s'est passé.
    let premiere_lvn: i64 = conn
        .query_row("SELECT COALESCE(MIN(lvn), 1) FROM sync_oplog", [], |row| row.get(0))
        .map_err(|e| ErreurHttp::interne(e.to_string()))?;
    let reset = corps.since > 0 && premiere_lvn > corps.since + 1;

    let lignes = journal(conn, corps.since, limite)?;
    let has_more = lignes.len() as u32 >= limite;
    let cursor = lignes.last().map(|(lvn, _)| *lvn).unwrap_or(corps.since);

    conn.execute(
        "UPDATE appareils SET last_pull_lvn = ?2 WHERE uuid = ?1",
        params![device, cursor],
    )
    .map_err(|e| ErreurHttp::interne(e.to_string()))?;

    Ok(PullResponse {
        changes: lignes.into_iter().map(|(_, changement)| changement).collect(),
        cursor,
        has_more,
        reset,
        server_time: temps_serveur(conn)?,
    })
}

/// Lecture bornée du journal, dans l'ordre de `lvn`.
fn journal(conn: &Connection, since: i64, limite: u32) -> Result<Vec<(i64, Changement)>, ErreurHttp> {
    let mut stmt = conn
        .prepare(
            "SELECT lvn, table_x, ref, op, payload
             FROM sync_oplog WHERE lvn > ?1 ORDER BY lvn LIMIT ?2",
        )
        .map_err(|e| ErreurHttp::interne(e.to_string()))?;

    let lignes = stmt
        .query_map(params![since, limite], |row| {
            let payload: Option<String> = row.get(4)?;
            Ok((
                row.get::<_, i64>(0)?,
                Changement {
                    lvn: row.get(0)?,
                    table_x: row.get(1)?,
                    reference: row.get(2)?,
                    op: row.get(3)?,
                    payload: payload.and_then(|texte| serde_json::from_str(&texte).ok()),
                },
            ))
        })
        .map_err(|e| ErreurHttp::interne(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| ErreurHttp::interne(e.to_string()))?;
    Ok(lignes)
}

// ─── POST /sync/push ──────────────────────────────────────────────────────────

/// Réception des lignes proposées par un téléphone.
pub async fn push(
    State(etat): State<EtatServeur>,
    headers: HeaderMap,
    Json(corps): Json<PushRequest>,
) -> Result<Json<PushResponse>, ErreurHttp> {
    etat.sync.compter_requete();
    let ids = auth::extraire_identifiants(&headers)?;
    au_bloc(etat.db.clone(), move |conn| {
        auth::verifier(conn, &ids)?;
        Ok(Json(pousser_au_poste(conn, &ids.device, corps)?))
    })
    .await
}

/// Cœur du push, séparé pour être testable : un lot entre, un relevé de
/// décisions sort.
pub fn pousser_au_poste(
    conn: &mut Connection,
    device: &str,
    corps: PushRequest,
) -> Result<PushResponse, ErreurHttp> {
    // Les triggers lisent `sync_ctx` pour savoir qui a écrit : l'auteur est posé
    // pour toute la durée du lot, puis rendu au poste. Le verrou de la base est
    // tenu pendant tout le bloc, aucune autre écriture ne peut s'intercaler.
    marquer_auteur(conn, device)?;
    let results = pousser_lot(conn, device, corps);
    marquer_auteur(conn, "")?;
    let results = results?;

    let nb_recues = results.iter().filter(|ligne| ligne.status != "rejected").count() as i64;
    conn.execute(
        "UPDATE appareils SET nb_lignes_sync = nb_lignes_sync + ?2 WHERE uuid = ?1",
        params![device, nb_recues],
    )
    .map_err(|e| ErreurHttp::interne(e.to_string()))?;

    let cursor: i64 = conn
        .query_row("SELECT COALESCE(MAX(lvn), 0) FROM sync_oplog", [], |row| row.get(0))
        .map_err(|e| ErreurHttp::interne(e.to_string()))?;

    Ok(PushResponse { results, cursor, server_time: temps_serveur(conn)? })
}

fn pousser_lot(conn: &mut Connection, device: &str, corps: PushRequest) -> Result<Vec<ResultatLigne>, ErreurHttp> {
    let mut resultat = Vec::new();

    // Les référentiels d'abord : une dépense qui référence un apprenti créé
    // dans le même lot doit trouver sa clé côté poste.
    for wire in &corps.intervenants {
        resultat.push(pousser_intervenant(conn, device, wire)?);
    }
    for wire in &corps.pieces_rechange {
        resultat.push(pousser_piece(conn, device, wire)?);
    }
    for wire in &corps.camions {
        resultat.push(pousser_camion(conn, wire)?);
    }
    for wire in &corps.depenses {
        resultat.push(pousser_depense(conn, device, wire)?);
    }
    Ok(resultat)
}

fn pousser_depense(
    conn: &mut Connection,
    device: &str,
    wire: &DepenseWire,
) -> Result<ResultatLigne, ErreurHttp> {
    // Contrôles de forme d'abord : ils ne coûtent aucune lecture.
    if !categorie_valide(&wire.categorie) {
        return Ok(rejete(&wire.uuid, "categorie_inconnue"));
    }
    if wire.designation.trim().is_empty() {
        return Ok(rejete(&wire.uuid, "designation_manquante"));
    }
    if !wire.montant.is_finite() || wire.montant < 0.0 {
        return Ok(rejete(&wire.uuid, "montant_invalide"));
    }

    let saison_id = match resoudre_ref(conn, "saisons", Some(&wire.saison_uuid))? {
        Some(id) => id,
        None => return Ok(rejete(&wire.uuid, "saison_inconnue")),
    };
    let camion_id = match resoudre_ref(conn, "camions", wire.camion_uuid.as_ref())? {
        Some(id) => Some(id),
        None if wire.camion_uuid.is_some() => return Ok(rejete(&wire.uuid, "camion_inconnu")),
        None => None,
    };
    let mission_id = match resoudre_ref(conn, "missions", wire.mission_uuid.as_ref())? {
        Some(id) => Some(id),
        None if wire.mission_uuid.is_some() => return Ok(rejete(&wire.uuid, "mission_inconnue")),
        None => None,
    };
    let chauffeur_id = match resoudre_ref(conn, "chauffeurs", wire.chauffeur_uuid.as_ref())? {
        Some(id) => Some(id),
        None if wire.chauffeur_uuid.is_some() => return Ok(rejete(&wire.uuid, "chauffeur_inconnu")),
        None => None,
    };
    let apprenti_id = match resoudre_ref(conn, "intervenants", wire.apprenti_uuid.as_ref())? {
        Some(id) => Some(id),
        None if wire.apprenti_uuid.is_some() => return Ok(rejete(&wire.uuid, "apprenti_inconnu")),
        None => None,
    };
    let mecanicien_id = match resoudre_ref(conn, "intervenants", wire.mecanicien_uuid.as_ref())? {
        Some(id) => Some(id),
        None if wire.mecanicien_uuid.is_some() => return Ok(rejete(&wire.uuid, "mecanicien_inconnu")),
        None => None,
    };
    let piece_id = match resoudre_ref(conn, "pieces_rechange", wire.piece_uuid.as_ref())? {
        Some(id) => Some(id),
        None if wire.piece_uuid.is_some() => return Ok(rejete(&wire.uuid, "piece_inconnue")),
        None => None,
    };

    let existante: Option<(i64, String, String)> = conn
        .query_row(
            "SELECT id, statut, updated_at FROM depenses WHERE uuid = ?1",
            params![wire.uuid],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(|e| ErreurHttp::interne(e.to_string()))?;

    let statut = match &existante {
        Some((_, auditee, updated_at)) => {
            // (a) La ligne a déjà été auditée au bureau : le poste gagne.
            if auditee == "validee" || auditee == "rejete" {
                return Ok(rejete(&wire.uuid, "deja_traitee_au_bureau")
                    .avec_image(image_depense(conn, &wire.uuid)?));
            }
            // (c) Last-write-wins sur `updated_at`.
            if wire.updated_at.as_str() <= updated_at.as_str() {
                return Ok(rejete(&wire.uuid, "plus_recent_au_bureau")
                    .avec_image(image_depense(conn, &wire.uuid)?));
            }
            "updated"
        }
        None => "ok",
    };

    // Écriture en transaction : en cas d'échec la ligne est annulée, le lot
    // passe à la suivante.
    let tx = conn.transaction().map_err(|e| ErreurHttp::interne(e.to_string()))?;
    match &existante {
        Some((id, _, _)) => {
            let _ = tx
                .execute(
                "UPDATE depenses
                    SET saison_id = ?2, camion_id = ?3, mission_id = ?4, chauffeur_id = ?5,
                        apprenti_id = ?6, mecanicien_id = ?7, piece_id = ?8, categorie = ?9,
                        designation = ?10, quantite = ?11, unite = ?12, montant = ?13,
                        date_depense = ?14, lieu = ?15, observations = ?16, updated_at = ?17,
                        synced_at = datetime('now')
                  WHERE id = ?1",
                params![
                    id,
                    saison_id,
                    camion_id,
                    mission_id,
                    chauffeur_id,
                    apprenti_id,
                    mecanicien_id,
                    piece_id,
                    wire.categorie,
                    wire.designation.trim(),
                    wire.quantite,
                    wire.unite,
                    wire.montant,
                    wire.date_depense,
                    wire.lieu,
                    wire.observations,
                    wire.updated_at
                ],
            )
            .map_err(|e| ErreurHttp::interne(e.to_string()))?;
        }
        None => {
            let _ = tx
                .execute(
                "INSERT INTO depenses (
                    uuid, saison_id, camion_id, mission_id, chauffeur_id, apprenti_id,
                    mecanicien_id, piece_id, categorie, designation, quantite, unite,
                    montant, date_depense, lieu, observations, photo, statut, source,
                    device_id, created_at, updated_at, synced_at
                 )
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
                         ?15, ?16, ?17, 'brouillon', 'mobile', ?18, ?19, ?20, datetime('now'))",
                params![
                    wire.uuid,
                    saison_id,
                    camion_id,
                    mission_id,
                    chauffeur_id,
                    apprenti_id,
                    mecanicien_id,
                    piece_id,
                    wire.categorie,
                    wire.designation.trim(),
                    wire.quantite,
                    wire.unite,
                    wire.montant,
                    wire.date_depense,
                    wire.lieu,
                    wire.observations,
                    wire.photo,
                    device,
                    wire.created_at,
                    wire.updated_at
                ],
            )
            .map_err(|e| ErreurHttp::interne(e.to_string()))?;
        }
    }
    tx.commit().map_err(|e| ErreurHttp::interne(e.to_string()))?;

    Ok(ligne_acceptee(&wire.uuid, statut, image_depense(conn, &wire.uuid)?))
}

fn pousser_intervenant(
    conn: &mut Connection,
    device: &str,
    wire: &IntervenantWire,
) -> Result<ResultatLigne, ErreurHttp> {
    if wire.nom.trim().is_empty() {
        return Ok(rejete(&wire.uuid, "nom_manquant"));
    }
    if !role_valide(&wire.role) {
        return Ok(rejete(&wire.uuid, "role_inconnu"));
    }

    // (b) Fusion par clé métier : même nom, même prénom, même rôle.
    let jumeau: Option<(String, String)> = conn
        .query_row(
            "SELECT uuid, updated_at FROM intervenants
              WHERE nom = ?1 COLLATE NOCASE
                AND ifnull(prenom, '') = ifnull(?2, '') COLLATE NOCASE
                AND role = ?3",
            params![wire.nom.trim(), wire.prenom.as_deref().map(str::trim), wire.role],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|e| ErreurHttp::interne(e.to_string()))?;

    if let Some((uuid_serveur, updated_at)) = &jumeau {
        if uuid_serveur != &wire.uuid {
            // Le téléphone a recréé une personne déjà connue : on garde la
            // fiche du poste, et une version plus récente du terrain la corrige
            // malgré tout.
            if wire.updated_at.as_str() > updated_at.as_str() {
                conn.execute(
                    "UPDATE intervenants SET telephone = ?2, actif = ?3, updated_at = ?4
                      WHERE uuid = ?1",
                    params![uuid_serveur, wire.telephone, wire.actif, wire.updated_at],
                )
                .map_err(|e| ErreurHttp::interne(e.to_string()))?;
            }
            return Ok(ResultatLigne {
                uuid: wire.uuid.clone(),
                status: "merged".to_string(),
                motif: Some("doublon_intervenant".to_string()),
                merged_into: Some(uuid_serveur.clone()),
                server_row: image_ligne(conn, "intervenants", uuid_serveur)?,
            });
        }
    }

    let existant: Option<String> = conn
        .query_row(
            "SELECT updated_at FROM intervenants WHERE uuid = ?1",
            params![wire.uuid],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| ErreurHttp::interne(e.to_string()))?;

    let statut = match &existant {
        Some(updated_at) if wire.updated_at.as_str() <= updated_at.as_str() => {
            return Ok(rejete(&wire.uuid, "plus_recent_au_bureau")
                .avec_image(image_ligne(conn, "intervenants", &wire.uuid)?));
        }
        Some(_) => "updated",
        None => "ok",
    };

    let tx = conn.transaction().map_err(|e| ErreurHttp::interne(e.to_string()))?;
    match &existant {
        Some(_) => {
            let _ = tx
                .execute(
                    "UPDATE intervenants
                        SET nom = ?2, prenom = ?3, telephone = ?4, role = ?5, actif = ?6,
                            updated_at = ?7
                      WHERE uuid = ?1",
                params![
                    wire.uuid,
                    wire.nom.trim(),
                    wire.prenom.as_deref().map(str::trim),
                    wire.telephone,
                    wire.role,
                    wire.actif,
                    wire.updated_at
                ],
                )
                .map_err(|e| ErreurHttp::interne(e.to_string()))?;
        }
        None => {
            let _ = tx
                .execute(
                    "INSERT INTO intervenants (
                        uuid, nom, prenom, telephone, role, actif, source, device_id, created_at, updated_at
                     )
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'mobile', ?7, ?8, ?9)",
                params![
                    wire.uuid,
                    wire.nom.trim(),
                    wire.prenom.as_deref().map(str::trim),
                    wire.telephone,
                    wire.role,
                    wire.actif,
                    device,
                    wire.created_at,
                    wire.updated_at
                ],
                )
                .map_err(|e| {
                    // Index unique : la fusion avait été manquée d'un cheveu.
                    if e.to_string().contains("UNIQUE") {
                        ErreurHttp::requete_invalide("doublon_intervenant")
                    } else {
                        ErreurHttp::interne(e.to_string())
                    }
                })?;
        }
    }
    tx.commit().map_err(|e| ErreurHttp::interne(e.to_string()))?;

    Ok(ligne_acceptee(&wire.uuid, statut, image_ligne(conn, "intervenants", &wire.uuid)?))
}

fn pousser_piece(conn: &mut Connection, device: &str, wire: &PieceWire) -> Result<ResultatLigne, ErreurHttp> {
    if wire.nom.trim().is_empty() {
        return Ok(rejete(&wire.uuid, "nom_manquant"));
    }

    let jumeau: Option<(String, String)> = conn
        .query_row(
            "SELECT uuid, updated_at FROM pieces_rechange
              WHERE nom = ?1 COLLATE NOCASE
                AND ifnull(categorie, '') = ifnull(?2, '') COLLATE NOCASE",
            params![wire.nom.trim(), wire.categorie.as_deref().map(str::trim)],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|e| ErreurHttp::interne(e.to_string()))?;

    if let Some((uuid_serveur, updated_at)) = &jumeau {
        if uuid_serveur != &wire.uuid {
            if wire.updated_at.as_str() > updated_at.as_str() {
                conn.execute(
                    "UPDATE pieces_rechange SET unite = ?2, actif = ?3, updated_at = ?4
                      WHERE uuid = ?1",
                    params![uuid_serveur, wire.unite, wire.actif, wire.updated_at],
                )
                .map_err(|e| ErreurHttp::interne(e.to_string()))?;
            }
            return Ok(ResultatLigne {
                uuid: wire.uuid.clone(),
                status: "merged".to_string(),
                motif: Some("doublon_piece".to_string()),
                merged_into: Some(uuid_serveur.clone()),
                server_row: image_ligne(conn, "pieces_rechange", uuid_serveur)?,
            });
        }
    }

    let existant: Option<String> = conn
        .query_row(
            "SELECT updated_at FROM pieces_rechange WHERE uuid = ?1",
            params![wire.uuid],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| ErreurHttp::interne(e.to_string()))?;

    let statut = match &existant {
        Some(updated_at) if wire.updated_at.as_str() <= updated_at.as_str() => {
            return Ok(rejete(&wire.uuid, "plus_recent_au_bureau")
                .avec_image(image_ligne(conn, "pieces_rechange", &wire.uuid)?));
        }
        Some(_) => "updated",
        None => "ok",
    };

    let tx = conn.transaction().map_err(|e| ErreurHttp::interne(e.to_string()))?;
    match &existant {
        Some(_) => {
            let _ = tx
                .execute(
                    "UPDATE pieces_rechange
                        SET nom = ?2, categorie = ?3, unite = ?4, actif = ?5, updated_at = ?6
                      WHERE uuid = ?1",
                params![
                    wire.uuid,
                    wire.nom.trim(),
                    wire.categorie.as_deref().map(str::trim),
                    wire.unite,
                    wire.actif,
                    wire.updated_at
                ],
                )
                .map_err(|e| ErreurHttp::interne(e.to_string()))?;
        }
        None => {
            let _ = tx
                .execute(
                    "INSERT INTO pieces_rechange (
                        uuid, nom, categorie, unite, actif, source, device_id, created_at, updated_at
                     )
                     VALUES (?1, ?2, ?3, ?4, ?5, 'mobile', ?6, ?7, ?8)",
                params![
                    wire.uuid,
                    wire.nom.trim(),
                    wire.categorie.as_deref().map(str::trim),
                    wire.unite,
                    wire.actif,
                    device,
                    wire.created_at,
                    wire.updated_at
                ],
                )
                .map_err(|e| {
                    if e.to_string().contains("UNIQUE") {
                        ErreurHttp::requete_invalide("doublon_piece")
                    } else {
                        ErreurHttp::interne(e.to_string())
                    }
                })?;
        }
    }
    tx.commit().map_err(|e| ErreurHttp::interne(e.to_string()))?;

    Ok(ligne_acceptee(&wire.uuid, statut, image_ligne(conn, "pieces_rechange", &wire.uuid)?))
}

fn pousser_camion(conn: &mut Connection, wire: &CamionWire) -> Result<ResultatLigne, ErreurHttp> {
    if wire.immatriculation.trim().is_empty() {
        return Ok(rejete(&wire.uuid, "immatriculation_manquante"));
    }

    // Le parc est tenu au bureau : un téléphone ne crée pas un camion, il tout
    // au plus corriger une lecture d'immatriculation faite de travers.
    let jumeau: Option<String> = conn
        .query_row(
            "SELECT uuid FROM camions WHERE immatriculation = ?1 COLLATE NOCASE",
            params![wire.immatriculation.trim()],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| ErreurHttp::interne(e.to_string()))?;

    let uuid_retenu = match jumeau {
        Some(uuid_serveur) if uuid_serveur != wire.uuid => {
            return Ok(ResultatLigne {
                uuid: wire.uuid.clone(),
                status: "merged".to_string(),
                motif: Some("camion_existant".to_string()),
                merged_into: Some(uuid_serveur.clone()),
                server_row: image_ligne(conn, "camions", &uuid_serveur)?,
            });
        }
        Some(uuid_serveur) => uuid_serveur,
        None => return Ok(rejete(&wire.uuid, "camion_inconnu")),
    };

    let updated_at: String = conn
        .query_row(
            "SELECT updated_at FROM camions WHERE uuid = ?1",
            params![uuid_retenu],
            |row| row.get(0),
        )
        .map_err(|e| ErreurHttp::interne(e.to_string()))?;

    if wire.updated_at.as_str() <= updated_at.as_str() {
        return Ok(rejete(&wire.uuid, "plus_recent_au_bureau")
            .avec_image(image_ligne(conn, "camions", &uuid_retenu)?));
    }

    let tx = conn.transaction().map_err(|e| ErreurHttp::interne(e.to_string()))?;
    let _ = tx
        .execute(
        "UPDATE camions
            SET immatriculation = ?2, marque = ?3, modele = ?4, capacite_tonnes = ?5,
                actif = ?6, updated_at = ?7
          WHERE uuid = ?1",
        params![
            uuid_retenu,
            wire.immatriculation.trim(),
            wire.marque,
            wire.modele,
            wire.capacite_tonnes,
            wire.actif,
            wire.updated_at
        ],
    )
    .map_err(|e| ErreurHttp::interne(e.to_string()))?;
    tx.commit().map_err(|e| ErreurHttp::interne(e.to_string()))?;

    Ok(ligne_acceptee(&wire.uuid, "updated", image_ligne(conn, "camions", &wire.uuid)?))
}

// ─── POST /sync/photos ────────────────────────────────────────────────────────

/// Réception des justificatifs photo, par lots séparés des lignes.
pub async fn photos(
    State(etat): State<EtatServeur>,
    headers: HeaderMap,
    Json(corps): Json<PhotosRequest>,
) -> Result<Json<PhotosResponse>, ErreurHttp> {
    etat.sync.compter_requete();
    let ids = auth::extraire_identifiants(&headers)?;
    let dossier = etat.dossier_justificatifs.clone();

    au_bloc(etat.db.clone(), move |conn| {
        auth::verifier(conn, &ids)?;
        let results = corps
            .items
            .into_iter()
            .map(|item| ecrire_photo(conn, &dossier, item))
            .collect();
        Ok(Json(PhotosResponse { results }))
    })
    .await
}

/// Une photo par une : un cliché refusé ne fait pas échouer le lot.
fn ecrire_photo(conn: &mut Connection, dossier: &std::path::Path, item: PhotoWire) -> ResultatPhoto {
    use base64::Engine as _;

    let echouer = |motif: &str| ResultatPhoto {
        depense_uuid: item.depense_uuid.clone(),
        status: "rejected".to_string(),
        motif: Some(motif.to_string()),
    };

    let connue: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM depenses WHERE uuid = ?1",
            params![item.depense_uuid],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if connue == 0 {
        return echouer("depense_inconnue");
    }

    let octets = match base64::engine::general_purpose::STANDARD.decode(item.base64.trim().as_bytes()) {
        Ok(octets) => octets,
        Err(_) => return echouer("encodage_invalide"),
    };
    if octets.is_empty() {
        return echouer("image_vide");
    }
    if octets.len() > TAILLE_PHOTO_MAX {
        return echouer("image_trop_volumineuse");
    }

    let nom = match justificatif::ecrire(dossier, &item.depense_uuid, &octets) {
        Ok(nom) => nom,
        Err(_) => return echouer("ecriture_impossible"),
    };

    // Le `updated_at` de la ligne n'est pas touché : une photo arrive après la
    // ligne et ne doit pas la faire gagner contre une édition du bureau.
    if conn
        .execute("UPDATE depenses SET photo = ?2 WHERE uuid = ?1", params![item.depense_uuid, nom])
        .is_err()
    {
        return echouer("enregistrement_impossible");
    }

    ResultatPhoto { depense_uuid: item.depense_uuid, status: "ok".to_string(), motif: None }
}

// ─── GET /sync/justificatif/{uuid} ────────────────────────────────────────────

/// Relire une photo poussée depuis un autre appareil.
pub async fn justificatif(
    State(etat): State<EtatServeur>,
    headers: HeaderMap,
    Path(uuid): Path<String>,
) -> Result<Response, ErreurHttp> {
    etat.sync.compter_requete();
    let ids = auth::extraire_identifiants(&headers)?;
    let dossier = etat.dossier_justificatifs.clone();

    let contenu = au_bloc(etat.db.clone(), move |conn| {
        auth::verifier(conn, &ids)?;
        let nom: Option<String> = conn
            .query_row(
                "SELECT photo FROM depenses WHERE uuid = ?1",
                params![uuid],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| ErreurHttp::interne(e.to_string()))?
            .flatten();
        let nom = nom
            .filter(|valeur| !valeur.is_empty())
            .ok_or_else(|| ErreurHttp::introuvable("justificatif_absent"))?;
        std::fs::read(dossier.join(nom)).map_err(|_| ErreurHttp::introuvable("justificatif_absent"))
    })
    .await?;

    axum::http::Response::builder()
        .status(axum::http::StatusCode::OK)
        .header(axum::http::header::CONTENT_TYPE, "image/jpeg")
        .body(axum::body::Body::from(contenu))
        .map_err(|e| ErreurHttp::interne(e.to_string()))
}

// ─── Aides internes ───────────────────────────────────────────────────────────

/// Exécute le travail SQLite hors du runtime async. Le verrou n'est jamais tenu
/// au-dessus d'un `await` : la fermeture du garde-corps marque la fin du bloc.
async fn au_bloc<T, F>(db: Arc<std::sync::Mutex<Connection>>, travail: F) -> Result<T, ErreurHttp>
where
    T: Send + 'static,
    F: FnOnce(&mut Connection) -> Result<T, ErreurHttp> + Send + 'static,
{
    tokio::task::spawn_blocking(move || {
        let mut conn = db.lock().map_err(|e| ErreurHttp::interne(e.to_string()))?;
        travail(&mut conn)
    })
    .await
    .map_err(|e| ErreurHttp::interne(e.to_string()))?
}

fn temps_serveur(conn: &Connection) -> Result<String, ErreurHttp> {
    conn.query_row("SELECT datetime('now')", [], |row| row.get(0))
        .map_err(|e| ErreurHttp::interne(e.to_string()))
}

fn marquer_auteur(conn: &Connection, device: &str) -> Result<(), ErreurHttp> {
    let _ = conn
        .execute("UPDATE sync_ctx SET device = ?1", params![device])
        .map_err(|e| ErreurHttp::interne(e.to_string()))?;
    Ok(())
}

/// Résolution UUID → identifiant interne. Une absence de correspondance vaut
/// `None` (et donc un rejet côté appelant), jamais une erreur HTTP.
fn resoudre_ref(conn: &Connection, table: &str, uuid: Option<&String>) -> Result<Option<i64>, ErreurHttp> {
    const AUTORISEES: &[&str] = &[
        "saisons",
        "camions",
        "missions",
        "chauffeurs",
        "intervenants",
        "pieces_rechange",
    ];
    if !AUTORISEES.contains(&table) {
        return Err(ErreurHttp::interne(format!("table de référentiel inattendue : {table}")));
    }
    let uuid = match uuid.map(|u| u.trim()).filter(|v| !v.is_empty()) {
        Some(uuid) => uuid,
        None => return Ok(None),
    };
    conn.query_row(
        &format!("SELECT id FROM {table} WHERE uuid = ?1"),
        params![uuid],
        |row| row.get(0),
    )
    .optional()
    .map_err(|e| ErreurHttp::interne(e.to_string()))
}

/// Réponse d'acceptation : statut de la ligne et image serveur.
fn ligne_acceptee(uuid: &str, status: &str, server_row: Option<serde_json::Value>) -> ResultatLigne {
    ResultatLigne {
        uuid: uuid.to_string(),
        status: status.to_string(),
        motif: None,
        merged_into: None,
        server_row,
    }
}

fn rejete(uuid: &str, motif: &str) -> ResultatLigne {
    ResultatLigne {
        uuid: uuid.to_string(),
        status: "rejected".to_string(),
        motif: Some(motif.to_string()),
        merged_into: None,
        server_row: None,
    }
}

impl ResultatLigne {
    fn avec_image(mut self, image: Option<serde_json::Value>) -> Self {
        self.server_row = image;
        self
    }
}

/// Image JSON d'une dépense du poste, renvoyée au téléphone lors d'un rejet :
/// il affiche la version retenue à côté de la sienne.
fn image_depense(conn: &Connection, uuid: &str) -> Result<Option<serde_json::Value>, ErreurHttp> {
    let texte: Option<String> = conn
        .query_row(
            "SELECT json_object(
                'uuid', d.uuid,
                'saison_uuid', (SELECT uuid FROM saisons WHERE id = d.saison_id),
                'camion_uuid', (SELECT uuid FROM camions WHERE id = d.camion_id),
                'mission_uuid', (SELECT uuid FROM missions WHERE id = d.mission_id),
                'chauffeur_uuid', (SELECT uuid FROM chauffeurs WHERE id = d.chauffeur_id),
                'apprenti_uuid', (SELECT uuid FROM intervenants WHERE id = d.apprenti_id),
                'mecanicien_uuid', (SELECT uuid FROM intervenants WHERE id = d.mecanicien_id),
                'piece_uuid', (SELECT uuid FROM pieces_rechange WHERE id = d.piece_id),
                'categorie', d.categorie,
                'designation', d.designation,
                'quantite', d.quantite,
                'unite', d.unite,
                'montant', d.montant,
                'date_depense', d.date_depense,
                'lieu', d.lieu,
                'observations', d.observations,
                'photo', d.photo,
                'statut', d.statut,
                'motif_rejet', d.motif_rejet,
                'source', d.source,
                'device_id', d.device_id,
                'updated_at', d.updated_at
             )
             FROM depenses d WHERE d.uuid = ?1",
            params![uuid],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| ErreurHttp::interne(e.to_string()))?;
    Ok(texte.and_then(|valeur| serde_json::from_str(&valeur).ok()))
}

/// Image JSON d'une ligne de référentiel. Les colonnes sont listées à la main,
/// table par table : rien d'implicite sur ce qui quitte le poste.
fn image_ligne(conn: &Connection, table: &str, uuid: &str) -> Result<Option<serde_json::Value>, ErreurHttp> {
    const IMAGES: &[(&str, &str)] = &[
        (
            "camions",
            "SELECT json_object('uuid', uuid, 'immatriculation', immatriculation, 'marque', marque,
                                    'modele', modele, 'capacite_tonnes', capacite_tonnes, 'actif', actif,
                                    'updated_at', updated_at)
             FROM camions WHERE uuid = ?1",
        ),
        (
            "intervenants",
            "SELECT json_object('uuid', uuid, 'nom', nom, 'prenom', prenom, 'telephone', telephone,
                                    'role', role, 'actif', actif, 'updated_at', updated_at)
             FROM intervenants WHERE uuid = ?1",
        ),
        (
            "pieces_rechange",
            "SELECT json_object('uuid', uuid, 'nom', nom, 'categorie', categorie, 'unite', unite,
                                    'actif', actif, 'updated_at', updated_at)
             FROM pieces_rechange WHERE uuid = ?1",
        ),
        (
            "chauffeurs",
            "SELECT json_object('uuid', uuid, 'nom', nom, 'prenom', prenom, 'telephone', telephone,
                                    'actif', actif, 'updated_at', updated_at)
             FROM chauffeurs WHERE uuid = ?1",
        ),
        (
            "saisons",
            "SELECT json_object('uuid', uuid, 'libelle', libelle, 'date_debut', date_debut,
                                    'date_fin', date_fin, 'statut', statut, 'updated_at', updated_at)
             FROM saisons WHERE uuid = ?1",
        ),
    ];

    let sql = match IMAGES.iter().find(|(nom, _)| *nom == table) {
        Some((_, sql)) => *sql,
        None => return Ok(None),
    };
    let texte: Option<String> = conn
        .query_row(sql, params![uuid], |row| row.get(0))
        .optional()
        .map_err(|e| ErreurHttp::interne(e.to_string()))?;
    Ok(texte.and_then(|valeur| serde_json::from_str(&valeur).ok()))
}
