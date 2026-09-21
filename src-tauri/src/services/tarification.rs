//! Moteur de calcul tarifaire unique (CDC v1.1, campagne 2026-2027).
//!
//! Partagé entre la validation des bordereaux (le tarif appliqué et le
//! montant brut y sont figés) et la facturation (repli pour les bordereaux
//! validés avant la Phase 7).
//!
//! Grille : une tranche de distance par type de fret et par campagne,
//! `distance_max` NULL = tranche ouverte (« 91 km et plus »). Les bornes sont
//! inclusives : la tranche 0–65 km s'arrête à 65 km et la tranche suivante
//! démarre à 66 km (grille continue, sans trou).
//!
//! Formules du CDC :
//! - unité « fcfa_tonne » (≤ 90 km) : poids (t) × tarif à la tonne ;
//! - unité « fcfa_tkm » (au-delà)   : poids (t) × distance × tarif à la tonne-km.

use rusqlite::Connection;

/// Types de fret du contrat (CDC v1.1).
pub const TYPES_FRET: [&str; 4] = ["direct", "retour", "evacuation", "transfert"];

/// Unités de tarification du contrat : « fcfa_tonne » pour les distances
/// ≤ 90 km, « fcfa_tkm » au-delà.
pub const UNITES_TARIF: [&str; 2] = ["fcfa_tonne", "fcfa_tkm"];

/// Seuil du contrat (CDC §7.1) : jusqu'à 90 km inclus, la facturation se
/// fait au FCFA/tonne ; au-delà, au FCFA/TKM. La TKM n'est facturée que
/// pour les trajets dépassant ce seuil (CDC §11.2).
pub const SEUIL_KM_FACTURATION_TONNE: f64 = 90.0;

/// Résultat du calcul tarifaire d'un transport.
#[derive(Debug, Clone, PartialEq)]
pub struct CalculTarif {
    /// Valeur de la tranche retenue : FCFA/tonne ou FCFA/TKM selon l'unité.
    pub tarif_applique: f64,
    /// Unité de la tranche retenue.
    pub unite_tarif: String,
    /// Montant brut du transport, en FCFA.
    pub montant_brut: f64,
}

/// Calcule le montant brut d'un transport : tranche applicable de la grille
/// (campagne + type de fret + distance), puis formule de l'unité.
pub fn calculer(
    conn: &Connection,
    saison_id: i64,
    type_fret: &str,
    distance_km: f64,
    poids_kg: f64,
) -> Result<CalculTarif, String> {
    let (tarif_applique, unite_tarif) = trouver_tranche(conn, saison_id, type_fret, distance_km)?;
    let montant_brut = montant_brut(poids_kg, distance_km, &unite_tarif, tarif_applique);
    Ok(CalculTarif {
        tarif_applique,
        unite_tarif,
        montant_brut,
    })
}

