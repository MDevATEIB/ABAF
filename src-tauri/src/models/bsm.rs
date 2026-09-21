use serde::{Deserialize, Serialize};

/// Ordre du cycle de vie d'un BSM (AGENT.md §11).
pub const STATUTS_BSM: [&str; 3] = ["ouvert", "cloture", "facture"];

/// Position d'un statut dans le cycle de vie du BSM.
pub fn index_statut_bsm(statut: &str) -> Option<usize> {
    STATUTS_BSM.iter().position(|s| *s == statut)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BSM {
    pub id: i64,
    pub numero: String,
    pub saison_id: i64,
    pub mission_id: Option<i64>,
    pub camion_id: i64,
    pub usine_id: Option<i64>,
    pub date_bsm: String,
    pub beneficiaire: Option<String>,
    pub quantite_litres: f64,
    pub prix_litre: f64,
    pub montant: f64,
    pub imputation: Option<String>,
    pub reference: Option<String>,
    pub statut: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreerBsmPayload {
    pub numero: String,
    pub saison_id: i64,
    pub mission_id: Option<i64>,
    pub camion_id: i64,
    pub usine_id: Option<i64>,
    pub date_bsm: String,
    pub beneficiaire: Option<String>,
    pub quantite_litres: f64,
    pub prix_litre: f64,
    pub imputation: Option<String>,
    pub reference: Option<String>,
}

/// Payload de modification : le formulaire frontend fournit l'ensemble des
/// champs modifiables. Un champ optionnel à `None` (null) est effacé.
/// La saison et le statut d'un BSM ne sont pas modifiables ici.
#[derive(Debug, Deserialize)]
pub struct ModifierBsmPayload {
    pub numero: String,
    pub mission_id: Option<i64>,
    pub camion_id: i64,
    pub usine_id: Option<i64>,
    pub date_bsm: String,
    pub beneficiaire: Option<String>,
    pub quantite_litres: f64,
    pub prix_litre: f64,
    pub imputation: Option<String>,
    pub reference: Option<String>,
}
