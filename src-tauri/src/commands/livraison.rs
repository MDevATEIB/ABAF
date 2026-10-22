// Commandes Tauri - module livraison (Phase 3)
use crate::db::AppState;
use crate::models::livraison::{LivraisonsParAv, LivraisonsParCamion, SyntheseLivraisons};
use tauri::State;

/// Synthèse des livraisons (bordereaux validés ou facturés) : totaux
/// généraux, par camion et par AV, pour une campagne donnée ou toutes.
///
/// La livraison n'a pas de table propre : elle s'appuie sur les bordereaux
/// validés, conformément au document de traçabilité de la livraison
/// (AGENT.md §4 étape 9).
#[tauri::command]
pub fn get_synthese_livraisons(
    state: State<AppState>,
    saison_id: Option<i64>,
) -> Result<SyntheseLivraisons, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let (nb_livraisons, poids_net_total_kg) = db
        .query_row(
            "SELECT COUNT(*), COALESCE(SUM(poids_net_kg), 0)
             FROM bordereaux
             WHERE statut IN ('valide', 'facture')
               AND (?1 IS NULL OR saison_id = ?1)",
            rusqlite::params![saison_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let par_camion = {
        let mut stmt = db
            .prepare(
                "SELECT camion_id, COUNT(*), COALESCE(SUM(poids_net_kg), 0)
                 FROM bordereaux
                 WHERE statut IN ('valide', 'facture')
                   AND (?1 IS NULL OR saison_id = ?1)
                 GROUP BY camion_id
                 ORDER BY 3 DESC",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(rusqlite::params![saison_id], |row| {
                Ok(LivraisonsParCamion {
                    camion_id: row.get(0)?,
                    nb_livraisons: row.get(1)?,
                    poids_net_kg: row.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        rows
    };

    let par_av = {
        let mut stmt = db
            .prepare(
                "SELECT lb.av_id, COUNT(*), COALESCE(SUM(lb.poids_kg), 0)
                 FROM lignes_bordereau lb
                 JOIN bordereaux b ON b.id = lb.bordereau_id
                 WHERE b.statut IN ('valide', 'facture')
                   AND lb.av_id IS NOT NULL
                   AND (?1 IS NULL OR b.saison_id = ?1)
                 GROUP BY lb.av_id
                 ORDER BY 3 DESC",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(rusqlite::params![saison_id], |row| {
                Ok(LivraisonsParAv {
                    av_id: row.get(0)?,
                    nb_lots: row.get(1)?,
                    poids_lots_kg: row.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        rows
    };

    Ok(SyntheseLivraisons {
        nb_livraisons,
        poids_net_total_kg,
        par_camion,
        par_av,
    })
}
