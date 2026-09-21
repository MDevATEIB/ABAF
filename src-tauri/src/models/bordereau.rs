use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Bordereau {
    pub id: i64,
    pub numero: String,
    pub saison_id: i64,
    pub mission_id: Option<i64>,
    pub camion_id: i64,
    pub chauffeur_id: Option<i64>,
    pub usine_id: Option<i64>,
    pub cgi_id: Option<i64>,
    pub date_bordereau: String,
    pub poids_vide_kg: Option<f64>,
    pub poids_charge_kg: Option<f64>,
    pub poids_net_kg: Option<f64>,
    pub distance_km: Option<f64>,
    pub type_fret: Option<String>,
    pub tarif_applique: Option<f64>,
    pub unite_tarif: Option<String>,
    pub montant_brut: Option<f64>,
    pub statut: String,
    pub observations: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LigneBordereau {
    pub id: i64,
    pub bordereau_id: i64,
    pub av_id: Option<i64>,
    pub localite: Option<String>,
    pub poids_kg: f64,
    pub code: Option<String>,
    pub observations: Option<String>,
}

/// Une ligne du chargement : un AV et le poids de son lot.
#[derive(Debug, Deserialize)]
pub struct LigneBordereauPayload {
    pub av_id: Option<i64>,
    pub localite: Option<String>,
    pub poids_kg: f64,
    pub code: Option<String>,
    pub observations: Option<String>,
}

/// Les poids du bordereau (vide et chargé) sont repris automatiquement
/// des pesées de la mission : ils ne font pas partie du formulaire.
#[derive(Debug, Deserialize)]
pub struct CreerBordereauPayload {
    pub numero: String,
    pub saison_id: i64,
    pub mission_id: Option<i64>,
    pub camion_id: i64,
    pub chauffeur_id: Option<i64>,
    pub usine_id: Option<i64>,
    pub cgi_id: Option<i64>,
    pub date_bordereau: String,
    pub distance_km: Option<f64>,
    /// Type de fret du contrat (défaut « direct ») : détermine la tranche
    /// tarifaire appliquée à la validation.
    pub type_fret: Option<String>,
    pub observations: Option<String>,
    pub lignes: Vec<LigneBordereauPayload>,
}

/// Payload de modification (brouillon uniquement) : le formulaire fournit
/// l'ensemble des lignes, qui remplacent les précédentes.
#[derive(Debug, Deserialize)]
pub struct ModifierBordereauPayload {
    pub numero: String,
    pub mission_id: Option<i64>,
    pub camion_id: i64,
    pub chauffeur_id: Option<i64>,
    pub usine_id: Option<i64>,
    pub cgi_id: Option<i64>,
    pub date_bordereau: String,
    pub distance_km: Option<f64>,
    pub type_fret: Option<String>,
    pub observations: Option<String>,
    pub lignes: Vec<LigneBordereauPayload>,
}
