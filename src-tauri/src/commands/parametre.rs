// Commandes Tauri - module paramètres (Phase 6)
use crate::db::AppState;
use crate::models::parametre::Parametres;
use rusqlite::params;
use std::collections::HashMap;
use tauri::State;

/// Construit la structure des paramètres depuis les lignes clé/valeur, avec
/// des valeurs par défaut pour les clés absentes de la base.
fn construire(map: &HashMap<String, String>) -> Parametres {
    let lire = |cle: &str, defaut: &str| -> String {
        match map.get(cle) {
            Some(valeur) => valeur.clone(),
            None => defaut.to_string(),
        }
    };

    Parametres {
        entreprise_nom: lire("entreprise_nom", "ABAF SARL"),
        entreprise_adresse: lire("entreprise_adresse", "Moundou, Tchad"),
        entreprise_telephone: lire("entreprise_telephone", ""),
        entreprise_email: lire("entreprise_email", ""),
        sauvegarde_auto: lire("sauvegarde_auto", "0") == "1",
    }
}

/// Lit les paramètres généraux de l'application.
#[tauri::command]
pub fn get_parametres(state: State<AppState>) -> Result<Parametres, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare("SELECT cle, valeur FROM parametres")
        .map_err(|e| e.to_string())?;
    let lignes = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?;

    let mut map = HashMap::new();
    for ligne in lignes {
        let (cle, valeur) = ligne.map_err(|e| e.to_string())?;
        map.insert(cle, valeur);
    }

    Ok(construire(&map))
}

/// Enregistre les paramètres généraux (UPSERT des informations de l'entreprise
/// et des options de sauvegarde). Le nom de l'entreprise est obligatoire.
#[tauri::command]
pub fn set_parametres(
    state: State<AppState>,
    payload: Parametres,
) -> Result<Parametres, String> {
    let enregistres = Parametres {
        entreprise_nom: payload.entreprise_nom.trim().to_string(),
        entreprise_adresse: payload.entreprise_adresse.trim().to_string(),
        entreprise_telephone: payload.entreprise_telephone.trim().to_string(),
        entreprise_email: payload.entreprise_email.trim().to_string(),
        sauvegarde_auto: payload.sauvegarde_auto,
    };

    if enregistres.entreprise_nom.is_empty() {
        return Err("Le nom de l'entreprise est obligatoire.".to_string());
    }

    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    let tx = db.transaction().map_err(|e| e.to_string())?;

    let sauvegarde_texte = if enregistres.sauvegarde_auto { "1" } else { "0" }.to_string();
    let valeurs = [
        ("entreprise_nom", &enregistres.entreprise_nom),
        ("entreprise_adresse", &enregistres.entreprise_adresse),
        ("entreprise_telephone", &enregistres.entreprise_telephone),
        ("entreprise_email", &enregistres.entreprise_email),
        ("sauvegarde_auto", &sauvegarde_texte),
    ];
    for (cle, valeur) in valeurs {
        tx.execute(
            "INSERT INTO parametres (cle, valeur, updated_at) VALUES (?1, ?2, datetime('now'))
             ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur, updated_at = excluded.updated_at",
            params![cle, valeur],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(enregistres)
}
