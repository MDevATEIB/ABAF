// Commandes Tauri - module BSM (Phase 3)
use crate::db::AppState;
use crate::models::bsm::{index_statut_bsm, CreerBsmPayload, ModifierBsmPayload, BSM};
use crate::models::mission::avancer_statut_mission;
use crate::utils::generer_numero_document;
use tauri::State;

/// Liste les BSM, avec filtres optionnels par saison et par statut.
#[tauri::command]
pub fn lister_bsm(
    state: State<AppState>,
    saison_id: Option<i64>,
    statut: Option<String>,
) -> Result<Vec<BSM>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, numero, saison_id, mission_id, camion_id, usine_id, date_bsm,
                    beneficiaire, quantite_litres, prix_litre, montant, imputation,
                    reference, statut, created_at, updated_at
             FROM bsm
             WHERE (?1 IS NULL OR saison_id = ?1)
               AND (?2 IS NULL OR statut = ?2)
             ORDER BY date_bsm DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![saison_id, statut], |row| {
            Ok(BSM {
                id: row.get(0)?,
                numero: row.get(1)?,
                saison_id: row.get(2)?,
                mission_id: row.get(3)?,
                camion_id: row.get(4)?,
                usine_id: row.get(5)?,
                date_bsm: row.get(6)?,
                beneficiaire: row.get(7)?,
                quantite_litres: row.get(8)?,
                prix_litre: row.get(9)?,
                montant: row.get(10)?,
                imputation: row.get(11)?,
                reference: row.get(12)?,
                statut: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Crée un BSM (statut initial : ouvert).
/// Le montant (quantité × prix au litre) est calculé par la base.
/// Le numéro est attribué automatiquement (par année) si celui du payload
/// est absent ou vide.
#[tauri::command]
pub fn creer_bsm(state: State<AppState>, payload: CreerBsmPayload) -> Result<BSM, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    if payload.quantite_litres <= 0.0 {
        return Err("La quantité de gasoil doit être supérieure à 0.".into());
    }
    if payload.prix_litre <= 0.0 {
        return Err("Le prix au litre doit être supérieur à 0.".into());
    }

    let numero = payload
        .numero
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let numero = match numero {
        Some(n) => {
            verifier_numero_disponible(&db, &n, None)?;
            n
        }
        None => generer_numero_document(&db, "bsm", "date_bsm", "numero", payload.date_bsm.as_str())?,
    };

    let camion_existe: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM camions WHERE id = ?1",
            rusqlite::params![payload.camion_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if camion_existe == 0 {
        return Err("Camion introuvable.".into());
    }

    // Règle : si le BSM est rattaché à une mission, vérifier son existence.
    // (La pesée à vide n'est plus requise : la tare est connue via la
    //  capacité enregistrée sur le camion : tare = capacité_tonnes × 1000.)
    if let Some(mission_id) = payload.mission_id {
        let existe: i64 = db
            .query_row(
                "SELECT COUNT(*) FROM missions WHERE id = ?1",
                rusqlite::params![mission_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if existe == 0 {
            return Err("Mission introuvable.".into());
        }
    }

    db.execute(
        "INSERT INTO bsm (numero, saison_id, mission_id, camion_id, usine_id, date_bsm,
                          beneficiaire, quantite_litres, prix_litre, imputation,
                          reference, statut)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'ouvert')",
        rusqlite::params![
            numero,
            payload.saison_id,
            payload.mission_id,
            payload.camion_id,
            payload.usine_id,
            payload.date_bsm,
            payload.beneficiaire,
            payload.quantite_litres,
            payload.prix_litre,
            payload.imputation,
            payload.reference,
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = db.last_insert_rowid();

    // Avance automatique du statut de la mission : le BSM constate la prise
    // de gasoil. Jamais de régression.
    if let Some(mission_id) = payload.mission_id {
        avancer_statut_mission(&db, mission_id, "gasoil_pris")?;
    }

    get_bsm_by_id(&db, id)
}

/// Modifie un BSM non clôturé (saison et statut exclus).
#[tauri::command]
pub fn modifier_bsm(
    state: State<AppState>,
    id: i64,
    payload: ModifierBsmPayload,
) -> Result<BSM, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let bsm = get_bsm_by_id(&db, id)?;

    if bsm.statut != "ouvert" {
        return Err("Un BSM clôturé ou facturé ne peut plus être modifié.".into());
    }

    if payload.quantite_litres <= 0.0 {
        return Err("La quantité de gasoil doit être supérieure à 0.".into());
    }
    if payload.prix_litre <= 0.0 {
        return Err("Le prix au litre doit être supérieur à 0.".into());
    }
    verifier_numero_disponible(&db, &payload.numero, Some(id))?;

    if let Some(mission_id) = payload.mission_id {
        let existe: i64 = db
            .query_row(
                "SELECT COUNT(*) FROM missions WHERE id = ?1",
                rusqlite::params![mission_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if existe == 0 {
            return Err("Mission introuvable.".into());
        }
    }

    db.execute(
        "UPDATE bsm
         SET numero          = ?1,
             mission_id      = ?2,
             camion_id       = ?3,
             usine_id        = ?4,
             date_bsm        = ?5,
             beneficiaire    = ?6,
             quantite_litres = ?7,
             prix_litre      = ?8,
             imputation      = ?9,
             reference       = ?10,
             updated_at      = datetime('now')
         WHERE id = ?11",
        rusqlite::params![
            payload.numero,
            payload.mission_id,
            payload.camion_id,
            payload.usine_id,
            payload.date_bsm,
            payload.beneficiaire,
            payload.quantite_litres,
            payload.prix_litre,
            payload.imputation,
            payload.reference,
            id
        ],
    )
    .map_err(|e| e.to_string())?;

    get_bsm_by_id(&db, id)
}

/// Fait évoluer le statut d'un BSM d'une seule étape
/// (ouvert → clôturé → facturé, ou l'inverse).
#[tauri::command]
pub fn changer_statut_bsm(
    state: State<AppState>,
    id: i64,
    nouveau_statut: String,
) -> Result<BSM, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let bsm = get_bsm_by_id(&db, id)?;

    let idx_actuel = index_statut_bsm(&bsm.statut)
        .ok_or_else(|| format!("Statut actuel inconnu : « {} ».", bsm.statut))?;
    let idx_nouveau = index_statut_bsm(&nouveau_statut)
        .ok_or_else(|| format!("Statut invalide : « {} ».", nouveau_statut))?;

    let delta = idx_nouveau as i64 - idx_actuel as i64;
    if delta == 0 {
        return Err("Le BSM se trouve déjà à ce statut.".into());
    }
    if delta.abs() > 1 {
        return Err(
            "Transition invalide : un BSM ne peut progresser ou reculer que d'une étape à la fois."
                .into(),
        );
    }

    db.execute(
        "UPDATE bsm
         SET statut     = ?1,
             updated_at = datetime('now')
         WHERE id = ?2",
        rusqlite::params![nouveau_statut, id],
    )
    .map_err(|e| e.to_string())?;

    get_bsm_by_id(&db, id)
}

// ─── Aide interne ─────────────────────────────────────────────────────────────
/// Les numéros de BSM sont pré-numérotés : ils doivent rester uniques.
fn verifier_numero_disponible(
    db: &rusqlite::Connection,
    numero: &str,
    id_exclu: Option<i64>,
) -> Result<(), String> {
    let nb: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM bsm WHERE numero = ?1 AND (?2 IS NULL OR id != ?2)",
            rusqlite::params![numero, id_exclu],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if nb > 0 {
        return Err(format!("Le numéro de BSM « {} » est déjà utilisé.", numero));
    }
    Ok(())
}

fn get_bsm_by_id(db: &rusqlite::Connection, id: i64) -> Result<BSM, String> {
    db.query_row(
        "SELECT id, numero, saison_id, mission_id, camion_id, usine_id, date_bsm,
                beneficiaire, quantite_litres, prix_litre, montant, imputation,
                reference, statut, created_at, updated_at
         FROM bsm WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(BSM {
                id: row.get(0)?,
                numero: row.get(1)?,
                saison_id: row.get(2)?,
                mission_id: row.get(3)?,
                camion_id: row.get(4)?,
                usine_id: row.get(5)?,
                date_bsm: row.get(6)?,
                beneficiaire: row.get(7)?,
                quantite_litres: row.get(8)?,
                prix_litre: row.get(9)?,
                montant: row.get(10)?,
                imputation: row.get(11)?,
                reference: row.get(12)?,
                statut: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        },
    )
    .map_err(|_| "BSM introuvable.".to_string())
}
