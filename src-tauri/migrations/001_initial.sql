-- Migration 001 – Schéma initial ABAF
-- Ce fichier sera complété au fur et à mesure du développement des modules.
-- Il est exécuté une seule fois au premier démarrage de l'application.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── Saisons ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saisons (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    libelle     TEXT    NOT NULL UNIQUE,
    date_debut  TEXT    NOT NULL,  -- ISO 8601 : YYYY-MM-DD
    date_fin    TEXT,
    statut      TEXT    NOT NULL DEFAULT 'ouverte' CHECK (statut IN ('ouverte', 'fermee')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Tarifs ─────────────────────────────────────────────────────────────────
-- Barème par campagne (CDC v1.1, contrat 2026-2027) : type de fret et unité
-- de tarification — « fcfa_tonne » pour les distances ≤ 90 km, « fcfa_tkm »
-- au-delà. « distance_max » NULL = tranche ouverte (ex. « 91 km et plus »).
CREATE TABLE IF NOT EXISTS tarifs (
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

-- ─── Prix gasoil ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prix_gasoil (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    saison_id   INTEGER NOT NULL UNIQUE REFERENCES saisons(id),
    prix_litre  REAL    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Clients ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nom         TEXT    NOT NULL UNIQUE,
    adresse     TEXT,
    telephone   TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Données initiales : client unique COTONTCHAD SN
INSERT OR IGNORE INTO clients (nom, adresse) VALUES ('COTONTCHAD SN', 'Moundou, Tchad');

-- ─── Camions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS camions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    immatriculation TEXT    NOT NULL UNIQUE,
    marque          TEXT,
    modele          TEXT,
    capacite_tonnes REAL,
    actif           INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0, 1)),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Chauffeurs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chauffeurs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nom         TEXT    NOT NULL,
    prenom      TEXT,
    telephone   TEXT,
    actif       INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0, 1)),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Usines ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usines (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nom         TEXT    NOT NULL UNIQUE,
    localite    TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── CGI ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cgis (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nom         TEXT    NOT NULL,
    usine_id    INTEGER NOT NULL REFERENCES usines(id),
    localite    TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (nom, usine_id)
);

-- ─── AV (Agents Villageois) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS avs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nom         TEXT    NOT NULL,
    cgi_id      INTEGER REFERENCES cgis(id),
    localite    TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Missions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS missions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    saison_id       INTEGER NOT NULL REFERENCES saisons(id),
    camion_id       INTEGER NOT NULL REFERENCES camions(id),
    chauffeur_id    INTEGER REFERENCES chauffeurs(id),
    usine_id        INTEGER REFERENCES usines(id),
    cgi_id          INTEGER REFERENCES cgis(id),
    av_id           INTEGER REFERENCES avs(id),
    date_mission    TEXT    NOT NULL,
    statut          TEXT    NOT NULL DEFAULT 'brouillon'
                    CHECK (statut IN (
                        'brouillon', 'arrive_usine', 'pese_vide', 'gasoil_pris',
                        'en_route', 'chargement', 'retour_usine', 'pese_charge',
                        'poids_net_calcule', 'dechargement', 'valide',
                        'facture', 'paye'
                    )),
    observations    TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Pesées ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pesees (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id      INTEGER NOT NULL REFERENCES missions(id),
    camion_id       INTEGER NOT NULL REFERENCES camions(id),
    usine_id        INTEGER REFERENCES usines(id),
    type_pesee      TEXT    NOT NULL CHECK (type_pesee IN ('vide', 'charge')),
    poids_kg        REAL    NOT NULL CHECK (poids_kg >= 0),
    date_pesee      TEXT    NOT NULL,
    heure_pesee     TEXT,
    ticket_pesee    TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── BSM / Gasoil ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bsm (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    numero          TEXT    NOT NULL UNIQUE,
    saison_id       INTEGER NOT NULL REFERENCES saisons(id),
    mission_id      INTEGER REFERENCES missions(id),
    camion_id       INTEGER NOT NULL REFERENCES camions(id),
    usine_id        INTEGER REFERENCES usines(id),
    date_bsm        TEXT    NOT NULL,
    beneficiaire    TEXT,
    quantite_litres REAL    NOT NULL CHECK (quantite_litres > 0),
    prix_litre      REAL    NOT NULL CHECK (prix_litre > 0),
    montant         REAL    GENERATED ALWAYS AS (quantite_litres * prix_litre) STORED,
    imputation      TEXT,
    reference       TEXT,
    statut          TEXT    NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'cloture', 'facture')),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Bordereaux ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bordereaux (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    numero          TEXT    NOT NULL UNIQUE,
    saison_id       INTEGER NOT NULL REFERENCES saisons(id),
    mission_id      INTEGER REFERENCES missions(id),
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
    -- Type de fret et tarif appliqué au moment de la validation (CDC v1.1).
    type_fret       TEXT    CHECK (type_fret IN ('direct', 'retour', 'evacuation', 'transfert')),
    tarif_applique  REAL,
    unite_tarif     TEXT    CHECK (unite_tarif IN ('fcfa_tonne', 'fcfa_tkm')),
    montant_brut    REAL,
    statut          TEXT    NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'valide', 'facture')),
    observations    TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Lignes Bordereau ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lignes_bordereau (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    bordereau_id    INTEGER NOT NULL REFERENCES bordereaux(id) ON DELETE CASCADE,
    av_id           INTEGER REFERENCES avs(id),
    localite        TEXT,
    poids_kg        REAL    NOT NULL CHECK (poids_kg >= 0),
    distance_km     REAL,
    code            TEXT,
    observations    TEXT
);

