use rusqlite::{params, Connection, OptionalExtension, Result};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

/// Tables référentielles qui reçoivent un `uuid` stable et dont les mouvements
/// sont tracés dans `sync_oplog` pour la synchronisation avec le terrain.
const TABLES_SYNC: &[&str] = &[
    "saisons", "camions", "chauffeurs", "usines", "cgis", "avs", "missions",
];

// ─── État partagé de l'application ───────────────────────────────────────────
/// La base est unique et partagée : les commandes Tauri comme le serveur de
/// synchronisation y accèdent par ce verrou. Un `Arc` permet au serveur HTTP de
/// la tenir sans dépendre de la durée de vie de `State<AppState>`.
pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
}

/// Initialise la base de données : ouvre le fichier, active les pragmas et
/// exécute la migration initiale si elle n'a pas encore été appliquée.
pub fn setup(app_data_dir: PathBuf) -> Result<AppState> {
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?;

    let db_path = app_data_dir.join("abaf.db");

    let conn = Connection::open(&db_path)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;",
    )?;

    // Si les migrations échouent (base dans un état intermédiaire corrompu),
    // on supprime la base et on repart de zéro plutôt que de bloquer l'app.
    if let Err(e) = run_migrations(&conn) {
        eprintln!("Migration échouée ({e}), réinitialisation de la base...");
        drop(conn);
        let _ = std::fs::remove_file(&db_path);
        let conn2 = Connection::open(&db_path)?;
        conn2.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;",
        )?;
        run_migrations(&conn2)?;
        compacter_sync_oplog(&conn2, JOURS_CONSERVATION_OPLOG).ok();
        sauvegarde_automatique(&conn2, &app_data_dir);
        return Ok(AppState { db: Arc::new(Mutex::new(conn2)) });
    }

    compacter_sync_oplog(&conn, JOURS_CONSERVATION_OPLOG).ok();
    sauvegarde_automatique(&conn, &app_data_dir);
    Ok(AppState { db: Arc::new(Mutex::new(conn)) })
}

/// Exécute les migrations DDL dans l'ordre : le schéma initial (idempotent,
/// pour les installations neuves) puis les migrations versionnées.
pub fn run_migrations(conn: &Connection) -> Result<()> {
    conn.execute_batch(include_str!("../../migrations/001_initial.sql"))?;
    appliquer_migrations_versionnees(conn)?;
    Ok(())
}

/// Applique les migrations versionnées (`PRAGMA user_version`) qui
/// transforment les bases créées avant la Phase 7 vers le schéma du CDC v1.1.
/// Idempotentes : une base déjà à jour est laissée intacte.
fn appliquer_migrations_versionnees(conn: &Connection) -> Result<()> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;

    // Sur une base toute neuve (version = 0), 001_initial.sql a déjà créé
    // les tables avec le bon schéma v5. On saute toutes les migrations
    // intermédiaires et on pose directement user_version = 6, puis on applique
    // la migration v7 (module Exploitation et synchronisation mobile).
    if version == 0 && schema_contient(conn, "bordereaux", "intrant_direct")? {
        conn.execute_batch("PRAGMA user_version = 6")?;
        migration_v7(conn)?;
        conn.execute_batch("PRAGMA user_version = 7")?;
        return Ok(());
    }

    if version < 1 {
        migration_v1(conn)?;
        conn.execute_batch("PRAGMA user_version = 1")?;
    }
    if version < 2 {
        migration_v2(conn)?;
        conn.execute_batch("PRAGMA user_version = 2")?;
    }
    if version < 3 {
        migration_v3(conn)?;
        conn.execute_batch("PRAGMA user_version = 3")?;
    }
    if version < 4 {
        migration_v4(conn)?;
        conn.execute_batch("PRAGMA user_version = 4")?;
    }
    if version < 5 {
        migration_v5(conn)?;
        conn.execute_batch("PRAGMA user_version = 5")?;
    }
    if version < 6 {
        migration_v6(conn)?;
        conn.execute_batch("PRAGMA user_version = 6")?;
    }
    if version < 7 {
        migration_v7(conn)?;
        conn.execute_batch("PRAGMA user_version = 7")?;
    }
    Ok(())
}

