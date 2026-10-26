// Commandes Tauri - module Exploitation : catalogue des pièces de rechange.
//
// Le catalogue peut être enrichi depuis le terrain. Les doublons sont évités
// par l'index unique (nom + catégorie, insensible à la casse) et le serveur de
// synchronisation répond alors `merged` avec l'UUID retenu.

use crate::db::AppState;
use crate::models::piece::{CreerPiecePayload, ModifierPiecePayload, PieceRechange};
use tauri::State;
use uuid::Uuid;

/// Liste les pièces du catalogue, actives en premier.
#[tauri::command]
pub fn lister_pieces(
    state: State<AppState>,
    categorie: Option<String>,
    actif: Option<i64>,
    recherche: Option<String>,
) -> Result<Vec<PieceRechange>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let motif = recherche
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty())
        .map(|r| format!("%{r}%"));

    let mut stmt = db
        .prepare(
            "SELECT p.id, p.uuid, p.nom, p.categorie, p.unite, p.actif, p.source,
                    p.device_id, p.created_at, p.updated_at,
                    app.nom,
                    (SELECT COUNT(*) FROM depenses d WHERE d.piece_id = p.id)
             FROM pieces_rechange p
             LEFT JOIN appareils app ON app.uuid = p.device_id
             WHERE (?1 IS NULL OR p.categorie = ?1)
               AND (?2 IS NULL OR p.actif = ?2)
               AND (?3 IS NULL OR p.nom LIKE ?3 OR ifnull(p.categorie, '') LIKE ?3)
             ORDER BY p.actif DESC, p.nom ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![categorie, actif, motif], |row| {
            Ok(PieceRechange {
                id: row.get(0)?,
                uuid: row.get(1)?,
                nom: row.get(2)?,
                categorie: row.get(3)?,
                unite: row.get(4)?,
                actif: row.get(5)?,
                source: row.get(6)?,
                device_id: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
                appareil: row.get(10)?,
                nb_depenses: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut pieces = Vec::new();
    for row in rows {
        pieces.push(row.map_err(|e| e.to_string())?);
    }
    Ok(pieces)
}

/// Ajoute une pièce au catalogue.
#[tauri::command]
pub fn creer_piece(state: State<AppState>, payload: CreerPiecePayload) -> Result<PieceRechange, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let nom = payload.nom.trim();
    if nom.is_empty() {
        return Err("Le nom de la pièce est obligatoire.".into());
    }
    let unite = payload
        .unite
        .as_deref()
        .map(str::trim)
        .filter(|u| !u.is_empty())
        .unwrap_or("u")
        .to_string();

    db.execute(
        "INSERT INTO pieces_rechange (uuid, nom, categorie, unite)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            Uuid::new_v4().to_string(),
            nom,
            payload.categorie.as_deref().map(str::trim),
            unite
        ],
    )
    .map_err(piece_existante)?;

    get_piece(&db, db.last_insert_rowid())
}

/// Modifie une pièce du catalogue.
#[tauri::command]
pub fn modifier_piece(
    state: State<AppState>,
    id: i64,
    payload: ModifierPiecePayload,
) -> Result<PieceRechange, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let existante = get_piece(&db, id)?;

    let nom = payload.nom.unwrap_or(existante.nom).trim().to_string();
    if nom.is_empty() {
        return Err("Le nom de la pièce est obligatoire.".into());
    }

    db.execute(
        "UPDATE pieces_rechange
            SET nom        = ?2,
                categorie  = ?3,
                unite      = ?4,
                updated_at = datetime('now')
          WHERE id = ?1",
        rusqlite::params![
            id,
            nom,
            payload.categorie.or(existante.categorie),
            payload.unite.unwrap_or(existante.unite)
        ],
    )
    .map_err(piece_existante)?;

    get_piece(&db, id)
}

/// Bascule l'état actif/inactif d'une pièce. Le catalogue ne se supprime pas :
/// les dépenses déjà saisies y font référence.
#[tauri::command]
pub fn desactiver_piece(state: State<AppState>, id: i64) -> Result<PieceRechange, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE pieces_rechange
            SET actif      = CASE WHEN actif = 1 THEN 0 ELSE 1 END,
                updated_at = datetime('now')
          WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    get_piece(&db, id)
}

// ─── Aides internes ───────────────────────────────────────────────────────────

fn piece_existante(e: rusqlite::Error) -> String {
    if e.to_string().contains("UNIQUE") {
        "Cette pièce figure déjà au catalogue.".into()
    } else {
        e.to_string()
    }
}

fn get_piece(db: &rusqlite::Connection, id: i64) -> Result<PieceRechange, String> {
    db.query_row(
        "SELECT p.id, p.uuid, p.nom, p.categorie, p.unite, p.actif, p.source,
                p.device_id, p.created_at, p.updated_at,
                app.nom,
                (SELECT COUNT(*) FROM depenses d WHERE d.piece_id = p.id)
         FROM pieces_rechange p
         LEFT JOIN appareils app ON app.uuid = p.device_id
         WHERE p.id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(PieceRechange {
                id: row.get(0)?,
                uuid: row.get(1)?,
                nom: row.get(2)?,
                categorie: row.get(3)?,
                unite: row.get(4)?,
                actif: row.get(5)?,
                source: row.get(6)?,
                device_id: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
                appareil: row.get(10)?,
                nb_depenses: row.get(11)?,
            })
        },
    )
    .map_err(|_| "Pièce introuvable.".to_string())
}
