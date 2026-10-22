// Commandes Tauri - module mission (Phase 3)
use crate::db::AppState;
use crate::models::mission::{index_statut, CreerMissionPayload, Mission, ModifierMissionPayload};
use tauri::State;

/// Liste les missions, avec filtres optionnels par saison et par statut.
#[tauri::command]
pub fn lister_missions(
    state: State<AppState>,
    saison_id: Option<i64>,
    statut: Option<String>,
) -> Result<Vec<Mission>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, saison_id, camion_id, chauffeur_id, usine_id, cgi_id, av_id,
                    date_mission, statut, observations, created_at, updated_at
             FROM missions
             WHERE (?1 IS NULL OR saison_id = ?1)
               AND (?2 IS NULL OR statut = ?2)
             ORDER BY date_mission DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![saison_id, statut], |row| {
            Ok(Mission {
                id: row.get(0)?,
                saison_id: row.get(1)?,
                camion_id: row.get(2)?,
                chauffeur_id: row.get(3)?,
                usine_id: row.get(4)?,
                cgi_id: row.get(5)?,
                av_id: row.get(6)?,
                date_mission: row.get(7)?,
                statut: row.get(8)?,
                observations: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Crée une mission (statut initial : brouillon).
#[tauri::command]
pub fn creer_mission(
    state: State<AppState>,
    payload: CreerMissionPayload,
) -> Result<Mission, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Règle : une mission ne peut être créée que dans une campagne ouverte
    let statut_saison: String = db
        .query_row(
            "SELECT statut FROM saisons WHERE id = ?1",
            rusqlite::params![payload.saison_id],
            |row| row.get(0),
        )
        .map_err(|_| "Saison introuvable.".to_string())?;

    if statut_saison == "fermee" {
        return Err("Impossible de créer une mission dans une saison clôturée.".into());
    }

    // Règle : un camion inactif ne peut pas être utilisé pour une nouvelle mission
    let camion_actif: i64 = db
        .query_row(
            "SELECT actif FROM camions WHERE id = ?1",
            rusqlite::params![payload.camion_id],
            |row| row.get(0),
        )
        .map_err(|_| "Camion introuvable.".to_string())?;

    if camion_actif == 0 {
        return Err("Un camion inactif ne peut pas être utilisé pour une nouvelle mission.".into());
    }

    db.execute(
        "INSERT INTO missions (saison_id, camion_id, chauffeur_id, usine_id, cgi_id, av_id,
                               date_mission, statut, observations)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'brouillon', ?8)",
        rusqlite::params![
            payload.saison_id,
            payload.camion_id,
            payload.chauffeur_id,
            payload.usine_id,
            payload.cgi_id,
            payload.av_id,
            payload.date_mission,
            payload.observations,
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = db.last_insert_rowid();
    get_mission_by_id(&db, id)
}

/// Modifie une mission (hors saison et statut, gérés séparément).
#[tauri::command]
pub fn modifier_mission(
    state: State<AppState>,
    id: i64,
    payload: ModifierMissionPayload,
) -> Result<Mission, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    get_mission_by_id(&db, id)?;

    db.execute(
        "UPDATE missions
         SET camion_id    = ?1,
             chauffeur_id = ?2,
             usine_id     = ?3,
             cgi_id       = ?4,
             av_id        = ?5,
             date_mission = ?6,
             observations = ?7,
             updated_at   = datetime('now')
         WHERE id = ?8",
        rusqlite::params![
            payload.camion_id,
            payload.chauffeur_id,
            payload.usine_id,
            payload.cgi_id,
            payload.av_id,
            payload.date_mission,
            payload.observations,
            id
        ],
    )
    .map_err(|e| e.to_string())?;

    get_mission_by_id(&db, id)
}

/// Fait évoluer le statut d'une mission d'une seule étape
/// (avancer vers l'étape suivante ou reculer vers la précédente).
#[tauri::command]
pub fn changer_statut_mission(
    state: State<AppState>,
    id: i64,
    nouveau_statut: String,
) -> Result<Mission, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mission = get_mission_by_id(&db, id)?;

    let idx_actuel = index_statut(&mission.statut)
        .ok_or_else(|| format!("Statut actuel inconnu : « {} ».", mission.statut))?;
    let idx_nouveau = index_statut(&nouveau_statut)
        .ok_or_else(|| format!("Statut invalide : « {} ».", nouveau_statut))?;

    let delta = idx_nouveau as i64 - idx_actuel as i64;
    if delta == 0 {
        return Err("La mission se trouve déjà à ce statut.".into());
    }
    if delta.abs() > 1 {
        return Err(
            "Transition invalide : une mission ne peut progresser ou reculer que d'une étape à la fois."
                .into(),
        );
    }

    db.execute(
        "UPDATE missions
         SET statut     = ?1,
             updated_at = datetime('now')
         WHERE id = ?2",
        rusqlite::params![nouveau_statut, id],
    )
    .map_err(|e| e.to_string())?;

    get_mission_by_id(&db, id)
}

// ─── Aide interne ─────────────────────────────────────────────────────────────
fn get_mission_by_id(db: &rusqlite::Connection, id: i64) -> Result<Mission, String> {
    db.query_row(
        "SELECT id, saison_id, camion_id, chauffeur_id, usine_id, cgi_id, av_id,
                date_mission, statut, observations, created_at, updated_at
         FROM missions WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Mission {
                id: row.get(0)?,
                saison_id: row.get(1)?,
                camion_id: row.get(2)?,
                chauffeur_id: row.get(3)?,
                usine_id: row.get(4)?,
                cgi_id: row.get(5)?,
                av_id: row.get(6)?,
                date_mission: row.get(7)?,
                statut: row.get(8)?,
                observations: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        },
    )
    .map_err(|_| "Mission introuvable.".to_string())
}