/// Migration v1 (Phase 7 — cœur tarifaire CDC v1.1) :
/// - `tarifs` : reconstruction avec `type_fret`, `unite_tarif`, `tarif` et
///   `distance_max` nullable ; conversion des barèmes existants
///   (`prix_tonne_km` → `tarif`, type « direct », unité « fcfa_tkm ») sans
///   modifier les montants des campagnes passées.
/// - `bordereaux` : type de fret et tarif appliqué au moment de la validation.
/// - `factures` : TKM total, détail du trajet et mention « ORIGINAL PAYABLE ».
fn migration_v1(conn: &Connection) -> Result<()> {
    if colonne_existe(conn, "tarifs", "prix_tonne_km")? {
        conn.execute_batch(
            "CREATE TABLE tarifs_v1 (
                 id              INTEGER PRIMARY KEY AUTOINCREMENT,
                 saison_id       INTEGER NOT NULL REFERENCES saisons(id),
                 type_fret       TEXT    NOT NULL DEFAULT 'direct'
                                 CHECK (type_fret IN ('direct', 'retour', 'evacuation', 'transfert')),
                 distance_min    REAL    NOT NULL,
                 distance_max    REAL,
                 unite_tarif     TEXT    NOT NULL DEFAULT 'fcfa_tkm'
                                 CHECK (unite_tarif IN ('fcfa_tonne', 'fcfa_tkm')),
                 tarif           REAL    NOT NULL,
                 created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
                 updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
                 CHECK (distance_max IS NULL OR distance_max > distance_min)
             );
             INSERT INTO tarifs_v1
                 (id, saison_id, type_fret, distance_min, distance_max,
                  unite_tarif, tarif, created_at, updated_at)
             SELECT id, saison_id, 'direct', distance_min, distance_max,
                    'fcfa_tkm', prix_tonne_km, created_at, updated_at
             FROM tarifs;
             DROP TABLE tarifs;
             ALTER TABLE tarifs_v1 RENAME TO tarifs;",
        )?;
    }

    if !colonne_existe(conn, "bordereaux", "type_fret")? {
        conn.execute_batch(
            "ALTER TABLE bordereaux ADD COLUMN type_fret TEXT
                 CHECK (type_fret IN ('direct', 'retour', 'evacuation', 'transfert'));
             ALTER TABLE bordereaux ADD COLUMN tarif_applique REAL;
             ALTER TABLE bordereaux ADD COLUMN unite_tarif TEXT
                 CHECK (unite_tarif IN ('fcfa_tonne', 'fcfa_tkm'));
             ALTER TABLE bordereaux ADD COLUMN montant_brut REAL;",
        )?;
    }

    if !colonne_existe(conn, "factures", "tkm")? {
        conn.execute_batch(
            "ALTER TABLE factures ADD COLUMN tkm REAL;
             ALTER TABLE factures ADD COLUMN detail_trajet TEXT;
             ALTER TABLE factures ADD COLUMN mention_original_payable INTEGER NOT NULL DEFAULT 0
                 CHECK (mention_original_payable IN (0, 1));",
        )?;
    }

    Ok(())
}

/// Migration v2 : ajoute `distance_km` sur `lignes_bordereau` pour le calcul
/// ligne-par-ligne des TKM (CDC v1.1). Idempotente : ne fait rien si la
/// colonne existe déjà (bases créées après intégration du schéma corrigé).
fn migration_v2(conn: &Connection) -> Result<()> {
    if !colonne_existe(conn, "lignes_bordereau", "distance_km")? {
        conn.execute_batch(
            "ALTER TABLE lignes_bordereau ADD COLUMN distance_km REAL NULL;",
        )?;
    }
    Ok(())
}

/// Migration v3 (Refonte Bordereau Système Global) :
/// - `bordereaux` : ajout colonne `bsm_id` FK vers `bsm(id)` pour lier 0 ou 1 BSM
///   auto-généré via la section gasoil du formulaire bordereau.
fn migration_v3(conn: &Connection) -> Result<()> {
    if !colonne_existe(conn, "bordereaux", "bsm_id")? {
        conn.execute_batch(
            "ALTER TABLE bordereaux ADD COLUMN bsm_id INTEGER NULL REFERENCES bsm(id);
             CREATE INDEX IF NOT EXISTS idx_bordereaux_bsm_id ON bordereaux(bsm_id);",
        )?;
    }
    Ok(())
}

