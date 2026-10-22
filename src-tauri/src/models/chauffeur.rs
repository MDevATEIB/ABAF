use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Chauffeur {
    pub id: i64,
    pub nom: String,
    pub prenom: Option<String>,
    pub telephone: Option<String>,
    pub actif: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreerChauffeurPayload {
    pub nom: String,
    pub prenom: Option<String>,
    pub telephone: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ModifierChauffeurPayload {
    pub nom: Option<String>,
    pub prenom: Option<String>,
    pub telephone: Option<String>,
}
