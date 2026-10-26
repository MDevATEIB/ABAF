// Commandes Tauri - module Exploitation : intervenants du parc (mécaniciens,
// chefs de parc, apprentis). Ces personnes peuvent être créées sur le terrain :
// la liste est donc synchronisée dans les deux sens et la fusion se fait sur la
// clé métier (nom + prénom + rôle, insensible à la casse).

use crate::db::AppState;
use crate::models::intervenant::{
    role_valide, CreerIntervenantPayload, Intervenant, ModifierIntervenantPayload,
};
use tauri::State;
use uuid::Uuid;

/// Liste les intervenants, par rôle et par état. `actif` : 1 ou 0, `None` =
/// tous. La recherche porte sur le nom, le prénom et le téléphone.
#[tauri::command]
pub fn lister_intervenants(
    state: State<AppState>,
    role: Option<String>,
    actif: Option<i64>,
    recherche: Option<String>,
) -> Result<Vec<Intervenant>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let motif = recherche
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty())
        .map(|r| format!("%{r}%"));

    let mut stmt = db
        .prepare(
            "SELECT i.id, i.uuid, i.nom, i.prenom, i.telephone, i.role, i.actif,
                    i.source, i.device_id, i.created_at, i.updated_at,
                    app.nom,
                    (SELECT COUNT(*) FROM depenses d
                      WHERE d.apprenti_id = i.id OR d.mecanicien_id = i.id)
             FROM intervenants i
             LEFT JOIN appareils app ON app.uuid = i.device_id
             WHERE (?1 IS NULL OR i.role = ?1)
               AND (?2 IS NULL OR i.actif = ?2)
               AND (?3 IS NULL OR i.nom LIKE ?3
                             OR ifnull(i.prenom, '') LIKE ?3
                             OR ifnull(i.telephone, '') LIKE ?3)
             ORDER BY i.actif DESC, i.nom ASC, i.prenom ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![role, actif, motif], |row| {
            Ok(Intervenant {
                id: row.get(0)?,
                uuid: row.get(1)?,
                nom: row.get(2)?,
                prenom: row.get(3)?,
                telephone: row.get(4)?,
                role: row.get(5)?,
                actif: row.get(6)?,
                source: row.get(7)?,
                device_id: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
                appareil: row.get(11)?,
                nb_depenses: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut intervenants = Vec::new();
    for row in rows {
        intervenants.push(row.map_err(|e| e.to_string())?);
    }
    Ok(intervenants)
}

/// Crée un intervenant au bureau.
#[tauri::command]
pub fn creer_intervenant(
    state: State<AppState>,
    payload: CreerIntervenantPayload,
) -> Result<Intervenant, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let nom = payload.nom.trim();
    if nom.is_empty() {
        return Err("Le nom de l'intervenant est obligatoire.".into());
    }
    if !role_valide(&payload.role) {
        return Err("Rôle d'intervenant inconnu.".into());
    }

    db.execute(
        "INSERT INTO intervenants (uuid, nom, prenom, telephone, role)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            Uuid::new_v4().to_string(),
            nom,
            payload.prenom.as_deref().map(str::trim),
            payload.telephone.as_deref().map(str::trim),
            payload.role
        ],
    )
    .map_err(intervenant_existant)?;

    get_intervenant(&db, db.last_insert_rowid())
}

/// Modifie un intervenant existant ; les champs omis sont conservés.
#[tauri::command]
pub fn modifier_intervenant(
    state: State<AppState>,
    id: i64,
    payload: ModifierIntervenantPayload,
) -> Result<Intervenant, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let existant = get_intervenant(&db, id)?;

    let nom = payload.nom.unwrap_or(existant.nom).trim().to_string();
    if nom.is_empty() {
        return Err("Le nom de l'intervenant est obligatoire.".into());
    }
    let role = payload.role.unwrap_or(existant.role);
    if !role_valide(&role) {
        return Err("Rôle d'intervenant inconnu.".into());
    }

    db.execute(
        "UPDATE intervenants
            SET nom        = ?2,
                prenom     = ?3,
                telephone  = ?4,
                role       = ?5,
                updated_at = datetime('now')
          WHERE id = ?1",
        rusqlite::params![
            id,
            nom,
            payload.prenom.or(existant.prenom),
            payload.telephone.or(existant.telephone),
            role
        ],
    )
    .map_err(intervenant_existant)?;

    get_intervenant(&db, id)
}

/// Bascule l'état actif/inactif d'un intervenant. Aucun n'est jamais supprimé :
/// les dépenses du terrain doivent rester rattachées.
#[tauri::command]
pub fn desactiver_intervenant(state: State<AppState>, id: i64) -> Result<Intervenant, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE intervenants
            SET actif      = CASE WHEN actif = 1 THEN 0 ELSE 1 END,
                updated_at = datetime('now')
          WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    get_intervenant(&db, id)
}

// ─── Aides internes ───────────────────────────────────────────────────────────

/// L'index unique du référentiel protège les doublons issus du terrain : le
/// message renvoie l'utilisateur vers la fiche existante.
fn intervenant_existant(e: rusqlite::Error) -> String {
    if e.to_string().contains("UNIQUE") {
        "Cet intervenant existe déjà pour ce rôle.".into()
    } else {
        e.to_string()
    }
}

fn get_intervenant(db: &rusqlite::Connection, id: i64) -> Result<Intervenant, String> {
    db.query_row(
        "SELECT i.id, i.uuid, i.nom, i.prenom, i.telephone, i.role, i.actif,
                i.source, i.device_id, i.created_at, i.updated_at,
                app.nom,
                (SELECT COUNT(*) FROM depenses d
                  WHERE d.apprenti_id = i.id OR d.mecanicien_id = i.id)
         FROM intervenants i
         LEFT JOIN appareils app ON app.uuid = i.device_id
         WHERE i.id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Intervenant {
                id: row.get(0)?,
                uuid: row.get(1)?,
                nom: row.get(2)?,
                prenom: row.get(3)?,
                telephone: row.get(4)?,
                role: row.get(5)?,
                actif: row.get(6)?,
                source: row.get(7)?,
                device_id: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
                appareil: row.get(11)?,
                nb_depenses: row.get(12)?,
            })
        },
    )
    .map_err(|_| "Intervenant introuvable.".to_string())
}
