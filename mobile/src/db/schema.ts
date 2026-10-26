/**
 * Schéma SQLite local d'ABAF Terrain (`abaf_terrain.db`).
 *
 * Le téléphone est un miroir offline-first : les référentiels viennent du
 * poste par `pull`, les dépenses sont écrites localement (`sync_state`) avant
 * toute tentative réseau. Le mobile ne connaît que des UUID.
 */

export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;

-- Dépenses saisies ou tirées. sync_state : pending | synced | conflit.
CREATE TABLE IF NOT EXISTS depenses (
  uuid             TEXT PRIMARY KEY,
  saison_uuid      TEXT NOT NULL,
  camion_uuid      TEXT,
  mission_uuid     TEXT,
  chauffeur_uuid   TEXT,
  apprenti_uuid    TEXT,
  mecanicien_uuid  TEXT,
  piece_uuid       TEXT,
  categorie        TEXT NOT NULL,
  designation      TEXT NOT NULL,
  quantite         REAL,
  unite            TEXT,
  montant          REAL NOT NULL CHECK (montant >= 0),
  date_depense     TEXT NOT NULL,
  lieu             TEXT,
  observations     TEXT,
  photo            TEXT,
  statut           TEXT NOT NULL DEFAULT 'brouillon',
  motif_rejet      TEXT,
  source           TEXT NOT NULL DEFAULT 'mobile',
  sync_state       TEXT NOT NULL DEFAULT 'pending'
                   CHECK (sync_state IN ('pending', 'synced', 'conflit')),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_depenses_date ON depenses (date_depense);
CREATE INDEX IF NOT EXISTS ix_depenses_state ON depenses (sync_state);

-- Référentiels tirés du poste (lecture locale hors ligne).
CREATE TABLE IF NOT EXISTS camions (
  uuid             TEXT PRIMARY KEY,
  immatriculation  TEXT NOT NULL,
  marque           TEXT,
  modele           TEXT,
  capacite_tonnes  REAL,
  actif            INTEGER NOT NULL DEFAULT 1,
  updated_at       TEXT,
  -- Le terrain peut corriger une immatriculation ; file de push alors.
  sync_state       TEXT NOT NULL DEFAULT 'synced'
                   CHECK (sync_state IN ('pending', 'synced', 'conflit')),
  local_only       INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS chauffeurs (
  uuid             TEXT PRIMARY KEY,
  nom              TEXT NOT NULL,
  prenom           TEXT,
  telephone        TEXT,
  actif            INTEGER NOT NULL DEFAULT 1,
  updated_at       TEXT
);
CREATE TABLE IF NOT EXISTS saisons (
  uuid             TEXT PRIMARY KEY,
  libelle          TEXT NOT NULL,
  date_debut       TEXT,
  date_fin         TEXT,
  statut           TEXT,
  updated_at       TEXT
);
CREATE TABLE IF NOT EXISTS intervenants_local (
  uuid             TEXT PRIMARY KEY,
  nom              TEXT NOT NULL,
  prenom           TEXT,
  telephone        TEXT,
  role             TEXT NOT NULL CHECK (role IN ('mecanicien', 'chef_parc', 'apprenti')),
  actif            INTEGER NOT NULL DEFAULT 1,
  sync_state       TEXT NOT NULL DEFAULT 'pending'
                   CHECK (sync_state IN ('pending', 'synced', 'conflit')),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pieces_rechange (
  uuid             TEXT PRIMARY KEY,
  nom              TEXT NOT NULL,
  categorie         TEXT,
  unite            TEXT NOT NULL DEFAULT 'u',
  actif            INTEGER NOT NULL DEFAULT 1,
  sync_state       TEXT NOT NULL DEFAULT 'pending'
                   CHECK (sync_state IN ('pending', 'synced', 'conflit')),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- Fusion côté serveur : notre UUID local a été remplacé par un UUID poste.
CREATE TABLE IF NOT EXISTS uuid_alias (
  local_uuid   TEXT PRIMARY KEY,
  server_uuid  TEXT NOT NULL,
  table_x      TEXT NOT NULL
);

-- Photos en attente d'envoi : URI locale (affichage) + JPEG compressé encodé
-- dès la capture (le cache image d'Android peut être purgé par l'OS).
CREATE TABLE IF NOT EXISTS photos_en_attente (
  depense_uuid  TEXT NOT NULL,
  uri           TEXT NOT NULL,
  base64        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'ok', 'erreur')),
  tries         INTEGER NOT NULL DEFAULT 0,
  motif         TEXT,
  PRIMARY KEY (depense_uuid, uri)
);

-- Journal des rejets et conflits visibles sur l'écran Synchro.
CREATE TABLE IF NOT EXISTS journal_sync (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid_ligne   TEXT NOT NULL,
  table_x      TEXT NOT NULL,
  motif        TEXT NOT NULL,
  statut       TEXT NOT NULL,
  serveur      TEXT,
  resolved     INTEGER NOT NULL DEFAULT 0,
  at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Méta : curseur_pull, device_uuid, host, port, nom_appareil, agent,
-- saison_active_uuid/libelle, dernier_serveur_time, derniere_synchro.
CREATE TABLE IF NOT EXISTS meta (
  cle    TEXT PRIMARY KEY,
  valeur TEXT
);
`;

/** Clés connues de la table `meta`. */
export const META_CLES = {
  curseurPull: 'curseur_pull',
  deviceUuid: 'device_uuid',
  host: 'host',
  port: 'port',
  nomAppareil: 'nom_appareil',
  agent: 'agent',
  saisonActiveUuid: 'saison_active_uuid',
  saisonActiveLibelle: 'saison_active_libelle',
  derniereSynchro: 'derniere_synchro',
  serveurTime: 'serveur_time',
} as const;
