// Commandes Tauri - module bordereau (Phase 3)
use crate::db::AppState;
use crate::models::bordereau::{
    CreerBordereauPayload, LigneBordereau, LigneBordereauPayload, ModifierBordereauPayload,
    Bordereau,
};
use crate::models::mission::avancer_statut_mission;
use crate::services::tarification;
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
            "SELECT id, numero, saison_id, mission_id, camion_id, chauffeur_id, usine_id,
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
                camion_id: row.get(4)?,
                chauffeur_id: row.get(5)?,
                usine_id: row.get(6)?,
                cgi_id: row.get(7)?,
                date_bordereau: row.get(8)?,
                poids_vide_kg: row.get(9)?,
                poids_charge_kg: row.get(10)?,
                poids_net_kg: row.get(11)?,
                distance_km: row.get(12)?,
                type_fret: row.get(13)?,
                tarif_applique: row.get(14)?,
                unite_tarif: row.get(15)?,
                montant_brut: row.get(16)?,
                statut: row.get(17)?,
                observations: row.get(18)?,
                created_at: row.get(19)?,
                updated_at: row.get(20)?,
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
/// - si le bordereau est rattaché à une mission, son statut avance vers
///   « chargement » (fait constaté) et les poids vide/chargé disponibles
///   sont repris automatiquement des pesées de la mission.
#[tauri::command]
pub fn creer_bordereau(
    state: State<AppState>,
    payload: CreerBordereauPayload,
) -> Result<Bordereau, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;

    verifier_lignes(&payload.lignes)?;
    verifier_numero_disponible(&db, &payload.numero, None)?;
    verifier_camion(&db, payload.camion_id)?;
    if let Some(mission_id) = payload.mission_id {
        verifier_mission(&db, mission_id)?;
    }
    let type_fret = normaliser_type_fret(payload.type_fret.as_deref())?;

    let tx = db.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO bordereaux (numero, saison_id, mission_id, camion_id, chauffeur_id,
                                 usine_id, cgi_id, date_bordereau, distance_km, type_fret,
                                 observations, statut)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'brouillon')",
        rusqlite::params![
            payload.numero,
            payload.saison_id,
            payload.mission_id,
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

    let id = tx.last_insert_rowid();
    inserer_lignes(&tx, id, &payload.lignes)?;

    if let Some(mission_id) = payload.mission_id {
        synchroniser_poids_depuis_pesees(&tx, id, mission_id)?;
        avancer_statut_mission(&tx, mission_id, "chargement")?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    get_bordereau_by_id(&db, id)
}

/// Modifie un bordereau en brouillon ; les lignes fournies remplacent
/// les précédentes. Le statut et la saison ne sont pas modifiables ici.
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

    verifier_lignes(&payload.lignes)?;
    verifier_numero_disponible(&db, &payload.numero, Some(id))?;
    verifier_camion(&db, payload.camion_id)?;
    if let Some(mission_id) = payload.mission_id {
        verifier_mission(&db, mission_id)?;
    }
    let type_fret = normaliser_type_fret(payload.type_fret.as_deref())?;

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

    // Les pesées ont pu être enregistrées entre-temps : reprendre
    // les poids disponibles (sans écraser une valeur déjà connue si la
    // pesée correspondante n'existe pas encore).
    if let Some(mission_id) = payload.mission_id {
        synchroniser_poids_depuis_pesees(&tx, id, mission_id)?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    get_bordereau_by_id(&db, id)
}

/// Valide un bordereau : le mouvement est figé, le poids net officiel est
/// calculé à partir des pesées de la mission (saisie unique), le tarif
/// applicable et le montant brut sont figés (CDC v1.1) et la mission avance
/// à l'étape « déchargement » (traçabilité de la livraison).
#[tauri::command]
pub fn valider_bordereau(state: State<AppState>, id: i64) -> Result<Bordereau, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let bordereau = get_bordereau_by_id(&db, id)?;

    if bordereau.statut != "brouillon" {
        return Err("Seul un bordereau en brouillon peut être validé.".into());
    }

    let mission_id = bordereau.mission_id.ok_or_else(|| {
        "Rattachez le bordereau à une mission avant de le valider.".to_string()
    })?;

    let nb_lignes: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM lignes_bordereau WHERE bordereau_id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if nb_lignes == 0 {
        return Err("Ajoutez au moins une ligne (AV et poids) avant de valider le bordereau.".into());
    }

    let (poids_vide, poids_charge) = lire_poids_pesees(&db, mission_id)?;
    let (Some(poids_vide), Some(poids_charge)) = (poids_vide, poids_charge) else {
        return Err(
            "Enregistrez les pesées à vide et chargée de la mission avant de valider le bordereau."
                .into(),
        );
    };

    let distance = bordereau.distance_km.ok_or_else(|| {
        "Renseignez la distance du bordereau avant de le valider : elle détermine le tarif applicable."
            .to_string()
    })?;

    // Le tarif applicable est figé à la validation (CDC v1.1) à partir du
    // type de fret du bordereau (défaut « direct ») et du poids net des pesées.
    let type_fret = bordereau
        .type_fret
        .clone()
        .unwrap_or_else(|| "direct".to_string());
    let poids_net = (poids_charge - poids_vide).max(0.0);
    let calcul = tarification::calculer(&db, bordereau.saison_id, &type_fret, distance, poids_net)?;

    db.execute(
        "UPDATE bordereaux
         SET poids_vide_kg   = ?1,
             poids_charge_kg = ?2,
             type_fret       = ?3,
             tarif_applique  = ?4,
             unite_tarif     = ?5,
             montant_brut    = ?6,
             statut          = 'valide',
             updated_at      = datetime('now')
         WHERE id = ?7",
        rusqlite::params![
            poids_vide,
            poids_charge,
            type_fret,
            calcul.tarif_applique,
            calcul.unite_tarif,
            calcul.montant_brut,
            id
        ],
    )
    .map_err(|e| e.to_string())?;

    // Le bordereau validé atteste la livraison : la mission avance à
    // l'étape « déchargement » (jamais de régression).
    avancer_statut_mission(&db, mission_id, "dechargement")?;

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

fn verifier_lignes(lignes: &[LigneBordereauPayload]) -> Result<(), String> {
    if lignes.is_empty() {
        return Err("Ajoutez au moins une ligne (AV et poids).".into());
    }
    for ligne in lignes {
        if ligne.poids_kg <= 0.0 {
            return Err("Le poids d'une ligne doit être supérieur à 0.".into());
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
            "INSERT INTO lignes_bordereau (bordereau_id, av_id, localite, poids_kg, code, observations)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                bordereau_id,
                ligne.av_id,
                ligne.localite,
                ligne.poids_kg,
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
            "SELECT id, bordereau_id, av_id, localite, poids_kg, code, observations
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
                code: row.get(5)?,
                observations: row.get(6)?,
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
        "SELECT id, numero, saison_id, mission_id, camion_id, chauffeur_id, usine_id,
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
                camion_id: row.get(4)?,
                chauffeur_id: row.get(5)?,
                usine_id: row.get(6)?,
                cgi_id: row.get(7)?,
                date_bordereau: row.get(8)?,
                poids_vide_kg: row.get(9)?,
                poids_charge_kg: row.get(10)?,
                poids_net_kg: row.get(11)?,
                distance_km: row.get(12)?,
                type_fret: row.get(13)?,
                tarif_applique: row.get(14)?,
                unite_tarif: row.get(15)?,
                montant_brut: row.get(16)?,
                statut: row.get(17)?,
                observations: row.get(18)?,
                created_at: row.get(19)?,
                updated_at: row.get(20)?,
            })
        },
    )
    .map_err(|_| "Bordereau introuvable.".to_string())
}
