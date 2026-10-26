// Commandes Tauri - module Exploitation : dépenses de terrain et rentabilité.
//
// Les charges d'exploitation sont tenues à l'écart des factures (CDC v1.1) :
// elles sont seulement agrégées par `services::exploitation` pour produire la
// marge. Les écritures posent un `uuid` fourni par l'application, consommé par
// le serveur de synchronisation, et remplissent le journal via les triggers.

use crate::db::AppState;
use crate::models::depense::{
    categorie_valide, CreerDepensePayload, Depense, DepenseFields, FiltresDepenses,
    JustificatifDepense, ModifierDepensePayload, TotalParCategorie,
};
use crate::models::exploitation::{CategorieCharge, LigneMarge, RapportExploitation};
use crate::services::{exploitation, justificatif};
use tauri::{Manager, State};
use uuid::Uuid;

/// Colonnes sélectionnées pour toutes les lectures de dépenses, avec les
/// libellés joints calculés à la volée pour l'affichage.
const SELECT_DEPENSES: &str = "SELECT
        d.id, d.uuid, d.saison_id, d.camion_id, d.mission_id, d.chauffeur_id,
        d.apprenti_id, d.mecanicien_id, d.piece_id, d.categorie, d.designation,
        d.quantite, d.unite, d.montant, d.date_depense, d.lieu, d.observations,
        d.photo, d.statut, d.motif_rejet, d.source, d.device_id,
        d.created_at, d.updated_at, d.synced_at,
        cam.immatriculation,
        TRIM('Mission ' || m.date_mission || COALESCE(' - ' || us.nom, '')),
        TRIM(COALESCE(ch.nom, '') || ' ' || COALESCE(ch.prenom, '')),
        TRIM(COALESCE(ap.nom, '') || ' ' || COALESCE(ap.prenom, '')),
        TRIM(COALESCE(mec.nom, '') || ' ' || COALESCE(mec.prenom, '')),
        p.nom,
        app.nom
    FROM depenses d
    LEFT JOIN camions         cam ON cam.id = d.camion_id
    LEFT JOIN missions          m ON m.id  = d.mission_id
    LEFT JOIN usines           us ON us.id = m.usine_id
    LEFT JOIN chauffeurs       ch ON ch.id = d.chauffeur_id
    LEFT JOIN intervenants     ap ON ap.id = d.apprenti_id
    LEFT JOIN intervenants    mec ON mec.id = d.mecanicien_id
    LEFT JOIN pieces_rechange   p ON p.id  = d.piece_id
    LEFT JOIN appareils       app ON app.uuid = d.device_id";

/// Colonne de tri autorisée : la liste est fermée pour éviter toute
/// interpolation d'entrée utilisateur dans le SQL.
const COLONNES_TRI: &[(&str, &str)] = &[
    ("date_depense", "d.date_depense"),
    ("montant", "d.montant"),
    ("categorie", "d.categorie"),
    ("statut", "d.statut"),
    ("source", "d.source"),
    ("camion", "cam.immatriculation"),
    ("created_at", "d.created_at"),
    ("updated_at", "d.updated_at"),
];

