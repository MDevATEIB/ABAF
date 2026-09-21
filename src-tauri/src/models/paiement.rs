use serde::{Deserialize, Serialize};

/// Statuts d'un paiement : réglé, en attente (« impaye ») ou neutralisé
/// (« np »), sans supprimer la trace de la saisie.
pub const STATUTS_PAIEMENT: [&str; 3] = ["paye", "impaye", "np"];

/// Position d'un statut dans la liste des statuts de paiement.
pub fn index_statut_paiement(statut: &str) -> Option<usize> {
    STATUTS_PAIEMENT.iter().position(|s| *s == statut)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Paiement {
    pub id: i64,
    pub facture_id: i64,
    pub date_paiement: String,
    pub montant: f64,
    pub mode_paiement: Option<String>,
    pub reference: Option<String>,
    pub statut: String,
    pub observations: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreerPaiementPayload {
    pub facture_id: i64,
    pub date_paiement: String,
    pub montant: f64,
    pub mode_paiement: Option<String>,
    pub reference: Option<String>,
    pub statut: String,
    pub observations: Option<String>,
}

/// Payload de modification : le formulaire fournit l'ensemble des champs
/// modifiables. Un paiement reste rattaché à sa facture.
#[derive(Debug, Deserialize)]
pub struct ModifierPaiementPayload {
    pub date_paiement: String,
    pub montant: f64,
    pub mode_paiement: Option<String>,
    pub reference: Option<String>,
    pub statut: String,
    pub observations: Option<String>,
}
