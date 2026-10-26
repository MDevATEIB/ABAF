//! Contrats d'échange du serveur de synchronisation.
//!
//! Ces structures définissent le JSON vu par les téléphones. Le miroir
//! TypeScript vit dans `mobile/src/types/api.ts` et **doit rester aligné** avec
//! ce fichier : toute colonne ajoutée ici doit y être reprise.
//!
//! Règle fondatrice : le mobile ne manipule que des UUID. Les `INTEGER`
//! internes ne quittent jamais le poste ; ils sont résolus ici, à l'entrée des
//! écritures (`uuid → id`) et à la sortie des payloads (`id → uuid`, fait par
//! les triggers SQLite).

use serde::{Deserialize, Serialize};

/// Une ligne du journal des changements, telle que tirée par un téléphone.
#[derive(Debug, Serialize)]
pub struct Changement {
    pub lvn: i64,
    /// Nom de la table concernée (`depenses`, `camions`, ...).
    pub table_x: String,
    /// UUID de la ligne.
    #[serde(rename = "ref")]
    pub reference: String,
    /// `upsert` | `delete`.
    pub op: String,
    /// Image JSON de la ligne, `None` pour une suppression (tombstone).
    pub payload: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct PullRequest {
    /// Dernier `lvn` vu par l'appareil. 0 pour une synchronisation complète.
    pub since: i64,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct PullResponse {
    pub changes: Vec<Changement>,
    /// Curseur à mémoriser pour le prochain tirage.
    pub cursor: i64,
    /// `true` s'il reste des lignes au-delà de la limite : le client rappelle.
    pub has_more: bool,
    /// Le client est plus ancien que le début du journal (journal compacté) :
    /// il doit se réinitialiser avant de rejouer.
    pub reset: bool,
    pub server_time: String,
}

#[derive(Debug, Deserialize)]
pub struct PairRequest {
    pub code: String,
    /// Nom commercial du téléphone, affiché dans la liste des appareils.
    pub nom_appareil: String,
    /// Agent qui porte l'appareil (chauffeur, chef de parc, mécanicien...).
    #[serde(default)]
    pub agent: String,
}

/// Campagne active renvoyée à l'appairage : le terrain ne demande jamais la
/// liste des campagnes, il travaille sur celle du poste.
#[derive(Debug, Serialize)]
pub struct SaisonActive {
    pub uuid: String,
    pub libelle: String,
}

#[derive(Debug, Serialize)]
pub struct PairResponse {
    /// Jeton secret, renvoyé une seule fois, à stocker dans le trousseau du
    /// téléphone (`expo-secure-store`).
    pub token: String,
    pub device_uuid: String,
    pub saison_active: Option<SaisonActive>,
    pub server_time: String,
}

/// Dépense telle que saisie sur le terrain. Le statut n'est **pas** poussé :
/// c'est le poste qui audite, le terrain ne produit que des brouillons.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct DepenseWire {
    pub uuid: String,
    pub saison_uuid: String,
    #[serde(default)]
    pub camion_uuid: Option<String>,
    #[serde(default)]
    pub mission_uuid: Option<String>,
    #[serde(default)]
    pub chauffeur_uuid: Option<String>,
    #[serde(default)]
    pub apprenti_uuid: Option<String>,
    #[serde(default)]
    pub mecanicien_uuid: Option<String>,
    #[serde(default)]
    pub piece_uuid: Option<String>,
    pub categorie: String,
    pub designation: String,
    #[serde(default)]
    pub quantite: Option<f64>,
    #[serde(default)]
    pub unite: Option<String>,
    pub montant: f64,
    pub date_depense: String,
    #[serde(default)]
    pub lieu: Option<String>,
    #[serde(default)]
    pub observations: Option<String>,
    #[serde(default)]
    pub photo: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Intervenant créé ou corrigé sur le terrain.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct IntervenantWire {
    pub uuid: String,
    pub nom: String,
    #[serde(default)]
    pub prenom: Option<String>,
    #[serde(default)]
    pub telephone: Option<String>,
    pub role: String,
    #[serde(default = "wire_actif")]
    pub actif: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// Pièce de rechange ajoutée au catalogue depuis le terrain.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct PieceWire {
    pub uuid: String,
    pub nom: String,
    #[serde(default)]
    pub categorie: Option<String>,
    #[serde(default = "wire_unite")]
    pub unite: String,
    #[serde(default = "wire_actif")]
    pub actif: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// Camion du parc : le terrain peut corriger une immatriculation lue de
/// travers, jamais en inventer une sans raison.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct CamionWire {
    pub uuid: String,
    pub immatriculation: String,
    #[serde(default)]
    pub marque: Option<String>,
    #[serde(default)]
    pub modele: Option<String>,
    #[serde(default)]
    pub capacite_tonnes: Option<f64>,
    #[serde(default = "wire_actif")]
    pub actif: i64,
    pub updated_at: String,
}

/// Lot poussé par un téléphone. Tous les tableaux sont optionnels : un
/// appareil envoie ce qu'il a en file, dans l'ordre qui lui arrange.
#[derive(Debug, Deserialize, Default)]
pub struct PushRequest {
    #[serde(default)]
    pub depenses: Vec<DepenseWire>,
    #[serde(default)]
    pub intervenants: Vec<IntervenantWire>,
    #[serde(default)]
    pub pieces_rechange: Vec<PieceWire>,
    #[serde(default)]
    pub camions: Vec<CamionWire>,
}

/// Sortie d'une ligne poussée.
#[derive(Debug, Serialize)]
pub struct ResultatLigne {
    pub uuid: String,
    /// `ok` (créé) | `updated` | `merged` (doublon métier) | `rejected`.
    pub status: String,
    /// Motif du rejet ou de la fusion, compris par le téléphone.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub motif: Option<String>,
    /// UUID retenu par le serveur lors d'une fusion : le téléphone réécrit le
    /// sien via sa table `uuid_alias`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub merged_into: Option<String>,
    /// Image de la ligne côté poste, pour recalage du client.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_row: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct PushResponse {
    pub results: Vec<ResultatLigne>,
    pub cursor: i64,
    pub server_time: String,
}

/// Photo de justificatif poussée par le terrain.
#[derive(Debug, Deserialize)]
pub struct PhotoWire {
    pub depense_uuid: String,
    #[serde(default)]
    pub filename: Option<String>,
    #[serde(default)]
    pub mime: Option<String>,
    /// Contenu JPEG encodé en base64 (sans préfixe `data:`).
    pub base64: String,
}

#[derive(Debug, Deserialize)]
pub struct PhotosRequest {
    pub items: Vec<PhotoWire>,
}

#[derive(Debug, Serialize)]
pub struct ResultatPhoto {
    pub depense_uuid: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub motif: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PhotosResponse {
    pub results: Vec<ResultatPhoto>,
}

/// Réponse de détection, sans jeton : sert au téléphone à reconnaître un poste
/// ABAF avant de demander un appairage.
#[derive(Debug, Serialize)]
pub struct HelloResponse {
    pub server_name: String,
    pub schema_version: String,
    pub time: String,
}

/// Erreur du protocole, renvoyée avec un code HTTP explicite.
#[derive(Debug, Serialize)]
pub struct ReponseErreur {
    pub erreur: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

fn wire_actif() -> i64 {
    1
}

fn wire_unite() -> String {
    "u".to_string()
}
