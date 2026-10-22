use crate::db::AppState;
use crate::models::prix_gasoil::{PrixGasoil, SetPrixGasoilPayload};
use tauri::State;

/// Retourne le prix du gasoil pour une saison donnÃ©e (None si non dÃ©fini).
#[tauri::command]
pub fn get_prix_gasoil(
    state: State<AppState>,
    saison_id: i64,
) -> Result<Option<PrixGasoil>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let result = db.query_row(
        "SELECT id, saison_id, prix_litre, created_at, updated_at
         FROM prix_gasoil WHERE saison_id = ?1",
        rusqlite::params![saison_id],
        |row| {
            Ok(PrixGasoil {
                id: row.get(0)?,
                saison_id: row.get(1)?,
                prix_litre: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    );

    match result {
        Ok(p) => Ok(Some(p)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// CrÃ©e ou met Ã  jour le prix du gasoil pour une saison ouverte (upsert).
#[tauri::command]
pub fn set_prix_gasoil(
    state: State<AppState>,
    payload: SetPrixGasoilPayload,
) -> Result<PrixGasoil, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // VÃ©rifie que la saison est ouverte
    let statut: String = db
        .query_row(
            "SELECT statut FROM saisons WHERE id = ?1",
            rusqlite::params![payload.saison_id],
            |row| row.get(0),
        )
        .map_err(|_| "Saison introuvable.".to_string())?;

    if statut != "ouverte" {
        return Err("Cette opÃ©ration n'est possible que sur une saison ouverte.".into());
    }

    // UPSERT : si un prix existe dÃ©jÃ  pour cette saison, on le met Ã  jour
    db.execute(
        "INSERT INTO prix_gasoil (saison_id, prix_litre)
         VALUES (?1, ?2)
         ON CONFLICT(saison_id) DO UPDATE SET
             prix_litre = excluded.prix_litre,
             updated_at = datetime('now')",
        rusqlite::params![payload.saison_id, payload.prix_litre],
    )
    .map_err(|e| e.to_string())?;

    db.query_row(
        "SELECT id, saison_id, prix_litre, created_at, updated_at
         FROM prix_gasoil WHERE saison_id = ?1",
        rusqlite::params![payload.saison_id],
        |row| {
            Ok(PrixGasoil {
                id: row.get(0)?,
                saison_id: row.get(1)?,
                prix_litre: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}
