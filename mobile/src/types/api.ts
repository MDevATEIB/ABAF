/**
 * Miroir TypeScript de `src-tauri/src/sync/payloads.rs` et des payloads JSON
 * produits par les triggers SQLite de `migrations/007_exploitation_sync.sql`.
 *
 * ⚠️ Ce fichier doit rester aligné avec le Rust : toute colonne ajoutée côté
 * serveur doit être reprise ici. Le mobile ne manipule QUE des UUID.
 */

// ─── Enveloppes du protocole ────────────────────────────────────────────────

/** Réponse de détection `GET /sync/hello` (sans jeton). */
export interface HelloResponse {
  server_name: string;
  schema_version: string;
  time: string;
}

/** Corps de `POST /sync/pair`. */
export interface PairRequest {
  code: string;
  nom_appareil: string;
  agent: string;
}

export interface SaisonActive {
  uuid: string;
  libelle: string;
}

/** Réponse d'appairage : le jeton n'est renvoyé qu'une seule fois. */
export interface PairResponse {
  token: string;
  device_uuid: string;
  saison_active: SaisonActive | null;
  server_time: string;
}

/** Une ligne du journal des changements (`sync_oplog`). */
export interface Changement {
  lvn: number;
  table_x: string;
  /** UUID de la ligne (colonne `ref`). */
  ref: string;
  op: 'upsert' | 'delete';
  payload: Record<string, unknown> | null;
}

export interface PullRequest {
  since: number;
  limit?: number;
}

export interface PullResponse {
  changes: Changement[];
  cursor: number;
  has_more: boolean;
  /** Le curseur demandé est antérieur au journal compacté : reset à faire. */
  reset: boolean;
  server_time: string;
}

// ─── Lignes poussées par le terrain ─────────────────────────────────────────

/** Statuts possibles d'une ligne poussée. */
export type ResultatStatut = 'ok' | 'updated' | 'merged' | 'rejected';

/** Motifs de rejet émis par `handlers.rs`. */
export type RejetMotif =
  | 'deja_traitee_au_bureau'
  | 'plus_recent_au_bureau'
  | 'saison_inconnue'
  | 'camion_inconnu'
  | 'chauffeur_inconnu'
  | 'intervenant_inconnu'
  | 'piece_inconnue'
  | 'mission_inconnue'
  | (string & {});

