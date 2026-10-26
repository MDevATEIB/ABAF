use serde::Serialize;

use crate::models::exploitation::CategorieCharge;

/// Ligne du tableau des opérations (colonnes du rapport annuel, AGENT.md §7.2).
/// Une ligne correspond à un bordereau de la campagne ; les données gasoil et
/// facturation sont rattachées via la mission et les lignes de facture.
#[derive(Debug, Serialize)]
pub struct LigneRapport {
    pub bordereau_id: i64,
    pub numero_bordereau: String,
    pub date_bordereau: String,
    pub numero_facture: Option<String>,
    pub numero_camion: Option<String>,
    pub usine: Option<String>,
    pub cgi: Option<String>,
    pub av: Option<String>,
    pub poids_coton_kg: Option<f64>,
    pub poids_intrants_kg: f64,
    pub distance_km: Option<f64>,
    pub gasoil_litres: f64,
    pub gasoil_montant: f64,
    pub montant_net: Option<f64>,
    pub observations: Option<String>,
    pub numeros_bms: Option<String>,
}

/// Totaux d'une campagne, toutes opérations confondues.
#[derive(Debug, Serialize)]
pub struct TotauxRapport {
    pub nb_missions: i64,
    pub nb_bordereaux: i64,
    pub nb_bsm: i64,
    pub nb_factures: i64,
    pub nb_paiements: i64,
    pub tonnage_coton_kg: f64,
    pub tonnage_intrants_kg: f64,
    pub distance_totale_km: f64,
    pub gasoil_litres: f64,
    pub gasoil_montant: f64,
    pub montant_brut: f64,
    pub montant_gasoil: f64,
    pub montant_net: f64,
    pub montant_paye: f64,
    pub montant_impaye: f64,
    pub avances_initiales: f64,
    pub avances_utilisees: f64,
    pub solde_avances: f64,
    // ── Synthèse exploitation (module Exploitation, hors CDC v1.1) ──────────
    /// Montant des charges d'exploitation validées de la campagne.
    pub total_depenses: f64,
    /// Nombre de dépenses validées.
    pub depenses_validees: i64,
    /// Montant des dépenses encore en brouillon (terrain non audité).
    pub depenses_en_attente: f64,
    /// `montant_net − total_depenses` : marge réelle du parc.
    pub marge_nette: f64,
}

/// Facture incluse dans le relevé imprimé d'une campagne.
#[derive(Debug, Serialize)]
pub struct FactureReleve {
    pub numero: String,
    pub date_facture: String,
    pub usine: Option<String>,
    pub montant_net: f64,
}

/// Récapitulatif des mouvements d'une campagne (AGENT.md §16).
#[derive(Debug, Serialize)]
pub struct Recapitulatif {
    pub saison_id: i64,
    pub saison_libelle: String,
    pub date_debut: String,
    pub date_fin: Option<String>,
    pub lignes: Vec<LigneRapport>,
    pub factures: Vec<FactureReleve>,
    pub totaux: TotauxRapport,
}

/// BSM listé dans les « données BMS » du rapport annuel (AGENT.md §20.4).
#[derive(Debug, Serialize)]
pub struct BsmRapport {
    pub numero: String,
    pub date_bsm: String,
    pub camion: Option<String>,
    pub beneficiaire: Option<String>,
    pub quantite_litres: f64,
    pub montant: f64,
    pub statut: String,
}

/// Règlement listé dans le rapport annuel.
#[derive(Debug, Serialize)]
pub struct PaiementRapport {
    pub date_paiement: String,
    pub numero_facture: Option<String>,
    pub montant: f64,
    pub mode_paiement: Option<String>,
    pub statut: String,
}

/// Ligne de comparaison avec les campagnes précédentes (AGENT.md §20.4).
#[derive(Debug, Serialize)]
pub struct ComparaisonCampagne {
    pub saison_id: i64,
    pub libelle: String,
    pub nb_bordereaux: i64,
    pub tonnage_coton_kg: f64,
    pub distance_totale_km: f64,
    pub gasoil_litres: f64,
    pub montant_net: f64,
}

/// Rapport annuel d'une campagne, généré automatiquement depuis les
/// opérations enregistrées (AGENT.md §7 et §20.4).
#[derive(Debug, Serialize)]
pub struct RapportAnnuel {
    pub saison_id: i64,
    pub saison_libelle: String,
    pub date_debut: String,
    pub date_fin: Option<String>,
    pub lignes: Vec<LigneRapport>,
    pub totaux: TotauxRapport,
    pub bsms: Vec<BsmRapport>,
    pub paiements: Vec<PaiementRapport>,
    pub comparaison: Vec<ComparaisonCampagne>,
    /// Charges validées de la campagne par catégorie (bloc « Synthèse
    /// exploitation » du rapport et de l'export Excel).
    pub charges_par_categorie: Vec<CategorieCharge>,
}
