use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Cgi {
    pub id: i64,
    pub nom: String,
    pub usine_id: i64,
    pub localite: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreerCgiPayload {
    pub nom: String,
    pub usine_id: i64,
    pub localite: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ModifierCgiPayload {
    pub nom: Option<String>,
    pub usine_id: Option<i64>,
    pub localite: Option<String>,
}
