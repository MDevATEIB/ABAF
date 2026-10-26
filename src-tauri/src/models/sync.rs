use serde::{Deserialize, Serialize};

/// Téléphone de terrain appairé avec le poste de gestion.
#[derive(Debug, Serialize)]
pub struct Appareil {
    pub uuid: String,
    pub nom: String,
    pub agent: String,
    /// `actif` | `revoque`.
    pub statut: String,
    pub created_at: String,
    pub last_seen_at: Option<String>,
    /// Nombre de lignes reçues de cet appareil depuis l'appairage.
    pub nb_lignes_sync: i64,
    /// Dernier curseur de journal récupéré par l'appareil.
    pub last_pull_lvn: i64,
    /// Nombre de changements du poste qu'il n'a pas encore téléchargés.
    pub nb_changes_en_attente: i64,
    /// Dépenses de cet appareil encore en brouillon au bureau.
    pub nb_depenses_a_valider: i64,
}

/// État de la synchronisation affiché dans Paramètres.
#[derive(Debug, Serialize)]
pub struct EtatSync {
    /// Le serveur HTTP de synchronisation est démarré.
    pub actif: bool,
    pub port: u16,
    pub port_decouverte: u16,
    /// Adresses IPv4 de la machine à communiquer au terrain.
    pub adresses: Vec<String>,
    pub nb_appareils_actifs: i64,
    pub nb_appareils_revoques: i64,
    /// Dépenses saisies sur le terrain et non encore validées au bureau.
    pub nb_depenses_a_valider: i64,
    /// Dernier changement enregistré dans le journal de synchronisation.
    pub dernier_lvn: i64,
    /// Un code d'appairage est en cours de validité.
    pub appairage_en_cours: bool,
    /// Date d'expiration du code d'appairage en cours (`YYYY-MM-DD HH:MM:SS`).
    pub appairage_expire_a: Option<String>,
    pub dossier_justificatifs: String,
    pub nb_justificatifs: i64,
    pub taille_justificatifs_octets: i64,
}

#[derive(Debug, Deserialize)]
pub struct GenererCodePayload {
    /// Nom de l'appareil qui va s'appairer, affiché dans la liste pour
    /// reconnaitre le téléphone concerné.
    pub appareil: Option<String>,
}

/// Réponse de la génération d'un code d'appairage : le code en clair n'est
/// jamais stocké ni relus, seul son empreinte est conservée côté serveur.
#[derive(Debug, Serialize)]
pub struct CodeAppairage {
    pub code: String,
    pub expire_a: String,
    pub duree_secondes: i64,
}
