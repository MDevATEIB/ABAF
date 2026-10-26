use serde::{Deserialize, Serialize};

/// Dépense d'exploitation saisie au bureau ou sur le terrain (module
/// Exploitation). Les montants ne touchent jamais les factures : ils sont
/// agrégés à part pour calculer la marge (CA net − charges).
#[derive(Debug, Serialize, Clone)]
pub struct Depense {
    pub id: i64,
    pub uuid: String,
    pub saison_id: i64,
    pub camion_id: Option<i64>,
    pub mission_id: Option<i64>,
    pub chauffeur_id: Option<i64>,
    pub apprenti_id: Option<i64>,
    pub mecanicien_id: Option<i64>,
    pub piece_id: Option<i64>,
    pub categorie: String,
    pub designation: String,
    pub quantite: Option<f64>,
    pub unite: Option<String>,
    pub montant: f64,
    pub date_depense: String,
    pub lieu: Option<String>,
    pub observations: Option<String>,
    /// Nom du fichier du justificatif dans `<données app>/justificatifs/`.
    pub photo: Option<String>,
    /// `brouillon` | `validee` | `rejete`.
    pub statut: String,
    pub motif_rejet: Option<String>,
    /// `desktop` | `mobile`.
    pub source: String,
    pub device_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub synced_at: Option<String>,

    // ── Libellés joints, calculés à la lecture pour l'affichage ─────────────
    pub camion: Option<String>,
    pub mission: Option<String>,
    pub chauffeur: Option<String>,
    pub apprenti: Option<String>,
    pub mecanicien: Option<String>,
    pub piece: Option<String>,
    /// Nom de l'appareil de terrain qui a saisi la ligne (`source = mobile`).
    pub appareil: Option<String>,
}

/// Nomenclature des catégories de charges d'exploitation.
pub const CATEGORIES_DEPENSE: &[&str] = &[
    "gasoil_hors_bsm",
    "piece_rechange",
    "main_oeuvre",
    "depannage",
    "pneu",
    "huile_entretien",
    "chef_parc",
    "perdiem",
    "peage",
    "stationnement",
    "amende",
    "autre",
];

pub const STATUTS_DEPENSE: &[&str] = &["brouillon", "validee", "rejete"];

/// Libellé affiché pour une catégorie de charge (exports et journaux côté
/// serveur ; l'interface dispose de sa propre carte pour les traduire).
pub fn libelle_categorie(categorie: &str) -> &str {
    match categorie {
        "gasoil_hors_bsm" => "Gasoil hors BSM",
        "piece_rechange" => "Pièce de rechange",
        "main_oeuvre" => "Main d'œuvre mécanicien",
        "depannage" => "Dépannage",
        "pneu" => "Pneu",
        "huile_entretien" => "Huile & entretien",
        "chef_parc" => "Indemnité chef de parc",
        "perdiem" => "Perdiem",
        "peage" => "Péage",
        "stationnement" => "Stationnement",
        "amende" => "Amende",
        "autre" => "Autre charge",
        autre => autre,
    }
}

/// Vrai si `categorie` fait partie de la nomenclature du module.
pub fn categorie_valide(categorie: &str) -> bool {
    CATEGORIES_DEPENSE.contains(&categorie)
}

/// Champs communs à la création et à la modification.
#[derive(Debug, Deserialize, Clone)]
pub struct DepenseFields {
    pub categorie: String,
    pub designation: String,
    pub quantite: Option<f64>,
    pub unite: Option<String>,
    pub montant: f64,
    pub date_depense: String,
    pub lieu: Option<String>,
    pub observations: Option<String>,
    pub camion_id: Option<i64>,
    pub mission_id: Option<i64>,
    pub chauffeur_id: Option<i64>,
    pub apprenti_id: Option<i64>,
    pub mecanicien_id: Option<i64>,
    pub piece_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreerDepensePayload {
    pub saison_id: i64,
    #[serde(flatten)]
    pub champs: DepenseFields,
}

#[derive(Debug, Deserialize)]
pub struct ModifierDepensePayload {
    #[serde(flatten)]
    pub champs: DepenseFields,
}

/// Filtres de la liste des dépenses. Tous optionnels : `None` = pas de filtre.
#[derive(Debug, Deserialize, Default)]
pub struct FiltresDepenses {
    pub saison_id: Option<i64>,
    pub camion_id: Option<i64>,
    pub categorie: Option<String>,
    pub statut: Option<String>,
    pub source: Option<String>,
    pub device_id: Option<String>,
    pub date_debut: Option<String>,
    pub date_fin: Option<String>,
    pub recherche: Option<String>,
}

/// Total des dépenses d'une catégorie (répartition affichée en graphique).
#[derive(Debug, Serialize)]
pub struct TotalParCategorie {
    pub categorie: String,
    pub montant: f64,
    pub nb_lignes: i64,
}

/// Synthèse d'une campagne pour le tableau de bord : charges d'exploitation
/// et marge résultante.
#[derive(Debug, Serialize, Default)]
pub struct SyntheseExploitation {
    /// Total des dépenses validées.
    pub charges_valides: f64,
    /// Total des dépenses encore en brouillon (terrain non audité).
    pub charges_en_attente: f64,
    /// Nombre de lignes validées.
    pub nb_charges: i64,
    /// Nombre de lignes en attente de validation.
    pub nb_charges_attente: i64,
    /// Rejets comptabilisés (information de qualité).
    pub nb_charges_rejetees: i64,
}

/// Justificatif photo d'une dépense, remonté à l'interface pour l'aperçu : le
/// fichier vit sur disque, seul son nom est en base.
#[derive(Debug, Serialize)]
pub struct JustificatifDepense {
    pub nom: String,
    pub chemin: String,
    /// Contenu encodé en `data:image/jpeg;base64,...`.
    pub data_url: String,
}