/// Tranche applicable : celle qui contient la distance, bornes incluses
/// (requête de référence du CDC). `distance_max` NULL = tranche ouverte.
pub fn trouver_tranche(
    conn: &Connection,
    saison_id: i64,
    type_fret: &str,
    distance_km: f64,
) -> Result<(f64, String), String> {
    conn.query_row(
        "SELECT tarif, unite_tarif
         FROM tarifs
         WHERE saison_id = ?1
           AND type_fret = ?2
           AND ?3 >= distance_min
           AND (distance_max IS NULL OR ?3 <= distance_max)
         ORDER BY distance_min DESC
         LIMIT 1",
        rusqlite::params![saison_id, type_fret, distance_km],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .map_err(|_| {
        format!(
            "Aucun tarif applicable pour {} km (fret « {} ») : complétez la grille tarifaire de la campagne.",
            distance_km, type_fret
        )
    })
}

/// Formule unique du CDC :
/// - « fcfa_tonne » : poids (t) × tarif à la tonne ;
/// - « fcfa_tkm »   : poids (t) × distance × tarif à la tonne-km.
pub fn montant_brut(poids_kg: f64, distance_km: f64, unite_tarif: &str, tarif: f64) -> f64 {
    let tonnes = poids_kg / 1000.0;
    if unite_tarif == "fcfa_tonne" {
        tonnes * tarif
    } else {
        tonnes * distance_km * tarif
    }
}

/// Tarif à la tonne effectif d'une opération (colonne `tarif_tonne` des lignes
/// de facture) : pour l'unité « fcfa_tkm », le tarif de la tranche est
/// multiplié par la distance pour obtenir un prix à la tonne comparable.
pub fn tarif_tonne_effectif(unite_tarif: &str, tarif_applique: f64, distance_km: f64) -> f64 {
    if unite_tarif == "fcfa_tonne" {
        tarif_applique
    } else {
        distance_km * tarif_applique
    }
}

/// Tonne-kilomètres d'un transport (CDC §11.2) : la TKM n'est calculée que
/// pour les distances dépassant le seuil de 90 km, `None` sinon.
pub fn tonne_kilometres(poids_kg: f64, distance_km: f64) -> Option<f64> {
    if distance_km > SEUIL_KM_FACTURATION_TONNE {
        Some((poids_kg / 1000.0) * distance_km)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Base en mémoire avec la grille 2026-2027 du contrat (CDC v1.1) :
    /// tranches direct/retour en FCFA/tonne jusqu'à 90 km puis FCFA/TKM,
    /// évacuation et transfert en FCFA/TKM sur une tranche ouverte.
    fn base_grille_cdc() -> Connection {
        let conn = Connection::open_in_memory().expect("base en mémoire");
        crate::db::run_migrations(&conn).expect("migrations");
        conn.execute(
            "INSERT INTO saisons (libelle, date_debut) VALUES ('2026-2027', '2026-01-01')",
            [],
        )
        .expect("saison 2026-2027");
        let saison = conn.last_insert_rowid();

        let tranches: [(&str, f64, Option<f64>, &str, f64); 8] = [
            ("direct", 0.0, Some(65.0), "fcfa_tonne", 12_937.0),
            ("direct", 66.0, Some(90.0), "fcfa_tonne", 14_513.0),
            ("direct", 91.0, None, "fcfa_tkm", 215.0),
            ("retour", 0.0, Some(65.0), "fcfa_tonne", 6_468.0),
            ("retour", 66.0, Some(90.0), "fcfa_tonne", 7_256.0),
            ("retour", 91.0, None, "fcfa_tkm", 107.5),
            ("evacuation", 0.0, None, "fcfa_tkm", 87.0),
            ("transfert", 0.0, None, "fcfa_tkm", 92.0),
        ];
        for (type_fret, min, max, unite, tarif) in tranches {
            conn.execute(
                "INSERT INTO tarifs (saison_id, type_fret, distance_min, distance_max, unite_tarif, tarif)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![saison, type_fret, min, max, unite, tarif],
            )
            .expect("tranche insérée");
        }
        conn
    }

    /// Calcule avec la grille CDC (la saison créée est la première de la base).
    fn calculer_cdc(type_fret: &str, distance_km: f64, poids_kg: f64) -> CalculTarif {
        let conn = base_grille_cdc();
        calculer(&conn, 1, type_fret, distance_km, poids_kg).expect("calcul tarifaire")
    }

    // ── Les 6 exemples chiffrés du CDC ───────────────────────────────────────
    // Exemple 1 : direct, 50 km, 20 t → 20 × 12 937 = 258 740 FCFA.
    #[test]
    fn exemple_cdc_1_direct_50_km() {
        let c = calculer_cdc("direct", 50.0, 20_000.0);
        assert_eq!(c.unite_tarif, "fcfa_tonne");
        assert_eq!(c.tarif_applique, 12_937.0);
        assert_eq!(c.montant_brut, 258_740.0);
    }

    // Exemple 2 : direct, 80 km, 20 t → 20 × 14 513 = 290 260 FCFA.
    #[test]
    fn exemple_cdc_2_direct_80_km() {
        let c = calculer_cdc("direct", 80.0, 20_000.0);
        assert_eq!(c.unite_tarif, "fcfa_tonne");
        assert_eq!(c.tarif_applique, 14_513.0);
        assert_eq!(c.montant_brut, 290_260.0);
    }

    // Exemple 3 : direct, 183 km, 20 t → 20 × 183 × 215 = 786 900 FCFA.
    #[test]
    fn exemple_cdc_3_direct_183_km() {
        let c = calculer_cdc("direct", 183.0, 20_000.0);
        assert_eq!(c.unite_tarif, "fcfa_tkm");
        assert_eq!(c.tarif_applique, 215.0);
        assert_eq!(c.montant_brut, 786_900.0);
    }

    // Exemple 4 : retour, 80 km, 25 t → 25 × 7 256 = 181 400 FCFA.
    #[test]
    fn exemple_cdc_4_retour_80_km() {
        let c = calculer_cdc("retour", 80.0, 25_000.0);
        assert_eq!(c.unite_tarif, "fcfa_tonne");
        assert_eq!(c.tarif_applique, 7_256.0);
        assert_eq!(c.montant_brut, 181_400.0);
    }

    // Exemple 5 : évacuation, 200 km, 30 t → 30 × 200 × 87 = 522 000 FCFA.
    #[test]
    fn exemple_cdc_5_evacuation_200_km() {
        let c = calculer_cdc("evacuation", 200.0, 30_000.0);
        assert_eq!(c.unite_tarif, "fcfa_tkm");
        assert_eq!(c.tarif_applique, 87.0);
        assert_eq!(c.montant_brut, 522_000.0);
    }

    // Exemple 6 : transfert (évacuation intrants, taux 92), 150 km, 15 t
    // → 15 × 150 × 92 = 207 000 FCFA.
    #[test]
    fn exemple_cdc_6_transfert_150_km() {
        let c = calculer_cdc("transfert", 150.0, 15_000.0);
        assert_eq!(c.unite_tarif, "fcfa_tkm");
        assert_eq!(c.tarif_applique, 92.0);
        assert_eq!(c.montant_brut, 207_000.0);
    }

    // ── Continuité des tranches et borne ouverte ─────────────────────────────
    #[test]
    fn tranches_continues_entre_65_et_66_km() {
        // 65 km appartient à la tranche 0–65, 66 km à la tranche 66–90 :
        // la grille est continue, sans trou entre les deux.
        let a_65 = calculer_cdc("direct", 65.0, 1_000.0);
        assert_eq!((a_65.tarif_applique, a_65.unite_tarif.as_str()), (12_937.0, "fcfa_tonne"));

        let a_66 = calculer_cdc("direct", 66.0, 1_000.0);
        assert_eq!((a_66.tarif_applique, a_66.unite_tarif.as_str()), (14_513.0, "fcfa_tonne"));

        // Bornes du basculement vers le TKM : 90 km reste en FCFA/tonne,
        // 91 km passe dans la tranche ouverte « 91 km et plus ».
        let a_90 = calculer_cdc("direct", 90.0, 1_000.0);
        assert_eq!((a_90.tarif_applique, a_90.unite_tarif.as_str()), (14_513.0, "fcfa_tonne"));

        let a_91 = calculer_cdc("direct", 91.0, 1_000.0);
        assert_eq!((a_91.tarif_applique, a_91.unite_tarif.as_str()), (215.0, "fcfa_tkm"));
    }

    #[test]
    fn erreur_quand_aucune_tranche_ne_correspond() {
        let conn = base_grille_cdc();
        conn.execute(
            "INSERT INTO saisons (libelle, date_debut) VALUES ('2027-2028', '2027-01-01')",
            [],
        )
        .expect("saison suivante");
        let saison_suivante = conn.last_insert_rowid();

        let erreur = calculer(&conn, saison_suivante, "direct", 50.0, 20_000.0).unwrap_err();
        assert!(erreur.contains("Aucun tarif applicable"), "message : {erreur}");
    }

    #[test]
    fn tarif_tonne_effectif_selon_lunite() {
        // En FCFA/tonne, le tarif de la tranche est déjà un prix à la tonne.
        assert_eq!(tarif_tonne_effectif("fcfa_tonne", 14_513.0, 80.0), 14_513.0);
        // En FCFA/TKM, il faut le multiplier par la distance.
        assert_eq!(tarif_tonne_effectif("fcfa_tkm", 215.0, 183.0), 39_345.0);
    }

    #[test]
    fn tonne_kilometres_au_dela_de_90_km() {
        // Exemple CDC : direct 183 km, 20 t → 20 × 183 = 3 660 TKM.
        assert_eq!(tonne_kilometres(20_000.0, 183.0), Some(3_660.0));
        // 90 km reste au FCFA/tonne (exemples CDC 80 km inclus) : pas de TKM.
        assert_eq!(tonne_kilometres(20_000.0, 90.0), None);
        assert_eq!(tonne_kilometres(25_000.0, 80.0), None);
    }
}
