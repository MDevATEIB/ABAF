use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Client {
    pub id: i64,
    pub nom: String,
    pub adresse: Option<String>,
    pub telephone: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
