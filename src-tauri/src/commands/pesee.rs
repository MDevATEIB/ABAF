// Commandes Tauri - module pesee (Phase 3)
use crate::db::AppState;
use crate::models::mission::index_statut;
use crate::models::pesee::{CreerPeseePayload, Pesee};
use rusqlite::OptionalExtension;
use tauri::State;

/// Enregistre une pesée (à vide ou chargée) pour une mission.
///
/// Règles métier (AGENT.md §10) :
/// - une seule pesée à vide par mission (poids vide initial de référence) ;
/// - une seule pesée chargée par mission ;
/// - une pesée chargée exige une pesée à vide et un poids net non négatif ;
/// - le statut de la mission avance automatiquement jusqu'à l'étape
///   constatée par la pesée (jamais de régression).
#[tauri::command]
pub fn creer_pesee(state: State<AppState>, payload: CreerPeseePayload) -> Result<Pesee, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    if payload.type_pesee != "vide" && payload.type_pesee != "charge" {
        return Err(format!(
            "Type de pesée invalide : « {} » (attendu : vide ou charge).",
            payload.type_pesee
        ));
    }
    if payload.poids_kg <= 0.0 {
        return Err("Le poids doit être supérieur à 0.".into());
    }

    // La mission doit exister : le camion et l'usine sont repris de la mission
    let (camion_id, usine_id, statut_mission): (i64, Option<i64>, String) = db
        .query_row(
            "SELECT camion_id, usine_id, statut FROM missions WHERE id = ?1",
            rusqlite::params![payload.mission_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "Mission introuvable.".to_string())?;

    if payload.type_pesee == "vide" {
        let nb_vide: i64 = db
            .query_row(
                "SELECT COUNT(*) FROM pesees WHERE mission_id = ?1 AND type_pesee = 'vide'",
                rusqlite::params![payload.mission_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if nb_vide > 0 {
            return Err("Une pesée à vide existe déjà pour cette mission.".into());
        }
    } else {
        let nb_charge: i64 = db
            .query_row(
                "SELECT COUNT(*) FROM pesees WHERE mission_id = ?1 AND type_pesee = 'charge'",
                rusqlite::params![payload.mission_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if nb_charge > 0 {
            return Err("Une pesée chargée existe déjà pour cette mission.".into());
        }

        let poids_vide: Option<f64> = db
            .query_row(
                "SELECT poids_kg FROM pesees
                 WHERE mission_id = ?1 AND type_pesee = 'vide'
                 ORDER BY id ASC LIMIT 1",
                rusqlite::params![payload.mission_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;

        let poids_vide = poids_vide
            .ok_or_else(|| "Enregistrez d'abord la pesée à vide du camion.".to_string())?;

        if payload.poids_kg < poids_vide {
            return Err(format!(
                "Poids net négatif : le poids chargé ({} kg) est inférieur au poids à vide ({} kg).",
                payload.poids_kg, poids_vide
            ));
        }
    }

    db.execute(
        "INSERT INTO pesees (mission_id, camion_id, usine_id, type_pesee, poids_kg,
                             date_pesee, heure_pesee, ticket_pesee)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            payload.mission_id,
            camion_id,
            usine_id,
            payload.type_pesee,
            payload.poids_kg,
            payload.date_pesee,
            payload.heure_pesee,
            payload.ticket_pesee,
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = db.last_insert_rowid();

    // Avance automatique du statut : la pesée constate un fait accompli.
    // 'vide' → pese_vide ; 'charge' → poids_net_calcule (calcul automatique du net).
    let cible = if payload.type_pesee == "vide" {
        "pese_vide"
    } else {
        "poids_net_calcule"
    };
    if let (Some(idx_actuel), Some(idx_cible)) =
        (index_statut(&statut_mission), index_statut(cible))
    {
        if idx_actuel < idx_cible {
            db.execute(
                "UPDATE missions
                 SET statut     = ?1,
                     updated_at = datetime('now')
                 WHERE id = ?2",
                rusqlite::params![cible, payload.mission_id],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    get_pesee_by_id(&db, id)
}

/// Retourne les pesées d'une mission, dans l'ordre chronologique.
#[tauri::command]
pub fn get_pesees_mission(state: State<AppState>, mission_id: i64) -> Result<Vec<Pesee>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, mission_id, camion_id, usine_id, type_pesee, poids_kg,
                    date_pesee, heure_pesee, ticket_pesee, created_at
             FROM pesees
             WHERE mission_id = ?1
             ORDER BY date_pesee ASC, id ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![mission_id], |row| {
            Ok(Pesee {
                id: row.get(0)?,
                mission_id: row.get(1)?,
                camion_id: row.get(2)?,
                usine_id: row.get(3)?,
                type_pesee: row.get(4)?,
                poids_kg: row.get(5)?,
                date_pesee: row.get(6)?,
                heure_pesee: row.get(7)?,
                ticket_pesee: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Supprime une pesée (correction de saisie).
/// La pesée à vide ne peut être supprimée que si aucune pesée chargée n'existe.
#[tauri::command]
pub fn supprimer_pesee(state: State<AppState>, id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let (mission_id, type_pesee): (i64, String) = db
        .query_row(
            "SELECT mission_id, type_pesee FROM pesees WHERE id = ?1",
            rusqlite::params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Pesée introuvable.".to_string())?;

    if type_pesee == "vide" {
        let nb_charge: i64 = db
            .query_row(
                "SELECT COUNT(*) FROM pesees WHERE mission_id = ?1 AND type_pesee = 'charge'",
                rusqlite::params![mission_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if nb_charge > 0 {
            return Err(
                "Impossible de supprimer la pesée à vide : une pesée chargée existe pour cette mission."
                    .into(),
            );
        }
    }

    db.execute("DELETE FROM pesees WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ─── Aide interne ─────────────────────────────────────────────────────────────
fn get_pesee_by_id(db: &rusqlite::Connection, id: i64) -> Result<Pesee, String> {
    db.query_row(
        "SELECT id, mission_id, camion_id, usine_id, type_pesee, poids_kg,
                date_pesee, heure_pesee, ticket_pesee, created_at
         FROM pesees WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Pesee {
                id: row.get(0)?,
                mission_id: row.get(1)?,
                camion_id: row.get(2)?,
                usine_id: row.get(3)?,
                type_pesee: row.get(4)?,
                poids_kg: row.get(5)?,
                date_pesee: row.get(6)?,
                heure_pesee: row.get(7)?,
                ticket_pesee: row.get(8)?,
                created_at: row.get(9)?,
            })
        },
    )
    .map_err(|_| "Pesée introuvable.".to_string())
}
