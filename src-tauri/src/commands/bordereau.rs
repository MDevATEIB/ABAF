// Commandes Tauri - module bordereau (Phase 3)
use crate::db::AppState;
use crate::models::bordereau::{
    CreerBordereauPayload, LigneBordereau, LigneBordereauPayload, ModifierBordereauPayload,
    Bordereau,
};
use crate::models::mission::avancer_statut_mission;
use crate::services::tarification;
use crate::utils::generer_numero_document;
use rusqlite::OptionalExtension;
use tauri::State;

/// Liste les bordereaux, avec filtres optionnels par saison et par statut.
#[tauri::command]
pub fn lister_bordereaux(
    state: State<AppState>,
    saison_id: Option<i64>,
    statut: Option<String>,
) -> Result<Vec<Bordereau>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, numero, saison_id, mission_id, bsm_id, camion_id, chauffeur_id, usine_id,
                    cgi_id, date_bordereau, poids_vide_kg, poids_charge_kg, poids_net_kg,
                    distance_km, type_fret, tarif_applique, unite_tarif, montant_brut,
                    statut, observations, created_at, updated_at
             FROM bordereaux
             WHERE (?1 IS NULL OR saison_id = ?1)
               AND (?2 IS NULL OR statut = ?2)
             ORDER BY date_bordereau DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![saison_id, statut], |row| {
            Ok(Bordereau {
                id: row.get(0)?,
                numero: row.get(1)?,
                saison_id: row.get(2)?,
                mission_id: row.get(3)?,
                bsm_id: row.get(4)?,
                camion_id: row.get(5)?,
                chauffeur_id: row.get(6)?,
                usine_id: row.get(7)?,
                cgi_id: row.get(8)?,
                date_bordereau: row.get(9)?,
                poids_vide_kg: row.get(10)?,
                poids_charge_kg: row.get(11)?,
                poids_net_kg: row.get(12)?,
                distance_km: row.get(13)?,
                type_fret: row.get(14)?,
                tarif_applique: row.get(15)?,
                unite_tarif: row.get(16)?,
                montant_brut: row.get(17)?,
                statut: row.get(18)?,
                observations: row.get(19)?,
                created_at: row.get(20)?,
                updated_at: row.get(21)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Retourne les lignes (AV et poids) d'un bordereau, dans l'ordre de saisie.
#[tauri::command]
pub fn get_lignes_bordereau(
    state: State<AppState>,
    bordereau_id: i64,
) -> Result<Vec<LigneBordereau>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    lire_lignes(&db, bordereau_id)
}

/// Crée un bordereau de chargement (statut initial : brouillon).
///
/// Règles (AGENT.md §4 et §12) :
/// - au moins une ligne (AV et poids) ;
/// - la mission est créée AUTOMATIQUEMENT si mission_id n'est pas fourni
///   (1 mission = 1 bordereau dans la refonte Système Global) ;
/// - si une quantité gasoil est saisie, un BSM est auto-généré et lié
///   via `bordereaux.bsm_id` ;
/// - le numéro est attribué automatiquement (par année) si celui du payload
///   est absent ou vide.
#[tauri::command]
pub fn creer_bordereau(
    state: State<AppState>,
    payload: CreerBordereauPayload,
) -> Result<Bordereau, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;

    verifier_lignes(&db, &payload.lignes)?;
    verifier_camion(&db, payload.camion_id)?;
    if let Some(mission_id) = payload.mission_id {
        verifier_mission(&db, mission_id)?;
    }
    let type_fret = normaliser_type_fret(payload.type_fret.as_deref())?;

    // Validation gasoil (ENF5)
    let gasoil_quantite = payload.quantite_litres_gasoil.unwrap_or(0.0);
    if gasoil_quantite > 0.0 {
        let prix = payload.prix_litre_gasoil.unwrap_or(0.0);
        if prix <= 0.0 {
            return Err(
                "Le prix au litre du gasoil est requis si une quantité est saisie."
                    .to_string(),
            );
        }
    }

    let numero = payload
        .numero
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let numero = match numero {
        Some(n) => {
            verifier_numero_disponible(&db, &n, None)?;
            n
        }
        None => generer_numero_document(
            &db,
            "bordereaux",
            "date_bordereau",
            "numero",
            payload.date_bordereau.as_str(),
        )?,
    };

    // Déterminer cgi_id pour la mission :
    // - d'abord payload.cgi_id si fourni ;
    // - sinon remonter le cgi_id de la première ligne qui a un av_id.
    let cgi_pour_mission = if payload.cgi_id.is_some() {
        payload.cgi_id
    } else {
        payload
            .lignes
            .iter()
            .find(|l| l.av_id.is_some())
            .and_then(|l| l.av_id)
            .and_then(|av_id| {
                db.query_row(
                    "SELECT cgi_id FROM avs WHERE id = ?1",
                    rusqlite::params![av_id],
                    |row| row.get::<_, Option<i64>>(0),
                )
                .optional()
                .ok()
                .flatten()
                .flatten()
            })
    };

    let tx = db.transaction().map_err(|e| e.to_string())?;

    // ── Étape 1 : Créer (ou réutiliser) la mission ────────────────────────
    let mission_id = match payload.mission_id {
        Some(id) => id,
        None => {
            tx.execute(
                "INSERT INTO missions (saison_id, camion_id, chauffeur_id, usine_id, cgi_id,
                                       date_mission, statut, observations)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'brouillon', ?7)",
                rusqlite::params![
                    payload.saison_id,
                    payload.camion_id,
                    payload.chauffeur_id,
                    payload.usine_id,
                    cgi_pour_mission,
                    payload.date_bordereau,
                    payload.observations,
                ],
            )
            .map_err(|e| e.to_string())?;
            tx.last_insert_rowid()
        }
    };

    // ── Étape 2 : Insérer le bordereau ────────────────────────────────────
    tx.execute(
        "INSERT INTO bordereaux (numero, saison_id, mission_id, camion_id, chauffeur_id,
                                 usine_id, cgi_id, date_bordereau, distance_km, type_fret,
                                 observations, statut)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'brouillon')",
        rusqlite::params![
            numero,
            payload.saison_id,
            mission_id,
            payload.camion_id,
            payload.chauffeur_id,
            payload.usine_id,
            payload.cgi_id,
            payload.date_bordereau,
            payload.distance_km,
            type_fret,
            payload.observations,
        ],
    )
    .map_err(|e| e.to_string())?;

    let bordereau_id = tx.last_insert_rowid();
    inserer_lignes(&tx, bordereau_id, &payload.lignes)?;

    // ── Étape 3 : Générer le BSM si gasoil saisi ──────────────────────────
    if gasoil_quantite > 0.0 {
        let numero_bsm = generer_numero_document(
            &tx,
            "bsm",
            "date_bsm",
            "numero",
            payload.date_bordereau.as_str(),
        )?;

        tx.execute(
            "INSERT INTO bsm (numero, saison_id, mission_id, camion_id, usine_id,
                              date_bsm, beneficiaire, quantite_litres, prix_litre,
                              imputation, reference, statut)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'ouvert')",
            rusqlite::params![
                numero_bsm,
                payload.saison_id,
                mission_id,
                payload.camion_id,
                payload.usine_id,
                payload.date_bordereau,
                payload.beneficiaire_gasoil,
                gasoil_quantite,
                payload.prix_litre_gasoil.unwrap(),
                payload.imputation_gasoil,
                payload.reference_gasoil,
            ],
        )
        .map_err(|e| e.to_string())?;

        let bsm_id = tx.last_insert_rowid();
        tx.execute(
            "UPDATE bordereaux SET bsm_id = ?1 WHERE id = ?2",
            rusqlite::params![bsm_id, bordereau_id],
        )
        .map_err(|e| e.to_string())?;
    }

    // ── Étape 4 : Avancement de la mission existante (backward compat) ────
    if payload.mission_id.is_some() {
        avancer_statut_mission(&tx, mission_id, "chargement")?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    get_bordereau_by_id(&db, bordereau_id)
}

