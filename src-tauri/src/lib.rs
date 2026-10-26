// ─── Modules internes ────────────────────────────────────────────────────────
pub mod commands;
pub mod db;
pub mod models;
pub mod services;
pub mod sync;
pub mod utils;

use tauri::Manager;

// ─── Point d'entrée Tauri ────────────────────────────────────────────────────
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Impossible d'obtenir le répertoire de données de l'application");

            let state = db::setup(app_data_dir)
                .expect("Impossible d'initialiser la base de données");

            app.manage(state);
            // Pilote du serveur de synchronisation : vivant même quand le
            // serveur est éteint, pour que Paramètres puisse l'allumer.
            app.manage::<std::sync::Arc<sync::SyncState>>(std::sync::Arc::new(
                sync::SyncState::new(),
            ));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Saisons
            commands::saison::lister_saisons,
            commands::saison::creer_saison,
            commands::saison::modifier_saison,
            commands::saison::cloturer_saison,
            // Tarifs
            commands::tarif::lister_tarifs,
            commands::tarif::creer_tarif,
            commands::tarif::modifier_tarif,
            commands::tarif::supprimer_tarif,
            // Prix gasoil
            commands::prix_gasoil::get_prix_gasoil,
            commands::prix_gasoil::set_prix_gasoil,
            // Camions
            commands::camion::lister_camions,
            commands::camion::creer_camion,
            commands::camion::modifier_camion,
            commands::camion::desactiver_camion,
            // Chauffeurs
            commands::chauffeur::lister_chauffeurs,
            commands::chauffeur::creer_chauffeur,
            commands::chauffeur::modifier_chauffeur,
            commands::chauffeur::desactiver_chauffeur,
            // Usines
            commands::usine::lister_usines,
            commands::usine::creer_usine,
            commands::usine::modifier_usine,
            // CGI
            commands::cgi::lister_cgis,
            commands::cgi::creer_cgi,
            commands::cgi::modifier_cgi,
            // AV
            commands::av::lister_avs,
            commands::av::creer_av,
            commands::av::modifier_av,
            // Clients
            commands::client::lister_clients,
            // Missions
            commands::mission::lister_missions,
            commands::mission::creer_mission,
            commands::mission::modifier_mission,
            commands::mission::changer_statut_mission,
            // Pesées
            commands::pesee::creer_pesee,
            commands::pesee::get_pesees_mission,
            commands::pesee::supprimer_pesee,
            // BSM
            commands::bsm::lister_bsm,
            commands::bsm::creer_bsm,
            commands::bsm::modifier_bsm,
            commands::bsm::changer_statut_bsm,
            // Bordereaux
            commands::bordereau::lister_bordereaux,
            commands::bordereau::get_lignes_bordereau,
            commands::bordereau::creer_bordereau,
            commands::bordereau::modifier_bordereau,
            commands::bordereau::valider_bordereau,
            commands::bordereau::devalider_bordereau,
            // Livraisons
            commands::livraison::get_synthese_livraisons,
            // Factures
            commands::facture::lister_factures,
            commands::facture::get_lignes_facture,
            commands::facture::get_operations_disponibles,
            commands::facture::creer_facture,
            commands::facture::valider_facture,
            commands::facture::supprimer_facture,
            // Paiements
            commands::paiement::lister_paiements,
            commands::paiement::creer_paiement,
            commands::paiement::modifier_paiement,
            // Avances
            commands::avance::lister_avances,
            commands::avance::get_utilisations_avance,
            commands::avance::creer_avance,
            commands::avance::enregistrer_utilisation_avance,
            // Rapport
            commands::rapport::generer_recapitulatif,
            commands::rapport::generer_rapport_annuel,
            commands::rapport::exporter_rapport_excel,
            commands::rapport::sauvegarder_rapport_pdf,
            commands::rapport::sauvegarder_exploitation_pdf,
            // Tableau de bord
            commands::dashboard::get_dashboard_stats,
            // Exploitation : dépenses de terrain, intervenants, pièces, marge
            commands::depense::lister_depenses,
            commands::depense::get_depense,
            commands::depense::creer_depense,
            commands::depense::modifier_depense,
            commands::depense::valider_depense,
            commands::depense::rejeter_depense,
            commands::depense::supprimer_depense,
            commands::depense::get_justificatif_depense,
            commands::depense::totaliser_depenses_par_categorie,
            commands::depense::get_synthese_exploitation,
            commands::depense::get_repartition_depenses,
            commands::depense::get_marge_par_camion,
            commands::depense::get_rapport_exploitation,
            commands::intervenant::lister_intervenants,
            commands::intervenant::creer_intervenant,
            commands::intervenant::modifier_intervenant,
            commands::intervenant::desactiver_intervenant,
            commands::piece::lister_pieces,
            commands::piece::creer_piece,
            commands::piece::modifier_piece,
            commands::piece::desactiver_piece,
            // Synchronisation avec les applications de terrain
            commands::sync::demarrer_serveur_sync,
            commands::sync::arreter_serveur_sync,
            commands::sync::get_etat_sync,
            commands::sync::generer_code_appairage,
            commands::sync::annuler_code_appairage,
            commands::sync::lister_appareils,
            commands::sync::revoquer_appareil,
            commands::sync::supprimer_appareil,
            commands::sync::ouvrir_dossier_justificatifs,
            commands::sync::configurer_pare_feu,
            commands::sync::tester_port_disponible,
            // Paramètres
            commands::parametre::get_parametres,
            commands::parametre::set_parametres,
            // Sauvegarde
            commands::sauvegarde::sauvegarder_base,
            commands::sauvegarde::choisir_fichier_sauvegarde,
            commands::sauvegarde::restaurer_base,
            // Utils / numérotation auto
            utils::prochain_numero_document,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors du démarrage de l'application ABAF");
}
