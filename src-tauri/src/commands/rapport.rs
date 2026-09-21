// Commandes Tauri - module rapport (Phase 5)
use crate::db::AppState;
use crate::models::rapport::{
    BsmRapport, ComparaisonCampagne, LigneRapport, PaiementRapport, RapportAnnuel, Recapitulatif,
    TotauxRapport,
};
use rusqlite::Connection;
use rust_xlsxwriter::{Color, Format, FormatAlign, FormatBorder, Workbook, XlsxError};
use std::path::PathBuf;
use tauri::State;

/// Campagne ciblée par un rapport : soit celle demandée, soit la campagne
/// ouverte par défaut.
pub(crate) struct SaisonResume {
    pub(crate) id: i64,
    pub(crate) libelle: String,
    pub(crate) date_debut: String,
    pub(crate) date_fin: Option<String>,
}

// ─── Récapitulatif (AGENT.md §16) ────────────────────────────────────────────

/// Construit automatiquement le récapitulatif des mouvements d'une campagne
/// à partir des missions, pesées, BSM, bordereaux, factures, paiements et
/// avances.
#[tauri::command]
pub fn generer_recapitulatif(
    state: State<AppState>,
    saison_id: Option<i64>,
) -> Result<Recapitulatif, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let saison = resoudre_saison(&db, saison_id)?;

    Ok(Recapitulatif {
        saison_id: saison.id,
        saison_libelle: saison.libelle,
        date_debut: saison.date_debut,
        date_fin: saison.date_fin,
        lignes: construire_lignes(&db, saison.id)?,
        totaux: construire_totaux(&db, saison.id)?,
    })
}

// ─── Rapport annuel (AGENT.md §7 et §20.4) ───────────────────────────────────

/// Génère automatiquement le rapport annuel d'une campagne : tableau des
/// opérations, totaux, données de gasoil, données BMS, règlements et
/// comparaison avec les campagnes précédentes.
#[tauri::command]
pub fn generer_rapport_annuel(
    state: State<AppState>,
    saison_id: Option<i64>,
) -> Result<RapportAnnuel, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let saison = resoudre_saison(&db, saison_id)?;

    Ok(RapportAnnuel {
        saison_id: saison.id,
        saison_libelle: saison.libelle,
        date_debut: saison.date_debut,
        date_fin: saison.date_fin,
        lignes: construire_lignes(&db, saison.id)?,
        totaux: construire_totaux(&db, saison.id)?,
        bsms: construire_bsms(&db, saison.id)?,
        paiements: construire_paiements(&db, saison.id)?,
        comparaison: construire_comparaison(&db)?,
    })
}

/// Exporte le rapport annuel d'une campagne dans un classeur Excel (.xlsx) :
/// feuille « Opérations » (colonnes §7.2 + totaux), feuille « Gasoil & BSM »,
/// feuille « Règlements » et feuille « Comparaison ».
/// Le fichier est écrit dans le dossier fourni ou, par défaut, dans
/// « Documents/ABAF ». Retourne le chemin complet du fichier généré.
#[tauri::command]
pub fn exporter_rapport_excel(
    state: State<AppState>,
    saison_id: Option<i64>,
    dossier: Option<String>,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let saison = resoudre_saison(&db, saison_id)?;
    let lignes = construire_lignes(&db, saison.id)?;
    let totaux = construire_totaux(&db, saison.id)?;
    let bsms = construire_bsms(&db, saison.id)?;
    let paiements = construire_paiements(&db, saison.id)?;
    let comparaison = construire_comparaison(&db)?;
    drop(db);

    let repertoire = match dossier.as_deref().map(str::trim) {
        Some(dossier_choisi) if !dossier_choisi.is_empty() => PathBuf::from(dossier_choisi),
        _ => dossier_documents()?.join("ABAF"),
    };
    std::fs::create_dir_all(&repertoire)
        .map_err(|e| format!("Impossible de créer le dossier d'export : {e}"))?;

    let nom_fichier = format!(
        "Rapport_annuel_{}_{}.xlsx",
        nettoyer_nom_fichier(&saison.libelle),
        chrono::Local::now().format("%Y%m%d_%H%M")
    );
    let chemin = repertoire.join(nom_fichier);

    let mut classeur =
        construire_classeur(&saison, &lignes, &totaux, &bsms, &paiements, &comparaison)
            .map_err(|e| format!("Erreur de génération du classeur Excel : {e}"))?;
    classeur
        .save(&chemin)
        .map_err(|e| format!("Impossible d'enregistrer le fichier Excel : {e}"))?;

    Ok(chemin.to_string_lossy().to_string())
}