/// Modifie un bordereau en brouillon ; les lignes fournies remplacent
/// les précédentes. Le statut et la saison ne sont pas modifiables ici.
///
/// Gestion du BSM lié (EF5) :
/// - Cas A : bsm_id existant + gasoil renseigné → UPDATE du BSM lié ;
/// - Cas B : pas de bsm_id + gasoil quantité > 0 → CREATE BSM + liaison ;
/// - Cas C : bsm_id existant + gasoil vidé → BSM conservé (historique).
#[tauri::command]
pub fn modifier_bordereau(
    state: State<AppState>,
    id: i64,
    payload: ModifierBordereauPayload,
) -> Result<Bordereau, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    let bordereau = get_bordereau_by_id(&db, id)?;

    if bordereau.statut != "brouillon" {
        return Err("Seul un bordereau en brouillon peut être modifié.".into());
    }

    verifier_lignes(&db, &payload.lignes)?;
    verifier_numero_disponible(&db, &payload.numero, Some(id))?;
    verifier_camion(&db, payload.camion_id)?;
    if let Some(mission_id) = payload.mission_id {
        verifier_mission(&db, mission_id)?;
    }
    let type_fret = normaliser_type_fret(payload.type_fret.as_deref())?;

    // Validation gasoil (ENF5)
    let gasoil_quantite = payload.quantite_litres_gasoil.unwrap_or(0.0);
    if gasoil_quantite > 0.0 {
        let prix = payload.prix_litre_gasoil.unwrap_or(0.0);
        if prix <= 0.0 {
            return Err(
                "Le prix au litre du gasoil est requis si une quantité est saisie."
                    .to_string(),
            );
        }
    }

    // Lecture du bsm_id existant (pour Cas A / B / C)
    let bsm_id_existant: Option<i64> = db
        .query_row(
            "SELECT bsm_id FROM bordereaux WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get::<_, Option<i64>>(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .flatten();

    // On utilise mission_id du payload OU à défaut l'existant du bordereau
    // (nécessaire pour créer/modifier BSM).
    let mission_pour_bsm = payload
        .mission_id
        .or(bordereau.mission_id);

    let tx = db.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE bordereaux
         SET numero          = ?1,
             mission_id      = ?2,
             camion_id       = ?3,
             chauffeur_id    = ?4,
             usine_id        = ?5,
             cgi_id          = ?6,
             date_bordereau  = ?7,
             distance_km     = ?8,
             type_fret       = ?9,
             observations    = ?10,
             updated_at      = datetime('now')
         WHERE id = ?11",
        rusqlite::params![
            payload.numero,
            payload.mission_id,
            payload.camion_id,
            payload.chauffeur_id,
            payload.usine_id,
            payload.cgi_id,
            payload.date_bordereau,
            payload.distance_km,
            type_fret,
            payload.observations,
            id
        ],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "DELETE FROM lignes_bordereau WHERE bordereau_id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    inserer_lignes(&tx, id, &payload.lignes)?;

    // ── Gestion BSM ──────────────────────────────────────────────────────
    if gasoil_quantite > 0.0 {
        match bsm_id_existant {
            // Cas A : BSM existe + gasoil renseigné → UPDATE
            Some(bsm_id) => {
                tx.execute(
                    "UPDATE bsm
                     SET camion_id      = ?1,
                         usine_id       = ?2,
                         date_bsm       = ?3,
                         beneficiaire   = ?4,
                         quantite_litres = ?5,
                         prix_litre     = ?6,
                         imputation     = ?7,
                         reference      = ?8,
                         updated_at     = datetime('now')
                     WHERE id = ?9",
                    rusqlite::params![
                        payload.camion_id,
                        payload.usine_id,
                        payload.date_bordereau,
                        payload.beneficiaire_gasoil,
                        gasoil_quantite,
                        payload.prix_litre_gasoil.unwrap(),
                        payload.imputation_gasoil,
                        payload.reference_gasoil,
                        bsm_id,
                    ],
                )
                .map_err(|e| e.to_string())?;
            }
            // Cas B : pas de BSM + gasoil renseigné → CREATE + lier
            None => {
                let numero_bsm = generer_numero_document(
                    &tx,
                    "bsm",
                    "date_bsm",
                    "numero",
                    payload.date_bordereau.as_str(),
                )?;

                tx.execute(
                    "INSERT INTO bsm (numero, saison_id, mission_id, camion_id, usine_id,
                                      date_bsm, beneficiaire, quantite_litres, prix_litre,
                                      imputation, reference, statut)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'ouvert')",
                    rusqlite::params![
                        numero_bsm,
                        bordereau.saison_id,
                        mission_pour_bsm,
                        payload.camion_id,
                        payload.usine_id,
                        payload.date_bordereau,
                        payload.beneficiaire_gasoil,
                        gasoil_quantite,
                        payload.prix_litre_gasoil.unwrap(),
                        payload.imputation_gasoil,
                        payload.reference_gasoil,
                    ],
                )
                .map_err(|e| e.to_string())?;

                let nouveau_bsm_id = tx.last_insert_rowid();
                tx.execute(
                    "UPDATE bordereaux SET bsm_id = ?1 WHERE id = ?2",
                    rusqlite::params![nouveau_bsm_id, id],
                )
                .map_err(|e| e.to_string())?;
            }
        }
    }
    // Cas C : bsm_id existant + gasoil vidé → ne rien faire (historique
    // préservé). L'utilisateur peut passer le BSM en statut « cloture »
    // via la page dédiée si besoin (non supprimé).

    tx.commit().map_err(|e| e.to_string())?;
    get_bordereau_by_id(&db, id)
}