/// Liste les dépenses avec filtres optionnels. La pagination est assurée côté
/// interface (`usePagination`), comme pour les autres grilles du poste.
#[tauri::command]
pub fn lister_depenses(
    state: State<AppState>,
    filtres: FiltresDepenses,
    tri: Option<String>,
    ordre: Option<String>,
) -> Result<Vec<Depense>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let colonne = tri
        .as_deref()
        .and_then(|t| COLONNES_TRI.iter().find(|(nom, _)| *nom == t))
        .map(|(_, sql)| *sql)
        .unwrap_or("d.date_depense");
    // Deuxième critère de tri accepté : la colonne elle-même, sinon desc.
    let sens = if ordre.as_deref() == Some("asc") { "ASC" } else { "DESC" };

    let motif = filtres
        .recherche
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty())
        .map(|r| format!("%{r}%"));

    let sql = format!(
        "{SELECT_DEPENSES}
         WHERE (?1 IS NULL OR d.saison_id = ?1)
           AND (?2 IS NULL OR d.camion_id = ?2)
           AND (?3 IS NULL OR d.categorie = ?3)
           AND (?4 IS NULL OR d.statut = ?4)
           AND (?5 IS NULL OR d.source = ?5)
           AND (?6 IS NULL OR d.device_id = ?6)
           AND (?7 IS NULL OR d.date_depense >= ?7)
           AND (?8 IS NULL OR d.date_depense <= ?8)
           AND (?9 IS NULL OR d.designation LIKE ?9 OR d.lieu LIKE ?9 OR d.observations LIKE ?9)
         ORDER BY {colonne} {sens}, d.id DESC",
    );

    let mut stmt = db
        .prepare(&sql)
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(
            rusqlite::params![
                filtres.saison_id,
                filtres.camion_id,
                filtres.categorie,
                filtres.statut,
                filtres.source,
                filtres.device_id,
                filtres.date_debut,
                filtres.date_fin,
                motif
            ],
            row_to_depense,
        )
        .map_err(|e| e.to_string())?;

    collect_depenses(rows)
}

/// Retourne une dépense par son identifiant interne (utilisé par la fiche de
/// détail et le journal de synchronisation).
#[tauri::command]
pub fn get_depense(state: State<AppState>, id: i64) -> Result<Depense, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    lire_depense(&db, id)
}

/// Crée une dépense saisie au bureau. Elle naît en `brouillon` : la validation
/// reste un geste d'audit distinct, pour les lignes du poste comme du terrain.
#[tauri::command]
pub fn creer_depense(
    state: State<AppState>,
    payload: CreerDepensePayload,
) -> Result<Depense, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    verifier_saison(&db, payload.saison_id)?;
    verifier_champs(&payload.champs)?;
    verifier_references(&db, &payload.champs)?;

    let uuid = Uuid::new_v4().to_string();
    db.execute(
        "INSERT INTO depenses (
            uuid, saison_id, camion_id, mission_id, chauffeur_id, apprenti_id,
            mecanicien_id, piece_id, categorie, designation, quantite, unite,
            montant, date_depense, lieu, observations, statut, source
         )
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                 ?13, ?14, ?15, ?16, 'brouillon', 'desktop')",
        rusqlite::params_from_iter(valeurs_depense(&uuid, payload.saison_id, &payload.champs)),
    )
    .map_err(|e| e.to_string())?;

    lire_depense(&db, db.last_insert_rowid())
}

/// Modifie une dépense. Une ligne validée est figée : l'audit au bureau ne doit
/// pas être récrit en douce ; une ligne rejetée repasse en brouillon après
/// correction (le terrain comme le bureau peuvent la représenter).
#[tauri::command]
pub fn modifier_depense(
    state: State<AppState>,
    id: i64,
    payload: ModifierDepensePayload,
) -> Result<Depense, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let existante = lire_depense(&db, id)?;

    if existante.statut == "validee" {
        return Err(
            "Cette dépense est validée au bureau : elle ne peut plus être modifiée.".to_string(),
        );
    }
    verifier_champs(&payload.champs)?;
    verifier_references(&db, &payload.champs)?;

    let mut valeurs = valeurs_depense(&existante.uuid, existante.saison_id, &payload.champs);
    valeurs.push(rusqlite::types::Value::Integer(id));

    db.execute(
        "UPDATE depenses
            SET saison_id     = ?2,
                camion_id     = ?3,
                mission_id    = ?4,
                chauffeur_id  = ?5,
                apprenti_id   = ?6,
                mecanicien_id = ?7,
                piece_id      = ?8,
                categorie     = ?9,
                designation   = ?10,
                quantite      = ?11,
                unite         = ?12,
                montant       = ?13,
                date_depense  = ?14,
                lieu          = ?15,
                observations  = ?16,
                statut        = CASE WHEN statut = 'rejete' THEN 'brouillon' ELSE statut END,
                motif_rejet   = NULL,
                updated_at    = datetime('now')
          WHERE uuid = ?1 AND id = ?17",
        rusqlite::params_from_iter(valeurs),
    )
    .map_err(|e| e.to_string())?;

    lire_depense(&db, id)
}

