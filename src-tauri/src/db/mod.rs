use rusqlite::{params, Connection, Result};
use std::path::PathBuf;
use std::sync::Mutex;

// ─── État partagé de l'application ───────────────────────────────────────────
pub struct AppState {
    pub db: Mutex<Connection>,
}

/// Initialise la base de données : ouvre le fichier, active les pragmas et
/// exécute la migration initiale si elle n'a pas encore été appliquée.
pub fn setup(app_data_dir: PathBuf) -> Result<AppState> {
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?;

    let db_path = app_data_dir.join("abaf.db");
    let conn = Connection::open(db_path)?;

    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;",
    )?;

    run_migrations(&conn)?;

    // Copie de sécurité automatique optionnelle (AGENT.md §24.3), sans
    // bloquer le lancement en cas d'échec.
    sauvegarde_automatique(&conn, &app_data_dir);

    Ok(AppState {
        db: Mutex::new(conn),
    })
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

    /// Crée le schéma « ancien » (avant la Phase 7) : tarifs avec
    /// `prix_tonne_km`, bordereaux et factures sans les colonnes du CDC v1.1.
    fn base_ancienne() -> Connection {
        let conn = Connection::open_in_memory().expect("base en mémoire");
        conn.execute_batch(
            "CREATE TABLE saisons (
                 id INTEGER PRIMARY KEY,
                 libelle TEXT NOT NULL
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
             INSERT INTO saisons (id, libelle) VALUES (1, '2024-2025');
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
        assert_eq!(version, 1, "la base doit être marquée en version 1");

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
        assert_eq!(version, 1);
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
}
