// Commandes Tauri - module Exploitation : pilotage du serveur de synchronisation
// avec les applications de terrain (plan §3).
//
// Le poste tient le rôle de serveur : il n'écoute que si l'utilisateur allume
// la synchronisation depuis l'écran Paramètres. Toutes ces commandes sont de
// l'intendance — état, appairage, appareils, pare-feu — et aucune ne touche aux
// données comptables.
use std::process::Command;
use std::sync::{Arc, Mutex};

use rusqlite::{params, Connection, OptionalExtension};
use tauri::{AppHandle, Manager, State};
use tokio::time::{sleep, Duration};

use crate::db::AppState;
use crate::models::sync::{Appareil, CodeAppairage, EtatSync};
use crate::services::justificatif;
use crate::sync::{auth, server, SyncState, PORT_DECOUVERTE, PORT_DEFAUT};

/// Durée de validité d'un code d'appairage, secondes.
const DUREE_CODE: i64 = auth::DUREE_CODE;

/// Pilote du serveur, partagé entre les commandes et les tâches axum.
fn etat_sync(app: &AppHandle) -> Result<Arc<SyncState>, String> {
    app
        .try_state::<Arc<SyncState>>()
        .map(|s| s.inner().clone())
        .ok_or_else(|| "Le serveur de synchronisation n'est pas initialisé.".to_string())
}

/// Dossier des justificatifs, créé à la demande : Paramètres l'affiche avant
/// même qu'un téléphone ait envoyé une photo.
fn dossier(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Impossible d'obtenir le répertoire de données : {e}"))?;
    let racine = justificatif::racine(&app_data_dir);
    justificatif::preparer(&racine)?;
    Ok(racine)
}

/// Allume le serveur HTTP de synchronisation et le service de découverte.
/// Un port explicite est optionnel : sans lui, le port enregistré dans les
/// paramètres (ou le port historique) est utilisé.
#[tauri::command]
pub async fn demarrer_serveur_sync(
    app: AppHandle,
    state: State<'_, AppState>,
    port: Option<u16>,
) -> Result<EtatSync, String> {
    let sync = etat_sync(&app)?;
    // Le verrou de la base et l'état géré par Tauri sont recopiés ici : un
    // garde-corps `State` n'est pas `Send` et ne peut pas franchir un `await`.
    let db: Arc<Mutex<Connection>> = state.db.clone();
    drop(state);

    let port_demande = match port {
        Some(valeur) if valeur > 0 => valeur,
        _ => port_enregistre(&db)?,
    };

    let dossier = dossier(&app)?;
    let port_retenue = server::demarrer(db.clone(), dossier, sync.clone(), port_demande, PORT_DECOUVERTE).await?;

    // Le port réellement occupé est mémorisé : un redémarrage de l'application
    // repart sur la même configuration, et les téléphones ne sont pas perdus.
    sauvegarder_port(&db, port_retenue)?;
    ecrire_parametre(&db, "sync_actif", "1")?;

    construire_etat_sync(&db, &sync, &app)
}

/// Éteint le serveur et le service de découverte.
#[tauri::command]
pub async fn arreter_serveur_sync(app: AppHandle, state: State<'_, AppState>) -> Result<EtatSync, String> {
    let sync = etat_sync(&app)?;
    let db: Arc<Mutex<Connection>> = state.db.clone();
    drop(state);

    server::arreter(&sync)?;
    ecrire_parametre(&db, "sync_actif", "0")?;

    // La boucle UDP observe `running` avec une seconde de latence : on lui
    // laisse le temps de rendre le port avant de retourner la main.
    sleep(Duration::from_millis(1100)).await;

    construire_etat_sync(&db, &sync, &app)
}

/// État complet affiché dans la carte « Synchronisation mobile ».
#[tauri::command]
pub fn get_etat_sync(app: AppHandle, state: State<AppState>) -> Result<EtatSync, String> {
    let sync = etat_sync(&app)?;
    construire_etat_sync(&state.db, &sync, &app)
}