/// Migration v4 : étend les CHECK de `type_fret` sur `tarifs` et `bordereaux`
/// pour inclure la valeur `'intrant'`. SQLite ne permettant pas d'altérer
/// une contrainte CHECK existante, on procède par rename → recréer → copier
/// → drop pour chacune des deux tables. Les FK sont désactivées pendant la
/// migration pour permettre le DROP de la table intermédiaire.
fn migration_v4(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA foreign_keys = OFF;")?;

    // ── tarifs ───────────────────────────────────────────────────────────────
    // Idempotent : si tarifs_v3 existe déjà (migration interrompue), on saute le RENAME.
    let tarifs_v3_existe = table_existe(conn, "tarifs_v3")?;
    if !tarifs_v3_existe {
        conn.execute_batch("ALTER TABLE tarifs RENAME TO tarifs_v3;")?;
    }
    conn.execute_batch(
        "DROP TABLE IF EXISTS tarifs;
         CREATE TABLE tarifs (
             id              INTEGER PRIMARY KEY AUTOINCREMENT,
             saison_id       INTEGER NOT NULL REFERENCES saisons(id),
             type_fret       TEXT    NOT NULL DEFAULT 'direct'
                             CHECK (type_fret IN ('direct', 'retour', 'evacuation', 'transfert', 'intrant')),
             distance_min    REAL    NOT NULL,
             distance_max    REAL,
             unite_tarif     TEXT    NOT NULL DEFAULT 'fcfa_tkm'
                             CHECK (unite_tarif IN ('fcfa_tonne', 'fcfa_tkm')),
             tarif           REAL    NOT NULL,
             created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
             updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
             CHECK (distance_max IS NULL OR distance_max > distance_min)
         );
         INSERT INTO tarifs
             (id, saison_id, type_fret, distance_min, distance_max,
              unite_tarif, tarif, created_at, updated_at)
         SELECT id, saison_id, type_fret, distance_min, distance_max,
                unite_tarif, tarif, created_at, updated_at
         FROM tarifs_v3;
         DROP TABLE tarifs_v3;",
    )?;

    // ── bordereaux ───────────────────────────────────────────────────────────
    // Idempotent : si bordereaux_v3 existe déjà, le RENAME a déjà eu lieu.
    let bordereaux_v3_existe = table_existe(conn, "bordereaux_v3")?;
    if !bordereaux_v3_existe {
        conn.execute_batch("ALTER TABLE bordereaux RENAME TO bordereaux_v3;")?;
    }
    // bordereaux_v3 existe maintenant dans tous les cas.
    // On vérifie que c'est une base complète (pas un schéma de test minimaliste).
    let a_numero = colonne_existe(conn, "bordereaux_v3", "numero")?;
    conn.execute_batch(
        "DROP TABLE IF EXISTS bordereaux;
         CREATE TABLE bordereaux (
             id              INTEGER PRIMARY KEY AUTOINCREMENT,
             numero          TEXT    NOT NULL UNIQUE,
             saison_id       INTEGER NOT NULL REFERENCES saisons(id),
             mission_id      INTEGER REFERENCES missions(id),
             bsm_id          INTEGER REFERENCES bsm(id),
             camion_id       INTEGER NOT NULL REFERENCES camions(id),
             chauffeur_id    INTEGER REFERENCES chauffeurs(id),
             usine_id        INTEGER REFERENCES usines(id),
             cgi_id          INTEGER REFERENCES cgis(id),
             date_bordereau  TEXT    NOT NULL,
             poids_vide_kg   REAL,
             poids_charge_kg REAL,
             poids_net_kg    REAL    GENERATED ALWAYS AS (
                                 CASE
                                     WHEN poids_charge_kg IS NOT NULL AND poids_vide_kg IS NOT NULL
                                     THEN MAX(0, poids_charge_kg - poids_vide_kg)
                                     ELSE NULL
                                 END
                             ) STORED,
             distance_km     REAL,
             type_fret       TEXT    CHECK (type_fret IN ('direct', 'retour', 'evacuation', 'transfert', 'intrant')),
             tarif_applique  REAL,
             unite_tarif     TEXT    CHECK (unite_tarif IN ('fcfa_tonne', 'fcfa_tkm')),
             montant_brut    REAL,
             statut          TEXT    NOT NULL DEFAULT 'brouillon'
                             CHECK (statut IN ('brouillon', 'valide', 'facture')),
             observations    TEXT,
             created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
             updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
         );",
    )?;
    if a_numero {
        conn.execute_batch(
            "INSERT INTO bordereaux
                 (id, numero, saison_id, mission_id, bsm_id, camion_id, chauffeur_id,
                  usine_id, cgi_id, date_bordereau, poids_vide_kg, poids_charge_kg,
                  distance_km, type_fret, tarif_applique, unite_tarif, montant_brut,
                  statut, observations, created_at, updated_at)
             SELECT id, numero, saison_id, mission_id, bsm_id, camion_id, chauffeur_id,
                    usine_id, cgi_id, date_bordereau, poids_vide_kg, poids_charge_kg,
                    distance_km, type_fret, tarif_applique, unite_tarif, montant_brut,
                    statut, observations, created_at, updated_at
             FROM bordereaux_v3;",
        )?;
    }
    conn.execute_batch(
        "DROP TABLE IF EXISTS bordereaux_v3;
         CREATE INDEX IF NOT EXISTS idx_bordereaux_bsm_id ON bordereaux(bsm_id);
         PRAGMA foreign_keys = ON;",
    )?;

    Ok(())
}

