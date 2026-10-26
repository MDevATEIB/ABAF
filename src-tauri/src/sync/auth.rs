//! Authentification des appareils de terrain et contrôle du code d'appairage.
//!
//! Un téléphone se présente avec deux en-têtes : `X-Device` (l'UUID que le poste
//! lui a attribué) et `X-Token` (le jeton secret reçu à l'appairage, stocké dans
//! le trousseau du téléphone). Le poste ne conserve que l'empreinte SHA-256 du
//! jeton : une fuite de la base ne donne pas les accès.

use axum::http::HeaderMap;
use rand::Rng;
use rusqlite::{Connection, OptionalExtension};
use sha2::{Digest, Sha256};

use super::ErreurHttp;

/// Durée de validité d'un code d'appairage, en secondes (10 minutes).
pub const DUREE_CODE: i64 = 600;

/// Couple identité de l'appareil + jeton, lu dans les en-têtes.
pub struct Identifiants {
    pub device: String,
    pub token: String,
}

/// Extrait les en-têtes d'identification. L'absence vaut un refus, sans
/// distinguer « pas de jeton » de « jeton faux » : le téléphone n'a rien à
/// savoir de l'état de la base.
pub fn extraire_identifiants(headers: &HeaderMap) -> Result<Identifiants, ErreurHttp> {
    let device = en_tete(headers, "x-device").ok_or_else(|| ErreurHttp::non_authorise("jeton_manquant"))?;
    let token = en_tete(headers, "x-token").ok_or_else(|| ErreurHttp::non_authorise("jeton_manquant"))?;
    if device.is_empty() || token.is_empty() {
        return Err(ErreurHttp::non_authorise("jeton_manquant"));
    }
    Ok(Identifiants { device, token })
}

fn en_tete(headers: &HeaderMap, nom: &str) -> Option<String> {
    headers
        .get(nom)
        .and_then(|valeur| valeur.to_str().ok())
        .map(|valeur| valeur.trim().to_string())
        .filter(|valeur| !valeur.is_empty())
}

/// Vérifie que l'appareil est connu, actif, et que le jeton correspond. Une
/// réussite rafraîchit `last_seen_at`, ce qui alimente la liste des appareils
/// de l'écran Paramètres.
pub fn verifier(conn: &Connection, ids: &Identifiants) -> Result<(), ErreurHttp> {
    let attendu: Option<(String, String)> = conn
        .query_row(
            "SELECT token_hash, statut FROM appareils WHERE uuid = ?1",
            rusqlite::params![ids.device],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|e| ErreurHttp::interne(e.to_string()))?;

    let (token_hash, statut) = match attendu {
        Some(pair) => pair,
        None => return Err(ErreurHttp::non_authorise("appareil_inconnu")),
    };

    if statut != "actif" {
        return Err(ErreurHttp::interdiction("appareil_revoque"));
    }
    if hacher_hex(ids.token.as_bytes()) != token_hash {
        return Err(ErreurHttp::non_authorise("jeton_invalide"));
    }

    conn.execute(
        "UPDATE appareils SET last_seen_at = datetime('now') WHERE uuid = ?1",
        rusqlite::params![ids.device],
    )
    .map_err(|e| ErreurHttp::interne(e.to_string()))?;
    Ok(())
}

/// Contrôle le code à 6 chiffres saisi sur le téléphone contre l'empreinte et
/// l'expiration enregistrées par le poste.
pub fn verifier_code(conn: &Connection, code: &str) -> Result<(), ErreurHttp> {
    let code = code.trim();
    if code.len() != 6 || !code.chars().all(|c| c.is_ascii_digit()) {
        return Err(ErreurHttp::non_authorise("code_invalide"));
    }

    let enregistre: Option<(String, String)> = conn
        .query_row(
            "SELECT p1.valeur, p2.valeur
             FROM parametres p1
             JOIN parametres p2 ON p2.cle = 'appairage_code_exp'
             WHERE p1.cle = 'appairage_code_hash'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|e| ErreurHttp::interne(e.to_string()))?;

    let (hash, expiration) = match enregistre {
        Some(pair) if !pair.0.is_empty() => pair,
        _ => return Err(ErreurHttp::interdiction("appairage_inactif")),
    };

    // Les horodatages SQLite sont en `YYYY-MM-DD HH:MM:SS` : la comparaison
    // lexicale suit l'ordre chronologique.
    let maintenant: String = conn
        .query_row("SELECT datetime('now')", [], |row| row.get(0))
        .map_err(|e| ErreurHttp::interne(e.to_string()))?;
    if expiration.as_str() <= maintenant.as_str() {
        return Err(ErreurHttp::interdiction("code_expire"));
    }
    if hacher_hex(code.as_bytes()) != hash {
        return Err(ErreurHttp::non_authorise("code_invalide"));
    }
    Ok(())
}

/// Consomme le code : usage unique. L'effacement de l'empreinte rend toute
/// nouvelle tentative impossible tant que le poste n'a pas régénéré un code.
pub fn consommer_code(conn: &Connection) -> Result<(), ErreurHttp> {
    conn.execute(
        "UPDATE parametres SET valeur = '', updated_at = datetime('now')
          WHERE cle IN ('appairage_code_hash', 'appairage_code_exp')",
        [],
    )
    .map_err(|e| ErreurHttp::interne(e.to_string()))?;
    Ok(())
}

