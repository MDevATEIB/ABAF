use rusqlite::Connection;
use serde::{Deserialize, Serialize};

/// Ordre du cycle de vie d'une mission (AGENT.md §9.2).
pub const STATUTS_ORDRE: [&str; 13] = [
    "brouillon",
    "arrive_usine",
    "pese_vide",
    "gasoil_pris",
    "en_route",
    "chargement",
    "retour_usine",
    "pese_charge",
    "poids_net_calcule",
    "dechargement",
    "valide",
    "facture",
    "paye",
];

/// Position d'un statut dans le cycle de vie de la mission.
pub fn index_statut(statut: &str) -> Option<usize> {
    STATUTS_ORDRE.iter().position(|s| *s == statut)
}

/// Avance le statut d'une mission jusqu'à l'étape constatée : les faits
/// successifs d'une même mission (gasoil pris, chargement, livraison,
/// facturation, paiement) ne font jamais régresser son statut.
pub fn avancer_statut_mission(
    db: &Connection,
    mission_id: i64,
    cible: &str,
) -> Result<(), String> {
    let statut_actuel: String = db
        .query_row(
            "SELECT statut FROM missions WHERE id = ?1",
            rusqlite::params![mission_id],
            |row| row.get(0),
        )
        .map_err(|_| "Mission introuvable.".to_string())?;

    if let (Some(idx_actuel), Some(idx_cible)) = (index_statut(&statut_actuel), index_statut(cible)) {
        if idx_actuel < idx_cible {
            db.execute(
                "UPDATE missions
                 SET statut     = ?1,
                     updated_at = datetime('now')
                 WHERE id = ?2",
                rusqlite::params![cible, mission_id],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Mission {
    pub id: i64,
    pub saison_id: i64,
    pub camion_id: i64,
    pub chauffeur_id: Option<i64>,
    pub usine_id: Option<i64>,
    pub cgi_id: Option<i64>,
    pub av_id: Option<i64>,
    pub date_mission: String,
    pub statut: String,
    pub observations: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreerMissionPayload {
    pub saison_id: i64,
    pub camion_id: i64,
    pub chauffeur_id: Option<i64>,
    pub usine_id: Option<i64>,
    pub cgi_id: Option<i64>,
    pub av_id: Option<i64>,
    pub date_mission: String,
    pub observations: Option<String>,
}

/// Payload de modification : le formulaire frontend fournit l'ensemble des
/// champs modifiables. Un champ optionnel à `None` (null) est effacé.
#[derive(Debug, Deserialize)]
pub struct ModifierMissionPayload {
    pub camion_id: i64,
    pub chauffeur_id: Option<i64>,
    pub usine_id: Option<i64>,
    pub cgi_id: Option<i64>,
    pub av_id: Option<i64>,
    pub date_mission: String,
    pub observations: Option<String>,
}
