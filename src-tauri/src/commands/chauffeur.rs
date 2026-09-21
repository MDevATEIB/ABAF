use crate::db::AppState;
use crate::models::chauffeur::{Chauffeur, CreerChauffeurPayload, ModifierChauffeurPayload};
use tauri::State;

/// Liste tous les chauffeurs, actifs en premier.
#[tauri::command]
pub fn lister_chauffeurs(state: State<AppState>) -> Result<Vec<Chauffeur>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, nom, prenom, telephone, actif, created_at, updated_at
             FROM chauffeurs
             ORDER BY actif DESC, nom ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Chauffeur {
                id: row.get(0)?,
                nom: row.get(1)?,
                prenom: row.get(2)?,
                telephone: row.get(3)?,
                actif: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut chauffeurs = Vec::new();
    for row in rows {
        chauffeurs.push(row.map_err(|e| e.to_string())?);
    }
    Ok(chauffeurs)
}

/// CrÃ©e un chauffeur.
#[tauri::command]
pub fn creer_chauffeur(
    state: State<AppState>,
    payload: CreerChauffeurPayload,
) -> Result<Chauffeur, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO chauffeurs (nom, prenom, telephone) VALUES (?1, ?2, ?3)",
        rusqlite::params![payload.nom, payload.prenom, payload.telephone],
    )
    .map_err(|e| e.to_string())?;

    let id = db.last_insert_rowid();
    get_chauffeur_by_id(&db, id)
}

/// Modifie un chauffeur existant.
#[tauri::command]
pub fn modifier_chauffeur(
    state: State<AppState>,
    id: i64,
    payload: ModifierChauffeurPayload,
) -> Result<Chauffeur, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let chauffeur = get_chauffeur_by_id(&db, id)?;

    db.execute(
        "UPDATE chauffeurs
         SET nom        = ?1,
             prenom     = ?2,
             telephone  = ?3,
             updated_at = datetime('now')
         WHERE id = ?4",
        rusqlite::params![
            payload.nom.unwrap_or(chauffeur.nom),
            payload.prenom.or(chauffeur.prenom),
            payload.telephone.or(chauffeur.telephone),
            id
        ],
    )
    .map_err(|e| e.to_string())?;

    get_chauffeur_by_id(&db, id)
}

/// Bascule l'Ã©tat actif/inactif d'un chauffeur.
#[tauri::command]
pub fn desactiver_chauffeur(state: State<AppState>, id: i64) -> Result<Chauffeur, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE chauffeurs
         SET actif      = CASE WHEN actif = 1 THEN 0 ELSE 1 END,
             updated_at = datetime('now')
         WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    get_chauffeur_by_id(&db, id)
}

// â”€â”€â”€ Aide interne â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
fn get_chauffeur_by_id(db: &rusqlite::Connection, id: i64) -> Result<Chauffeur, String> {
    db.query_row(
        "SELECT id, nom, prenom, telephone, actif, created_at, updated_at
         FROM chauffeurs WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Chauffeur {
                id: row.get(0)?,
                nom: row.get(1)?,
                prenom: row.get(2)?,
                telephone: row.get(3)?,
                actif: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .map_err(|_| "Chauffeur introuvable.".to_string())
}