/// Code à 6 chiffres, non sensible à l'ordre des tirages.
pub fn generer_code() -> String {
    let valeur: u32 = rand::thread_rng().gen_range(100_000..=999_999);
    valeur.to_string()
}

/// Jeton aléatoire de 32 octets, encodé en base64 standard pour voyager dans
/// une chaîne JSON et être stocké tel quel côté téléphone.
pub fn generer_token() -> String {
    use base64::Engine as _;
    let octets: [u8; 32] = rand::random();
    base64::engine::general_purpose::STANDARD.encode(octets)
}

/// Empreinte SHA-256 hexadécimale, identique côté poste et côté téléphone
/// (`expo-crypto` digest `SHA-256` sur les mêmes octets).
pub fn hacher_hex(donnees: &[u8]) -> String {
    let empreinte = Sha256::digest(donnees);
    empreinte.iter().map(|octet| format!("{octet:02x}")).collect()
}

/// Valeur d'une clé de `parametres`, chaîne vide si la clé manque.
pub fn lire_parametre(conn: &Connection, cle: &str) -> String {
    conn.query_row(
        "SELECT valeur FROM parametres WHERE cle = ?1",
        rusqlite::params![cle],
        |row| row.get::<_, String>(0),
    )
    .unwrap_or_default()
}

/// Écrit une clé de `parametres` (créée si absente).
pub fn ecrire_parametre(conn: &Connection, cle: &str, valeur: &str) -> Result<(), ErreurHttp> {
    conn.execute(
        "INSERT INTO parametres (cle, valeur, updated_at)
         VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(cle) DO UPDATE
            SET valeur = excluded.valeur, updated_at = excluded.updated_at",
        rusqlite::params![cle, valeur],
    )
    .map_err(|e| ErreurHttp::interne(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn le_code_est_a_six_chiffres_et_le_token_de_trente_deux_octets() {
        let code = generer_code();
        assert_eq!(code.len(), 6);
        assert!(code.chars().all(|c| c.is_ascii_digit()));

        // 32 octets en base64 standard sans retour à la ligne : 44 caractères.
        let token = generer_token();
        assert_eq!(token.len(), 44);
        assert_ne!(token, generer_token());
    }

    #[test]
    fn l_empreinte_est_stable_et_sensible_aux_octets() {
        // Vecteur connu du SHA-256 de la chaîne vide.
        assert_eq!(
            hacher_hex(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_ne!(hacher_hex(b"123456"), hacher_hex(b"123457"));
    }

    #[test]
    fn un_code_valide_est_verifie_puis_consomme() {
        let conn = Connection::open_in_memory().expect("base");
        conn.execute_batch(
            "CREATE TABLE parametres (cle TEXT PRIMARY KEY, valeur TEXT NOT NULL, updated_at TEXT);
             CREATE TABLE appareils (
                 uuid TEXT PRIMARY KEY, token_hash TEXT NOT NULL,
                 statut TEXT NOT NULL, last_seen_at TEXT
             );",
        )
        .expect("schéma minimal");

        // Aucun code enregistré : l'appairage est inactif.
        assert!(verifier_code(&conn, "123456").is_err());

        let code = generer_code();
        ecrire_parametre(&conn, "appairage_code_hash", &hacher_hex(code.as_bytes())).expect("hash");
        ecrire_parametre(
            &conn,
            "appairage_code_exp",
            &conn
                .query_row("SELECT datetime('now', '+10 minutes')", [], |row| row.get::<_, String>(0))
                .expect("date"),
        )
        .expect("expiration");

        assert!(verifier_code(&conn, "000000").is_err(), "un code faux doit être rejeté");
        assert!(verifier_code(&conn, &code).is_ok());
        assert!(verifier_code(&conn, &code).is_ok(), "la vérification ne consomme pas le code");

        consommer_code(&conn).expect("consommation");
        assert!(
            verifier_code(&conn, &code).is_err(),
            "un code consommé ne peut plus servir"
        );

        // Jeton : un appareil actif passe, un appareil révoqué ou inconnu non.
        let token = generer_token();
        conn.execute(
            "INSERT INTO appareils (uuid, token_hash, statut)
             VALUES ('d1', ?1, 'actif'), ('d2', ?1, 'revoque')",
            rusqlite::params![hacher_hex(token.as_bytes())],
        )
        .expect("insert appareils");

        let ids = Identifiants { device: "d1".into(), token: token.clone() };
        verifier(&conn, &ids).expect("appareil actif autorisé");
        let vu: Option<String> = conn
            .query_row("SELECT last_seen_at FROM appareils WHERE uuid = 'd1'", [], |row| row.get(0))
            .expect("lecture");
        assert!(vu.is_some(), "la date de dernier passage est tracée");

        let revoque = Identifiants { device: "d2".into(), token: token.clone() };
        assert!(matches!(verifier(&conn, &revoque), Err(e) if e.erreur == "appareil_revoque"));

        let inconnu = Identifiants { device: "d3".into(), token };
        assert!(matches!(verifier(&conn, &inconnu), Err(e) if e.erreur == "appareil_inconnu"));

        let faux_jeton = Identifiants { device: "d1".into(), token: generer_token() };
        assert!(matches!(verifier(&conn, &faux_jeton), Err(e) if e.erreur == "jeton_invalide"));
    }
}
