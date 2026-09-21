use crate::db::AppState;
use crate::models::av::{Av, CreerAvPayload, ModifierAvPayload};
use tauri::State;

/// Liste tous les AV, avec filtre optionnel par CGI.
#[tauri::command]
pub fn lister_avs(
    state: State<AppState>,
    cgi_id: Option<i64>,
) -> Result<Vec<Av>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare(
            "SELECT id, nom, cgi_id, localite, created_at, updated_at
             FROM avs
             WHERE (?1 IS NULL OR cgi_id = ?1)
             ORDER BY nom ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![cgi_id], |row| {
            Ok(Av {
                id: row.get(0)?,
                nom: row.get(1)?,
                cgi_id: row.get(2)?,
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

/// Crée un AV.
#[tauri::command]
pub fn creer_av(
    state: State<AppState>,
    payload: CreerAvPayload,
) -> Result<Av, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO avs (nom, cgi_id, localite) VALUES (?1, ?2, ?3)",
        rusqlite::params![payload.nom, payload.cgi_id, payload.localite],
    )
    .map_err(|e| e.to_string())?;

    let id = db.last_insert_rowid();
    get_av_by_id(&db, id)
}

/// Modifie un AV existant.
#[tauri::command]
pub fn modifier_av(
    state: State<AppState>,
    id: i64,
    payload: ModifierAvPayload,
) -> Result<Av, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let av = get_av_by_id(&db, id)?;

    db.execute(
        "UPDATE avs
         SET nom        = ?1,
             cgi_id     = ?2,
             localite   = ?3,
             updated_at = datetime('now')
         WHERE id = ?4",
        rusqlite::params![
            payload.nom.unwrap_or(av.nom),
            payload.cgi_id.or(av.cgi_id),
            payload.localite.or(av.localite),
            id
        ],
    )
    .map_err(|e| e.to_string())?;

    get_av_by_id(&db, id)
}

// ─── Aide interne ─────────────────────────────────────────────────────────────
pub fn get_av_by_id(db: &rusqlite::Connection, id: i64) -> Result<Av, String> {
    db.query_row(
        "SELECT id, nom, cgi_id, localite, created_at, updated_at FROM avs WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Av {
                id: row.get(0)?,
                nom: row.get(1)?,
                cgi_id: row.get(2)?,
                localite: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        },
    )
    .map_err(|_| "AV introuvable.".to_string())
}
