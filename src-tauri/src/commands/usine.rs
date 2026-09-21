use crate::db::AppState;
use crate::models::usine::{CreerUsinePayload, ModifierUsinePayload, Usine};
use tauri::State;

/// Liste toutes les usines triÃ©es par nom.
#[tauri::command]
pub fn lister_usines(state: State<AppState>) -> Result<Vec<Usine>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, nom, localite, created_at, updated_at
             FROM usines ORDER BY nom ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Usine {
                id: row.get(0)?,
                nom: row.get(1)?,
                localite: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut usines = Vec::new();
    for row in rows {
        usines.push(row.map_err(|e| e.to_string())?);
    }
    Ok(usines)
}

/// CrÃ©e une usine. Le nom doit Ãªtre unique.
#[tauri::command]
pub fn creer_usine(
    state: State<AppState>,
    payload: CreerUsinePayload,
) -> Result<Usine, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO usines (nom, localite) VALUES (?1, ?2)",
        rusqlite::params![payload.nom, payload.localite],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Ce nom d'usine est dÃ©jÃ  enregistrÃ©.".into()
        } else {
            e.to_string()
        }
    })?;

    let id = db.last_insert_rowid();
    get_usine_by_id(&db, id)
}

/// Modifie une usine existante.
#[tauri::command]
pub fn modifier_usine(
    state: State<AppState>,
    id: i64,
    payload: ModifierUsinePayload,
) -> Result<Usine, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let usine = get_usine_by_id(&db, id)?;

    db.execute(
        "UPDATE usines
         SET nom        = ?1,
             localite   = ?2,
             updated_at = datetime('now')
         WHERE id = ?3",
        rusqlite::params![
            payload.nom.unwrap_or(usine.nom),
            payload.localite.or(usine.localite),
            id
        ],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Ce nom d'usine est dÃ©jÃ  enregistrÃ©.".into()
        } else {
            e.to_string()
        }
    })?;

    get_usine_by_id(&db, id)
}

// â”€â”€â”€ Aide interne â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
pub fn get_usine_by_id(db: &rusqlite::Connection, id: i64) -> Result<Usine, String> {
    db.query_row(
        "SELECT id, nom, localite, created_at, updated_at FROM usines WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Usine {
                id: row.get(0)?,
                nom: row.get(1)?,
                localite: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    )
    .map_err(|_| "Usine introuvable.".to_string())
}