// ─── Aide interne ─────────────────────────────────────────────────────────────

pub(crate) fn resoudre_saison(db: &Connection, saison_id: Option<i64>) -> Result<SaisonResume, String> {
    let id = match saison_id {
        Some(id) => id,
        None => db
            .query_row(
                "SELECT id FROM saisons WHERE statut = 'ouverte' ORDER BY id DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .map_err(|_| "Aucune campagne ouverte : sélectionnez une campagne.".to_string())?,
    };

    db.query_row(
        "SELECT id, libelle, date_debut, date_fin FROM saisons WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(SaisonResume {
                id: row.get(0)?,
                libelle: row.get(1)?,
                date_debut: row.get(2)?,
                date_fin: row.get(3)?,
            })
        },
    )
    .map_err(|_| "Campagne introuvable.".to_string())
}

/// Tableau des opérations : une ligne par bordereau, avec le gasoil de la
/// mission (BSM), la facturation du bordereau et les intrants chargés.
fn construire_lignes(db: &Connection, saison_id: i64) -> Result<Vec<LigneRapport>, String> {
    let mut stmt = db
        .prepare(
            "SELECT b.id, b.numero, b.date_bordereau, b.poids_net_kg, b.distance_km,
                    b.observations,
                    cam.immatriculation, u.nom, c.nom,
                    (SELECT GROUP_CONCAT(DISTINCT a.nom)
                     FROM lignes_bordereau lb JOIN avs a ON a.id = lb.av_id
                     WHERE lb.bordereau_id = b.id),
                    (SELECT COALESCE(SUM(lb.poids_kg), 0)
                     FROM lignes_bordereau lb WHERE lb.bordereau_id = b.id),
                    (SELECT COALESCE(SUM(x.quantite_litres), 0)
                     FROM bsm x WHERE x.mission_id = b.mission_id),
                    (SELECT COALESCE(SUM(x.montant), 0)
                     FROM bsm x WHERE x.mission_id = b.mission_id),
                    (SELECT GROUP_CONCAT(x.numero, ', ')
                     FROM bsm x WHERE x.mission_id = b.mission_id),
                    (SELECT f.numero
                     FROM lignes_facture lf JOIN factures f ON f.id = lf.facture_id
                     WHERE lf.bordereau_id = b.id LIMIT 1),
                    (SELECT lf.montant_net
                     FROM lignes_facture lf WHERE lf.bordereau_id = b.id LIMIT 1)
             FROM bordereaux b
             LEFT JOIN camions cam ON cam.id = b.camion_id
             LEFT JOIN usines u ON u.id = b.usine_id
             LEFT JOIN cgis c ON c.id = b.cgi_id
             WHERE b.saison_id = ?1
             ORDER BY b.date_bordereau, b.id",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![saison_id], |row| {
            Ok(LigneRapport {
                bordereau_id: row.get(0)?,
                numero_bordereau: row.get(1)?,
                date_bordereau: row.get(2)?,
                poids_coton_kg: row.get(3)?,
                distance_km: row.get(4)?,
                observations: row.get(5)?,
                numero_camion: row.get(6)?,
                usine: row.get(7)?,
                cgi: row.get(8)?,
                av: row.get(9)?,
                poids_intrants_kg: row.get(10)?,
                gasoil_litres: row.get(11)?,
                gasoil_montant: row.get(12)?,
                numeros_bms: row.get(13)?,
                numero_facture: row.get(14)?,
                montant_net: row.get(15)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Totaux de la campagne (AGENT.md §21.1).
pub(crate) fn construire_totaux(db: &Connection, saison_id: i64) -> Result<TotauxRapport, String> {
    let mut totaux = db
        .query_row(
            "SELECT
                (SELECT COUNT(*) FROM missions WHERE saison_id = ?1),
                (SELECT COUNT(*) FROM bordereaux WHERE saison_id = ?1),
                (SELECT COUNT(*) FROM bsm WHERE saison_id = ?1),
                (SELECT COUNT(*) FROM factures WHERE saison_id = ?1),
                (SELECT COUNT(*) FROM paiements p JOIN factures f ON f.id = p.facture_id
                 WHERE f.saison_id = ?1),
                (SELECT COALESCE(SUM(poids_net_kg), 0) FROM bordereaux WHERE saison_id = ?1),
                (SELECT COALESCE(SUM(lb.poids_kg), 0)
                 FROM lignes_bordereau lb JOIN bordereaux b ON b.id = lb.bordereau_id
                 WHERE b.saison_id = ?1),
                (SELECT COALESCE(SUM(distance_km), 0) FROM bordereaux WHERE saison_id = ?1),
                (SELECT COALESCE(SUM(quantite_litres), 0) FROM bsm WHERE saison_id = ?1),
                (SELECT COALESCE(SUM(montant), 0) FROM bsm WHERE saison_id = ?1),
                (SELECT COALESCE(SUM(montant_brut), 0) FROM factures WHERE saison_id = ?1),
                (SELECT COALESCE(SUM(montant_gasoil), 0) FROM factures WHERE saison_id = ?1),
                (SELECT COALESCE(SUM(montant_net), 0) FROM factures WHERE saison_id = ?1),
                (SELECT COALESCE(SUM(p.montant), 0)
                 FROM paiements p JOIN factures f ON f.id = p.facture_id
                 WHERE f.saison_id = ?1 AND p.statut = 'paye'),
                (SELECT COALESCE(SUM(montant_initial), 0) FROM avances WHERE saison_id = ?1),
                (SELECT COALESCE(SUM(montant_utilise), 0) FROM avances WHERE saison_id = ?1)",
            rusqlite::params![saison_id],
            |row| {
                Ok(TotauxRapport {
                    nb_missions: row.get(0)?,
                    nb_bordereaux: row.get(1)?,
                    nb_bsm: row.get(2)?,
                    nb_factures: row.get(3)?,
                    nb_paiements: row.get(4)?,
                    tonnage_coton_kg: row.get(5)?,
                    tonnage_intrants_kg: row.get(6)?,
                    distance_totale_km: row.get(7)?,
                    gasoil_litres: row.get(8)?,
                    gasoil_montant: row.get(9)?,
                    montant_brut: row.get(10)?,
                    montant_gasoil: row.get(11)?,
                    montant_net: row.get(12)?,
                    montant_paye: row.get(13)?,
                    avances_initiales: row.get(14)?,
                    avances_utilisees: row.get(15)?,
                    montant_impaye: 0.0,
                    solde_avances: 0.0,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    // Valeurs dérivées (AGENT.md §21.1)
    totaux.montant_impaye = (totaux.montant_net - totaux.montant_paye).max(0.0);
    totaux.solde_avances = totaux.avances_initiales - totaux.avances_utilisees;
    Ok(totaux)
}

/// Données BMS du rapport annuel.
fn construire_bsms(db: &Connection, saison_id: i64) -> Result<Vec<BsmRapport>, String> {
    let mut stmt = db
        .prepare(
            "SELECT bs.numero, bs.date_bsm, cam.immatriculation, bs.beneficiaire,
                    bs.quantite_litres, bs.montant, bs.statut
             FROM bsm bs
             LEFT JOIN camions cam ON cam.id = bs.camion_id
             WHERE bs.saison_id = ?1
             ORDER BY bs.date_bsm, bs.id",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![saison_id], |row| {
            Ok(BsmRapport {
                numero: row.get(0)?,
                date_bsm: row.get(1)?,
                camion: row.get(2)?,
                beneficiaire: row.get(3)?,
                quantite_litres: row.get(4)?,
                montant: row.get(5)?,
                statut: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Règlements rattachés aux factures de la campagne.
fn construire_paiements(db: &Connection, saison_id: i64) -> Result<Vec<PaiementRapport>, String> {
    let mut stmt = db
        .prepare(
            "SELECT p.date_paiement, f.numero, p.montant, p.mode_paiement, p.statut
             FROM paiements p JOIN factures f ON f.id = p.facture_id
             WHERE f.saison_id = ?1
             ORDER BY p.date_paiement, p.id",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![saison_id], |row| {
            Ok(PaiementRapport {
                date_paiement: row.get(0)?,
                numero_facture: row.get(1)?,
                montant: row.get(2)?,
                mode_paiement: row.get(3)?,
                statut: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Comparaison des indicateurs de toutes les campagnes (AGENT.md §20.4).
pub(crate) fn construire_comparaison(db: &Connection) -> Result<Vec<ComparaisonCampagne>, String> {
    let mut stmt = db
        .prepare(
            "SELECT s.id, s.libelle,
                    (SELECT COUNT(*) FROM bordereaux b WHERE b.saison_id = s.id),
                    (SELECT COALESCE(SUM(b.poids_net_kg), 0)
                     FROM bordereaux b WHERE b.saison_id = s.id),
                    (SELECT COALESCE(SUM(b.distance_km), 0)
                     FROM bordereaux b WHERE b.saison_id = s.id),
                    (SELECT COALESCE(SUM(x.quantite_litres), 0)
                     FROM bsm x WHERE x.saison_id = s.id),
                    (SELECT COALESCE(SUM(f.montant_net), 0)
                     FROM factures f WHERE f.saison_id = s.id)
             FROM saisons s
             ORDER BY s.date_debut, s.id",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ComparaisonCampagne {
                saison_id: row.get(0)?,
                libelle: row.get(1)?,
                nb_bordereaux: row.get(2)?,
                tonnage_coton_kg: row.get(3)?,
                distance_totale_km: row.get(4)?,
                gasoil_litres: row.get(5)?,
                montant_net: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

// ─── Export PDF (AGENT.md §20.4) ─────────────────────────────────────────────

/// Écrit sur disque le PDF du rapport annuel généré dans l'interface (jsPDF).
/// Le fichier est créé dans le dossier fourni ou, par défaut, dans
/// « Documents/ABAF ». Retourne le chemin complet du fichier généré.
#[tauri::command]
pub fn sauvegarder_rapport_pdf(
    dossier: Option<String>,
    libelle_campagne: String,
    contenu: Vec<u8>,
) -> Result<String, String> {
    if contenu.is_empty() {
        return Err("Le contenu du PDF est vide.".into());
    }

    let repertoire = match dossier.as_deref().map(str::trim) {
        Some(dossier_choisi) if !dossier_choisi.is_empty() => PathBuf::from(dossier_choisi),
        _ => dossier_documents()?.join("ABAF"),
    };
    std::fs::create_dir_all(&repertoire)
        .map_err(|e| format!("Impossible de créer le dossier d'export : {e}"))?;

    let nom_fichier = format!(
        "Rapport_annuel_{}_{}.pdf",
        nettoyer_nom_fichier(&libelle_campagne),
        chrono::Local::now().format("%Y%m%d_%H%M")
    );
    let chemin = repertoire.join(nom_fichier);

    std::fs::write(&chemin, &contenu)
        .map_err(|e| format!("Impossible d'enregistrer le fichier PDF : {e}"))?;

    Ok(chemin.to_string_lossy().to_string())
}

// ─── Export Excel — aide interne ─────────────────────────────────────────────

/// Styles partagés par les feuilles du classeur.
struct StylesExcel {
    titre: Format,
    sous_titre: Format,
    entete: Format,
    texte: Format,
    nombre: Format,
    nombre_dec: Format,
    total: Format,
}

impl StylesExcel {
    fn creer() -> Self {
        Self {
            titre: Format::new().set_bold().set_font_size(14.0),
            sous_titre: Format::new()
                .set_italic()
                .set_font_color(Color::RGB(0x606060)),
            entete: Format::new()
                .set_bold()
                .set_background_color(Color::RGB(0xE8E8E8))
                .set_border(FormatBorder::Thin)
                .set_align(FormatAlign::Center)
                .set_text_wrap(),
            texte: Format::new().set_border(FormatBorder::Thin),
            nombre: Format::new()
                .set_border(FormatBorder::Thin)
                .set_num_format("#,##0"),
            nombre_dec: Format::new()
                .set_border(FormatBorder::Thin)
                .set_num_format("#,##0.0"),
            total: Format::new()
                .set_bold()
                .set_border(FormatBorder::Thin)
                .set_num_format("#,##0"),
        }
    }
}

/// Construit le classeur complet du rapport annuel (quatre feuilles).
fn construire_classeur(
    saison: &SaisonResume,
    lignes: &[LigneRapport],
    totaux: &TotauxRapport,
    bsms: &[BsmRapport],
    paiements: &[PaiementRapport],
    comparaison: &[ComparaisonCampagne],
) -> Result<Workbook, XlsxError> {
    let mut classeur = Workbook::new();
    let styles = StylesExcel::creer();

    // ── Feuille « Opérations » (colonnes AGENT.md §7.2) ──
    let feuille = classeur.add_worksheet();
    feuille.set_name("Opérations")?;
    feuille.merge_range(
        0,
        0,
        0,
        13,
        format!("Rapport annuel — {}", saison.libelle).as_str(),
        &styles.titre,
    )?;
    let periode = match &saison.date_fin {
        Some(date_fin) => format!("Campagne du {} au {}", saison.date_debut, date_fin),
        None => format!("Campagne du {} — en cours", saison.date_debut),
    };
    feuille.merge_range(1, 0, 1, 13, periode.as_str(), &styles.sous_titre)?;

    const COLONNES_OPERATIONS: [&str; 14] = [
        "N° Bordereau",
        "Date",
        "N° Fac",
        "N° Camion",
        "USINE",
        "CGI",
        "AV",
        "Poids Coton (kg)",
        "Poids INT (kg)",
        "Distance (km)",
        "Gasoil (L)",
        "Montant (FCFA)",
        "OBSER",
        "BMS",
    ];
    for (colonne, libelle) in COLONNES_OPERATIONS.iter().enumerate() {
        feuille.write_string_with_format(3, colonne as u16, *libelle, &styles.entete)?;
    }

    let mut ligne = 4_u32;
    for item in lignes {
        feuille.write_string_with_format(ligne, 0, item.numero_bordereau.as_str(), &styles.texte)?;
        feuille.write_string_with_format(ligne, 1, item.date_bordereau.as_str(), &styles.texte)?;
        feuille.write_string_with_format(
            ligne,
            2,
            item.numero_facture.as_deref().unwrap_or(""),
            &styles.texte,
        )?;
        feuille.write_string_with_format(
            ligne,
            3,
            item.numero_camion.as_deref().unwrap_or(""),
            &styles.texte,
        )?;
        feuille.write_string_with_format(ligne, 4, item.usine.as_deref().unwrap_or(""), &styles.texte)?;
        feuille.write_string_with_format(ligne, 5, item.cgi.as_deref().unwrap_or(""), &styles.texte)?;
        feuille.write_string_with_format(ligne, 6, item.av.as_deref().unwrap_or(""), &styles.texte)?;
        match item.poids_coton_kg {
            Some(valeur) => {
                feuille.write_number_with_format(ligne, 7, valeur, &styles.nombre)?;
            }
            None => {
                feuille.write_string_with_format(ligne, 7, "", &styles.texte)?;
            }
        }
        feuille.write_number_with_format(ligne, 8, item.poids_intrants_kg, &styles.nombre)?;
        match item.distance_km {
            Some(valeur) => {
                feuille.write_number_with_format(ligne, 9, valeur, &styles.nombre_dec)?;
            }
            None => {
                feuille.write_string_with_format(ligne, 9, "", &styles.texte)?;
            }
        }
        feuille.write_number_with_format(ligne, 10, item.gasoil_litres, &styles.nombre_dec)?;
        match item.montant_net {
            Some(valeur) => {
                feuille.write_number_with_format(ligne, 11, valeur, &styles.nombre)?;
            }
            None => {
                feuille.write_string_with_format(ligne, 11, "", &styles.texte)?;
            }
        }
        feuille.write_string_with_format(
            ligne,
            12,
            item.observations.as_deref().unwrap_or(""),
            &styles.texte,
        )?;
        feuille.write_string_with_format(
            ligne,
            13,
            item.numeros_bms.as_deref().unwrap_or(""),
            &styles.texte,
        )?;
        ligne += 1;
    }

    // Totaux de la campagne (AGENT.md §21.1)
    ligne += 1;
    feuille.write_string_with_format(ligne, 0, "Totaux de la campagne", &styles.titre)?;
    ligne += 1;
    let lignes_totaux: [(&str, f64); 15] = [
        ("Missions", totaux.nb_missions as f64),
        ("Bordereaux", totaux.nb_bordereaux as f64),
        ("BSM", totaux.nb_bsm as f64),
        ("Factures", totaux.nb_factures as f64),
        ("Paiements", totaux.nb_paiements as f64),
        ("Tonnage coton (kg)", totaux.tonnage_coton_kg),
        ("Tonnage intrants (kg)", totaux.tonnage_intrants_kg),
        ("Distance totale (km)", totaux.distance_totale_km),
        ("Gasoil (L)", totaux.gasoil_litres),
        ("Montant gasoil (FCFA)", totaux.gasoil_montant),
        ("Montant brut (FCFA)", totaux.montant_brut),
        ("Montant net (FCFA)", totaux.montant_net),
        ("Montant payé (FCFA)", totaux.montant_paye),
        ("Montant impayé (FCFA)", totaux.montant_impaye),
        ("Solde avances (FCFA)", totaux.solde_avances),
    ];
    for (libelle, valeur) in lignes_totaux {
        feuille.write_string_with_format(ligne, 0, libelle, &styles.total)?;
        feuille.write_number_with_format(ligne, 1, valeur, &styles.total)?;
        ligne += 1;
    }

    const LARGEURS_OPERATIONS: [f64; 14] = [
        14.0, 11.0, 11.0, 12.0, 18.0, 14.0, 14.0, 15.0, 14.0, 12.0, 11.0, 15.0, 26.0, 14.0,
    ];
    for (colonne, largeur) in LARGEURS_OPERATIONS.iter().enumerate() {
        feuille.set_column_width(colonne as u16, *largeur)?;
    }
    feuille.set_freeze_panes(4, 0)?;

    // ── Feuille « Gasoil & BSM » ──
    let feuille = classeur.add_worksheet();
    feuille.set_name("Gasoil & BSM")?;
    feuille.merge_range(
        0,
        0,
        0,
        6,
        format!("Bons de sortie gasoil — {}", saison.libelle).as_str(),
        &styles.titre,
    )?;
    const COLONNES_BSM: [&str; 7] = [
        "N° BSM",
        "Date",
        "Camion",
        "Bénéficiaire",
        "Litres",
        "Montant (FCFA)",
        "Statut",
    ];
    for (colonne, libelle) in COLONNES_BSM.iter().enumerate() {
        feuille.write_string_with_format(1, colonne as u16, *libelle, &styles.entete)?;
    }
    for (index, bsm) in bsms.iter().enumerate() {
        let ligne = 2 + index as u32;
        feuille.write_string_with_format(ligne, 0, bsm.numero.as_str(), &styles.texte)?;
        feuille.write_string_with_format(ligne, 1, bsm.date_bsm.as_str(), &styles.texte)?;
        feuille.write_string_with_format(ligne, 2, bsm.camion.as_deref().unwrap_or(""), &styles.texte)?;
        feuille.write_string_with_format(
            ligne,
            3,
            bsm.beneficiaire.as_deref().unwrap_or(""),
            &styles.texte,
        )?;
        feuille.write_number_with_format(ligne, 4, bsm.quantite_litres, &styles.nombre_dec)?;
        feuille.write_number_with_format(ligne, 5, bsm.montant, &styles.nombre)?;
        feuille.write_string_with_format(ligne, 6, libelle_statut_bsm(&bsm.statut), &styles.texte)?;
    }
    let largeurs_bsm: [f64; 7] = [14.0, 11.0, 12.0, 20.0, 10.0, 15.0, 11.0];
    for (colonne, largeur) in largeurs_bsm.iter().enumerate() {
        feuille.set_column_width(colonne as u16, *largeur)?;
    }

    // ── Feuille « Règlements » ──
    let feuille = classeur.add_worksheet();
    feuille.set_name("Règlements")?;
    feuille.merge_range(
        0,
        0,
        0,
        4,
        format!("Règlements — {}", saison.libelle).as_str(),
        &styles.titre,
    )?;
    const COLONNES_REGLEMENTS: [&str; 5] = [
        "Date",
        "N° Facture",
        "Montant (FCFA)",
        "Mode",
        "Statut",
    ];
    for (colonne, libelle) in COLONNES_REGLEMENTS.iter().enumerate() {
        feuille.write_string_with_format(1, colonne as u16, *libelle, &styles.entete)?;
    }
    for (index, paiement) in paiements.iter().enumerate() {
        let ligne = 2 + index as u32;
        feuille.write_string_with_format(ligne, 0, paiement.date_paiement.as_str(), &styles.texte)?;
        feuille.write_string_with_format(
            ligne,
            1,
            paiement.numero_facture.as_deref().unwrap_or(""),
            &styles.texte,
        )?;
        feuille.write_number_with_format(ligne, 2, paiement.montant, &styles.nombre)?;
        feuille.write_string_with_format(
            ligne,
            3,
            paiement.mode_paiement.as_deref().unwrap_or(""),
            &styles.texte,
        )?;
        feuille.write_string_with_format(
            ligne,
            4,
            libelle_statut_paiement(&paiement.statut),
            &styles.texte,
        )?;
    }
    let largeurs_reglements: [f64; 5] = [11.0, 14.0, 15.0, 18.0, 11.0];
    for (colonne, largeur) in largeurs_reglements.iter().enumerate() {
        feuille.set_column_width(colonne as u16, *largeur)?;
    }

    // ── Feuille « Comparaison » ──
    let feuille = classeur.add_worksheet();
    feuille.set_name("Comparaison")?;
    feuille.merge_range(
        0,
        0,
        0,
        5,
        "Comparaison avec les campagnes",
        &styles.titre,
    )?;
    const COLONNES_COMPARAISON: [&str; 6] = [
        "Campagne",
        "Bordereaux",
        "Tonnage coton (kg)",
        "Distance (km)",
        "Gasoil (L)",
        "Montant net (FCFA)",
    ];
    for (colonne, libelle) in COLONNES_COMPARAISON.iter().enumerate() {
        feuille.write_string_with_format(1, colonne as u16, *libelle, &styles.entete)?;
    }
    for (index, campagne) in comparaison.iter().enumerate() {
        let ligne = 2 + index as u32;
        feuille.write_string_with_format(ligne, 0, campagne.libelle.as_str(), &styles.texte)?;
        feuille.write_number_with_format(ligne, 1, campagne.nb_bordereaux as f64, &styles.nombre)?;
        feuille.write_number_with_format(ligne, 2, campagne.tonnage_coton_kg, &styles.nombre)?;
        feuille.write_number_with_format(ligne, 3, campagne.distance_totale_km, &styles.nombre_dec)?;
        feuille.write_number_with_format(ligne, 4, campagne.gasoil_litres, &styles.nombre_dec)?;
        feuille.write_number_with_format(ligne, 5, campagne.montant_net, &styles.nombre)?;
    }
    let largeurs_comparaison: [f64; 6] = [24.0, 12.0, 18.0, 13.0, 11.0, 17.0];
    for (colonne, largeur) in largeurs_comparaison.iter().enumerate() {
        feuille.set_column_width(colonne as u16, *largeur)?;
    }

    Ok(classeur)
}

fn libelle_statut_bsm(statut: &str) -> &str {
    match statut {
        "ouvert" => "Ouvert",
        "cloture" => "Clôturé",
        "facture" => "Facturé",
        autre => autre,
    }
}

fn libelle_statut_paiement(statut: &str) -> &str {
    match statut {
        "paye" => "Payé",
        "impaye" => "Impayé",
        "np" => "Non payé",
        autre => autre,
    }
}

/// Dossier « Documents » de l'utilisateur (repli : dossier personnel).
pub(crate) fn dossier_documents() -> Result<PathBuf, String> {
    let base = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Impossible de déterminer le dossier de l'utilisateur.".to_string())?;
    let documents = PathBuf::from(&base).join("Documents");
    Ok(if documents.is_dir() {
        documents
    } else {
        PathBuf::from(base)
    })
}

/// Remplace les caractères interdits dans un nom de fichier.
fn nettoyer_nom_fichier(nom: &str) -> String {
    nom.chars()
        .map(|caractere| match caractere {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => caractere,
        })
        .map(|caractere| if caractere.is_whitespace() { '_' } else { caractere })
        .collect()
}
