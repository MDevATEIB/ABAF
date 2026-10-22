use crate::db::AppState;
use crate::models::tarif::{CreerTarifPayload, ModifierTarifPayload, Tarif};
use crate::services::tarification::{TYPES_FRET, UNITES_TARIF};
use tauri::State;

/// Liste tous les tarifs d'une saison, triés par type de fret puis par
/// distance croissante.
#[tauri::command]
pub fn lister_tarifs(state: State<AppState>, saison_id: i64) -> Result<Vec<Tarif>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, saison_id, type_fret, distance_min, distance_max, unite_tarif,
                    tarif, created_at, updated_at
             FROM tarifs
             WHERE saison_id = ?1
             ORDER BY type_fret ASC, distance_min ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![saison_id], |row| {
            Ok(Tarif {
                id: row.get(0)?,
                saison_id: row.get(1)?,
                type_fret: row.get(2)?,
                distance_min: row.get(3)?,
                distance_max: row.get(4)?,
                unite_tarif: row.get(5)?,
                tarif: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tarifs = Vec::new();
    for row in rows {
        tarifs.push(row.map_err(|e| e.to_string())?);
    }
    Ok(tarifs)
}

/// Crée une tranche du barème pour une saison ouverte. Vérifie les valeurs et
/// l'absence de chevauchement pour le même type de fret.
#[tauri::command]
pub fn creer_tarif(state: State<AppState>, payload: CreerTarifPayload) -> Result<Tarif, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    verifier_saison_ouverte(&db, payload.saison_id)?;
    verifier_valeurs(
        &payload.type_fret,
        &payload.unite_tarif,
        payload.distance_min,
        payload.distance_max,
        payload.tarif,
    )?;
    verifier_pas_chevauchement(
        &db,
        payload.saison_id,
        &payload.type_fret,
        None,
        payload.distance_min,
        payload.distance_max,
    )?;

    db.execute(
        "INSERT INTO tarifs (saison_id, type_fret, distance_min, distance_max, unite_tarif, tarif)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            payload.saison_id,
            payload.type_fret,
            payload.distance_min,
            payload.distance_max,
            payload.unite_tarif,
            payload.tarif
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = db.last_insert_rowid();
    get_tarif_by_id(&db, id)
}

/// Modifie une tranche existante si la saison est ouverte.
#[tauri::command]
pub fn modifier_tarif(
    state: State<AppState>,
    id: i64,
    payload: ModifierTarifPayload,
) -> Result<Tarif, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let tarif = get_tarif_by_id(&db, id)?;
    verifier_saison_ouverte(&db, tarif.saison_id)?;
    verifier_valeurs(
        &payload.type_fret,
        &payload.unite_tarif,
        payload.distance_min,
        payload.distance_max,
        payload.tarif,
    )?;
    verifier_pas_chevauchement(
        &db,
        tarif.saison_id,
        &payload.type_fret,
        Some(id),
        payload.distance_min,
        payload.distance_max,
    )?;

    db.execute(
        "UPDATE tarifs
         SET type_fret    = ?1,
             distance_min = ?2,
             distance_max = ?3,
             unite_tarif  = ?4,
             tarif        = ?5,
             updated_at   = datetime('now')
         WHERE id = ?6",
        rusqlite::params![
            payload.type_fret,
            payload.distance_min,
            payload.distance_max,
            payload.unite_tarif,
            payload.tarif,
            id
        ],
    )
    .map_err(|e| e.to_string())?;

    get_tarif_by_id(&db, id)
}

/// Supprime une tranche si la saison est ouverte.
#[tauri::command]
pub fn supprimer_tarif(state: State<AppState>, id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let tarif = get_tarif_by_id(&db, id)?;
    verifier_saison_ouverte(&db, tarif.saison_id)?;

    db.execute("DELETE FROM tarifs WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Aides internes ──────────────────────────────────────────────────────────
fn get_tarif_by_id(db: &rusqlite::Connection, id: i64) -> Result<Tarif, String> {
    db.query_row(
        "SELECT id, saison_id, type_fret, distance_min, distance_max, unite_tarif,
                tarif, created_at, updated_at
         FROM tarifs WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Tarif {
                id: row.get(0)?,
                saison_id: row.get(1)?,
                type_fret: row.get(2)?,
                distance_min: row.get(3)?,
                distance_max: row.get(4)?,
                unite_tarif: row.get(5)?,
                tarif: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    )
    .map_err(|_| "Tarif introuvable.".to_string())
}

fn verifier_saison_ouverte(db: &rusqlite::Connection, saison_id: i64) -> Result<(), String> {
    let statut: String = db
        .query_row(
            "SELECT statut FROM saisons WHERE id = ?1",
            rusqlite::params![saison_id],
            |row| row.get(0),
        )
        .map_err(|_| "Saison introuvable.".to_string())?;

    if statut != "ouverte" {
        Err("Cette opération n'est possible que sur une saison ouverte.".into())
    } else {
        Ok(())
    }
}

/// Vérifie la cohérence de la tranche : types du contrat, bornes de distance
/// et tarif strictement positif.
fn verifier_valeurs(
    type_fret: &str,
    unite_tarif: &str,
    distance_min: f64,
    distance_max: Option<f64>,
    tarif: f64,
) -> Result<(), String> {
    if !TYPES_FRET.contains(&type_fret) {
        return Err("Type de fret invalide.".into());
    }
    if !UNITES_TARIF.contains(&unite_tarif) {
        return Err("Unité de tarification invalide.".into());
    }
    if !distance_min.is_finite() || distance_min < 0.0 {
        return Err("La distance de début doit être un nombre positif.".into());
    }
    if let Some(max) = distance_max {
        if !max.is_finite() || max <= distance_min {
            return Err("La distance de fin doit être supérieure à la distance de début.".into());
        }
    }
    if !tarif.is_finite() || tarif <= 0.0 {
        return Err("Le tarif doit être un nombre strictement positif.".into());
    }
    Ok(())
}

/// Refuse une tranche qui chevauche une autre tranche de la même saison et du
/// même type de fret. Une tranche ouverte (`distance_max` NULL) couvre
/// l'intervalle [distance_min, +∞[.
fn verifier_pas_chevauchement(
    db: &rusqlite::Connection,
    saison_id: i64,
    type_fret: &str,
    exclure_id: Option<i64>,
    distance_min: f64,
    distance_max: Option<f64>,
) -> Result<(), String> {
    let exclure = exclure_id.unwrap_or(-1);
    let fin = distance_max.unwrap_or(f64::INFINITY);
    let count: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM tarifs
             WHERE saison_id = ?1
               AND type_fret = ?2
               AND id != ?3
               AND distance_min < ?5
               AND COALESCE(distance_max, ?6) > ?4",
            rusqlite::params![saison_id, type_fret, exclure, distance_min, fin, f64::INFINITY],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if count > 0 {
        Err("Cette tranche chevauche un tarif existant pour ce type de fret.".into())
    } else {
        Ok(())
    }
}