/// Migration v5 : remplace la valeur générique `'intrant'` par quatre valeurs
/// distinctes (`'intrant_direct'`, `'intrant_retour'`, `'intrant_evacuation'`,
/// `'intrant_transfert'`) dans les CHECK de `tarifs` et `bordereaux`.
/// Les éventuelles lignes déjà enregistrées avec `type_fret = 'intrant'` sont
/// converties en `'intrant_direct'` (valeur la plus courante).
fn migration_v5(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA foreign_keys = OFF;")?;

    // ── tarifs ────────────────────────────────────────────────────────────────
    let tarifs_v4_existe = table_existe(conn, "tarifs_v4")?;
    if !tarifs_v4_existe {
        conn.execute_batch(
            "UPDATE tarifs SET type_fret = 'intrant_direct' WHERE type_fret = 'intrant';
             ALTER TABLE tarifs RENAME TO tarifs_v4;",
        )?;
    }
    conn.execute_batch(
        "DROP TABLE IF EXISTS tarifs;
         CREATE TABLE tarifs (
             id              INTEGER PRIMARY KEY AUTOINCREMENT,
             saison_id       INTEGER NOT NULL REFERENCES saisons(id),
             type_fret       TEXT    NOT NULL DEFAULT 'direct'
                             CHECK (type_fret IN (
                                 'direct', 'retour', 'evacuation', 'transfert',
                                 'intrant_direct', 'intrant_retour',
                                 'intrant_evacuation', 'intrant_transfert'
                             )),
             distance_min    REAL    NOT NULL,
             distance_max    REAL,
             unite_tarif     TEXT    NOT NULL DEFAULT 'fcfa_tkm'
                             CHECK (unite_tarif IN ('fcfa_tonne', 'fcfa_tkm')),
             tarif           REAL    NOT NULL,
             created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
             updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
             CHECK (distance_max IS NULL OR distance_max > distance_min)
         );
         INSERT INTO tarifs
             (id, saison_id, type_fret, distance_min, distance_max,
              unite_tarif, tarif, created_at, updated_at)
         SELECT id, saison_id, type_fret, distance_min, distance_max,
                unite_tarif, tarif, created_at, updated_at
         FROM tarifs_v4;
         DROP TABLE tarifs_v4;",
    )?;

    // ── bordereaux ────────────────────────────────────────────────────────────
    let bordereaux_v4_existe = table_existe(conn, "bordereaux_v4")?;
    if !bordereaux_v4_existe {
        conn.execute_batch(
            "UPDATE bordereaux SET type_fret = 'intrant_direct'
              WHERE type_fret = 'intrant';
             ALTER TABLE bordereaux RENAME TO bordereaux_v4;",
        )?;
    }
    let a_numero = colonne_existe(conn, "bordereaux_v4", "numero")?;
    conn.execute_batch(
        "DROP TABLE IF EXISTS bordereaux;
         CREATE TABLE bordereaux (
             id              INTEGER PRIMARY KEY AUTOINCREMENT,
             numero          TEXT    NOT NULL UNIQUE,
             saison_id       INTEGER NOT NULL REFERENCES saisons(id),
             mission_id      INTEGER REFERENCES missions(id),
             bsm_id          INTEGER REFERENCES bsm(id),
             camion_id       INTEGER NOT NULL REFERENCES camions(id),
             chauffeur_id    INTEGER REFERENCES chauffeurs(id),
             usine_id        INTEGER REFERENCES usines(id),
             cgi_id          INTEGER REFERENCES cgis(id),
             date_bordereau  TEXT    NOT NULL,
             poids_vide_kg   REAL,
             poids_charge_kg REAL,
             poids_net_kg    REAL    GENERATED ALWAYS AS (
                                 CASE
                                     WHEN poids_charge_kg IS NOT NULL AND poids_vide_kg IS NOT NULL
                                     THEN MAX(0, poids_charge_kg - poids_vide_kg)
                                     ELSE NULL
                                 END
                             ) STORED,
             distance_km     REAL,
             type_fret       TEXT    CHECK (type_fret IN (
                                 'direct', 'retour', 'evacuation', 'transfert',
                                 'intrant_direct', 'intrant_retour',
                                 'intrant_evacuation', 'intrant_transfert'
                             )),
             tarif_applique  REAL,
             unite_tarif     TEXT    CHECK (unite_tarif IN ('fcfa_tonne', 'fcfa_tkm')),
             montant_brut    REAL,
             statut          TEXT    NOT NULL DEFAULT 'brouillon'
                             CHECK (statut IN ('brouillon', 'valide', 'facture')),
             observations    TEXT,
             created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
             updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
         );",
    )?;
    if a_numero {
        conn.execute_batch(
            "INSERT INTO bordereaux
                 (id, numero, saison_id, mission_id, bsm_id, camion_id, chauffeur_id,
                  usine_id, cgi_id, date_bordereau, poids_vide_kg, poids_charge_kg,
                  distance_km, type_fret, tarif_applique, unite_tarif, montant_brut,
                  statut, observations, created_at, updated_at)
             SELECT id, numero, saison_id, mission_id, bsm_id, camion_id, chauffeur_id,
                    usine_id, cgi_id, date_bordereau, poids_vide_kg, poids_charge_kg,
                    distance_km, type_fret, tarif_applique, unite_tarif, montant_brut,
                    statut, observations, created_at, updated_at
             FROM bordereaux_v4;",
        )?;
    }
    conn.execute_batch(
        "DROP TABLE IF EXISTS bordereaux_v4;
         CREATE INDEX IF NOT EXISTS idx_bordereaux_bsm_id ON bordereaux(bsm_id);
         PRAGMA foreign_keys = ON;",
    )?;

    Ok(())
}


/// Migration v6 : ajoute la colonne `numero_cotontchad` (nullable) sur
/// `bordereaux` pour stocker le numéro de référence Cotontchad.
fn migration_v6(conn: &Connection) -> Result<()> {
    if !colonne_existe(conn, "bordereaux", "numero_cotontchad")? {
        conn.execute_batch(
            "ALTER TABLE bordereaux ADD COLUMN numero_cotontchad TEXT NULL;",
        )?;
    }
    Ok(())
}

/// Nombre de jours pendant lesquels `sync_oplog` conserve l'historique complet
/// des changements. Au-delà, une seule entrée par ligne est gardée : un
/// appareil resté hors ligne plus longtemps doit faire une resynchronisation
/// totale (le serveur le lui signale par `reset = true`).
const JOURS_CONSERVATION_OPLOG: i64 = 90;

