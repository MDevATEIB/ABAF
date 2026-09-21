use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Pesee {
    pub id: i64,
    pub mission_id: i64,
    pub camion_id: i64,
    pub usine_id: Option<i64>,
    pub type_pesee: String,
    pub poids_kg: f64,
    pub date_pesee: String,
    pub heure_pesee: Option<String>,
    pub ticket_pesee: Option<String>,
    pub created_at: String,
}

/// Le camion et l'usine sont repris automatiquement de la mission
/// (saisie unique : une information n'est saisie qu'une seule fois).
#[derive(Debug, Deserialize)]
pub struct CreerPeseePayload {
    pub mission_id: i64,
    pub type_pesee: String,
    pub poids_kg: f64,
    pub date_pesee: String,
    pub heure_pesee: Option<String>,
    pub ticket_pesee: Option<String>,
}
