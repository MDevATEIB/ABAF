//! Justificatifs photo des dépenses de terrain.
//!
//! Les images ne sont jamais stockées dans SQLite : elles vivent dans
//! `<données de l'application>/justificatifs/{depense_uuid}.jpg` et la base n'en
//! garde que le nom du fichier. Ce module est partagé entre l'interface du poste
//! (aperçu, ouverture du dossier) et le serveur de synchronisation (réception
//! des photos poussées par les téléphones).

use std::path::{Path, PathBuf};

/// Nom du sous-dossier de `<app_data_dir>`.
pub const SOUS_DOSSIER: &str = "justificatifs";

/// Extension imposée : le terrain compresse les clichés en JPEG avant l'envoi.
pub const EXTENSION: &str = "jpg";

/// Racine du dossier de justificatifs pour un répertoire de données donné.
pub fn racine(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(SOUS_DOSSIER)
}

/// S'assure que le dossier existe (créé à la demande, jamais en dur dans une
/// migration).
pub fn preparer(dossier: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dossier)
        .map_err(|e| format!("Impossible de créer le dossier des justificatifs : {e}"))
}

/// Nom de fichier attendu pour la dépense portant cet UUID.
pub fn nom_pour(depense_uuid: &str) -> String {
    format!("{depense_uuid}.{EXTENSION}")
}

/// Écrit le contenu d'une photo et retourne son nom de fichier. L'UUID est
/// contrôlé : il provient du réseau et sert de nom de fichier.
pub fn ecrire(dossier: &Path, depense_uuid: &str, contenu: &[u8]) -> Result<String, String> {
    if !est_uuid_valide(depense_uuid) {
        return Err("Identifiant de dépense invalide.".to_string());
    }
    if contenu.is_empty() {
        return Err("Image vide.".to_string());
    }
    preparer(dossier)?;

    let nom = nom_pour(depense_uuid);
    std::fs::write(dossier.join(&nom), contenu)
        .map_err(|e| format!("Impossible d'enregistrer le justificatif : {e}"))?;
    Ok(nom)
}

/// Supprime un justificatif dont le nom est stocké dans `depenses.photo`.
/// Une absence de fichier n'est pas une erreur : la base peut être plus
/// récente que le disque après une restauration.
pub fn supprimer(dossier: &Path, nom: &str) -> Result<(), String> {
    if nom.contains('/') || nom.contains('\\') || nom.is_empty() {
        return Err("Nom de fichier invalide.".to_string());
    }
    let chemin = dossier.join(nom);
    if chemin.exists() {
        std::fs::remove_file(&chemin)
            .map_err(|e| format!("Impossible de supprimer le justificatif : {e}"))?;
    }
    Ok(())
}

/// Data URL `data:image/jpeg;base64,...` pour l'aperçu dans l'interface.
pub fn vers_data_url(dossier: &Path, nom: &str) -> Result<Option<String>, String> {
    if nom.contains('/') || nom.contains('\\') || nom.is_empty() {
        return Err("Nom de fichier invalide.".to_string());
    }
    let chemin = dossier.join(nom);
    if !chemin.is_file() {
        return Ok(None);
    }
    let contenu =
        std::fs::read(&chemin).map_err(|e| format!("Lecture du justificatif impossible : {e}"))?;
    use base64::Engine as _;
    let encode = base64::engine::general_purpose::STANDARD.encode(&contenu);
    Ok(Some(format!("data:image/jpeg;base64,{encode}")))
}

/// Nombre de fichiers et taille cumulée, affichés dans Paramètres.
pub fn statistique(dossier: &Path) -> (i64, i64) {
    let entries = match std::fs::read_dir(dossier) {
        Ok(entries) => entries,
        Err(_) => return (0, 0),
    };
    let mut nb = 0_i64;
    let mut taille = 0_i64;
    for entry in entries.flatten() {
        if let Ok(meta) = entry.metadata() {
            if meta.is_file() {
                nb += 1;
                taille += meta.len() as i64;
            }
        }
    }
    (nb, taille)
}

/// Un UUID de dépense ne doit contenir que des chiffres, des lettres hexagonales
/// et des tirets : c'est le seul caractère autorisé dans un nom de fichier reçu.
fn est_uuid_valide(valeur: &str) -> bool {
    valeur.len() == 36
        && valeur
            .chars()
            .all(|c| c.is_ascii_hexdigit() || c == '-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ecrire_refuse_un_identifiant_invalide() {
        let dossier = std::env::temp_dir().join(format!("abaf-justif-{}", std::process::id()));
        let uuid = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";

        assert!(est_uuid_valide(uuid));
        assert!(!est_uuid_valide("../../windows/system.ini"));
        assert!(!est_uuid_valide(""));

        let nom = ecrire(&dossier, uuid, &[0xFF, 0xD8, 0xFF]).expect("écriture");
        assert_eq!(nom, format!("{uuid}.jpg"));
        assert!(dossier.join(&nom).is_file());

        // Rejet sans avoir touché au disque.
        assert!(ecrire(&dossier, "../evil", &[1, 2, 3]).is_err());

        let url = vers_data_url(&dossier, &nom)
            .expect("data URL")
            .expect("fichier présent");
        assert!(url.starts_with("data:image/jpeg;base64,"));

        supprimer(&dossier, &nom).expect("suppression");
        assert!(!dossier.join(&nom).exists());
        // Supprimer un fichier déjà absent n'est pas une erreur.
        supprimer(&dossier, &nom).expect("suppression tolérante");

        let _ = std::fs::remove_dir_all(&dossier);
    }
}
