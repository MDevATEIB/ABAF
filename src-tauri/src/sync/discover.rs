//! Découverte du poste de gestion sur le WiFi partagé.
//!
//! Le téléphone ne connaît pas l'IP du PC : il diffuse la trame
//! `ABAF_DISCOVER?` sur le port 9471 et le poste répond par son nom, sa version
//! et son port HTTP. C'est un confort — l'écran de connexion sait aussi
//! interroger les passerelles de hotspot une par une — et le service ne tourne
//! que pendant que le serveur de synchronisation est allumé.

use std::net::{UdpSocket, SocketAddr};
use std::sync::Arc;

use super::{SyncState, SCHEMA_VERSION, PORT_DECOUVERTE};

/// Trame attendue d'un téléphone. Comparaison en majuscules, espaces ignorés.
const SONDE: &str = "ABAF_DISCOVER?";
/// Taille maximale d'une sonde acceptée : au-delà, ce n'est pas notre protocole.
const TAILLE_MAX_SONDE: usize = 64;

/// Lance la boucle de découverte. L'appel revient dès que le socket est lié :
/// l'écoute continue dans une tâche dédiée, qui rend le socket en s'éteignant.
pub fn demarrer(port_http: u16, port_ecoute: u16, sync: Arc<SyncState>) -> Result<(), String> {
    let socket = UdpSocket::bind(("0.0.0.0", port_ecoute))
        .map_err(|e| format!("Impossible d'ouvrir le port de découverte {port_ecoute} : {e}"))?;
    // Le poste peut être joint par un client isolé derrière un hotspot : la
    // diffusion est autorisée à la réponse autant qu'à l'écoute.
    let _ = socket.set_broadcast(true);
    socket
        .set_read_timeout(Some(std::time::Duration::from_secs(1)))
        .map_err(|e| e.to_string())?;

    std::thread::Builder::new()
        .name("abaf-decouverte".to_string())
        .spawn(move || ecouter(socket, port_http, sync))
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Boucle d'écoute : une seconde de latence au pire entre l'arrêt du serveur
/// et la libération du port.
fn ecouter(socket: UdpSocket, port_http: u16, sync: Arc<SyncState>) {
    let mut tampon = [0u8; TAILLE_MAX_SONDE];
    while sync.est_actif() {
        match socket.recv_from(&mut tampon) {
            Ok((taille, depuis)) => {
                if taille == 0 {
                    continue;
                }
                let sonde = String::from_utf8_lossy(&tampon[..taille]);
                if !est_sonde(sonde.trim()) {
                    continue;
                }
                let reponse = construire_reponse(port_http, &depuis);
                // Un seul poste répond : le premier arrivé gagne la réponse, les
                // collisions sont sans conséquence pour le téléphone qui retente.
                let _ = socket.send_to(reponse.as_bytes(), depuis);
            }
            // Timeout de lecture : on reboucle en vérifiant l'état du serveur.
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock
                || e.kind() == std::io::ErrorKind::TimedOut => {}
            // Erreur réseau ou socket fermé : la boucle n'a rien à faire de plus.
            Err(_) => break,
        }
    }
}

/// La sonde est acceptée telle quelle ou en minuscules, le point d'interrogation
/// final pouvant manquer selon l'encodeur du client.
fn est_sonde(sonde: &str) -> bool {
    let normalisee = sonde.trim().to_ascii_uppercase().trim_end_matches('?').to_string();
    normalisee == SONDE.trim_end_matches('?')
}

/// Trame de réponse : `ip` est l'adresse source du poste vue depuis le
/// demandeur, ce qui règle le cas où la machine a plusieurs interfaces.
fn construire_reponse(port_http: u16, depuis: &SocketAddr) -> String {
    let ip = ip_locale_pour(&socket_temporaire(), &depuis.ip()).unwrap_or_default();
    format!(
        "{{\"name\":\"ABAF\",\"version\":\"{SCHEMA_VERSION}\",\"http_port\":{port_http},\"ip\":\"{ip}\"}}"
    )
}

fn socket_temporaire() -> UdpSocket {
    UdpSocket::bind("0.0.0.0:0").expect("socket UDP éphémère")
}

/// Adresse source que la machine utiliserait pour joindre `cible`, sans rien
/// envoyer : la simple association UDP consulte la table de routage.
fn ip_locale_pour(socket: &UdpSocket, cible: &std::net::IpAddr) -> Option<String> {
    // On se branche sur le port de découverte du demandeur : aucune donnée ne
    // part, seule la table de routage est consultée pour choisir l'interface.
    socket.connect((*cible, PORT_DECOUVERTE)).ok()?;
    let adresse = socket.local_addr().ok()?;
    match adresse {
        SocketAddr::V4(v4) if !v4.ip().is_unspecified() => Some(v4.ip().to_string()),
        SocketAddr::V6(v6) if !v6.ip().is_unspecified() => Some(v6.ip().to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn la_sonde_est_reconnue_selon_sa_forme() {
        assert!(est_sonde("ABAF_DISCOVER?"));
        assert!(est_sonde("abaf_discover?"));
        assert!(est_sonde("  ABAF_DISCOVER  "));
        assert!(!est_sonde("ABAF_PING"));
        assert!(!est_sonde(""));
        assert!(!est_sonde("ABAF_DISCOVER? espion"));
    }

    #[test]
    fn la_reponse_annonce_le_port_http_du_poste() {
        let depuis: SocketAddr = "192.168.43.50:51000".parse().expect("adresse");
        let texte = construire_reponse(9470, &depuis);
        let valeur: serde_json::Value = serde_json::from_str(&texte)
            .expect("la trame de découverte doit être un JSON valide");
        assert_eq!(valeur["name"], "ABAF");
        assert_eq!(valeur["http_port"], 9470);
        assert_eq!(valeur["version"], SCHEMA_VERSION);
        assert!(valeur["ip"].is_string(), "l'IP source du poste est annoncée");
    }
}
