use crate::db::AppState;
use crate::models::saison::{CreerSaisonPayload, ModifierSaisonPayload, Saison};
use tauri::State;

/// Retourne toutes les saisons triées par date de début décroissante.
#[tauri::command]
pub fn lister_saisons(state: State<AppState>) -> Result<Vec<Saison>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, libelle, date_debut, date_fin, statut, created_at, updated_at
             FROM saisons
             ORDER BY date_debut DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Saison {
                id: row.get(0)?,
                libelle: row.get(1)?,
                date_debut: row.get(2)?,
                date_fin: row.get(3)?,
                statut: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut saisons = Vec::new();
    for row in rows {
        saisons.push(row.map_err(|e| e.to_string())?);
    }
    Ok(saisons)
}

/// Crée une nouvelle saison. Vérifie qu'il n'existe pas déjà une saison ouverte.
#[tauri::command]
pub fn creer_saison(
    state: State<AppState>,
    payload: CreerSaisonPayload,
) -> Result<Saison, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Règle : une seule saison ouverte à la fois
    let nb_ouvertes: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM saisons WHERE statut = 'ouverte'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if nb_ouvertes > 0 {
        return Err("Une saison est déjà ouverte. Clôturez-la avant d'en créer une nouvelle.".into());
    }

    db.execute(
        "INSERT INTO saisons (libelle, date_debut, date_fin, statut)
         VALUES (?1, ?2, ?3, 'ouverte')",
        rusqlite::params![payload.libelle, payload.date_debut, payload.date_fin],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Ce libellé est déjà utilisé par une autre saison.".into()
        } else {
            e.to_string()
        }
    })?;

    let id = db.last_insert_rowid();
    get_saison_by_id(&db, id)
}

/// Modifie une saison ouverte (libellé, dates).
#[tauri::command]
pub fn modifier_saison(
    state: State<AppState>,
    id: i64,
    payload: ModifierSaisonPayload,
) -> Result<Saison, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Règle : une saison fermée ne peut plus être modifiée
    let statut: String = db
        .query_row(
            "SELECT statut FROM saisons WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|_| "Saison introuvable.".to_string())?;

    if statut == "fermee" {
        return Err("Une saison clôturée ne peut plus être modifiée.".into());
    }

    db.execute(
        "UPDATE saisons
         SET libelle    = COALESCE(?1, libelle),
             date_debut = COALESCE(?2, date_debut),
             date_fin   = COALESCE(?3, date_fin),
             updated_at = datetime('now')
         WHERE id = ?4",
        rusqlite::params![payload.libelle, payload.date_debut, payload.date_fin, id],
    )
    .map_err(|e| e.to_string())?;

    get_saison_by_id(&db, id)
}

/// Clôture une saison ouverte (statut → 'fermee').
#[tauri::command]
pub fn cloturer_saison(state: State<AppState>, id: i64) -> Result<Saison, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let statut: String = db
        .query_row(
            "SELECT statut FROM saisons WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|_| "Saison introuvable.".to_string())?;

    if statut == "fermee" {
        return Err("Cette saison est déjà clôturée.".into());
    }

    db.execute(
        "UPDATE saisons
         SET statut     = 'fermee',
             date_fin   = COALESCE(date_fin, date('now')),
             updated_at = datetime('now')
         WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    get_saison_by_id(&db, id)
}

// ─── Aide interne ─────────────────────────────────────────────────────────────
fn get_saison_by_id(db: &rusqlite::Connection, id: i64) -> Result<Saison, String> {
    db.query_row(
        "SELECT id, libelle, date_debut, date_fin, statut, created_at, updated_at
         FROM saisons WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Saison {
                id: row.get(0)?,
                libelle: row.get(1)?,
                date_debut: row.get(2)?,
                date_fin: row.get(3)?,
                statut: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}
