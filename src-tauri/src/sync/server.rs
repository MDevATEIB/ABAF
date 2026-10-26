//! Démarrage et arrêt du serveur HTTP de synchronisation.
//!
//! Le serveur vit dans le processus Tauri : il partage la base de données avec
//! les écrans du poste, ce qui évite toute seconde source de vérité. Il n'est
//! écouté que si l'utilisateur l'allume depuis Paramètres.

use std::net::{IpAddr, SocketAddr};
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};

use axum::extract::DefaultBodyLimit;
use axum::routing::{get, post};
use axum::Router;
use rusqlite::Connection;
use tokio::net::TcpListener;
use tokio::sync::oneshot;

use super::{discover, handlers, EtatServeur, SyncState, PORT_DECOUVERTE, PORT_DEFAUT};

/// Plafond corporel d'une requête : un lot de photos peut peser plusieurs
/// mégaoctets en base64, le plafond par défaut d'axum (2 Mo) est trop juste.
const LIMITE_CORPS: usize = 8 * 1024 * 1024;

/// Construit le routeur du protocole. Séparé de `demarrer` pour être testé avec
/// `tower::ServiceExt::oneshot`, sans occupant un port.
pub fn construire_router(etat: EtatServeur) -> Router {
    Router::new()
        // Détection et appairage : les deux seuls parcours sans jeton.
        .route("/sync/hello", get(handlers::hello))
        .route("/sync/pair", post(handlers::pair))
        // Tout le reste exige un appareil appairé et actif.
        .route("/sync/pull", post(handlers::pull))
        .route("/sync/push", post(handlers::push))
        .route("/sync/photos", post(handlers::photos))
        .route("/sync/justificatif/{uuid}", get(handlers::justificatif))
        .layer(DefaultBodyLimit::max(LIMITE_CORPS))
        .with_state(etat)
}

/// Allume le serveur HTTP sur toutes les interfaces, plus la découverte UDP.
/// Retourne le port effectivement occupé. La liaison est faite **avant** le
/// spawn : un port déjà pris remonte une erreur lisible à l'interface.
pub async fn demarrer(
    db: Arc<Mutex<Connection>>,
    dossier_justificatifs: PathBuf,
    sync: Arc<SyncState>,
    port: u16,
    port_decouverte: u16,
) -> Result<u16, String> {
    if sync.est_actif() {
        return Err("Le serveur de synchronisation est déjà démarré.".to_string());
    }

    let adresses = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = TcpListener::bind(adresses)
        .await
        .map_err(|e| format!("Impossible d'ouvrir le port {port} : {e}"))?;
    let port_retenue = listener
        .local_addr()
        .map_err(|e| e.to_string())?
        .port();

    let etat = EtatServeur { db, dossier_justificatifs, sync: sync.clone() };
    let service = construire_router(etat).into_make_service_with_connect_info::<SocketAddr>();

    let (tx_arret, rx_arret) = oneshot::channel::<()>();
    *sync.stop.lock().map_err(|e| e.to_string())? = Some(tx_arret);
    sync.port.store(port_retenue, Ordering::Relaxed);
    sync.running.store(true, Ordering::Relaxed);

    // Boucle HTTP : s'arrête dès que le signal d'arrêt est émis, puis rend le
    // drapeau. Une panique dans la tâche laisse `running` faux au pire, jamais
    // un serveur cru considéré vivant.
    tauri::async_runtime::spawn({
        let sync = sync.clone();
        async move {
            let arret = async move {
                let _ = rx_arret.await;
            };
            if let Err(e) = axum::serve(listener, service).with_graceful_shutdown(arret).await {
                eprintln!("Serveur de synchronisation arrêté : {e}");
            }
            sync.running.store(false, Ordering::Relaxed);
        }
    });

    // Découverte UDP : le téléphone cherche le poste sur le réseau partagé.
    if let Err(e) = discover::demarrer(port_retenue, port_decouverte, sync.clone()) {
        // Le serveur HTTP reste utilisable : la découverte n'est qu'un confort.
        eprintln!("Découverte UDP indisponible : {e}");
    }

    Ok(port_retenue)
}

