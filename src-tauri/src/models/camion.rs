use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Camion {
    pub id: i64,
    pub immatriculation: String,
    pub marque: Option<String>,
    pub modele: Option<String>,
    pub capacite_tonnes: Option<f64>,
    pub actif: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreerCamionPayload {
    pub immatriculation: String,
    pub marque: Option<String>,
    pub modele: Option<String>,
    pub capacite_tonnes: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct ModifierCamionPayload {
    pub immatriculation: Option<String>,
    pub marque: Option<String>,
    pub modele: Option<String>,
    pub capacite_tonnes: Option<f64>,
}