/// Valide une dépense (brouillon ou déjà rejetée) : elle entre alors dans
/// les charges de la campagne et devient protégée contre les écritures du
/// terrain.
#[tauri::command]
pub fn valider_depense(state: State<AppState>, id: i64) -> Result<Depense, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let depense = lire_depense(&db, id)?;

    if depense.statut == "validee" {
        return Ok(depense);
    }
    db.execute(
        "UPDATE depenses
            SET statut = 'validee', motif_rejet = NULL, updated_at = datetime('now')
          WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    lire_depense(&db, id)
}

/// Rejette une dépense avec un motif obligatoire : le motif est remonté au
/// terrain dans le journal des conflits.
#[tauri::command]
pub fn rejeter_depense(state: State<AppState>, id: i64, motif: String) -> Result<Depense, String> {
    let motif = motif.trim().to_string();
    if motif.is_empty() {
        return Err("Le motif de rejet est obligatoire : il sert de retour au terrain.".into());
    }

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let depense = lire_depense(&db, id)?;
    if depense.statut == "validee" {
        return Err("Cette dépense est validée : annulez la validation avant de la rejeter.".into());
    }

    db.execute(
        "UPDATE depenses
            SET statut = 'rejete', motif_rejet = ?2, updated_at = datetime('now')
          WHERE id = ?1",
        rusqlite::params![id, motif],
    )
    .map_err(|e| e.to_string())?;
    lire_depense(&db, id)
}

/// Supprime une dépense. Une ligne validée ne peut pas être effacée : elle est
/// déjà comptée dans la marge de la campagne.
#[tauri::command]
pub fn supprimer_depense(state: State<AppState>, app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let dossier = dossier_justificatifs(&app)?;
    let mut db = state.db.lock().map_err(|e| e.to_string())?;

    let (statut, photo): (String, Option<String>) = db
        .query_row(
            "SELECT statut, photo FROM depenses WHERE id = ?1",
            rusqlite::params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Dépense introuvable.".to_string())?;

    if statut == "validee" {
        return Err("Dépense validée : la suppression est bloquée pour ne pas fausser la marge.".into());
    }

    let tx = db.transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM depenses WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;

    // Le justificatif suit la ligne : le journal publie la suppression, les
    // téléphones retireront leur copie locale au prochain tirage.
    if let Some(nom) = photo {
        justificatif::supprimer(&dossier, &nom)?;
    }
    Ok(())
}

/// Retourne le justificatif photo d'une dépense pour l'aperçu de la fiche de
/// détail. `None` si la ligne n'a pas de photo ou si le fichier a disparu.
#[tauri::command]
pub fn get_justificatif_depense(
    state: State<AppState>,
    app: tauri::AppHandle,
    id: i64,
) -> Result<Option<JustificatifDepense>, String> {
    let dossier = dossier_justificatifs(&app)?;
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let photo: Option<String> = db
        .query_row(
            "SELECT photo FROM depenses WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|_| "Dépense introuvable.".to_string())?;

    let nom = match photo {
        Some(nom) if !nom.is_empty() => nom,
        _ => return Ok(None),
    };
    match justificatif::vers_data_url(&dossier, &nom)? {
        Some(data_url) => Ok(Some(JustificatifDepense {
            nom: nom.clone(),
            chemin: dossier.join(nom).to_string_lossy().to_string(),
            data_url,
        })),
        None => Ok(None),
    }
}

/// Totaux des dépenses par catégorie, pour le total filtré de la grille.
#[tauri::command]
pub fn totaliser_depenses_par_categorie(
    state: State<AppState>,
    saison_id: Option<i64>,
) -> Result<Vec<TotalParCategorie>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    exploitation::totaliser_par_categorie(&db, saison_id)
}

/// Charges d'une campagne pour les cartes du tableau de bord. Sans campagne
/// explicite, la campagne ouverte est retenue.
#[tauri::command]
pub fn get_synthese_exploitation(
    state: State<AppState>,
    saison_id: Option<i64>,
) -> Result<crate::models::depense::SyntheseExploitation, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let saison = crate::commands::rapport::resoudre_saison(&db, saison_id)?;
    exploitation::synthese(&db, saison.id)
}

