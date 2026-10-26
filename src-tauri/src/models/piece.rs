use serde::{Deserialize, Serialize};

/// Pièce du catalogue des pièces de rechange, rattachée aux dépenses de la
/// catégorie `piece_rechange`.
#[derive(Debug, Serialize, Clone)]
pub struct PieceRechange {
    pub id: i64,
    pub uuid: String,
    pub nom: String,
    pub categorie: Option<String>,
    pub unite: String,
    pub actif: i64,
    /// `desktop` | `mobile`.
    pub source: String,
    pub device_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub appareil: Option<String>,
    /// Nombre de dépenses rattachées à cette pièce.
    pub nb_depenses: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreerPiecePayload {
    pub nom: String,
    pub categorie: Option<String>,
    pub unite: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ModifierPiecePayload {
    pub nom: Option<String>,
    pub categorie: Option<String>,
    pub unite: Option<String>,
}
