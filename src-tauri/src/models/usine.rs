use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Usine {
    pub id: i64,
    pub nom: String,
    pub localite: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreerUsinePayload {
    pub nom: String,
    pub localite: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ModifierUsinePayload {
    pub nom: Option<String>,
    pub localite: Option<String>,
}
