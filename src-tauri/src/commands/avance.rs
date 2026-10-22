// Commandes Tauri - module avance (Phase 4)
use crate::db::AppState;
use crate::models::avance::{
    Avance, CreerAvancePayload, UtilisationAvance, UtilisationAvancePayload,
};
use tauri::State;

/// Liste les avances, avec filtre optionnel par campagne.
#[tauri::command]
pub fn lister_avances(
    state: State<AppState>,
    saison_id: Option<i64>,
) -> Result<Vec<Avance>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, saison_id, date_avance, montant_initial, montant_utilise,
                    reference, observations, created_at, updated_at
             FROM avances
             WHERE (?1 IS NULL OR saison_id = ?1)
             ORDER BY date_avance DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![saison_id], |row| {
            Ok(Avance {
                id: row.get(0)?,
                saison_id: row.get(1)?,
                date_avance: row.get(2)?,
                montant_initial: row.get(3)?,
                montant_utilise: row.get(4)?,
                reference: row.get(5)?,
                observations: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Retourne les utilisations d'une avance (consultation du détail).
#[tauri::command]
pub fn get_utilisations_avance(
    state: State<AppState>,
    avance_id: i64,
) -> Result<Vec<UtilisationAvance>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, avance_id, facture_id, date_utilisation, montant,
                    observations, created_at
             FROM utilisations_avances
             WHERE avance_id = ?1
             ORDER BY date_utilisation DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![avance_id], |row| {
            Ok(UtilisationAvance {
                id: row.get(0)?,
                avance_id: row.get(1)?,
                facture_id: row.get(2)?,
                date_utilisation: row.get(3)?,
                montant: row.get(4)?,
                observations: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Crée une avance de campagne (fonds avancés par le client).
#[tauri::command]
pub fn creer_avance(state: State<AppState>, payload: CreerAvancePayload) -> Result<Avance, String> {
    if payload.montant_initial <= 0.0 {
        return Err("Le montant de l'avance doit être supérieur à 0.".into());
    }

    let db = state.db.lock().map_err(|e| e.to_string())?;
    verifier_saison(&db, payload.saison_id)?;

    db.execute(
        "INSERT INTO avances (saison_id, date_avance, montant_initial, reference, observations)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            payload.saison_id,
            payload.date_avance,
            payload.montant_initial,
            payload.reference,
            payload.observations,
        ],
    )
    .map_err(|e| e.to_string())?;

    get_avance_by_id(&db, db.last_insert_rowid())
}

/// Enregistre l'utilisation d'une avance (éventuellement pour régler une
/// facture) et met à jour le cumul utilisé de l'avance.
#[tauri::command]
pub fn enregistrer_utilisation_avance(
    state: State<AppState>,
    payload: UtilisationAvancePayload,
) -> Result<UtilisationAvance, String> {
    if payload.montant <= 0.0 {
        return Err("Le montant de l'utilisation doit être supérieur à 0.".into());
    }

    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    let avance = get_avance_by_id(&db, payload.avance_id)?;

    let solde = avance.montant_initial - avance.montant_utilise;
    if payload.montant > solde {
        return Err(format!(
            "Le montant dépasse le solde disponible de l'avance ({:.0} FCFA).",
            solde
        ));
    }

    if let Some(facture_id) = payload.facture_id {
        verifier_facture(&db, facture_id)?;
    }

    let tx = db.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO utilisations_avances (avance_id, facture_id, date_utilisation,
                                           montant, observations)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            payload.avance_id,
            payload.facture_id,
            payload.date_utilisation,
            payload.montant,
            payload.observations,
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = tx.last_insert_rowid();

    // Le cumul utilisé est recalculé à partir des utilisations saisies :
    // le solde de l'avance reste ainsi toujours cohérent.
    tx.execute(
        "UPDATE avances
         SET montant_utilise = (
                 SELECT COALESCE(SUM(montant), 0)
                 FROM utilisations_avances
                 WHERE avance_id = ?1
             ),
             updated_at = datetime('now')
         WHERE id = ?1",
        rusqlite::params![payload.avance_id],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    get_utilisation_by_id(&db, id)
}

// ─── Aide interne ─────────────────────────────────────────────────────────────

fn verifier_saison(db: &rusqlite::Connection, saison_id: i64) -> Result<(), String> {
    let existe: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM saisons WHERE id = ?1",
            rusqlite::params![saison_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if existe == 0 {
        return Err("Campagne introuvable.".into());
    }
    Ok(())
}

fn verifier_facture(db: &rusqlite::Connection, facture_id: i64) -> Result<(), String> {
    let existe: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM factures WHERE id = ?1",
            rusqlite::params![facture_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if existe == 0 {
        return Err("Facture introuvable.".into());
    }
    Ok(())
}

fn get_avance_by_id(db: &rusqlite::Connection, id: i64) -> Result<Avance, String> {
    db.query_row(
        "SELECT id, saison_id, date_avance, montant_initial, montant_utilise,
                reference, observations, created_at, updated_at
         FROM avances WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Avance {
                id: row.get(0)?,
                saison_id: row.get(1)?,
                date_avance: row.get(2)?,
                montant_initial: row.get(3)?,
                montant_utilise: row.get(4)?,
                reference: row.get(5)?,
                observations: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    )
    .map_err(|_| "Avance introuvable.".to_string())
}

fn get_utilisation_by_id(db: &rusqlite::Connection, id: i64) -> Result<UtilisationAvance, String> {
    db.query_row(
        "SELECT id, avance_id, facture_id, date_utilisation, montant, observations, created_at
         FROM utilisations_avances WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(UtilisationAvance {
                id: row.get(0)?,
                avance_id: row.get(1)?,
                facture_id: row.get(2)?,
                date_utilisation: row.get(3)?,
                montant: row.get(4)?,
                observations: row.get(5)?,
                created_at: row.get(6)?,
            })
        },
    )
    .map_err(|_| "Utilisation introuvable.".to_string())
}