/// Répartition des charges validées par catégorie (graphique de l'état
/// d'exploitation).
#[tauri::command]
pub fn get_repartition_depenses(
    state: State<AppState>,
    saison_id: Option<i64>,
) -> Result<Vec<CategorieCharge>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let saison = crate::commands::rapport::resoudre_saison(&db, saison_id)?;
    exploitation::repartition_par_categorie(&db, saison.id)
}

/// Rentabilité du parc pour une campagne, une ligne par camion.
#[tauri::command]
pub fn get_marge_par_camion(
    state: State<AppState>,
    saison_id: Option<i64>,
) -> Result<Vec<LigneMarge>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let saison = crate::commands::rapport::resoudre_saison(&db, saison_id)?;
    exploitation::marge_par_camion(&db, saison.id)
}

/// État d'exploitation complet : lignes du parc, totaux et répartition, prêt
/// pour l'écran de rentabilité comme pour l'export.
#[tauri::command]
pub fn get_rapport_exploitation(
    state: State<AppState>,
    saison_id: Option<i64>,
) -> Result<RapportExploitation, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let saison = crate::commands::rapport::resoudre_saison(&db, saison_id)?;
    exploitation::rapport_exploitation(&db, saison.id, &saison.libelle)
}

// ─── Aides internes ───────────────────────────────────────────────────────────

/// Dossier des justificatifs, créé à la demande.
fn dossier_justificatifs(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Impossible d'obtenir le dossier de données : {e}"))?;
    let dossier = justificatif::racine(&app_data_dir);
    justificatif::preparer(&dossier)?;
    Ok(dossier)
}

/// Liste des 16 valeurs communes à l'insertion et à la mise à jour, dans
/// l'ordre `?1 uuid, ?2 saison, ?3..?16 champs`.
fn valeurs_depense(
    uuid: &str,
    saison_id: i64,
    champs: &DepenseFields,
) -> Vec<rusqlite::types::Value> {
    use rusqlite::types::Value;

    fn texte(valeur: &str) -> Value {
        Value::Text(valeur.to_string())
    }
    fn texte_opt(valeur: &Option<String>) -> Value {
        valeur.as_ref().map(|v| Value::Text(v.clone())).unwrap_or(Value::Null)
    }
    fn entier_opt(valeur: &Option<i64>) -> Value {
        valeur.map(Value::Integer).unwrap_or(Value::Null)
    }
    fn reel_opt(valeur: &Option<f64>) -> Value {
        valeur.map(Value::Real).unwrap_or(Value::Null)
    }

    vec![
        texte(uuid),
        Value::Integer(saison_id),
        entier_opt(&champs.camion_id),
        entier_opt(&champs.mission_id),
        entier_opt(&champs.chauffeur_id),
        entier_opt(&champs.apprenti_id),
        entier_opt(&champs.mecanicien_id),
        entier_opt(&champs.piece_id),
        texte(&champs.categorie),
        texte(champs.designation.trim()),
        reel_opt(&champs.quantite),
        texte_opt(&champs.unite),
        Value::Real(champs.montant),
        texte(champs.date_depense.trim()),
        texte_opt(&champs.lieu),
        texte_opt(&champs.observations),
    ]
}

