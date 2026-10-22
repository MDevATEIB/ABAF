// Commandes Tauri - module paiement (Phase 4)
use crate::db::AppState;
use crate::models::mission::avancer_statut_mission;
use crate::models::paiement::{
    index_statut_paiement, CreerPaiementPayload, ModifierPaiementPayload, Paiement,
};
use tauri::State;

/// Liste les paiements, avec filtres optionnels par campagne et par statut.
/// La campagne d'un paiement est celle de sa facture.
#[tauri::command]
pub fn lister_paiements(
    state: State<AppState>,
    saison_id: Option<i64>,
    statut: Option<String>,
) -> Result<Vec<Paiement>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT p.id, p.facture_id, p.date_paiement, p.montant, p.mode_paiement,
                    p.reference, p.statut, p.observations, p.created_at, p.updated_at
             FROM paiements p
             JOIN factures f ON f.id = p.facture_id
             WHERE (?1 IS NULL OR f.saison_id = ?1)
               AND (?2 IS NULL OR p.statut = ?2)
             ORDER BY p.date_paiement DESC, p.id DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![saison_id, statut], |row| {
            Ok(Paiement {
                id: row.get(0)?,
                facture_id: row.get(1)?,
                date_paiement: row.get(2)?,
                montant: row.get(3)?,
                mode_paiement: row.get(4)?,
                reference: row.get(5)?,
                statut: row.get(6)?,
                observations: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Enregistre un paiement rattaché à une facture validée (étape 12 du
/// parcours camion). Quand les règlements soldent la facture, celle-ci passe
/// au statut « payée » et les missions concernées avancent à « payé ».
#[tauri::command]
pub fn creer_paiement(
    state: State<AppState>,
    payload: CreerPaiementPayload,
) -> Result<Paiement, String> {
    if payload.montant <= 0.0 {
        return Err("Le montant du paiement doit être supérieur à 0.".into());
    }
    verifier_statut(&payload.statut)?;

    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    verifier_facture(&db, payload.facture_id)?;

    let tx = db.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO paiements (facture_id, date_paiement, montant, mode_paiement,
                                reference, statut, observations)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            payload.facture_id,
            payload.date_paiement,
            payload.montant,
            payload.mode_paiement,
            payload.reference,
            payload.statut,
            payload.observations,
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = tx.last_insert_rowid();
    recalculer_statut_facture(&tx, payload.facture_id)?;

    tx.commit().map_err(|e| e.to_string())?;
    get_paiement_by_id(&db, id)
}

/// Modifie un paiement existant (correction de saisie) et met à jour le
/// statut de la facture concernée.
#[tauri::command]
pub fn modifier_paiement(
    state: State<AppState>,
    id: i64,
    payload: ModifierPaiementPayload,
) -> Result<Paiement, String> {
    if payload.montant <= 0.0 {
        return Err("Le montant du paiement doit être supérieur à 0.".into());
    }
    verifier_statut(&payload.statut)?;

    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    let paiement = get_paiement_by_id(&db, id)?;

    let tx = db.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE paiements
         SET date_paiement = ?1,
             montant       = ?2,
             mode_paiement = ?3,
             reference     = ?4,
             statut        = ?5,
             observations  = ?6,
             updated_at    = datetime('now')
         WHERE id = ?7",
        rusqlite::params![
            payload.date_paiement,
            payload.montant,
            payload.mode_paiement,
            payload.reference,
            payload.statut,
            payload.observations,
            id,
        ],
    )
    .map_err(|e| e.to_string())?;

    recalculer_statut_facture(&tx, paiement.facture_id)?;

    tx.commit().map_err(|e| e.to_string())?;
    get_paiement_by_id(&db, id)
}

// ─── Aide interne ─────────────────────────────────────────────────────────────
fn verifier_statut(statut: &str) -> Result<(), String> {
    if index_statut_paiement(statut).is_none() {
        return Err(format!("Statut de paiement invalide : « {} ».", statut));
    }
    Ok(())
}

/// La facture doit exister et être validée : un brouillon ne reçoit pas de
/// paiement.
fn verifier_facture(db: &rusqlite::Connection, facture_id: i64) -> Result<(), String> {
    let (numero, statut): (String, String) = db
        .query_row(
            "SELECT numero, statut FROM factures WHERE id = ?1",
            rusqlite::params![facture_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Facture introuvable.".to_string())?;

    if statut == "brouillon" {
        return Err(format!(
            "La facture « {} » est en brouillon : validez-la avant d'enregistrer un paiement.",
            numero
        ));
    }
    Ok(())
}

/// Recalcule le statut d'une facture à partir de ses paiements réglés :
/// soldée → « payée » (les missions avancent à « payé », jamais de
/// régression) ; sinon retour à « validée » en cas de correction.
fn recalculer_statut_facture(
    db: &rusqlite::Connection,
    facture_id: i64,
) -> Result<(), String> {
    let (montant_net, statut): (f64, String) = db
        .query_row(
            "SELECT montant_net, statut FROM factures WHERE id = ?1",
            rusqlite::params![facture_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Facture introuvable.".to_string())?;

    let total_regle: f64 = db
        .query_row(
            "SELECT COALESCE(SUM(montant), 0)
             FROM paiements
             WHERE facture_id = ?1 AND statut = 'paye'",
            rusqlite::params![facture_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if total_regle >= montant_net && statut != "payee" {
        db.execute(
            "UPDATE factures
             SET statut     = 'payee',
                 updated_at = datetime('now')
             WHERE id = ?1",
            rusqlite::params![facture_id],
        )
        .map_err(|e| e.to_string())?;
        avancer_missions_payees(db, facture_id)?;
    } else if total_regle < montant_net && statut == "payee" {
        db.execute(
            "UPDATE factures
             SET statut     = 'validee',
                 updated_at = datetime('now')
             WHERE id = ?1",
            rusqlite::params![facture_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Fait avancer à « payé » les missions des bordereaux et BSM rattachés à
/// la facture soldée (jamais de régression).
fn avancer_missions_payees(db: &rusqlite::Connection, facture_id: i64) -> Result<(), String> {
    let missions = {
        let mut stmt = db
            .prepare(
                "SELECT b.mission_id
                 FROM lignes_facture lf
                 JOIN bordereaux b ON b.id = lf.bordereau_id
                 WHERE lf.facture_id = ?1 AND b.mission_id IS NOT NULL
                 UNION
                 SELECT b.mission_id
                 FROM lignes_facture lf
                 JOIN bsm b ON b.id = lf.bsm_id
                 WHERE lf.facture_id = ?1 AND b.mission_id IS NOT NULL",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(rusqlite::params![facture_id], |row| row.get::<_, i64>(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    };

    for mission_id in missions {
        avancer_statut_mission(db, mission_id, "paye")?;
    }
    Ok(())
}

fn get_paiement_by_id(db: &rusqlite::Connection, id: i64) -> Result<Paiement, String> {
    db.query_row(
        "SELECT id, facture_id, date_paiement, montant, mode_paiement, reference,
                statut, observations, created_at, updated_at
         FROM paiements WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Paiement {
                id: row.get(0)?,
                facture_id: row.get(1)?,
                date_paiement: row.get(2)?,
                montant: row.get(3)?,
                mode_paiement: row.get(4)?,
                reference: row.get(5)?,
                statut: row.get(6)?,
                observations: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        },
    )
    .map_err(|_| "Paiement introuvable.".to_string())
}