/** Dépense telle que saisie sur le terrain (pas de statut : le poste audite). */
export interface DepenseWire {
  uuid: string;
  saison_uuid: string;
  camion_uuid: string | null;
  mission_uuid: string | null;
  chauffeur_uuid: string | null;
  apprenti_uuid: string | null;
  mecanicien_uuid: string | null;
  piece_uuid: string | null;
  categorie: string;
  designation: string;
  quantite: number | null;
  unite: string | null;
  montant: number;
  date_depense: string;
  lieu: string | null;
  observations: string | null;
  /** Nom du fichier côté poste une fois la photo poussée ; null localement. */
  photo: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntervenantWire {
  uuid: string;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  role: 'mecanicien' | 'chef_parc' | 'apprenti';
  actif: number;
  created_at: string;
  updated_at: string;
}

export interface PieceWire {
  uuid: string;
  nom: string;
  categorie: string | null;
  unite: string;
  actif: number;
  created_at: string;
  updated_at: string;
}

export interface CamionWire {
  uuid: string;
  immatriculation: string;
  marque: string | null;
  modele: string | null;
  capacite_tonnes: number | null;
  actif: number;
  updated_at: string;
}

/** Lot poussé par `POST /sync/push`. */
export interface PushRequest {
  depenses?: DepenseWire[];
  intervenants?: IntervenantWire[];
  pieces_rechange?: PieceWire[];
  camions?: CamionWire[];
}

export interface ResultatLigne {
  uuid: string;
  status: ResultatStatut;
  motif?: RejetMotif;
  /** UUID retenu par le serveur en cas de fusion (`merged`). */
  merged_into?: string;
  /** Image de la ligne côté poste, pour recalage. */
  server_row?: Record<string, unknown>;
}

export interface PushResponse {
  results: ResultatLigne[];
  cursor: number;
  server_time: string;
}

// ─── Photos ─────────────────────────────────────────────────────────────────

export interface PhotoWire {
  depense_uuid: string;
  filename?: string | null;
  mime?: string | null;
  /** JPEG encodé en base64, sans préfixe `data:`. */
  base64: string;
}

export interface PhotosRequest {
  items: PhotoWire[];
}

export interface ResultatPhoto {
  depense_uuid: string;
  status: string;
  motif?: string;
}

export interface PhotosResponse {
  results: ResultatPhoto[];
}

// ─── Payloads tirés (images JSON des triggers) ──────────────────────────────

export interface DepensePayload {
  uuid: string;
  saison_uuid: string | null;
  camion_uuid: string | null;
  mission_uuid: string | null;
  chauffeur_uuid: string | null;
  apprenti_uuid: string | null;
  mecanicien_uuid: string | null;
  piece_uuid: string | null;
  categorie: string;
  designation: string;
  quantite: number | null;
  unite: string | null;
  montant: number;
  date_depense: string;
  lieu: string | null;
  observations: string | null;
  photo: string | null;
  statut: 'brouillon' | 'validee' | 'rejete';
  motif_rejet: string | null;
  source: string;
  device_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntervenantPayload {
  uuid: string;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  role: string;
  actif: number;
  source: string;
  device_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PiecePayload {
  uuid: string;
  nom: string;
  categorie: string | null;
  unite: string;
  actif: number;
  source: string;
  device_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CamionPayload {
  uuid: string;
  immatriculation: string;
  marque: string | null;
  modele: string | null;
  capacite_tonnes: number | null;
  actif: number;
  updated_at: string;
}

export interface ChauffeurPayload {
  uuid: string;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  actif: number;
  updated_at: string;
}

export interface SaisonPayload {
  uuid: string;
  libelle: string;
  date_debut: string;
  date_fin: string;
  statut: string;
  updated_at: string;
}

/** Tables connues du mobile ; les autres (usines, cgis, avs, missions) sont
 * ignorées silencieusement lors du pull. */
export type TablesSyncMobile =
  | 'depenses'
  | 'intervenants'
  | 'pieces_rechange'
  | 'camions'
  | 'chauffeurs'
  | 'saisons';

// ─── Nomenclatures partagées avec le poste ──────────────────────────────────

export const CATEGORIES_DEPENSE = [
  'gasoil_hors_bsm',
  'piece_rechange',
  'main_oeuvre',
  'depannage',
  'pneu',
  'huile_entretien',
  'chef_parc',
  'perdiem',
  'peage',
  'stationnement',
  'amende',
  'autre',
] as const;

export type CategorieDepense = (typeof CATEGORIES_DEPENSE)[number];

export const LIBELLES_CATEGORIE_DEPENSE: Record<string, string> = {
  gasoil_hors_bsm: 'Gasoil (hors BSM)',
  piece_rechange: 'Pièce de rechange',
  main_oeuvre: 'Main d’œuvre',
  depannage: 'Dépannage',
  pneu: 'Pneu',
  huile_entretien: 'Huile / entretien',
  chef_parc: 'Chef de parc',
  perdiem: 'Per diem',
  peage: 'Péage',
  stationnement: 'Stationnement',
  amende: 'Amende',
  autre: 'Autre',
};

export function libelleCategorieDepense(categorie: string): string {
  return LIBELLES_CATEGORIE_DEPENSE[categorie] ?? categorie;
}

export const ROLES_INTERVENANT = ['mecanicien', 'chef_parc', 'apprenti'] as const;
export type RoleIntervenant = (typeof ROLES_INTERVENANT)[number];

export const LIBELLES_ROLE_INTERVENANT: Record<string, string> = {
  mecanicien: 'Mécanicien',
  chef_parc: 'Chef de parc',
  apprenti: 'Apprenti',
};
