// Commandes Tauri - module client (Phase 4)
use crate::db::AppState;
use crate::models::client::Client;
use tauri::State;

/// Liste les clients (référentiel alimenté au fil des facturations ;
/// COTONTCHAD SN est créé par la migration initiale).
#[tauri::command]
pub fn lister_clients(state: State<AppState>) -> Result<Vec<Client>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, nom, adresse, telephone, created_at, updated_at
             FROM clients
             ORDER BY nom",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Client {
                id: row.get(0)?,
                nom: row.get(1)?,
                adresse: row.get(2)?,
                telephone: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}