fn construire_etat_sync(
    db: &Arc<Mutex<Connection>>,
    sync: &SyncState,
    app: &AppHandle,
) -> Result<EtatSync, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let (nb_actifs, nb_revoques): (i64, i64) = conn
        .query_row(
            "SELECT COUNT(*) FILTER (WHERE statut = 'actif'),
                    COUNT(*) FILTER (WHERE statut = 'revoque')
             FROM appareils",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap_or((0, 0));

    let nb_depenses_a_valider: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM depenses WHERE source = 'mobile' AND statut = 'brouillon'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let dernier_lvn: i64 = conn
        .query_row("SELECT COALESCE(MAX(lvn), 0) FROM sync_oplog", [], |row| row.get(0))
        .unwrap_or(0);

    let expiration = auth::lire_parametre(&conn, "appairage_code_exp");
    let hash = auth::lire_parametre(&conn, "appairage_code_hash");
    let appairage_en_cours = !hash.is_empty() && !expiration.is_empty();

    let dossier = dossier(app)?;
    let (nb_justificatifs, taille) = justificatif::statistique(&dossier);

    // Le port est lu depuis la garde `conn` déjà tenue ci-dessus : surtout pas
    // repasser par `port_enregistre(&db)`, qui re-lockerait le même mutex sur la
    // même thread et deadlockerait la commande (et donc l'interface).
    let port = if sync.est_actif() { sync.port_ecoute() } else { port_depuis_conn(&conn) };

    Ok(EtatSync {
        actif: sync.est_actif(),
        port,
        port_decouverte: PORT_DECOUVERTE,
        adresses: server::adresses_locales(),
        nb_appareils_actifs: nb_actifs,
        nb_appareils_revoques: nb_revoques,
        nb_depenses_a_valider,
        dernier_lvn,
        appairage_en_cours,
        appairage_expire_a: appairage_en_cours.then_some(expiration),
        dossier_justificatifs: dossier.to_string_lossy().to_string(),
        nb_justificatifs,
        taille_justificatifs_octets: taille,
    })
}

/// Émet un code d'appairage à six chiffres pour un téléphone. Le code en clair
/// n'est jamais stocké : seule son empreinte entre dans `parametres`, et il est
/// consommé dès qu'un appareil s'en sert.
#[tauri::command]
pub fn generer_code_appairage(
    state: State<AppState>,
    appareil: Option<String>,
) -> Result<CodeAppairage, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let code = auth::generer_code();
    auth::ecrire_parametre(&conn, "appairage_code_hash", &auth::hacher_hex(code.as_bytes()))
        .map_err(|e| e.detail.unwrap_or(e.erreur))?;

    let expire_a: String = conn
        .query_row(
            "SELECT datetime('now', ?1)",
            params![format!("+{DUREE_CODE} seconds")],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    auth::ecrire_parametre(&conn, "appairage_code_exp", &expire_a)
        .map_err(|e| e.detail.unwrap_or(e.erreur))?;

    // Le nom visé n'est qu'une aide memoire pour la personne au bureau.
    auth::ecrire_parametre(&conn, "appairage_device_en_attente", appareil.unwrap_or_default().trim())
        .map_err(|e| e.detail.unwrap_or(e.erreur))?;

    Ok(CodeAppairage { code, expire_a, duree_secondes: DUREE_CODE })
}

/// Annule un code d'appairage en cours sans attendre son expiration.
#[tauri::command]
pub fn annuler_code_appairage(state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    auth::consommer_code(&conn).map_err(|e| e.detail.unwrap_or(e.erreur))
}

