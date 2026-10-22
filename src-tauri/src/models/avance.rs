use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Avance {
    pub id: i64,
    pub saison_id: i64,
    pub date_avance: String,
    pub montant_initial: f64,
    pub montant_utilise: f64,
    pub reference: Option<String>,
    pub observations: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UtilisationAvance {
    pub id: i64,
    pub avance_id: i64,
    pub facture_id: Option<i64>,
    pub date_utilisation: String,
    pub montant: f64,
    pub observations: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreerAvancePayload {
    pub saison_id: i64,
    pub date_avance: String,
    pub montant_initial: f64,
    pub reference: Option<String>,
    pub observations: Option<String>,
}

/// Payload d'utilisation : le frontend cible l'avance ; la facture réglée
/// par l'utilisation est facultative.
#[derive(Debug, Deserialize)]
pub struct UtilisationAvancePayload {
    pub avance_id: i64,
    pub facture_id: Option<i64>,
    pub date_utilisation: String,
    pub montant: f64,
    pub observations: Option<String>,
}
