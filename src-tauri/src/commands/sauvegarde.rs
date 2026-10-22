// Commandes Tauri - module sauvegarde et restauration (Phase 6)
use crate::commands::rapport::dossier_documents;
use crate::db::AppState;
use rusqlite::backup::Progress;
use rusqlite::{params, Connection, DatabaseName, OpenFlags};
use std::path::PathBuf;
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;

/// Sauvegarde manuelle de la base de données (AGENT.md §24.3) : une copie
/// complète et cohérente de la base est créée via « VACUUM INTO » (les
/// transactions encore présentes dans le journal WAL sont incluses).
/// Sans dossier précisé, la copie est créée dans « Documents/ABAF ».
/// Retourne le chemin complet du fichier créé.
#[tauri::command]
pub fn sauvegarder_base(
    state: State<AppState>,
    dossier: Option<String>,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let repertoire = match dossier.as_deref().map(str::trim) {
        Some(dossier_choisi) if !dossier_choisi.is_empty() => PathBuf::from(dossier_choisi),
        _ => dossier_documents()?.join("ABAF"),
    };
    std::fs::create_dir_all(&repertoire)
        .map_err(|e| format!("Impossible de créer le dossier de sauvegarde : {e}"))?;

    let nom_fichier = format!("abaf-{}.db", chrono::Local::now().format("%Y%m%d_%H%M%S"));
    let chemin = repertoire.join(nom_fichier);
    let chemin_texte = chemin.to_string_lossy().to_string();

    db.execute("VACUUM INTO ?1", params![chemin_texte])
        .map_err(|e| format!("Erreur lors de la sauvegarde de la base : {e}"))?;

    Ok(chemin_texte)
}

/// Ouvre le dialogue de sélection d'une sauvegarde à restaurer (AGENT.md
/// §24.3). Retourne le chemin choisi, ou None si l'utilisateur annule.
#[tauri::command]
pub async fn choisir_fichier_sauvegarde(app: tauri::AppHandle) -> Result<Option<String>, String> {
    // Le dialogue est bloquant : il s'exécute hors du runtime async.
    let fichier = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("Choisir une sauvegarde à restaurer")
            .add_filter("Base de données SQLite", &["db"])
            .blocking_pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(fichier.and_then(|chemin| chemin.as_path().map(|p| p.to_string_lossy().to_string())))
}

/// Restaure la base depuis une sauvegarde (AGENT.md §24.3) : le fichier est
/// validé (tables ABAF attendues), une copie de sécurité de la base actuelle
/// est créée dans « backups/ » puis le contenu de la sauvegarde remplace
/// celui de la base en place (API backup de SQLite, sans fermer la connexion).
/// Retourne le chemin de la copie de sécurité.
#[tauri::command]
pub fn restaurer_base(
    state: State<AppState>,
    app: tauri::AppHandle,
    chemin: String,
) -> Result<String, String> {
    let chemin_source = PathBuf::from(chemin.trim());
    if !chemin_source.is_file() {
        return Err("Fichier de sauvegarde introuvable.".to_string());
    }

    // Validation : le fichier doit être une base SQLite contenant les tables
    // principales d'une base ABAF.
    let conn_source = Connection::open_with_flags(&chemin_source, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("Ce fichier n'est pas une base SQLite valide : {e}"))?;
    let nb_tables: i64 = conn_source
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master
             WHERE type = 'table' AND name IN ('saisons', 'missions', 'factures')",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Ce fichier n'est pas une base SQLite valide : {e}"))?;
    drop(conn_source);
    if nb_tables < 3 {
        return Err(
            "Ce fichier n'est pas une sauvegarde ABAF valide (tables manquantes).".to_string(),
        );
    }

    let mut db = state.db.lock().map_err(|e| e.to_string())?;

    // Copie de sécurité de la base actuelle avant remplacement (§24.3).
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Impossible d'obtenir le dossier de données : {e}"))?;
    let dossier_backups = app_data_dir.join("backups");
    std::fs::create_dir_all(&dossier_backups)
        .map_err(|e| format!("Impossible de créer le dossier de sauvegarde : {e}"))?;
    let nom_securite = format!("abaf-{}.db", chrono::Local::now().format("%Y%m%d_%H%M%S"));
    let chemin_securite = dossier_backups.join(nom_securite);
    let chemin_securite_texte = chemin_securite.to_string_lossy().to_string();
    db.execute("VACUUM INTO ?1", params![chemin_securite_texte])
        .map_err(|e| format!("Erreur lors de la copie de sécurité : {e}"))?;

    // Remplacement du contenu de la base en place (API backup de SQLite).
    db.restore(DatabaseName::Main, &chemin_source, None::<fn(Progress)>)
        .map_err(|e| format!("Erreur lors de la restauration : {e}"))?;

    // La sauvegarde restaurée peut dater d'un schéma antérieur : les
    // migrations versionnées sont rejouées sur la base en place.
    crate::db::run_migrations(&db)
        .map_err(|e| format!("Erreur lors de la mise à jour du schéma : {e}"))?;

    let _ = crate::db::nettoyer_anciennes_copies(&dossier_backups, 10);

    Ok(chemin_securite_texte)
}