/// Téléphones connus du poste, avec leur activité.
#[tauri::command]
pub fn lister_appareils(state: State<AppState>) -> Result<Vec<Appareil>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let dernier_lvn: i64 = conn
        .query_row("SELECT COALESCE(MAX(lvn), 0) FROM sync_oplog", [], |row| row.get(0))
        .unwrap_or(0);

    let mut stmt = conn
        .prepare(
            "SELECT a.uuid, a.nom, a.agent, a.statut, a.created_at, a.last_seen_at,
                    a.nb_lignes_sync, a.last_pull_lvn,
                    (SELECT COUNT(*) FROM depenses d
                      WHERE d.device_id = a.uuid AND d.statut = 'brouillon')
             FROM appareils a
             ORDER BY a.statut = 'actif' DESC,
                      COALESCE(a.last_seen_at, a.created_at) DESC",
        )
        .map_err(|e| e.to_string())?;

    let appareils = stmt
        .query_map([], |row| {
            let last_pull: i64 = row.get(7)?;
            Ok(Appareil {
                uuid: row.get(0)?,
                nom: row.get(1)?,
                agent: row.get(2)?,
                statut: row.get(3)?,
                created_at: row.get(4)?,
                last_seen_at: row.get(5)?,
                nb_lignes_sync: row.get(6)?,
                last_pull_lvn: last_pull,
                nb_changes_en_attente: (dernier_lvn - last_pull).max(0),
                nb_depenses_a_valider: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(appareils)
}

/// Révoque un téléphone : son jeton cesse immédiatement de fonctionner, mais
/// ses lignes déjà acceptées au bureau restent en base.
#[tauri::command]
pub fn revoquer_appareil(state: State<AppState>, uuid: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let connu: Option<String> = conn
        .query_row(
            "SELECT statut FROM appareils WHERE uuid = ?1",
            params![uuid.trim()],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    match connu {
        Some(statut) if statut == "revoque" => Ok(()),
        Some(_) => {
            conn.execute(
                "UPDATE appareils SET statut = 'revoque' WHERE uuid = ?1",
                params![uuid.trim()],
            )
            .map_err(|e| e.to_string())?;
            Ok(())
        }
        None => Err("Cet appareil est inconnu.".to_string()),
    }
}

/// Oublie un téléphone jamais appairé avec succès : suppression de la fiche,
/// le jeton et l'historique des lignes déjà reçues restent attribués à l'UUID.
#[tauri::command]
pub fn supprimer_appareil(state: State<AppState>, uuid: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let oubliees = conn
        .execute("DELETE FROM appareils WHERE uuid = ?1", params![uuid.trim()])
        .map_err(|e| e.to_string())?;
    if oubliees == 0 {
        return Err("Cet appareil est inconnu.".to_string());
    }
    Ok(())
}

/// Retourne le chemin du dossier des justificatifs (créé au besoin) : c'est le
/// frontend qui l'ouvre avec `revealItemInDir`, déjà utilisé pour les exports.
#[tauri::command]
pub fn ouvrir_dossier_justificatifs(app: AppHandle) -> Result<String, String> {
    Ok(dossier(&app)?.to_string_lossy().to_string())
}

/// Ajoute les règles entrantes TCP 9470 et UDP 9471 au pare-feu Windows.
/// L'élévation est demandée par UAC : la commande est détachée, le poste ne
/// reste pas bloqué si l'utilisateur refuse.
#[tauri::command]
pub fn configurer_pare_feu(app: AppHandle) -> Result<String, String> {
    let sync = etat_sync(&app)?;
    let port_http = if sync.est_actif() { sync.port_ecoute() } else { PORT_DEFAUT };
    autoriser_ecouteaux_pare_feu(port_http, PORT_DECOUVERTE)
}

/// Cœur du pare-feu, séparé pour être testable sans Tauri : deux règles
/// nommées, effacées puis recréées, donc l'opération est idempotente.
fn autoriser_ecouteaux_pare_feu(port_http: u16, port_decouverte: u16) -> Result<String, String> {
    let script = r#"
Remove-NetFirewallRule -DisplayName 'ABAF Sync HTTP' -ErrorAction SilentlyContinue | Out-Null
Remove-NetFirewallRule -DisplayName 'ABAF Sync Decouverte' -ErrorAction SilentlyContinue | Out-Null
New-NetFirewallRule -DisplayName 'ABAF Sync HTTP' -Direction Inbound -Action Allow `
  -Protocol TCP -LocalPort __PORT_HTTP__ -Profile Any | Out-Null
New-NetFirewallRule -DisplayName 'ABAF Sync Decouverte' -Direction Inbound -Action Allow `
  -Protocol UDP -LocalPort __PORT_UDP__ -Profile Any | Out-Null
exit 0
"#
    .replace("__PORT_HTTP__", &port_http.to_string())
    .replace("__PORT_UDP__", &port_decouverte.to_string());

    // `RunAs` déclenche l'élévation UAC ; le processus n'est pas attendu, un
    // refus de l'utilisateur ne doit pas geler l'interface du poste.
    Command::new("powershell")
        .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command"])
        .arg(format!(
            "Start-Process -Verb RunAs -WindowStyle Hidden powershell -ArgumentList @('-NoProfile','-Command',{script:?})"
        ))
        .spawn()
        .map_err(|e| format!("Impossible de lancer la configuration du pare-feu : {e}"))?;

    Ok(format!(
        "Une demande d'élévation Windows a été envoyée : acceptez-la pour ouvrir le port TCP {port_http} et le port UDP {port_decouverte}."
    ))
}

/// Port enregistré en base, à partir d'une connexion déjà verrouillée.
fn port_depuis_conn(conn: &Connection) -> u16 {
    auth::lire_parametre(conn, "sync_port")
        .trim()
        .parse::<u16>()
        .unwrap_or(PORT_DEFAUT)
}

fn port_enregistre(db: &Arc<Mutex<Connection>>) -> Result<u16, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    Ok(port_depuis_conn(&conn))
}

fn sauvegarder_port(db: &Arc<Mutex<Connection>>, port: u16) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    auth::ecrire_parametre(&conn, "sync_port", &port.to_string())
        .map_err(|e| e.detail.unwrap_or(e.erreur))
}

fn ecrire_parametre(db: &Arc<Mutex<Connection>>, cle: &str, valeur: &str) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    auth::ecrire_parametre(&conn, cle, valeur).map_err(|e| e.detail.unwrap_or(e.erreur))
}

/// Tente une ouverture en lecture seule du port : sert à l'interface pour
/// signaler qu'un autre programme occupe déjà le port avant même de démarrer.
#[tauri::command]
pub fn tester_port_disponible(port: u16) -> Result<bool, String> {
    if port == 0 {
        return Err("Port invalide.".to_string());
    }
    Ok(std::net::TcpListener::bind(("0.0.0.0", port)).is_ok())
}

// La découverte UDP est portée par `server::demarrer` ; rien d'autre ne pilote
// ce service, dont la boucle s'éteint seule avec le serveur HTTP.
