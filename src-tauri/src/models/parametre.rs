use serde::{Deserialize, Serialize};

/// Paramètres généraux de l'application (Phase 6, étapes 31 et 32). Stockés en
/// base clé/valeur et édités dans la page Paramètres. Les informations de
/// l'entreprise alimentent les en-têtes des documents imprimés (§20.1, §20.3) ;
/// sauvegarde_auto active la copie de sécurité au démarrage (§24.3).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parametres {
    pub entreprise_nom: String,
    pub entreprise_adresse: String,
    pub entreprise_telephone: String,
    pub entreprise_email: String,
    pub sauvegarde_auto: bool,
}
