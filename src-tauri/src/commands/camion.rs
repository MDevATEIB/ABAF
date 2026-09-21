use crate::db::AppState;
use crate::models::camion::{Camion, CreerCamionPayload, ModifierCamionPayload};
use tauri::State;

/// Liste tous les camions, actifs en premier.
#[tauri::command]
pub fn lister_camions(state: State<AppState>) -> Result<Vec<Camion>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, immatriculation, marque, modele, capacite_tonnes, actif, created_at, updated_at
             FROM camions
             ORDER BY actif DESC, immatriculation ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Camion {
                id: row.get(0)?,
                immatriculation: row.get(1)?,
                marque: row.get(2)?,
                modele: row.get(3)?,
                capacite_tonnes: row.get(4)?,
                actif: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut camions = Vec::new();
    for row in rows {
        camions.push(row.map_err(|e| e.to_string())?);
    }
    Ok(camions)
}

/// Crée un camion. L'immatriculation doit être unique.
#[tauri::command]
pub fn creer_camion(
    state: State<AppState>,
    payload: CreerCamionPayload,
) -> Result<Camion, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO camions (immatriculation, marque, modele, capacite_tonnes)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            payload.immatriculation,
            payload.marque,
            payload.modele,
            payload.capacite_tonnes
        ],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Cette immatriculation est déjà enregistrée.".into()
        } else {
            e.to_string()
        }
    })?;

    let id = db.last_insert_rowid();
    get_camion_by_id(&db, id)
}

/// Modifie un camion existant.
#[tauri::command]
pub fn modifier_camion(
    state: State<AppState>,
    id: i64,
    payload: ModifierCamionPayload,
) -> Result<Camion, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let camion = get_camion_by_id(&db, id)?;

    db.execute(
        "UPDATE camions
         SET immatriculation = ?1,
             marque          = ?2,
             modele          = ?3,
             capacite_tonnes = ?4,
             updated_at      = datetime('now')
         WHERE id = ?5",
        rusqlite::params![
            payload.immatriculation.unwrap_or(camion.immatriculation),
            payload.marque.or(camion.marque),
            payload.modele.or(camion.modele),
            payload.capacite_tonnes.or(camion.capacite_tonnes),
            id
        ],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Cette immatriculation est déjà enregistrée.".into()
        } else {
            e.to_string()
        }
    })?;

    get_camion_by_id(&db, id)
}

/// Bascule l'état actif/inactif d'un camion.
#[tauri::command]
pub fn desactiver_camion(state: State<AppState>, id: i64) -> Result<Camion, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE camions
         SET actif      = CASE WHEN actif = 1 THEN 0 ELSE 1 END,
             updated_at = datetime('now')
         WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    get_camion_by_id(&db, id)
}

// ─── Aide interne ─────────────────────────────────────────────────────────────
fn get_camion_by_id(db: &rusqlite::Connection, id: i64) -> Result<Camion, String> {
    db.query_row(
        "SELECT id, immatriculation, marque, modele, capacite_tonnes, actif, created_at, updated_at
         FROM camions WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Camion {
                id: row.get(0)?,
                immatriculation: row.get(1)?,
                marque: row.get(2)?,
                modele: row.get(3)?,
                capacite_tonnes: row.get(4)?,
                actif: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        },
    )
    .map_err(|_| "Camion introuvable.".to_string())
}
