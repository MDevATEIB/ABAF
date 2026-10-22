use crate::models::bordereau::Bordereau;
use crate::models::bsm::BSM;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Facture {
    pub id: i64,
    pub numero: String,
    pub saison_id: i64,
    pub client_id: i64,
    pub date_facture: String,
    pub montant_brut: f64,
    pub montant_gasoil: f64,
    pub montant_net: f64,
    pub tkm: Option<f64>,
    pub detail_trajet: Option<String>,
    pub mention_original_payable: bool,
    pub statut: String,
    pub observations: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LigneFacture {
    pub id: i64,
    pub facture_id: i64,
    pub bordereau_id: Option<i64>,
    pub bsm_id: Option<i64>,
    pub description: Option<String>,
    pub poids_net_kg: f64,
    pub distance_km: f64,
    pub tarif_tonne: f64,
    pub montant_brut: f64,
    pub montant_gasoil: f64,
    pub montant_net: f64,
}

/// Opérations facturables d'une campagne : bordereaux validés et BSM
/// qui ne sont pas encore rattachés à une facture.
#[derive(Debug, Serialize)]
pub struct OperationsDisponibles {
    pub bordereaux: Vec<Bordereau>,
    pub bsms: Vec<BSM>,
}

/// Payload de création : le frontend fournit les identifiants des opérations
/// sélectionnées, les montants sont calculés côté base (AGENT.md §13).
#[derive(Debug, Deserialize)]
pub struct CreerFacturePayload {
    /// Numéro de facture. Optionnel : si `None` ou chaîne vide, le backend
    /// attribue une valeur séquentielle par année (format `2026-0138`).
    #[serde(default)]
    pub numero: Option<String>,
    pub saison_id: i64,
    pub client_id: i64,
    pub date_facture: String,
    pub observations: Option<String>,
    /// Mention « ORIGINAL PAYABLE » sur l'exemplaire original (défaut : oui,
    /// CDC v1.1 §7.1).
    #[serde(default = "mention_payable_par_defaut")]
    pub mention_original_payable: bool,
    #[serde(default)]
    pub bordereau_ids: Vec<i64>,
    #[serde(default)]
    pub bsm_ids: Vec<i64>,
}

/// Valeur par défaut de la mention « ORIGINAL PAYABLE » : activée.
fn mention_payable_par_defaut() -> bool {
    true
}
