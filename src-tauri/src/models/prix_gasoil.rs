use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PrixGasoil {
    pub id: i64,
    pub saison_id: i64,
    pub prix_litre: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct SetPrixGasoilPayload {
    pub saison_id: i64,
    pub prix_litre: f64,
}