/// Éteint le serveur et le service de découverte.
pub fn arreter(sync: &SyncState) -> Result<(), String> {
    if !sync.est_actif() {
        return Err("Le serveur de synchronisation n'est pas démarré.".to_string());
    }
    if let Some(emetteur) = sync.stop.lock().map_err(|e| e.to_string())?.take() {
        let _ = emetteur.send(());
    }
    // La boucle UDP observe `running` : on le baisse immédiatement pour qu'elle
    // rende la main dans la seconde.
    sync.running.store(false, Ordering::Relaxed);
    Ok(())
}

/// Adresses IPv4 joignables depuis le terrain : l'adresse de la route par
/// défaut, puis l'adresse source de chacune des passerelles de hotspot
/// classiques. C'est cette liste qui est affichée dans Paramètres.
pub fn adresses_locales() -> Vec<String> {
    let mut adresses: Vec<IpAddr> = Vec::new();

    if let Ok(adresse) = local_ip_address::local_ip() {
        adresses.push(adresse);
    }

    // Le poste peut être passé par-dessus le téléphone : les trois passerelles
    // usuelles des hotspots Android, iOS et Windows sont sondées.
    for passerelle in ["192.168.43.1", "172.20.10.1", "192.168.137.1"] {
        if let Ok(adresse) = adresse_source_pour(passerelle) {
            adresses.push(adresse);
        }
    }

    let mut vues = Vec::new();
    for adresse in adresses {
        if !adresse.is_unspecified() && !vues.contains(&adresse) {
            vues.push(adresse);
        }
    }
    vues.sort();
    vues.iter().map(|adresse| adresse.to_string()).collect()
}

/// Adresse source que la machine utilise pour joindre une cible, sans envoyer un
/// seul paquet (l'association UDP suffit à consulter la table de routage).
fn adresse_source_pour(cible: &str) -> Result<IpAddr, std::io::Error> {
    let socket = std::net::UdpSocket::bind("0.0.0.0:0")?;
    socket.connect((cible, PORT_DECOUVERTE))?;
    Ok(socket.local_addr()?.ip())
}