/// Migration v7 : module Exploitation (dépenses de terrain, intervenants,
/// pièces de rechange) et infrastructure de synchronisation mobile.
///
/// Dans l'ordre :
/// 1. identifiants `uuid` stables sur les référentiels synchronisés — les
///    triggers du journal y font référence, ils doivent donc exister avant ;
/// 2. schéma du module (`007_exploitation_sync.sql`) : tables, journaux,
///    appareils, triggers et paramètres ;
/// 3. amorçage du journal : les lignes déjà présentes sont publiées pour
///    qu'un premier appareil de terrain récupère un référentiel complet.
fn migration_v7(conn: &Connection) -> Result<()> {
    for table in TABLES_SYNC {
        if !colonne_existe(conn, table, "uuid")? {
            conn.execute_batch(&format!("ALTER TABLE {table} ADD COLUMN uuid TEXT;"))?;
        }

        let ids: Vec<i64> = {
            let mut stmt = conn.prepare(&format!("SELECT id FROM {table} WHERE uuid IS NULL"))?;
            let rows = stmt.query_map([], |row| row.get::<_, i64>(0))?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        let mut update = conn.prepare(&format!("UPDATE {table} SET uuid = ?1 WHERE id = ?2"))?;
        for id in ids {
            update.execute(params![Uuid::new_v4().to_string(), id])?;
        }

        conn.execute_batch(&format!(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_{table}_uuid ON {table}(uuid);"
        ))?;
    }

    conn.execute_batch(include_str!("../../migrations/007_exploitation_sync.sql"))?;

    // `SET uuid = uuid` ne change aucune valeur mais déclenche le trigger
    // AFTER UPDATE : le journal part donc avec une image complète du référentiel.
    for table in TABLES_SYNC {
        conn.execute_batch(&format!("UPDATE {table} SET uuid = uuid;"))?;
    }

    Ok(())
}

/// Compaction du journal des changements : au-delà de `jours`, on ne garde que
/// la dernière entrée de chaque `(table_x, ref)`. Retourne le nombre d'entrées
/// supprimées.
pub fn compacter_sync_oplog(conn: &Connection, jours: i64) -> Result<usize> {
    Ok(conn.execute(
        "DELETE FROM sync_oplog
         WHERE lvn < (SELECT COALESCE(MAX(o.lvn), 0) FROM sync_oplog o
                      WHERE o.table_x = sync_oplog.table_x AND o.ref = sync_oplog.ref)
           AND at < datetime('now', ?1)",
        params![format!("-{jours} days")],
    )?)
}


fn table_existe(conn: &Connection, nom: &str) -> Result<bool> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
        [nom],
        |row| row.get(0),
    )?;
    Ok(n > 0)
}

/// Vrai si le DDL de la table `table` (tel que stocké dans sqlite_master)
/// contient la chaîne `motif` — utilisé pour détecter si un CHECK contient
/// déjà une valeur donnée sans parser le SQL.
fn schema_contient(conn: &Connection, table: &str, motif: &str) -> Result<bool> {
    let sql: Option<String> = conn
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name=?1",
            [table],
            |row| row.get(0),
        )
        .optional()?;
    Ok(sql.map(|s| s.contains(motif)).unwrap_or(false))
}

/// Vrai si `table` possède la colonne `colonne` (via `PRAGMA table_info`).
fn colonne_existe(conn: &Connection, table: &str, colonne: &str) -> Result<bool> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let mut lignes = stmt.query([])?;
    while let Some(ligne) = lignes.next()? {
        let nom: String = ligne.get(1)?;
        if nom == colonne {
            return Ok(true);
        }
    }
    Ok(false)
}

/// Copie de sécurité automatique de la base (AGENT.md §24.3) : si le paramètre
/// « sauvegarde_auto » est activé, une copie horodatée de la base est créée
/// dans « backups/ » au démarrage de l'application. Toute erreur est ignorée
/// pour ne pas empêcher le lancement.
fn sauvegarde_automatique(conn: &Connection, app_data_dir: &PathBuf) {
    let active = conn
        .query_row(
            "SELECT valeur FROM parametres WHERE cle = 'sauvegarde_auto'",
            [],
            |row| row.get::<_, String>(0),
        )
        .map(|valeur| valeur == "1")
        .unwrap_or(false);
    if !active {
        return;
    }

    let dossier = app_data_dir.join("backups");
    if std::fs::create_dir_all(&dossier).is_err() {
        return;
    }

    let nom = format!("abaf-{}.db", chrono::Local::now().format("%Y%m%d_%H%M%S"));
    let chemin = dossier.join(nom).to_string_lossy().to_string();
    // VACUUM INTO produit une copie complète et cohérente (WAL inclus).
    if conn.execute("VACUUM INTO ?1", params![chemin]).is_err() {
        return;
    }

    nettoyer_anciennes_copies(&dossier, 10);
}