fn row_to_depense(row: &rusqlite::Row) -> rusqlite::Result<Depense> {
    Ok(Depense {
        id: row.get(0)?,
        uuid: row.get(1)?,
        saison_id: row.get(2)?,
        camion_id: row.get(3)?,
        mission_id: row.get(4)?,
        chauffeur_id: row.get(5)?,
        apprenti_id: row.get(6)?,
        mecanicien_id: row.get(7)?,
        piece_id: row.get(8)?,
        categorie: row.get(9)?,
        designation: row.get(10)?,
        quantite: row.get(11)?,
        unite: row.get(12)?,
        montant: row.get(13)?,
        date_depense: row.get(14)?,
        lieu: row.get(15)?,
        observations: row.get(16)?,
        photo: row.get(17)?,
        statut: row.get(18)?,
        motif_rejet: row.get(19)?,
        source: row.get(20)?,
        device_id: row.get(21)?,
        created_at: row.get(22)?,
        updated_at: row.get(23)?,
        synced_at: row.get(24)?,
        camion: row.get(25)?,
        mission: row.get(26)?,
        chauffeur: row.get(27)?,
        apprenti: row.get(28)?,
        mecanicien: row.get(29)?,
        piece: row.get(30)?,
        appareil: row.get(31)?,
    })
}

fn collect_depenses<'a, I>(rows: I) -> Result<Vec<Depense>, String>
where
    I: Iterator<Item = rusqlite::Result<Depense>>,
{
    let mut depenses = Vec::new();
    for row in rows {
        depenses.push(row.map_err(|e| e.to_string())?);
    }
    Ok(depenses)
}

fn lire_depense(db: &rusqlite::Connection, id: i64) -> Result<Depense, String> {
    let sql = format!("{SELECT_DEPENSES} WHERE d.id = ?1");
    db.query_row(&sql, rusqlite::params![id], row_to_depense)
        .map_err(|_| "Dépense introuvable.".to_string())
}

fn verifier_saison(db: &rusqlite::Connection, saison_id: i64) -> Result<(), String> {
    let existe: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM saisons WHERE id = ?1",
            rusqlite::params![saison_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if existe == 0 {
        return Err("Campagne introuvable : choisissez la campagne de la dépense.".into());
    }
    Ok(())
}

/// Contrôles de saisie : la nomenclature des catégories est fermée, le montant
/// et la date sont obligatoires.
fn verifier_champs(champs: &DepenseFields) -> Result<(), String> {
    if !categorie_valide(&champs.categorie) {
        return Err("Catégorie de dépense inconnue.".into());
    }
    if champs.designation.trim().is_empty() {
        return Err("La désignation de la dépense est obligatoire.".into());
    }
    if !champs.montant.is_finite() || champs.montant < 0.0 {
        return Err("Le montant doit être un nombre positif.".into());
    }
    if champs.date_depense.trim().is_empty() {
        return Err("La date de la dépense est obligatoire.".into());
    }
    if let Some(quantite) = champs.quantite {
        if !quantite.is_finite() || quantite <= 0.0 {
            return Err("La quantité doit être supérieure à 0.".into());
        }
    }
    Ok(())
}

/// Vérifie que les référentiels référencés existent, avec un message clair par
/// nature de pièce plutôt qu'une erreur de clé étrangère opaque.
fn verifier_references(db: &rusqlite::Connection, champs: &DepenseFields) -> Result<(), String> {
    let kontroles: &[(&str, Option<i64>, &str)] = &[
        ("camions", champs.camion_id, "Camion"),
        ("missions", champs.mission_id, "Mission"),
        ("chauffeurs", champs.chauffeur_id, "Chauffeur"),
        ("intervenants", champs.apprenti_id, "Apprenti"),
        ("intervenants", champs.mecanicien_id, "Mécanicien"),
        ("pieces_rechange", champs.piece_id, "Pièce"),
    ];

    for (table, id, libelle) in kontroles {
        if let Some(id) = id {
            let existe: i64 = db
                .query_row(
                    &format!("SELECT COUNT(*) FROM {table} WHERE id = ?1"),
                    rusqlite::params![id],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;
            if existe == 0 {
                return Err(format!("{libelle} introuvable (référence {id})."));
            }
        }
    }
    Ok(())
}