/// Valide un bordereau : le mouvement est figé.
///
/// Nouveau calcul (refonte 2026) :
/// 1. Poids à vide (tare) = `camion.capacite_tonnes * 1000` (enregistré lors
///    de la création du camion, il sert de tare par défaut pour toutes ses
///    missions).
/// 2. Poids net = somme des `poids_kg` de toutes les lignes du bordereau
///    (coton chargé, lots par AV).
/// 3. Poids chargé (brut) = poids_vide + poids_net (somme calculée, pas une
///    pesée physique).
/// 4. Tarification : LIGNE PAR LIGNE. Chaque ligne utilise son propre
///    `distance_km` (ou la distance globale du bordereau en fallback
///    historique). Les montants sont agrégés pour obtenir le total.
/// 5. Si une mission est rattachée, son statut avance à « déchargement ».
#[tauri::command]
pub fn valider_bordereau(state: State<AppState>, id: i64) -> Result<Bordereau, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let bordereau = get_bordereau_by_id(&db, id)?;

    if bordereau.statut != "brouillon" {
        return Err("Seul un bordereau en brouillon peut être validé.".into());
    }

    let lignes = lire_lignes(&db, id)?;
    if lignes.is_empty() {
        return Err("Ajoutez au moins une ligne (AV et poids) avant de valider le bordereau.".into());
    }

    // 1. Poids à vide (tare) → capacité du camion × 1000
    let capacite_tonnes: Option<f64> = db
        .query_row(
            "SELECT capacite_tonnes FROM camions WHERE id = ?1",
            rusqlite::params![bordereau.camion_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .flatten();

    let poids_vide_kg: Option<f64> = capacite_tonnes.map(|c| c * 1000.0);
    if poids_vide_kg.is_none() {
        return Err(
            "Le camion n'a pas de capacité renseignée (tonnes). Renseignez-la avant de valider : elle sert de tare par défaut."
                .into(),
        );
    }
    let poids_vide = poids_vide_kg.unwrap();

    // 2. Poids net = somme des poids des lignes (coton chargé)
    let somme_lignes_poids: f64 = lignes.iter().map(|l| l.poids_kg).sum();
    let poids_net = somme_lignes_poids.max(0.0);

    // 3. Poids chargé (brut) = tare + coton chargé
    let poids_charge = poids_vide + poids_net;

    // Distance globale = somme des distances ligne par ligne (si au moins une
    // ligne en possède) ; fallback sur bordereau.distance_km pour l'historique.
    let somme_lignes_distance: f64 = lignes
        .iter()
        .map(|l| l.distance_km.unwrap_or(0.0))
        .sum();
    let distance_globale = if somme_lignes_distance > 0.0 {
        Some(somme_lignes_distance)
    } else {
        bordereau.distance_km
    };

    // 4. Tarification LIGNE PAR LIGNE
    let type_fret = bordereau
        .type_fret
        .clone()
        .unwrap_or_else(|| "direct".to_string());
    let saison_id = bordereau.saison_id;

    let mut montant_total: f64 = 0.0;
    let mut premier_tarif_applique: Option<f64> = None;
    let mut premier_unite_tarif: Option<String> = None;

    for ligne in &lignes {
        let distance_ligne = match ligne.distance_km {
            Some(d) if d > 0.0 => d,
            _ => match bordereau.distance_km {
                Some(d) if d > 0.0 => d,
                _ => {
                    return Err(format!(
                        "Ligne #{} (AV #{:?}) : distance (km) non renseignée ni sur la ligne ni globalement sur le bordereau. Renseignez la distance avant de valider.",
                        ligne.id, ligne.av_id
                    ));
                }
            },
        };
        let calcul = tarification::calculer(
            &db,
            saison_id,
            &type_fret,
            distance_ligne,
            ligne.poids_kg,
        )?;
        montant_total += calcul.montant_brut;
        if premier_tarif_applique.is_none() {
            premier_tarif_applique = Some(calcul.tarif_applique);
            premier_unite_tarif = Some(calcul.unite_tarif);
        }
    }

    let tarif_applique = premier_tarif_applique.unwrap_or(0.0);
    let unite_tarif = premier_unite_tarif.unwrap_or_else(|| "fcfa_tonne".to_string());

    // 5. Persistance : poids_vide (tare camion) + poids_charge (brut calculé)
    //    permettent à la colonne GENERATED `poids_net_kg` du schéma de valoir
    //    automatiquement MAX(0, poids_charge_kg - poids_vide_kg).
    //    On ajoute distance globale agrégée, tarif (1ère ligne, informative)
    //    et montant total.
    //    Note : on ne touche JAMAIS à poids_net_kg (colonne générée).
    db.execute(
        "UPDATE bordereaux
         SET poids_vide_kg   = ?1,
             poids_charge_kg = ?2,
             distance_km     = COALESCE(?3, distance_km),
             type_fret       = ?4,
             tarif_applique  = ?5,
             unite_tarif     = ?6,
             montant_brut    = ?7,
             statut          = 'valide',
             updated_at      = datetime('now')
         WHERE id = ?8",
        rusqlite::params![
            poids_vide,
            poids_charge,
            distance_globale,
            type_fret,
            tarif_applique,
            unite_tarif,
            montant_total,
            id
        ],
    )
    .map_err(|e| e.to_string())?;

    // 6. Avancement de mission (si rattachée) : déchargement
    if let Some(mission_id) = bordereau.mission_id {
        avancer_statut_mission(&db, mission_id, "dechargement")?;
    }

    get_bordereau_by_id(&db, id)
}

/// Remet un bordereau validé en brouillon (correction de saisie).
#[tauri::command]
pub fn devalider_bordereau(state: State<AppState>, id: i64) -> Result<Bordereau, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let bordereau = get_bordereau_by_id(&db, id)?;

    if bordereau.statut != "valide" {
        return Err("Seul un bordereau validé peut être remis en brouillon.".into());
    }

    db.execute(
        "UPDATE bordereaux
         SET statut     = 'brouillon',
             updated_at = datetime('now')
         WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    get_bordereau_by_id(&db, id)
}

// ─── Aide interne ─────────────────────────────────────────────────────────────
/// Type de fret du contrat (CDC v1.1) : « direct » par défaut, une valeur
/// inconnue est refusée.
fn normaliser_type_fret(type_fret: Option<&str>) -> Result<String, String> {
    match type_fret {
        None | Some("") => Ok("direct".to_string()),
        Some(t) if tarification::TYPES_FRET.contains(&t) => Ok(t.to_string()),
        Some(_) => Err("Type de fret invalide.".into()),
    }
}

/// Les numéros de bordereau sont pré-numérotés : ils doivent rester uniques.
fn verifier_numero_disponible(
    db: &rusqlite::Connection,
    numero: &str,
    id_exclu: Option<i64>,
) -> Result<(), String> {
    let nb: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM bordereaux WHERE numero = ?1 AND (?2 IS NULL OR id != ?2)",
            rusqlite::params![numero, id_exclu],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if nb > 0 {
        return Err(format!(
            "Le numéro de bordereau « {} » est déjà utilisé.",
            numero
        ));
    }
    Ok(())
}

fn verifier_lignes(
    db: &rusqlite::Connection,
    lignes: &[LigneBordereauPayload],
) -> Result<(), String> {
    if lignes.is_empty() {
        return Err("Ajoutez au moins une ligne (AV et poids).".into());
    }
    for (i, ligne) in lignes.iter().enumerate() {
        if ligne.poids_kg <= 0.0 {
            return Err(format!(
                "Ligne #{} : le poids doit être supérieur à 0.",
                i + 1
            ));
        }
        if ligne.av_id.is_none() {
            return Err(format!(
                "Ligne #{} : un AV (Aire de Vente) est requis. Sélectionnez un AV existant ou créez-en un nouveau via le bouton « + » du champ AV.",
                i + 1
            ));
        }
        if let Some(av_id) = ligne.av_id {
            let existe: i64 = db
                .query_row(
                    "SELECT COUNT(*) FROM avs WHERE id = ?1",
                    rusqlite::params![av_id],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;
            if existe == 0 {
                return Err(format!(
                    "Ligne #{} : AV #{} introuvable dans la base. Essayez d'invalider le cache de la page (F5) avant de réessayer.",
                    i + 1,
                    av_id
                ));
            }
        }
    }
    Ok(())
}

fn verifier_camion(db: &rusqlite::Connection, camion_id: i64) -> Result<(), String> {
    let existe: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM camions WHERE id = ?1",
            rusqlite::params![camion_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if existe == 0 {
        return Err("Camion introuvable.".into());
    }
    Ok(())
}

fn verifier_mission(db: &rusqlite::Connection, mission_id: i64) -> Result<(), String> {
    let existe: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM missions WHERE id = ?1",
            rusqlite::params![mission_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if existe == 0 {
        return Err("Mission introuvable.".into());
    }
    Ok(())
}

fn inserer_lignes(
    db: &rusqlite::Connection,
    bordereau_id: i64,
    lignes: &[LigneBordereauPayload],
) -> Result<(), String> {
    for ligne in lignes {
        db.execute(
            "INSERT INTO lignes_bordereau (bordereau_id, av_id, localite, poids_kg, distance_km, code, observations)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                bordereau_id,
                ligne.av_id,
                ligne.localite,
                ligne.poids_kg,
                ligne.distance_km,
                ligne.code,
                ligne.observations,
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn lire_lignes(
    db: &rusqlite::Connection,
    bordereau_id: i64,
) -> Result<Vec<LigneBordereau>, String> {
    let mut stmt = db
        .prepare(
            "SELECT id, bordereau_id, av_id, localite, poids_kg, distance_km, code, observations
             FROM lignes_bordereau
             WHERE bordereau_id = ?1
             ORDER BY id ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![bordereau_id], |row| {
            Ok(LigneBordereau {
                id: row.get(0)?,
                bordereau_id: row.get(1)?,
                av_id: row.get(2)?,
                localite: row.get(3)?,
                poids_kg: row.get(4)?,
                distance_km: row.get(5)?,
                code: row.get(6)?,
                observations: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Poids à vide et poids chargé issus des pesées de la mission (saisie unique).
fn lire_poids_pesees(
    db: &rusqlite::Connection,
    mission_id: i64,
) -> Result<(Option<f64>, Option<f64>), String> {
    let poids_vide: Option<f64> = db
        .query_row(
            "SELECT poids_kg FROM pesees
             WHERE mission_id = ?1 AND type_pesee = 'vide'
             ORDER BY id ASC LIMIT 1",
            rusqlite::params![mission_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let poids_charge: Option<f64> = db
        .query_row(
            "SELECT poids_kg FROM pesees
             WHERE mission_id = ?1 AND type_pesee = 'charge'
             ORDER BY id ASC LIMIT 1",
            rusqlite::params![mission_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    Ok((poids_vide, poids_charge))
}

/// Reprend les poids vide/chargé des pesées de la mission, lorsqu'elles existent.
fn synchroniser_poids_depuis_pesees(
    db: &rusqlite::Connection,
    bordereau_id: i64,
    mission_id: i64,
) -> Result<(), String> {
    let (poids_vide, poids_charge) = lire_poids_pesees(db, mission_id)?;
    db.execute(
        "UPDATE bordereaux
         SET poids_vide_kg   = COALESCE(?1, poids_vide_kg),
             poids_charge_kg = COALESCE(?2, poids_charge_kg),
             updated_at      = datetime('now')
         WHERE id = ?3",
        rusqlite::params![poids_vide, poids_charge, bordereau_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn get_bordereau_by_id(db: &rusqlite::Connection, id: i64) -> Result<Bordereau, String> {
    db.query_row(
        "SELECT id, numero, saison_id, mission_id, bsm_id, camion_id, chauffeur_id, usine_id,
                cgi_id, date_bordereau, poids_vide_kg, poids_charge_kg, poids_net_kg,
                distance_km, type_fret, tarif_applique, unite_tarif, montant_brut,
                statut, observations, created_at, updated_at
         FROM bordereaux WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Bordereau {
                id: row.get(0)?,
                numero: row.get(1)?,
                saison_id: row.get(2)?,
                mission_id: row.get(3)?,
                bsm_id: row.get(4)?,
                camion_id: row.get(5)?,
                chauffeur_id: row.get(6)?,
                usine_id: row.get(7)?,
                cgi_id: row.get(8)?,
                date_bordereau: row.get(9)?,
                poids_vide_kg: row.get(10)?,
                poids_charge_kg: row.get(11)?,
                poids_net_kg: row.get(12)?,
                distance_km: row.get(13)?,
                type_fret: row.get(14)?,
                tarif_applique: row.get(15)?,
                unite_tarif: row.get(16)?,
                montant_brut: row.get(17)?,
                statut: row.get(18)?,
                observations: row.get(19)?,
                created_at: row.get(20)?,
                updated_at: row.get(21)?,
            })
        },
    )
    .map_err(|_| "Bordereau introuvable.".to_string())
}
