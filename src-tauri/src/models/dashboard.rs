use serde::Serialize;

use crate::models::rapport::{ComparaisonCampagne, TotauxRapport};

/// Données du tableau de bord (AGENT.md §17) : indicateurs de la campagne
/// sélectionnée (opérations, transport, gasoil, finances), nombre de camions
/// actifs du parc et comparaison des campagnes pour les graphiques.
#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub saison_id: i64,
    pub saison_libelle: String,
    /// Indépendant de la campagne : camions dont le statut est actif.
    pub nb_camions_actifs: i64,
    pub totaux: TotauxRapport,
    pub comparaison: Vec<ComparaisonCampagne>,
}
