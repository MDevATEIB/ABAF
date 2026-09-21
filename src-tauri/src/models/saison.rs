use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Saison {
    pub id: i64,
    pub libelle: String,
    pub date_debut: String,
    pub date_fin: Option<String>,
    pub statut: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreerSaisonPayload {
    pub libelle: String,
    pub date_debut: String,
    pub date_fin: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ModifierSaisonPayload {
    pub libelle: Option<String>,
    pub date_debut: Option<String>,
    pub date_fin: Option<String>,
}
