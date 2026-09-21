use serde::Serialize;

/// Synthèse en lecture seule des livraisons d'une campagne.
///
/// Une livraison correspond à un bordereau validé (ou facturé) : les
/// agrégations sont calculées en SQL à partir des mouvements existants
/// (saisie unique, AGENT.md §16).
#[derive(Debug, Serialize)]
pub struct SyntheseLivraisons {
    pub nb_livraisons: i64,
    pub poids_net_total_kg: f64,
    pub par_camion: Vec<LivraisonsParCamion>,
    pub par_av: Vec<LivraisonsParAv>,
}

#[derive(Debug, Serialize)]
pub struct LivraisonsParCamion {
    pub camion_id: i64,
    pub nb_livraisons: i64,
    pub poids_net_kg: f64,
}

/// Totaux par AV issus des lignes de chargement des bordereaux livrés.
#[derive(Debug, Serialize)]
pub struct LivraisonsParAv {
    pub av_id: i64,
    pub nb_lots: i64,
    pub poids_lots_kg: f64,
}
