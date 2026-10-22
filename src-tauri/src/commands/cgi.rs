use crate::db::AppState;
use crate::models::cgi::{Cgi, CreerCgiPayload, ModifierCgiPayload};
use tauri::State;

/// Liste tous les CGI, avec filtre optionnel par usine.
#[tauri::command]
pub fn lister_cgis(
    state: State<AppState>,
    usine_id: Option<i64>,
) -> Result<Vec<Cgi>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // On prépare une seule requête ; si usine_id vaut None on filtre sur NULL IS NULL (toujours vrai)
    let mut stmt = db
        .prepare(
            "SELECT id, nom, usine_id, localite, created_at, updated_at
             FROM cgis
             WHERE (?1 IS NULL OR usine_id = ?1)
             ORDER BY nom ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![usine_id], |row| {
            Ok(Cgi {
                id: row.get(0)?,
                nom: row.get(1)?,
                usine_id: row.get(2)?,
                localite: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Crée un CGI. Le nom doit être unique par usine.
#[tauri::command]
pub fn creer_cgi(
    state: State<AppState>,
    payload: CreerCgiPayload,
) -> Result<Cgi, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO cgis (nom, usine_id, localite) VALUES (?1, ?2, ?3)",
        rusqlite::params![payload.nom, payload.usine_id, payload.localite],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Un CGI avec ce nom existe déjà pour cette usine.".into()
        } else {
            e.to_string()
        }
    })?;

    let id = db.last_insert_rowid();
    get_cgi_by_id(&db, id)
}

/// Modifie un CGI existant.
#[tauri::command]
pub fn modifier_cgi(
    state: State<AppState>,
    id: i64,
    payload: ModifierCgiPayload,
) -> Result<Cgi, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let cgi = get_cgi_by_id(&db, id)?;

    db.execute(
        "UPDATE cgis
         SET nom        = ?1,
             usine_id   = ?2,
             localite   = ?3,
             updated_at = datetime('now')
         WHERE id = ?4",
        rusqlite::params![
            payload.nom.unwrap_or(cgi.nom),
            payload.usine_id.unwrap_or(cgi.usine_id),
            payload.localite.or(cgi.localite),
            id
        ],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Un CGI avec ce nom existe déjà pour cette usine.".into()
        } else {
            e.to_string()
        }
    })?;

    get_cgi_by_id(&db, id)
}

// ─── Aide interne ─────────────────────────────────────────────────────────────
pub fn get_cgi_by_id(db: &rusqlite::Connection, id: i64) -> Result<Cgi, String> {
    db.query_row(
        "SELECT id, nom, usine_id, localite, created_at, updated_at FROM cgis WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Cgi {
                id: row.get(0)?,
                nom: row.get(1)?,
                usine_id: row.get(2)?,
                localite: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        },
    )
    .map_err(|_| "CGI introuvable.".to_string())
}
