// Commandes Tauri - module facture (Phase 4)
use crate::db::AppState;
use crate::models::bsm::index_statut_bsm;
use crate::models::facture::{CreerFacturePayload, Facture, LigneFacture, OperationsDisponibles};
use crate::models::mission::avancer_statut_mission;
use crate::services::tarification;
use tauri::State;

/// Liste les factures, avec filtres optionnels par saison et par statut.
#[tauri::command]
pub fn lister_factures(
    state: State<AppState>,
    saison_id: Option<i64>,
    statut: Option<String>,
) -> Result<Vec<Facture>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, numero, saison_id, client_id, date_facture, montant_brut,
                    montant_gasoil, montant_net, tkm, detail_trajet, mention_original_payable,
                    statut, observations, created_at, updated_at
             FROM factures
             WHERE (?1 IS NULL OR saison_id = ?1)
               AND (?2 IS NULL OR statut = ?2)
             ORDER BY date_facture DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![saison_id, statut], |row| {
            Ok(Facture {
                id: row.get(0)?,
                numero: row.get(1)?,
                saison_id: row.get(2)?,
                client_id: row.get(3)?,
                date_facture: row.get(4)?,
                montant_brut: row.get(5)?,
                montant_gasoil: row.get(6)?,
                montant_net: row.get(7)?,
                tkm: row.get(8)?,
                detail_trajet: row.get(9)?,
                mention_original_payable: row.get(10)?,
                statut: row.get(11)?,
                observations: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Retourne les lignes (transport et gasoil) d'une facture, dans l'ordre
/// de création.
#[tauri::command]
pub fn get_lignes_facture(
    state: State<AppState>,
    facture_id: i64,
) -> Result<Vec<LigneFacture>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    lire_lignes(&db, facture_id)
}

/// Opérations facturables d'une campagne : bordereaux validés et BSM qui
/// ne sont pas encore rattachés à une facture.
#[tauri::command]
pub fn get_operations_disponibles(
    state: State<AppState>,
    saison_id: i64,
) -> Result<OperationsDisponibles, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let bordereaux = {
        let mut stmt = db
            .prepare(
                "SELECT b.id, b.numero, b.saison_id, b.mission_id, b.camion_id, b.chauffeur_id,
                        b.usine_id, b.cgi_id, b.date_bordereau, b.poids_vide_kg, b.poids_charge_kg,
                        b.poids_net_kg, b.distance_km, b.type_fret, b.tarif_applique,
                        b.unite_tarif, b.montant_brut, b.statut, b.observations,
                        b.created_at, b.updated_at
                 FROM bordereaux b
                 WHERE b.saison_id = ?1
                   AND b.statut = 'valide'
                   AND NOT EXISTS (
                       SELECT 1 FROM lignes_facture lf WHERE lf.bordereau_id = b.id
                   )
                 ORDER BY b.date_bordereau DESC, b.id DESC",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(rusqlite::params![saison_id], |row| {
                Ok(crate::models::bordereau::Bordereau {
                    id: row.get(0)?,
                    numero: row.get(1)?,
                    saison_id: row.get(2)?,
                    mission_id: row.get(3)?,
                    camion_id: row.get(4)?,
                    chauffeur_id: row.get(5)?,
                    usine_id: row.get(6)?,
                    cgi_id: row.get(7)?,
                    date_bordereau: row.get(8)?,
                    poids_vide_kg: row.get(9)?,
                    poids_charge_kg: row.get(10)?,
                    poids_net_kg: row.get(11)?,
                    distance_km: row.get(12)?,
                    type_fret: row.get(13)?,
                    tarif_applique: row.get(14)?,
                    unite_tarif: row.get(15)?,
                    montant_brut: row.get(16)?,
                    statut: row.get(17)?,
                    observations: row.get(18)?,
                    created_at: row.get(19)?,
                    updated_at: row.get(20)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        rows
    };

    let bsms = {
        let mut stmt = db
            .prepare(
                "SELECT b.id, b.numero, b.saison_id, b.mission_id, b.camion_id, b.usine_id,
                        b.date_bsm, b.beneficiaire, b.quantite_litres, b.prix_litre, b.montant,
                        b.imputation, b.reference, b.statut, b.created_at, b.updated_at
                 FROM bsm b
                 WHERE b.saison_id = ?1
                   AND NOT EXISTS (
                       SELECT 1 FROM lignes_facture lf WHERE lf.bsm_id = b.id
                   )
                 ORDER BY b.date_bsm DESC, b.id DESC",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(rusqlite::params![saison_id], |row| {
                Ok(crate::models::bsm::BSM {
                    id: row.get(0)?,
                    numero: row.get(1)?,
                    saison_id: row.get(2)?,
                    mission_id: row.get(3)?,
                    camion_id: row.get(4)?,
                    usine_id: row.get(5)?,
                    date_bsm: row.get(6)?,
                    beneficiaire: row.get(7)?,
                    quantite_litres: row.get(8)?,
                    prix_litre: row.get(9)?,
                    montant: row.get(10)?,
                    imputation: row.get(11)?,
                    reference: row.get(12)?,
                    statut: row.get(13)?,
                    created_at: row.get(14)?,
                    updated_at: row.get(15)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        rows
    };

    Ok(OperationsDisponibles { bordereaux, bsms })
}

/// Crée une facture en brouillon à partir des bordereaux validés et des BSM
/// sélectionnés (AGENT.md §13). Les montants sont calculés côté base :
/// - brut   = montant figé à la validation du bordereau (CDC v1.1) ;
/// - gasoil = somme des montants des BSM (ligne de déduction) ;
/// - net    = brut − gasoil.
/// La TKM (trajets > 90 km), le détail des trajets et la mention
/// « ORIGINAL PAYABLE » sont générés à la création (CDC v1.1 §11).
#[tauri::command]
pub fn creer_facture(
    state: State<AppState>,
    payload: CreerFacturePayload,
) -> Result<Facture, String> {
    if payload.numero.trim().is_empty() {
        return Err("Le numéro de facture est obligatoire.".into());
    }
    if payload.bordereau_ids.is_empty() && payload.bsm_ids.is_empty() {
        return Err("Sélectionnez au moins un bordereau ou un BSM.".into());
    }

    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    verifier_numero_disponible(&db, &payload.numero, None)?;
    verifier_client(&db, payload.client_id)?;

    let tx = db.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO factures (numero, saison_id, client_id, date_facture, observations,
                               mention_original_payable)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            payload.numero,
            payload.saison_id,
            payload.client_id,
            payload.date_facture,
            payload.observations,
            payload.mention_original_payable,
        ],
    )
    .map_err(|e| e.to_string())?;

    let facture_id = tx.last_insert_rowid();

    let mut total_brut = 0.0_f64;
    let mut total_gasoil = 0.0_f64;
    let mut total_tkm = 0.0_f64;
    let mut trajets: Vec<String> = Vec::new();

    for &bordereau_id in &payload.bordereau_ids {
        let transport = facturer_bordereau(&tx, facture_id, bordereau_id, payload.saison_id)?;
        total_brut += transport.montant_brut;
        total_tkm += transport.tkm;
        if !trajets.contains(&transport.trajet) {
            trajets.push(transport.trajet);
        }
    }
    for &bsm_id in &payload.bsm_ids {
        total_gasoil += facturer_bsm(&tx, facture_id, bsm_id, payload.saison_id)?;
    }

    // TKM et détail du trajet sont « générés » (CDC §11.1) : la TKM ne
    // concerne que les trajets > 90 km, les trajets sont listés dans l'ordre
    // des lignes.
    let tkm = (total_tkm > 0.0).then_some(total_tkm);
    let detail_trajet = (!trajets.is_empty()).then(|| trajets.join(" ; "));

    tx.execute(
        "UPDATE factures
         SET montant_brut   = ?1,
             montant_gasoil = ?2,
             montant_net    = ?3,
             tkm            = ?4,
             detail_trajet  = ?5,
             updated_at     = datetime('now')
         WHERE id = ?6",
        rusqlite::params![
            total_brut,
            total_gasoil,
            total_brut - total_gasoil,
            tkm,
            detail_trajet,
            facture_id,
        ],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    get_facture_by_id(&db, facture_id)
}

/// Valide une facture : elle devient définitive, les bordereaux et BSM
/// rattachés passent au statut « facturé » et les missions concernées
/// avancent à l'étape « facture » (jamais de régression).
#[tauri::command]
pub fn valider_facture(state: State<AppState>, id: i64) -> Result<Facture, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    let facture = get_facture_by_id(&db, id)?;

    if facture.statut != "brouillon" {
        return Err("Seule une facture en brouillon peut être validée.".into());
    }

    let lignes = lire_lignes(&db, id)?;
    if lignes.is_empty() {
        return Err(
            "La facture ne contient aucune ligne : ajoutez au moins un bordereau ou un BSM.".into(),
        );
    }

    let tx = db.transaction().map_err(|e| e.to_string())?;

    for ligne in &lignes {
        if let Some(bordereau_id) = ligne.bordereau_id {
            tx.execute(
                "UPDATE bordereaux
                 SET statut     = 'facture',
                     updated_at = datetime('now')
                 WHERE id = ?1",
                rusqlite::params![bordereau_id],
            )
            .map_err(|e| e.to_string())?;

            let mission_id: Option<i64> = tx
                .query_row(
                    "SELECT mission_id FROM bordereaux WHERE id = ?1",
                    rusqlite::params![bordereau_id],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;
            if let Some(mission_id) = mission_id {
                avancer_statut_mission(&tx, mission_id, "facture")?;
            }
        }

        if let Some(bsm_id) = ligne.bsm_id {
            avancer_bsm_facture(&tx, bsm_id)?;
        }
    }

    tx.execute(
        "UPDATE factures
         SET statut     = 'validee',
             updated_at = datetime('now')
         WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    get_facture_by_id(&db, id)
}

/// Supprime une facture en brouillon (les lignes suivent en cascade).
#[tauri::command]
pub fn supprimer_facture(state: State<AppState>, id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let facture = get_facture_by_id(&db, id)?;

    if facture.statut != "brouillon" {
        return Err("Seule une facture en brouillon peut être supprimée.".into());
    }

    db.execute("DELETE FROM factures WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Aide interne ─────────────────────────────────────────────────────────────
/// Les numéros de facture sont pré-numérotés : ils doivent rester uniques.
fn verifier_numero_disponible(
    db: &rusqlite::Connection,
    numero: &str,
    id_exclu: Option<i64>,
) -> Result<(), String> {
    let nb: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM factures WHERE numero = ?1 AND (?2 IS NULL OR id != ?2)",
            rusqlite::params![numero, id_exclu],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if nb > 0 {
        return Err(format!(
            "Le numéro de facture « {} » est déjà utilisé.",
            numero
        ));
    }
    Ok(())
}

fn verifier_client(db: &rusqlite::Connection, client_id: i64) -> Result<(), String> {
    let existe: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM clients WHERE id = ?1",
            rusqlite::params![client_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if existe == 0 {
        return Err("Client introuvable.".into());
    }
    Ok(())
}

fn lire_lignes(db: &rusqlite::Connection, facture_id: i64) -> Result<Vec<LigneFacture>, String> {
    let mut stmt = db
        .prepare(
            "SELECT id, facture_id, bordereau_id, bsm_id, description, poids_net_kg,
                    distance_km, tarif_tonne, montant_brut, montant_gasoil, montant_net
             FROM lignes_facture
             WHERE facture_id = ?1
             ORDER BY id",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![facture_id], |row| {
            Ok(LigneFacture {
                id: row.get(0)?,
                facture_id: row.get(1)?,
                bordereau_id: row.get(2)?,
                bsm_id: row.get(3)?,
                description: row.get(4)?,
                poids_net_kg: row.get(5)?,
                distance_km: row.get(6)?,
                tarif_tonne: row.get(7)?,
                montant_brut: row.get(8)?,
                montant_gasoil: row.get(9)?,
                montant_net: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Résultat de la facturation d'un bordereau : montant brut ajouté à la
/// facture, TKM de la ligne (0 pour les trajets ≤ 90 km) et libellé du
/// trajet pour le détail imprimé (CDC v1.1 §11.1).
struct TransportFacture {
    montant_brut: f64,
    tkm: f64,
    trajet: String,
}

/// Ajoute la ligne de transport d'un bordereau validé et retourne son
/// montant brut (montant figé à la validation du bordereau, ou calculé par
/// le moteur tarifaire pour les bordereaux antérieurs à la Phase 7), sa TKM
/// et son trajet.
fn facturer_bordereau(
    tx: &rusqlite::Transaction,
    facture_id: i64,
    bordereau_id: i64,
    saison_id: i64,
) -> Result<TransportFacture, String> {
    let (numero, saison, statut, poids_net, distance, type_fret, tarif_applique, unite_tarif, montant_stocke, cgi_nom, usine_nom): (
        String,
        i64,
        String,
        Option<f64>,
        Option<f64>,
        Option<String>,
        Option<f64>,
        Option<String>,
        Option<f64>,
        Option<String>,
        Option<String>,
    ) = tx
        .query_row(
            "SELECT b.numero, b.saison_id, b.statut, b.poids_net_kg, b.distance_km, b.type_fret,
                    b.tarif_applique, b.unite_tarif, b.montant_brut, c.nom, u.nom
             FROM bordereaux b
             LEFT JOIN cgis c   ON c.id = b.cgi_id
             LEFT JOIN usines u ON u.id = b.usine_id
             WHERE b.id = ?1",
            rusqlite::params![bordereau_id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                    row.get(7)?,
                    row.get(8)?,
                    row.get(9)?,
                    row.get(10)?,
                ))
            },
        )
        .map_err(|_| format!("Bordereau n° {} introuvable.", bordereau_id))?;

    if saison != saison_id {
        return Err(format!(
            "Le bordereau « {} » n'appartient pas à la campagne choisie.",
            numero
        ));
    }
    if statut != "valide" {
        return Err(format!(
            "Le bordereau « {} » n'est pas validé : seuls les bordereaux validés sont facturables.",
            numero
        ));
    }

    let deja: i64 = tx
        .query_row(
            "SELECT COUNT(*) FROM lignes_facture WHERE bordereau_id = ?1",
            rusqlite::params![bordereau_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if deja > 0 {
        return Err(format!(
            "Le bordereau « {} » est déjà rattaché à une facture.",
            numero
        ));
    }

    let poids_net = poids_net
        .ok_or_else(|| format!("Le poids net du bordereau « {} » est manquant.", numero))?;
    let distance = distance.ok_or_else(|| {
        format!(
            "Renseignez la distance du bordereau « {} » avant de le facturer.",
            numero
        )
    })?;

    // Le tarif appliqué et le montant brut ont été figés à la validation du
    // bordereau (CDC v1.1) ; pour les bordereaux validés avant la Phase 7,
    // le moteur de calcul prend le relais (repli).
    let (unite_tarif, tarif_applique, montant_brut) =
        match (unite_tarif, tarif_applique, montant_stocke) {
            (Some(unite), Some(tarif), Some(montant)) => (unite, tarif, montant),
            _ => {
                let type_fret = type_fret.unwrap_or_else(|| "direct".to_string());
                let calcul =
                    tarification::calculer(tx, saison_id, &type_fret, distance, poids_net)?;
                (calcul.unite_tarif, calcul.tarif_applique, calcul.montant_brut)
            }
        };

    // Tarif à la tonne effectif de la ligne de facture.
    let tarif_tonne = tarification::tarif_tonne_effectif(&unite_tarif, tarif_applique, distance);

    // TKM de la ligne (CDC §11.2) : calculée au-delà de 90 km uniquement.
    let tkm = tarification::tonne_kilometres(poids_net, distance).unwrap_or(0.0);

    tx.execute(
        "INSERT INTO lignes_facture (facture_id, bordereau_id, description, poids_net_kg,
                                     distance_km, tarif_tonne, montant_brut,
                                     montant_gasoil, montant_net)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?7)",
        rusqlite::params![
            facture_id,
            bordereau_id,
            format!("Transport — bordereau n° {}", numero),
            poids_net,
            distance,
            tarif_tonne,
            montant_brut,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(TransportFacture {
        montant_brut,
        tkm,
        trajet: libelle_trajet(cgi_nom.as_deref(), usine_nom.as_deref(), distance),
    })
}

/// Ajoute la ligne de gasoil d'un BSM (déduction) et retourne son montant.
fn facturer_bsm(
    tx: &rusqlite::Transaction,
    facture_id: i64,
    bsm_id: i64,
    saison_id: i64,
) -> Result<f64, String> {
    let (numero, saison, statut, montant): (String, i64, String, f64) = tx
        .query_row(
            "SELECT numero, saison_id, statut, montant FROM bsm WHERE id = ?1",
            rusqlite::params![bsm_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| format!("BSM n° {} introuvable.", bsm_id))?;

    if saison != saison_id {
        return Err(format!(
            "Le BSM « {} » n'appartient pas à la campagne choisie.",
            numero
        ));
    }
    if statut == "facture" {
        return Err(format!("Le BSM « {} » est déjà facturé.", numero));
    }

    let deja: i64 = tx
        .query_row(
            "SELECT COUNT(*) FROM lignes_facture WHERE bsm_id = ?1",
            rusqlite::params![bsm_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if deja > 0 {
        return Err(format!(
            "Le BSM « {} » est déjà rattaché à une facture.",
            numero
        ));
    }

    // Le gasoil est déduit du montant de la facture : ligne négative.
    tx.execute(
        "INSERT INTO lignes_facture (facture_id, bsm_id, description, montant_gasoil, montant_net)
         VALUES (?1, ?2, ?3, ?4, ?4 * -1)",
        rusqlite::params![
            facture_id,
            bsm_id,
            format!("Gasoil — BSM n° {}", numero),
            montant,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(montant)
}

/// Fait avancer un BSM facturé jusqu'au statut « facture » (jamais de
/// régression) et lève le statut de la mission rattachée à « facture ».
fn avancer_bsm_facture(tx: &rusqlite::Transaction, bsm_id: i64) -> Result<(), String> {
    let (statut, mission_id): (String, Option<i64>) = tx
        .query_row(
            "SELECT statut, mission_id FROM bsm WHERE id = ?1",
            rusqlite::params![bsm_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "BSM introuvable.".to_string())?;

    if let (Some(idx_actuel), Some(idx_facture)) =
        (index_statut_bsm(&statut), index_statut_bsm("facture"))
    {
        if idx_actuel < idx_facture {
            tx.execute(
                "UPDATE bsm
                 SET statut     = 'facture',
                     updated_at = datetime('now')
                 WHERE id = ?1",
                rusqlite::params![bsm_id],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    if let Some(mission_id) = mission_id {
        avancer_statut_mission(tx, mission_id, "facture")?;
    }
    Ok(())
}

fn get_facture_by_id(db: &rusqlite::Connection, id: i64) -> Result<Facture, String> {
    db.query_row(
        "SELECT id, numero, saison_id, client_id, date_facture, montant_brut,
                montant_gasoil, montant_net, tkm, detail_trajet, mention_original_payable,
                statut, observations, created_at, updated_at
         FROM factures WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Facture {
                id: row.get(0)?,
                numero: row.get(1)?,
                saison_id: row.get(2)?,
                client_id: row.get(3)?,
                date_facture: row.get(4)?,
                montant_brut: row.get(5)?,
                montant_gasoil: row.get(6)?,
                montant_net: row.get(7)?,
                tkm: row.get(8)?,
                detail_trajet: row.get(9)?,
                mention_original_payable: row.get(10)?,
                statut: row.get(11)?,
                observations: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        },
    )
    .map_err(|_| "Facture introuvable.".to_string())
}

/// Libellé d'un trajet de bordereau pour le détail imprimé sur la facture
/// (CDC §11.1) : « Guelendeng → Ashraf (183 km) ».
fn libelle_trajet(cgi: Option<&str>, usine: Option<&str>, distance_km: f64) -> String {
    format!(
        "{} → {} ({} km)",
        cgi.unwrap_or("CGI"),
        usine.unwrap_or("Usine"),
        formater_km(distance_km)
    )
}

/// Distance sans décimale superflue : 183.0 → « 183 », 183.5 → « 183.5 ».
fn formater_km(distance: f64) -> String {
    if distance.fract() == 0.0 {
        format!("{}", distance as i64)
    } else {
        format!("{}", distance)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn libelle_trajet_avec_replis() {
        assert_eq!(
            libelle_trajet(Some("Guelendeng"), Some("Ashraf"), 183.0),
            "Guelendeng → Ashraf (183 km)"
        );
        assert_eq!(
            libelle_trajet(Some("Guelendeng"), Some("Ashraf"), 183.5),
            "Guelendeng → Ashraf (183.5 km)"
        );
        // Repli neutre lorsque le CGI ou l'usine n'est pas renseigné.
        assert_eq!(libelle_trajet(None, None, 50.0), "CGI → Usine (50 km)");
    }
}
