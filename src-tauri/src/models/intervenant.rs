use serde::{Deserialize, Serialize};

/// Intervenant du parc : mécanicien, chef de parc ou apprenti aux côtés d'un
/// chauffeur. Peut être créé au bureau ou directement sur le terrain.
#[derive(Debug, Serialize, Clone)]
pub struct Intervenant {
    pub id: i64,
    pub uuid: String,
    pub nom: String,
    pub prenom: Option<String>,
    pub telephone: Option<String>,
    /// `mecanicien` | `chef_parc` | `apprenti`.
    pub role: String,
    pub actif: i64,
    /// `desktop` | `mobile`.
    pub source: String,
    pub device_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    /// Nom de l'appareil de terrain à l'origine de la création.
    pub appareil: Option<String>,
    /// Nombre de dépenses rattachées (information de l'utilisateur avant
    /// désactivation).
    pub nb_depenses: i64,
}

pub const ROLES_INTERVENANT: &[&str] = &["mecanicien", "chef_parc", "apprenti"];

/// Vrai si `role` fait partie de la nomenclature.
pub fn role_valide(role: &str) -> bool {
    ROLES_INTERVENANT.contains(&role)
}

#[derive(Debug, Deserialize)]
pub struct CreerIntervenantPayload {
    pub nom: String,
    pub prenom: Option<String>,
    pub telephone: Option<String>,
    pub role: String,
}

#[derive(Debug, Deserialize)]
pub struct ModifierIntervenantPayload {
    pub nom: Option<String>,
    pub prenom: Option<String>,
    pub telephone: Option<String>,
    pub role: Option<String>,
}
