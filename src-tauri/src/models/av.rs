use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Av {
    pub id: i64,
    pub nom: String,
    pub cgi_id: Option<i64>,
    pub localite: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreerAvPayload {
    pub nom: String,
    pub cgi_id: Option<i64>,
    pub localite: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ModifierAvPayload {
    pub nom: Option<String>,
    pub cgi_id: Option<i64>,
    pub localite: Option<String>,
}