/// Conserve uniquement les `conserver` copies les plus récentes du dossier
/// (les noms horodatés « abaf-AAAAMMJJ_HHMMSS.db » se trient par date).
pub(crate) fn nettoyer_anciennes_copies(dossier: &PathBuf, conserver: usize) {
    let Ok(entrees) = std::fs::read_dir(dossier) else {
        return;
    };
    let mut copies: Vec<PathBuf> = entrees
        .filter_map(|entree| entree.ok())
        .map(|entree| entree.path())
        .filter(|chemin| chemin.extension().map(|ext| ext == "db").unwrap_or(false))
        .collect();

    if copies.len() <= conserver {
        return;
    }

    copies.sort();
    for ancienne in &copies[..copies.len() - conserver] {
        let _ = std::fs::remove_file(ancienne);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Crée le schéma « ancien » (avant la Phase 7 — cœur tarifaire) : tarifs
    /// avec `prix_tonne_km`, bordereaux et factures sans les colonnes du CDC
    /// v1.1. Les tables non mentionnées sont créées par 001_initial.sql, d'où
    /// le schéma complet de `saisons` attendu par les triggers de publication.
    fn base_ancienne() -> Connection {
        let conn = Connection::open_in_memory().expect("base en mémoire");
        conn.execute_batch(
            "CREATE TABLE saisons (
                 id INTEGER PRIMARY KEY,
                 libelle TEXT NOT NULL UNIQUE,
                 date_debut TEXT NOT NULL,
                 date_fin TEXT,
                 statut TEXT NOT NULL DEFAULT 'ouverte'
                            CHECK (statut IN ('ouverte', 'fermee')),
                 created_at TEXT NOT NULL DEFAULT (datetime('now')),
                 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
             );
             CREATE TABLE tarifs (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 saison_id INTEGER NOT NULL REFERENCES saisons(id),
                 distance_min REAL NOT NULL,
                 distance_max REAL NOT NULL,
                 prix_tonne_km REAL NOT NULL,
                 created_at TEXT NOT NULL DEFAULT (datetime('now')),
                 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
             );
             CREATE TABLE bordereaux (id INTEGER PRIMARY KEY, distance_km REAL);
             CREATE TABLE factures (id INTEGER PRIMARY KEY, montant_net REAL NOT NULL DEFAULT 0);
             INSERT INTO saisons (id, libelle, date_debut) VALUES (1, '2024-2025', '2024-09-01');
             INSERT INTO tarifs (saison_id, distance_min, distance_max, prix_tonne_km)
                 VALUES (1, 0, 100, 145.0);",
        )
        .expect("schéma ancien");
        conn
    }

    #[test]
    fn migration_v1_convertit_lancien_bareme() {
        let conn = base_ancienne();
        run_migrations(&conn).expect("migration");

        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(
            version, 7,
            "la base doit être marquée en version 7 après toutes les migrations"
        );

        assert!(!colonne_existe(&conn, "tarifs", "prix_tonne_km").unwrap());

        let (type_fret, unite_tarif, tarif): (String, String, f64) = conn
            .query_row(
                "SELECT type_fret, unite_tarif, tarif FROM tarifs WHERE id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(type_fret, "direct");
        assert_eq!(unite_tarif, "fcfa_tkm");
        assert_eq!(tarif, 145.0);

        assert!(colonne_existe(&conn, "bordereaux", "montant_brut").unwrap());
        assert!(colonne_existe(&conn, "factures", "tkm").unwrap());
        assert!(colonne_existe(&conn, "factures", "mention_original_payable").unwrap());
    }

    #[test]
    fn migration_sur_base_neuve_avec_tranche_ouverte() {
        let conn = Connection::open_in_memory().expect("base en mémoire");
        run_migrations(&conn).expect("migration");

        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 7);
        assert!(!colonne_existe(&conn, "tarifs", "prix_tonne_km").unwrap());

        conn.execute(
            "INSERT INTO saisons (libelle, date_debut) VALUES ('2026-2027', '2026-01-01')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO tarifs (saison_id, type_fret, distance_min, distance_max, unite_tarif, tarif)
             VALUES (1, 'direct', 91, NULL, 'fcfa_tkm', 215.0)",
            [],
        )
        .expect("tranche ouverte acceptée");

        // Une tranche incohérente (max ≤ min) est rejetée par le CHECK.
        let erreur = conn.execute(
            "INSERT INTO tarifs (saison_id, type_fret, distance_min, distance_max, unite_tarif, tarif)
             VALUES (1, 'direct', 50, 40, 'fcfa_tonne', 12937.0)",
            [],
        );
        assert!(erreur.is_err(), "distance_max ≤ distance_min doit échouer");
    }

    /// Montants (id, brut, gasoil, net) d'une table de montants, triés par id.
    fn montants_tries(conn: &Connection, table: &str) -> Vec<(i64, f64, f64, f64)> {
        let mut stmt = conn
            .prepare(&format!(
                "SELECT id, montant_brut, montant_gasoil, montant_net FROM {table} ORDER BY id"
            ))
            .unwrap();
        let lignes = stmt
            .query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        lignes
    }

    /// Non-régression (Phase 7, Étape 4) : la base de démo de la campagne
    /// 2024-2025, créée avec l'ancien schéma, doit conserver à l'identique ses
    /// montants (factures et lignes) après migration vers le schéma du CDC
    /// v1.1, et ses barèmes convertis sans perte (« prix_tonne_km » → tarif
    /// FCFA/TKM, fret « direct »).
    #[test]
    fn non_regression_campagne_2024_2025_base_demo() {
        let chemin_demo = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../abaf-campagne-2024-2025.db");
        if !chemin_demo.exists() {
            eprintln!(
                "Base de démo absente ({}) : test de non-régression ignoré.",
                chemin_demo.display()
            );
            return;
        }

        // Travaille sur une copie : la base de démo n'est jamais modifiée.
        let copie = std::env::temp_dir().join("abaf-non-regression-2024-2025.db");
        let _ = std::fs::remove_file(&copie);
        std::fs::copy(&chemin_demo, &copie).expect("copie de la base de démo");
        let conn = Connection::open(&copie).expect("ouverture de la copie de démo");

        // La base de démo est attendue dans l'ancien schéma (avant Phase 7).
        assert!(!colonne_existe(&conn, "tarifs", "unite_tarif").unwrap());

        let factures_avant = montants_tries(&conn, "factures");
        let lignes_avant = montants_tries(&conn, "lignes_facture");
        assert!(
            !factures_avant.is_empty() && !lignes_avant.is_empty(),
            "la base de démo doit contenir des factures et des lignes"
        );

        // Ancien barème : (id, distance_min, distance_max, prix_tonne_km).
        let bareme_avant: Vec<(i64, f64, f64, f64)> = {
            let mut stmt = conn
                .prepare(
                    "SELECT id, distance_min, distance_max, prix_tonne_km FROM tarifs ORDER BY id",
                )
                .unwrap();
            let lignes = stmt
                .query_map([], |row| {
                    Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
                })
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap();
            lignes
        };
        assert!(!bareme_avant.is_empty(), "la base de démo doit avoir un barème");

        run_migrations(&conn).expect("migration de la base de démo");

        // 1) Montants des factures et des lignes strictement inchangés.
        assert_eq!(
            factures_avant,
            montants_tries(&conn, "factures"),
            "les montants des factures 2024-2025 doivent rester inchangés"
        );
        assert_eq!(
            lignes_avant,
            montants_tries(&conn, "lignes_facture"),
            "les montants des lignes 2024-2025 doivent rester inchangés"
        );

        // 2) Barèmes convertis à l'identique : mêmes bornes et même prix,
        //    en fret « direct » et unité FCFA/TKM.
        let bareme_apres: Vec<(i64, f64, f64, f64, String, String)> = {
            let mut stmt = conn
                .prepare(
                    "SELECT id, distance_min, distance_max, tarif, type_fret, unite_tarif
                     FROM tarifs ORDER BY id",
                )
                .unwrap();
            let lignes = stmt
                .query_map([], |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                    ))
                })
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap();
            lignes
        };
        assert_eq!(bareme_avant.len(), bareme_apres.len());
        for (avant, apres) in bareme_avant.iter().zip(bareme_apres.iter()) {
            assert_eq!(
                (avant.0, avant.1, avant.2, avant.3),
                (apres.0, apres.1, apres.2, apres.3),
                "bornes et tarif du barème 2024-2025 doivent être conservés"
            );
            assert_eq!(apres.4, "direct", "les barèmes migrés passent en fret direct");
            assert_eq!(apres.5, "fcfa_tkm", "l'ancien prix à la tonne-km devient un tarif FCFA/TKM");
        }

        let _ = std::fs::remove_file(&copie);
    }

    /// Vérifie que la migration v5 remplace `'intrant'` par les quatre valeurs
    /// distinctes et rejette toujours les valeurs inconnues.
    #[test]
    fn migration_v5_ajoute_intrant_sous_types() {
        let conn = Connection::open_in_memory().expect("base en mémoire");
        run_migrations(&conn).expect("migration");

        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(
            version, 7,
            "la base doit être en version 7 après migration_v5 et migration_v7"
        );

        conn.execute(
            "INSERT INTO saisons (libelle, date_debut) VALUES ('2026-2027', '2026-01-01')",
            [],
        )
        .expect("saison insérée");
        let saison_id = conn.last_insert_rowid();

        // Les quatre variantes intrant doivent être acceptées.
        for tf in &["intrant_direct", "intrant_retour", "intrant_evacuation", "intrant_transfert"] {
            let ok = conn.execute(
                "INSERT INTO tarifs (saison_id, type_fret, distance_min, distance_max, unite_tarif, tarif)
                 VALUES (?1, ?2, 0, NULL, 'fcfa_tkm', 95.0)",
                rusqlite::params![saison_id, tf],
            );
            assert!(ok.is_ok(), "type_fret='{}' doit être accepté dans tarifs", tf);
        }

        // La valeur générique 'intrant' et une valeur inconnue doivent être rejetées.
        for tf in &["intrant", "invalide"] {
            let err = conn.execute(
                "INSERT INTO tarifs (saison_id, type_fret, distance_min, distance_max, unite_tarif, tarif)
                 VALUES (?1, ?2, 0, NULL, 'fcfa_tkm', 95.0)",
                rusqlite::params![saison_id, tf],
            );
            assert!(err.is_err(), "type_fret='{}' doit être rejeté dans tarifs", tf);
        }
    }

    /// Migration v7 : le module Exploitation est créé, les référentiels
    /// synchronisés reçoivent un UUID unique et les triggers publient chaque
    /// changement dans le journal utilisé par les appareils de terrain.
    #[test]
    fn migration_v7_cree_le_module_et_le_journal() {
        let conn = Connection::open_in_memory().expect("base en mémoire");
        run_migrations(&conn).expect("migration");

        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 7);

        for table in &["depenses", "intervenants", "pieces_rechange", "appareils", "sync_oplog"] {
            assert!(table_existe(&conn, table).unwrap(), "la table {table} doit exister");
        }
        for table in TABLES_SYNC {
            assert!(
                colonne_existe(&conn, table, "uuid").unwrap(),
                "la table {table} doit porter un uuid"
            );
        }

        // Paramètres de synchronisation initialisés.
        let port: String = conn
            .query_row("SELECT valeur FROM parametres WHERE cle = 'sync_port'", [], |r| {
                r.get(0)
            })
            .expect("sync_port");
        assert_eq!(port, "9470");

        // Une catégorie hors nomenclature est refusée par le CHECK.
        conn.execute(
            "INSERT INTO saisons (id, libelle, date_debut) VALUES (1, '2026-2027', '2026-01-01')",
            [],
        )
        .unwrap();
        let erreur = conn.execute(
            "INSERT INTO depenses (uuid, saison_id, categorie, designation, montant, date_depense)
             VALUES ('d1', 1, 'marche_noire', 'Test', 1000, '2026-01-02')",
            [],
        );
        assert!(erreur.is_err(), "une catégorie inconnue doit être rejetée");
    }

    /// Les triggers du journal publient les créations, modifications (avec
    /// l'appareil indiqué dans `sync_ctx`) et suppressions sous forme de
    /// tombstones, avec les références en UUID.
    #[test]
    fn journal_de_synchronisation_enregistre_les_mouvements() {
        let conn = Connection::open_in_memory().expect("base en mémoire");
        run_migrations(&conn).expect("migration");

        conn.execute_batch(
            "INSERT INTO saisons (id, libelle, date_debut) VALUES (1, '2026-2027', '2026-01-01');
             DELETE FROM sync_oplog;",
        )
        .unwrap();

        conn.execute(
            "INSERT INTO camions (id, immatriculation, capacite_tonnes) VALUES (1, 'AB-1234', 25)",
            [],
        )
        .unwrap();

        let (op, device): (String, String) = conn
            .query_row(
                "SELECT op, device FROM sync_oplog WHERE table_x = 'camions' ORDER BY lvn DESC",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("écriture du journal pour un camion");
        assert_eq!(op, "upsert");
        assert_eq!(device, "", "une écriture du poste n'est pas portée par un appareil");

        // L'écriture provient cette fois d'un appareil de terrain.
        conn.execute("UPDATE sync_ctx SET device = 'poste-mobile-1'", [])
            .unwrap();
        conn.execute(
            "INSERT INTO depenses (uuid, saison_id, camion_id, categorie, designation, montant, date_depense)
             VALUES ('d1', 1, 1, 'piece_rechange', 'Embrayage', 300000, '2026-01-25')",
            [],
        )
        .unwrap();

        let payload: String = conn
            .query_row(
                "SELECT payload FROM sync_oplog WHERE table_x = 'depenses' ORDER BY lvn DESC",
                [],
                |row| row.get(0),
            )
            .expect("payload de la dépense");
        let json: serde_json::Value = serde_json::from_str(&payload).expect("payload JSON");
        assert_eq!(json["uuid"], "d1");
        assert_eq!(json["categorie"], "piece_rechange");
        assert_eq!(json["montant"], 300_000.0);
        assert_eq!(json["statut"], "brouillon", "statut par défaut appliqué par le trigger");
        let camion_uuid: String = conn
            .query_row("SELECT uuid FROM camions WHERE id = 1", [], |row| row.get(0))
            .unwrap();
        assert_eq!(
            json["camion_uuid"], camion_uuid,
            "les références sont publiées en UUID du référentiel"
        );

        let device: String = conn
            .query_row(
                "SELECT device FROM sync_oplog WHERE table_x = 'depenses' ORDER BY lvn DESC",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(device, "poste-mobile-1");

        // Une modification alimente le journal sans effacer l'entrée précédente.
        conn.execute("UPDATE depenses SET montant = 320000 WHERE uuid = 'd1'", [])
            .unwrap();
        let nb: i64 = conn
            .query_row("SELECT COUNT(*) FROM sync_oplog WHERE table_x = 'depenses'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(nb, 2, "l'update ajoute une entrée au journal");

        // Une suppression devient un tombstone `delete` sans payload.
        conn.execute("DELETE FROM depenses WHERE uuid = 'd1'", []).unwrap();
        let (op, payload): (String, Option<String>) = conn
            .query_row(
                "SELECT op, payload FROM sync_oplog WHERE table_x = 'depenses' ORDER BY lvn DESC",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(op, "delete");
        assert!(payload.is_none(), "un tombstone ne porte pas de payload");

        // Tous les UUID de référentiels sont posés et uniques.
        let sans_uuid: i64 = conn
            .query_row("SELECT COUNT(*) FROM camions WHERE uuid IS NULL", [], |r| r.get(0))
            .unwrap();
        assert_eq!(sans_uuid, 0, "chaque camion doit avoir un UUID");
    }

    /// La compaction ne garde qu'une entrée par ligne au-delà du délai, sans
    /// jamais supprimer la dernière image d'une ligne.
    #[test]
    fn compacter_journal_garde_la_derniere_image() {
        let conn = Connection::open_in_memory().expect("base en mémoire");
        run_migrations(&conn).expect("migration");

        conn.execute_batch(
            r#"INSERT INTO saisons (id, libelle, date_debut) VALUES (1, '2026-2027', '2026-01-01');
             DELETE FROM sync_oplog;
             INSERT INTO sync_oplog (table_x, ref, op, payload, at)
                 VALUES ('depenses', 'd1', 'upsert', '{}', datetime('now', '-200 days')),
                        ('depenses', 'd1', 'upsert', '{"montant":2}', datetime('now', '-150 days')),
                        ('depenses', 'd1', 'upsert', '{"montant":3}', datetime('now', '-120 days')),
                        ('depenses', 'd2', 'upsert', '{}', datetime('now', '-10 days'));"#,
        )
        .unwrap();

        let supprimes = compacter_sync_oplog(&conn, 90).expect("compaction");
        assert_eq!(supprimes, 2, "les deux anciennes images de d1 sont supprimées");

        let reste: Vec<(String, String)> = conn
            .prepare("SELECT ref, payload FROM sync_oplog ORDER BY lvn")
            .unwrap()
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(reste.len(), 2);
        assert_eq!(reste[0].1, "{\"montant\":3}", "la dernière image de d1 est conservée");
    }
}