/// Port d'écoute recommandé : celui enregistré dans les paramètres, ou le port
/// historique du produit.
pub fn port_par_defaut() -> u16 {
    PORT_DEFAUT
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::run_migrations;
    use crate::sync::auth;
    use axum::body::{to_bytes, Body};
    use axum::extract::connect_info::MockConnectInfo;
    use axum::http::{header, Request, StatusCode};
    use axum::Router;
    use base64::Engine as _;
    use tower::ServiceExt;
    use uuid::Uuid;

    /// Base en mémoire entièrement migrée, avec une campagne et un camion.
    /// Le second élément est un dossier temporaire de justificatifs, propre à
    /// chaque exécution.
    fn base() -> (Arc<Mutex<Connection>>, std::path::PathBuf) {
        let conn = Connection::open_in_memory().expect("base en mémoire");
        run_migrations(&conn).expect("migrations");
        conn.execute_batch(
            "INSERT INTO saisons (id, libelle, date_debut) VALUES (1, '2026-2027', '2026-01-01');
             INSERT INTO camions (id, immatriculation, capacite_tonnes) VALUES (1, 'AB-1234-CD', 25);",
        )
        .expect("amorçage");

        let dossier = std::env::temp_dir().join(format!("abaf-sync-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dossier).expect("dossier temporaire");
        (Arc::new(Mutex::new(conn)), dossier)
    }

    fn uuid_de(conn: &Arc<Mutex<Connection>>, table: &str, id: i64) -> String {
        let conn = conn.lock().unwrap();
        conn.query_row(&format!("SELECT uuid FROM {table} WHERE id = ?1"), [id], |r| r.get(0))
            .expect("uuid de l'amorce")
    }

    /// Déclare un appareil actif ; retourne (device_uuid, token en clair).
    fn appareil_actif(conn: &Arc<Mutex<Connection>>) -> (String, String) {
        let conn = conn.lock().unwrap();
        let device = Uuid::new_v4().to_string();
        let token = auth::generer_token();
        conn.execute(
            "INSERT INTO appareils (uuid, nom, agent, token_hash, statut) VALUES (?1, 'Tel', 'chef', ?2, 'actif')",
            rusqlite::params![device, auth::hacher_hex(token.as_bytes())],
        )
        .expect("appareil");
        (device, token)
    }

    /// Génère et enregistre un code d'appairage valide pour dix minutes.
    fn code_appairage(conn: &Arc<Mutex<Connection>>) -> String {
        let conn = conn.lock().unwrap();
        let code = auth::generer_code();
        auth::ecrire_parametre(&conn, "appairage_code_hash", &auth::hacher_hex(code.as_bytes()))
            .expect("hash");
        let exp: String = conn
            .query_row("SELECT datetime('now', '+10 minutes')", [], |r| r.get(0))
            .unwrap();
        auth::ecrire_parametre(&conn, "appairage_code_exp", &exp).expect("expiration");
        code
    }

    /// Routeur de test : le vrai routeur coiffé d'une adresse de connexion
    /// factice pour satisfaire l extracteur `ConnectInfo` de la route pair.
    fn routeur(db: Arc<Mutex<Connection>>, dossier: std::path::PathBuf) -> Router {
        let etat = EtatServeur { db, dossier_justificatifs: dossier, sync: Arc::new(SyncState::new()) };
        construire_router(etat).layer(MockConnectInfo(std::net::SocketAddr::from(([0, 0, 0, 0], 0))))
    }

    fn requete(methode: &str, uri: &str, corps: &str, jeton: Option<(&str, &str)>) -> Request<Body> {
        let mut builder = Request::builder()
            .method(methode)
            .uri(uri)
            .header(header::CONTENT_TYPE, "application/json");
        if let Some((device, token)) = jeton {
            builder = builder.header("x-device", device).header("x-token", token);
        }
        builder.body(Body::from(corps.to_string())).expect("requête")
    }

    async fn reponse(app: Router, req: Request<Body>) -> (StatusCode, serde_json::Value) {
        let res = app.oneshot(req).await.expect("service");
        let status = res.status();
        let octets = to_bytes(res.into_body(), 16 * 1024 * 1024).await.expect("corps");
        let json = serde_json::from_slice(&octets).unwrap_or(serde_json::Value::Null);
        (status, json)
    }

    fn depense_json(uuid: &str, saison: &str, camion: &str, montant: f64, maj: &str) -> String {
        serde_json::json!({
            "depenses": [{
                "uuid": uuid,
                "saison_uuid": saison,
                "camion_uuid": camion,
                "categorie": "gasoil_hors_bsm",
                "designation": "Gasoil hors BSM",
                "montant": montant,
                "date_depense": "2026-01-05",
                "created_at": "2026-01-05 08:00:00",
                "updated_at": maj
            }]
        })
        .to_string()
    }

    #[tokio::test]
    async fn hello_repond_sans_jeton() {
        let (db, dossier) = base();
        let (status, json) = reponse(routeur(db, dossier), requete("GET", "/sync/hello", "", None)).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(json["server_name"], "ABAF");
    }

    #[tokio::test]
    async fn pair_refuse_un_code_invalide() {
        let (db, dossier) = base();
        let _ = code_appairage(&db);
        let corps = serde_json::json!({ "code": "000000", "nom_appareil": "Tel" }).to_string();
        let (status, json) = reponse(routeur(db, dossier), requete("POST", "/sync/pair", &corps, None)).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert_eq!(json["erreur"], "code_invalide");
    }

    #[tokio::test]
    async fn pair_valide_enregistre_l_appareil_et_brule_le_code() {
        let (db, dossier) = base();
        let code = code_appairage(&db);
        let corps = serde_json::json!({ "code": code, "nom_appareil": "Tel Terrain", "agent": "Abakar" }).to_string();
        let (status, json) = reponse(routeur(db.clone(), dossier.clone()), requete("POST", "/sync/pair", &corps, None)).await;
        assert_eq!(status, StatusCode::OK);
        assert!(json["token"].is_string() && json["device_uuid"].is_string());

        let nb: i64 = db.lock().unwrap()
            .query_row("SELECT COUNT(*) FROM appareils WHERE uuid = ?1", [json["device_uuid"].as_str().unwrap()], |r| r.get(0))
            .unwrap();
        assert_eq!(nb, 1, "l'appareil est créé");

        // Le code est consommé : une seconde tentative échoue.
        let (statut2, _) = reponse(routeur(db, dossier), requete("POST", "/sync/pair", &corps, None)).await;
        assert_ne!(statut2, StatusCode::OK, "un code ne sert qu'une fois");
    }

    #[tokio::test]
    async fn pull_sans_jeton_est_rejete() {
        let (db, dossier) = base();
        let corps = serde_json::json!({ "since": 0 }).to_string();
        let (status, _) = reponse(routeur(db, dossier), requete("POST", "/sync/pull", &corps, None)).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn pull_est_page_avec_curseur() {
        let (db, dossier) = base();
        let (device, token) = appareil_actif(&db);
        // Trois nouvelles dépenses alimentent le journal au-delà des amorces.
        {
            let conn = db.lock().unwrap();
            for i in 0..3 {
                conn.execute(
                    "INSERT INTO depenses (uuid, saison_id, categorie, designation, montant, date_depense)
                     VALUES (?1, 1, 'autre', ?2, 1000, '2026-01-05')",
                    rusqlite::params![format!("d{i}"), format!("ligne {i}")],
                )
                .unwrap();
            }
        }
        let corps = serde_json::json!({ "since": 0, "limit": 2 }).to_string();
        let (status, json) = reponse(
            routeur(db, dossier),
            requete("POST", "/sync/pull", &corps, Some((&device, &token))),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(json["changes"].as_array().unwrap().len(), 2, "limit respectée");
        assert_eq!(json["has_more"], true, "il reste des lignes à tirer");
        assert!(json["cursor"].as_i64().unwrap() > 0);
    }

    #[tokio::test]
    async fn push_cree_puis_respecte_le_last_write_wins() {
        let (db, dossier) = base();
        let (device, token) = appareil_actif(&db);
        let saison = uuid_de(&db, "saisons", 1);
        let camion = uuid_de(&db, "camions", 1);
        let uuid = Uuid::new_v4().to_string();

        // Création.
        let corps = depense_json(&uuid, &saison, &camion, 50_000.0, "2026-01-05 08:00:00");
        let (status, json) = reponse(
            routeur(db.clone(), dossier.clone()),
            requete("POST", "/sync/push", &corps, Some((&device, &token))),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(json["results"][0]["status"], "ok");

        // Poussée plus ancienne que la ligne serveur : rejetée.
        let corps = depense_json(&uuid, &saison, &camion, 60_000.0, "2026-01-05 07:00:00");
        let (_, json) = reponse(
            routeur(db.clone(), dossier.clone()),
            requete("POST", "/sync/push", &corps, Some((&device, &token))),
        )
        .await;
        assert_eq!(json["results"][0]["status"], "rejected");
        assert_eq!(json["results"][0]["motif"], "plus_recent_au_bureau");

        // Poussée plus récente : mise à jour acceptée.
        let corps = depense_json(&uuid, &saison, &camion, 70_000.0, "2026-01-05 09:00:00");
        let (_, json) = reponse(
            routeur(db.clone(), dossier.clone()),
            requete("POST", "/sync/push", &corps, Some((&device, &token))),
        )
        .await;
        assert_eq!(json["results"][0]["status"], "updated");

        let montant: f64 = db.lock().unwrap()
            .query_row("SELECT montant FROM depenses WHERE uuid = ?1", [&uuid], |r| r.get(0))
            .unwrap();
        assert_eq!(montant, 70_000.0, "la dernière version gagne");
    }

    #[tokio::test]
    async fn push_rejete_une_depense_validee_au_bureau() {
        let (db, dossier) = base();
        let (device, token) = appareil_actif(&db);
        let saison = uuid_de(&db, "saisons", 1);
        let camion = uuid_de(&db, "camions", 1);
        let uuid = Uuid::new_v4().to_string();

        let corps = depense_json(&uuid, &saison, &camion, 50_000.0, "2026-01-05 08:00:00");
        reponse(routeur(db.clone(), dossier.clone()), requete("POST", "/sync/push", &corps, Some((&device, &token)))).await;

        // Le bureau audite la ligne : elle devient protégée.
        db.lock().unwrap().execute("UPDATE depenses SET statut = 'validee' WHERE uuid = ?1", [&uuid]).unwrap();

        let corps = depense_json(&uuid, &saison, &camion, 99_000.0, "2026-02-01 12:00:00");
        let (_, json) = reponse(
            routeur(db.clone(), dossier),
            requete("POST", "/sync/push", &corps, Some((&device, &token))),
        )
        .await;
        assert_eq!(json["results"][0]["status"], "rejected");
        assert_eq!(json["results"][0]["motif"], "deja_traitee_au_bureau");
        assert!(json["results"][0]["server_row"].is_object(), "l'image serveur est renvoyée");
    }

    #[tokio::test]
    async fn push_fusionne_un_camion_par_immatriculation() {
        let (db, dossier) = base();
        let (device, token) = appareil_actif(&db);
        let camion_serveur = uuid_de(&db, "camions", 1);
        let corps = serde_json::json!({
            "camions": [{
                "uuid": Uuid::new_v4().to_string(),
                "immatriculation": "ab-1234-cd",
                "actif": 1,
                "updated_at": "2026-01-05 08:00:00"
            }]
        })
        .to_string();
        let (status, json) = reponse(
            routeur(db.clone(), dossier),
            requete("POST", "/sync/push", &corps, Some((&device, &token))),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(json["results"][0]["status"], "merged");
        assert_eq!(json["results"][0]["merged_into"], camion_serveur, "le poste garde sa clé");
    }

    #[tokio::test]
    async fn push_fusionne_un_intervenant_par_nom() {
        let (db, dossier) = base();
        let (device, token) = appareil_actif(&db);
        db.lock().unwrap().execute(
            "INSERT INTO intervenants (uuid, nom, role) VALUES ('i-orig', 'NDOUMBE', 'mecanicien')",
            [],
        )
        .unwrap();

        let corps = serde_json::json!({
            "intervenants": [{
                "uuid": Uuid::new_v4().to_string(),
                "nom": "ndoumbe",
                "role": "mecanicien",
                "actif": 1,
                "created_at": "2026-01-05 08:00:00",
                "updated_at": "2026-01-05 08:00:00"
            }]
        })
        .to_string();
        let (_, json) = reponse(
            routeur(db, dossier),
            requete("POST", "/sync/push", &corps, Some((&device, &token))),
        )
        .await;
        assert_eq!(json["results"][0]["status"], "merged");
        assert_eq!(json["results"][0]["merged_into"], "i-orig");
    }

    #[tokio::test]
    async fn photos_ecrit_le_fichier_et_la_colonne() {
        let (db, dossier) = base();
        let (device, token) = appareil_actif(&db);
        let saison = uuid_de(&db, "saisons", 1);
        let camion = uuid_de(&db, "camions", 1);
        let uuid = Uuid::new_v4().to_string();

        let corps = depense_json(&uuid, &saison, &camion, 50_000.0, "2026-01-05 08:00:00");
        reponse(routeur(db.clone(), dossier.clone()), requete("POST", "/sync/push", &corps, Some((&device, &token)))).await;

        // Un faux JPEG, encodé comme le fait le terrain.
        let octets = [0xFFu8, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46];
        let b64 = base64::engine::general_purpose::STANDARD.encode(octets);
        let corps = serde_json::json!({
            "items": [{ "depense_uuid": uuid, "filename": "photo.jpg", "mime": "image/jpeg", "base64": b64 }]
        })
        .to_string();
        let (status, json) = reponse(
            routeur(db.clone(), dossier.clone()),
            requete("POST", "/sync/photos", &corps, Some((&device, &token))),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(json["results"][0]["status"], "ok");

        let nom = format!("{uuid}.jpg");
        assert!(dossier.join(&nom).is_file(), "le fichier est écrit sur le disque");
        let photo: Option<String> = db.lock().unwrap()
            .query_row("SELECT photo FROM depenses WHERE uuid = ?1", [&uuid], |r| r.get(0))
            .unwrap();
        assert_eq!(photo.as_deref(), Some(nom.as_str()), "la colonne photo est renseignée");

        let _ = std::fs::remove_dir_all(&dossier);
    }
}
