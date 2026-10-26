//! Serveur HTTP local de synchronisation avec les applications de terrain.
//!
//! Le poste de gestion tient toujours le rôle de serveur et reste la source de
//! vérité : `abaf.db` est la base de référence, les téléphones n'envoient que
//! des propositions que le poste accepte, fusionne ou rejette. Le serveur est
//! démarré à la demande depuis l'écran Paramètres ; sans lui, l'application
//! desktop fonctionne exactement comme avant.

pub mod auth;
pub mod discover;
pub mod handlers;
pub mod payloads;
pub mod server;

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU16, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tokio::sync::oneshot;

/// Port d'écoute par défaut du serveur HTTP de synchronisation.
pub const PORT_DEFAUT: u16 = 9470;
/// Port de découverte UDP (diffusion du nom du poste sur le WiFi partagé).
pub const PORT_DECOUVERTE: u16 = 9471;
/// Version du schéma de la base, annoncée au téléphone lors de la détection :
/// un poste plus ancien que l'application refuse l'appairage.
pub const SCHEMA_VERSION: &str = "7";
/// Nombre maximal de tentatives d'appairage par minute et par adresse.
const TENTATIVES_PAIR_MAX: u32 = 5;
/// Fenêtre de comptage des tentatives d'appairage.
const FENETRE_TENTATIVES: std::time::Duration = std::time::Duration::from_secs(60);

/// Pilote du serveur, géré par Tauri et partagé avec les tâches axum.
pub struct SyncState {
    /// Le serveur accepte des requêtes.
    pub running: AtomicBool,
    /// Port réellement occupé par le serveur HTTP.
    pub port: AtomicU16,
    /// Émetteur du signal d'arrêt, pris par la tâche du serveur HTTP.
    pub stop: Mutex<Option<oneshot::Sender<()>>>,
    /// Stop du service de découverte UDP.
    pub stop_decouverte: Mutex<Option<oneshot::Sender<()>>>,
    /// Compteur de tentatives d'appairage par adresse IP (anti force-brute du
    /// code à 6 chiffres).
    pub(crate) tentatives_pair: Mutex<HashMap<String, Tentatives>>,
    /// Nombre de requêtes traitées depuis le démarrage, pour le diagnostic.
    pub dernieres_requetes: AtomicU64,
}

pub(crate) struct Tentatives {
    nb: u32,
    debut: Instant,
}

impl SyncState {
    pub fn new() -> Self {
        SyncState {
            running: AtomicBool::new(false),
            port: AtomicU16::new(PORT_DEFAUT),
            stop: Mutex::new(None),
            stop_decouverte: Mutex::new(None),
            tentatives_pair: Mutex::new(HashMap::new()),
            dernieres_requetes: AtomicU64::new(0),
        }
    }

    pub fn est_actif(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }

    pub fn port_ecoute(&self) -> u16 {
        self.port.load(Ordering::Relaxed)
    }

    /// Vrai si l'adresse est encore autorisée à tenter un appairage. Le code
    /// étant à durée limitée, un renouvellement de code ne remet pas le
    /// compteur à zéro : il est global à l'adresse.
    pub fn autoriser_pair(&self, adresse: &str) -> bool {
        let mut compteur = match self.tentatives_pair.lock() {
            Ok(compteur) => compteur,
            // Verrou embrouillé : on refuse plutôt que d'ouvrir la porte.
            Err(_) => return false,
        };
        let maintenant = Instant::now();
        match compteur.get_mut(adresse) {
            Some(entree) if entree.debut.elapsed() < FENETRE_TENTATIVES => {
                entree.nb += 1;
                entree.nb <= TENTATIVES_PAIR_MAX
            }
            _ => {
                compteur.insert(
                    adresse.to_string(),
                    Tentatives { nb: 1, debut: maintenant },
                );
                true
            }
        }
    }

    /// Oublie les compteurs (appelé quand un appairage réussit).
    pub fn reinitialiser_pair(&self, adresse: &str) {
        if let Ok(mut compteur) = self.tentatives_pair.lock() {
            compteur.remove(adresse);
        }
    }

    pub fn compter_requete(&self) {
        self.dernieres_requetes.fetch_add(1, Ordering::Relaxed);
    }
}

impl Default for SyncState {
    fn default() -> Self {
        Self::new()
    }
}

/// Erreur du protocole : un code HTTP et un message machine, jamais du texte
/// libre, pour que le téléphone puisse réagir programmatiquement.
#[derive(Debug)]
pub struct ErreurHttp {
    pub code: axum::http::StatusCode,
    pub erreur: String,
    pub detail: Option<String>,
}

impl ErreurHttp {
    fn nouveau(code: axum::http::StatusCode, erreur: &str, detail: Option<String>) -> Self {
        ErreurHttp { code, erreur: erreur.to_string(), detail }
    }

    pub fn non_authorise(raison: &str) -> Self {
        Self::nouveau(axum::http::StatusCode::UNAUTHORIZED, raison, None)
    }

    pub fn interdiction(raison: &str) -> Self {
        Self::nouveau(axum::http::StatusCode::FORBIDDEN, raison, None)
    }

    pub fn requete_invalide(detail: impl Into<String>) -> Self {
        Self::nouveau(
            axum::http::StatusCode::BAD_REQUEST,
            "requete_invalide",
            Some(detail.into()),
        )
    }

    pub fn introuvable(raison: &str) -> Self {
        Self::nouveau(axum::http::StatusCode::NOT_FOUND, raison, None)
    }

    pub fn trop_de_tentatives() -> Self {
        Self::nouveau(axum::http::StatusCode::TOO_MANY_REQUESTS, "trop_de_tentatives", None)
    }

    pub fn interne(detail: impl Into<String>) -> Self {
        Self::nouveau(axum::http::StatusCode::INTERNAL_SERVER_ERROR, "erreur_interne", Some(detail.into()))
    }
}

impl axum::response::IntoResponse for ErreurHttp {
    fn into_response(self) -> axum::response::Response {
        let corps = payloads::ReponseErreur { erreur: self.erreur, detail: self.detail };
        (self.code, axum::Json(corps)).into_response()
    }
}

/// État injecté dans le routeur axum : clonable, peu coûteux.
#[derive(Clone)]
pub struct EtatServeur {
    pub db: Arc<Mutex<rusqlite::Connection>>,
    /// Dossier des justificatifs photo (`<données app>/justificatifs`).
    pub dossier_justificatifs: std::path::PathBuf,
    pub sync: Arc<SyncState>,
}
