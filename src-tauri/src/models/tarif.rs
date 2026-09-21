use serde::{Deserialize, Serialize};

/// Ligne du barème d'une campagne (CDC v1.1) : une tranche de distance pour
/// un type de fret, exprimée soit en FCFA/tonne (≤ 90 km), soit en FCFA/TKM
/// (au-delà). `distance_max` NULL = tranche ouverte (« 91 km et plus »).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Tarif {
    pub id: i64,
    pub saison_id: i64,
    pub type_fret: String,
    pub distance_min: f64,
    pub distance_max: Option<f64>,
    pub unite_tarif: String,
    pub tarif: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreerTarifPayload {
    pub saison_id: i64,
    pub type_fret: String,
    pub distance_min: f64,
    pub distance_max: Option<f64>,
    pub unite_tarif: String,
    pub tarif: f64,
}

/// Payload de modification : le formulaire fournit la tranche complète.
#[derive(Debug, Deserialize)]
pub struct ModifierTarifPayload {
    pub type_fret: String,
    pub distance_min: f64,
    pub distance_max: Option<f64>,
    pub unite_tarif: String,
    pub tarif: f64,
}
