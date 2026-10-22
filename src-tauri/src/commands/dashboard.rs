// Commandes Tauri - module tableau de bord (Phase 6)
use crate::commands::rapport::{construire_comparaison, construire_totaux, resoudre_saison};
use crate::db::AppState;
use crate::models::dashboard::DashboardStats;
use tauri::State;

/// Indicateurs du tableau de bord (AGENT.md §17) : nombres d'opérations,
/// tonnages, gasoil et finances de la campagne sélectionnée, plus le nombre
/// de camions actifs et la comparaison des campagnes pour les graphiques.
/// Sans campagne précisée, la campagne ouverte est utilisée.
#[tauri::command]
pub fn get_dashboard_stats(
    state: State<AppState>,
    saison_id: Option<i64>,
) -> Result<DashboardStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let saison = resoudre_saison(&db, saison_id)?;

    let nb_camions_actifs = db
        .query_row("SELECT COUNT(*) FROM camions WHERE actif = 1", [], |row| {
            row.get(0)
        })
        .map_err(|e| e.to_string())?;

    Ok(DashboardStats {
        saison_id: saison.id,
        saison_libelle: saison.libelle,
        nb_camions_actifs,
        totaux: construire_totaux(&db, saison.id)?,
        comparaison: construire_comparaison(&db)?,
    })
}