-- ─── Factures ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS factures (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    numero          TEXT    NOT NULL UNIQUE,
    saison_id       INTEGER NOT NULL REFERENCES saisons(id),
    client_id       INTEGER NOT NULL REFERENCES clients(id),
    date_facture    TEXT    NOT NULL,
    montant_brut    REAL    NOT NULL DEFAULT 0,
    montant_gasoil  REAL    NOT NULL DEFAULT 0,
    montant_net     REAL    NOT NULL DEFAULT 0,
    -- TKM total, détail des trajets et mention « ORIGINAL PAYABLE » (CDC v1.1).
    tkm             REAL,
    detail_trajet   TEXT,
    mention_original_payable INTEGER NOT NULL DEFAULT 0 CHECK (mention_original_payable IN (0, 1)),
    statut          TEXT    NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'validee', 'payee')),
    observations    TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Lignes Facture ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lignes_facture (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    facture_id      INTEGER NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
    bordereau_id    INTEGER REFERENCES bordereaux(id),
    bsm_id          INTEGER REFERENCES bsm(id),
    description     TEXT,
    poids_net_kg    REAL    DEFAULT 0,
    distance_km     REAL    DEFAULT 0,
    tarif_tonne     REAL    DEFAULT 0,
    montant_brut    REAL    NOT NULL DEFAULT 0,
    montant_gasoil  REAL    NOT NULL DEFAULT 0,
    montant_net     REAL    NOT NULL DEFAULT 0
);

-- ─── Paiements ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paiements (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    facture_id      INTEGER NOT NULL REFERENCES factures(id),
    date_paiement   TEXT    NOT NULL,
    montant         REAL    NOT NULL CHECK (montant > 0),
    mode_paiement   TEXT,
    reference       TEXT,
    statut          TEXT    NOT NULL DEFAULT 'paye' CHECK (statut IN ('paye', 'impaye', 'np')),
    observations    TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Avances ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS avances (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    saison_id       INTEGER NOT NULL REFERENCES saisons(id),
    date_avance     TEXT    NOT NULL,
    montant_initial REAL    NOT NULL CHECK (montant_initial > 0),
    montant_utilise REAL    NOT NULL DEFAULT 0,
    -- solde calculé à la volée dans les requêtes : montant_initial - montant_utilise
    reference       TEXT,
    observations    TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Utilisations avances ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS utilisations_avances (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    avance_id       INTEGER NOT NULL REFERENCES avances(id),
    facture_id      INTEGER REFERENCES factures(id),
    date_utilisation TEXT   NOT NULL,
    montant         REAL    NOT NULL CHECK (montant > 0),
    observations    TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Distances (référentiel CGI ↔ Usine) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS distances (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cgi_id      INTEGER NOT NULL REFERENCES cgis(id),
    usine_id    INTEGER NOT NULL REFERENCES usines(id),
    distance_km REAL    NOT NULL CHECK (distance_km > 0),
    UNIQUE (cgi_id, usine_id)
);

-- ─── Paramètres généraux (Phase 6) ───────────────────────────────────────────
-- Configuration clé/valeur de l'application : informations de l'entreprise
-- (en-têtes des documents imprimés, BSM §20.1 et facture §20.3) et options de
-- sauvegarde (§24.3).
CREATE TABLE IF NOT EXISTS parametres (
    cle        TEXT PRIMARY KEY,
    valeur     TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO parametres (cle, valeur) VALUES
    ('entreprise_nom',       'ABAF SARL'),
    ('entreprise_adresse',   'Moundou, Tchad'),
    ('entreprise_telephone', ''),
    ('entreprise_email',     ''),
    ('sauvegarde_auto',      '0');
