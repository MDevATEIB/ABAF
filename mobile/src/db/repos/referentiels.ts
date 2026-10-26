/**
 * Repo des référentiels locaux : miroirs tirés du poste (camions, chauffeurs,
 * saisons), créés sur le terrain (intervenants, pièces), tables d'alias et de
 * journal. Les écritures terrain posent `sync_state = 'pending'`.
 */
import * as Crypto from 'expo-crypto';
import { getAll, getFirst, run } from '../client';
import { nowSqlite } from '../../utils/time';
import type {
  CamionPayload,
  ChauffeurPayload,
  IntervenantPayload,
  IntervenantWire,
  PiecePayload,
  PieceWire,
  SaisonPayload,
} from '../../types/api';

// ─── Camions (tirés ; corrigeables par le terrain) ──────────────────────────

export interface CamionLocal {
  uuid: string;
  immatriculation: string;
  marque: string | null;
  modele: string | null;
  capacite_tonnes: number | null;
  actif: number;
  updated_at: string | null;
  sync_state: string;
}

export async function listerCamions(actifsSeulement = true): Promise<CamionLocal[]> {
  return getAll<CamionLocal>(
    `SELECT * FROM camions ${actifsSeulement ? 'WHERE actif = 1' : ''} ORDER BY immatriculation`,
  );
}

export async function appliquerCamionPull(payload: CamionPayload): Promise<void> {
  await run(
    `INSERT INTO camions (uuid, immatriculation, marque, modele, capacite_tonnes, actif, updated_at, sync_state, local_only)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', 0)
     ON CONFLICT(uuid) DO UPDATE SET
       immatriculation = excluded.immatriculation, marque = excluded.marque,
       modele = excluded.modele, capacite_tonnes = excluded.capacite_tonnes,
       actif = excluded.actif, updated_at = excluded.updated_at,
       sync_state = 'synced', local_only = 0`,
    [
      payload.uuid,
      payload.immatriculation,
      payload.marque,
      payload.modele,
      payload.capacite_tonnes,
      payload.actif,
      payload.updated_at,
    ],
  );
}

export async function supprimerCamionPull(uuid: string): Promise<void> {
  await run('DELETE FROM camions WHERE uuid = ?', [uuid]);
}

// ─── Chauffeurs et saisons (tirés, lecture seule sur le terrain) ────────────

export interface ChauffeurLocal {
  uuid: string;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  actif: number;
}

export async function listerChauffeurs(actifsSeulement = true): Promise<ChauffeurLocal[]> {
  return getAll<ChauffeurLocal>(
    `SELECT * FROM chauffeurs ${actifsSeulement ? 'WHERE actif = 1' : ''} ORDER BY nom, prenom`,
  );
}

export async function appliquerChauffeurPull(payload: ChauffeurPayload): Promise<void> {
  await run(
    `INSERT INTO chauffeurs (uuid, nom, prenom, telephone, actif, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(uuid) DO UPDATE SET
       nom = excluded.nom, prenom = excluded.prenom, telephone = excluded.telephone,
       actif = excluded.actif, updated_at = excluded.updated_at`,
    [payload.uuid, payload.nom, payload.prenom, payload.telephone, payload.actif, payload.updated_at],
  );
}

export async function supprimerChauffeurPull(uuid: string): Promise<void> {
  await run('DELETE FROM chauffeurs WHERE uuid = ?', [uuid]);
}

export interface SaisonLocale {
  uuid: string;
  libelle: string;
  date_debut: string | null;
  date_fin: string | null;
  statut: string | null;
}

export async function listerSaisons(): Promise<SaisonLocale[]> {
  return getAll<SaisonLocale>('SELECT * FROM saisons ORDER BY date_debut DESC');
}

export async function appliquerSaisonPull(payload: SaisonPayload): Promise<void> {
  await run(
    `INSERT INTO saisons (uuid, libelle, date_debut, date_fin, statut, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(uuid) DO UPDATE SET
       libelle = excluded.libelle, date_debut = excluded.date_debut,
       date_fin = excluded.date_fin, statut = excluded.statut, updated_at = excluded.updated_at`,
    [payload.uuid, payload.libelle, payload.date_debut, payload.date_fin, payload.statut, payload.updated_at],
  );
}

// ─── Intervenants (créables sur le terrain) ─────────────────────────────────

export interface IntervenantLocal {
  uuid: string;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  role: string;
  actif: number;
  sync_state: string;
  created_at: string;
  updated_at: string;
}

export async function listerIntervenants(role?: string): Promise<IntervenantLocal[]> {
  return getAll<IntervenantLocal>(
    `SELECT * FROM intervenants_local ${role ? 'WHERE role = ?' : ''} ORDER BY nom, prenom`,
    role ? [role] : [],
  );
}

export async function creerIntervenant(champs: {
  nom: string;
  prenom?: string | null;
  telephone?: string | null;
  role: string;
}): Promise<string> {
  const uuid = Crypto.randomUUID();
  const maintenant = nowSqlite();
  await run(
    `INSERT INTO intervenants_local (uuid, nom, prenom, telephone, role, actif, sync_state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, 'pending', ?, ?)`,
    [uuid, champs.nom.trim(), champs.prenom?.trim() || null, champs.telephone?.trim() || null, champs.role, maintenant, maintenant],
  );
  return uuid;
}

export function intervenantWire(i: IntervenantLocal): IntervenantWire {
  return {
    uuid: i.uuid,
    nom: i.nom,
    prenom: i.prenom,
    telephone: i.telephone,
    role: i.role as IntervenantWire['role'],
    actif: i.actif,
    created_at: i.created_at,
    updated_at: i.updated_at,
  };
}

export async function appliquerIntervenantPull(payload: IntervenantPayload): Promise<void> {
  await run(
    `INSERT INTO intervenants_local (uuid, nom, prenom, telephone, role, actif, sync_state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'synced', ?, ?)
     ON CONFLICT(uuid) DO UPDATE SET
       nom = excluded.nom, prenom = excluded.prenom, telephone = excluded.telephone,
       role = excluded.role, actif = excluded.actif, sync_state = 'synced',
       updated_at = excluded.updated_at`,
    [
      payload.uuid,
      payload.nom,
      payload.prenom,
      payload.telephone,
      payload.role,
      payload.actif,
      payload.created_at,
      payload.updated_at,
    ],
  );
}

export async function supprimerIntervenantPull(uuid: string): Promise<void> {
  await run('DELETE FROM intervenants_local WHERE uuid = ?', [uuid]);
}

// ─── Pièces de rechange (créables sur le terrain) ───────────────────────────

export interface PieceLocale {
  uuid: string;
  nom: string;
  categorie: string | null;
  unite: string;
  actif: number;
  sync_state: string;
  created_at: string;
  updated_at: string;
}

export async function listerPieces(recherche?: string): Promise<PieceLocale[]> {
  if (recherche) {
    return getAll<PieceLocale>(
      "SELECT * FROM pieces_rechange WHERE actif = 1 AND nom LIKE ? ORDER BY nom LIMIT 100",
      [`%${recherche}%`],
    );
  }
  return getAll<PieceLocale>("SELECT * FROM pieces_rechange WHERE actif = 1 ORDER BY nom LIMIT 200");
}

export async function creerPiece(champs: {
  nom: string;
  categorie?: string | null;
  unite?: string | null;
}): Promise<string> {
  const uuid = Crypto.randomUUID();
  const maintenant = nowSqlite();
  await run(
    `INSERT INTO pieces_rechange (uuid, nom, categorie, unite, actif, sync_state, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, 'pending', ?, ?)`,
    [uuid, champs.nom.trim(), champs.categorie?.trim() || null, champs.unite?.trim() || 'u', maintenant, maintenant],
  );
  return uuid;
}

export function pieceWire(p: PieceLocale): PieceWire {
  return {
    uuid: p.uuid,
    nom: p.nom,
    categorie: p.categorie,
    unite: p.unite,
    actif: p.actif,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

export async function appliquerPiecePull(payload: PiecePayload): Promise<void> {
  await run(
    `INSERT INTO pieces_rechange (uuid, nom, categorie, unite, actif, sync_state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'synced', ?, ?)
     ON CONFLICT(uuid) DO UPDATE SET
       nom = excluded.nom, categorie = excluded.categorie, unite = excluded.unite,
       actif = excluded.actif, sync_state = 'synced', updated_at = excluded.updated_at`,
    [
      payload.uuid,
      payload.nom,
      payload.categorie,
      payload.unite,
      payload.actif,
      payload.created_at,
      payload.updated_at,
    ],
  );
}

export async function supprimerPiecePull(uuid: string): Promise<void> {
  await run('DELETE FROM pieces_rechange WHERE uuid = ?', [uuid]);
}

// ─── Aliases issus des fusions (`merged`) ───────────────────────────────────

export async function enregistrerAlias(localUuid: string, serverUuid: string, tableX: string): Promise<void> {
  await run('INSERT OR REPLACE INTO uuid_alias (local_uuid, server_uuid, table_x) VALUES (?, ?, ?)', [
    localUuid,
    serverUuid,
    tableX,
  ]);
}

/** Un UUID poussé peut avoir été fondu : on résout avant de réécrire localement. */
export async function resoudreAlias(localUuid: string): Promise<string | null> {
  const ligne = await getFirst<{ server_uuid: string }>('SELECT server_uuid FROM uuid_alias WHERE local_uuid = ?', [
    localUuid,
  ]);
  return ligne?.server_uuid ?? null;
}

// ─── Journal des rejets et conflits ─────────────────────────────────────────

export interface EntreeJournal {
  id: number;
  uuid_ligne: string;
  table_x: string;
  motif: string;
  statut: string;
  serveur: string | null;
  resolved: number;
  at: string;
}

export async function journaliser(
  uuid: string,
  tableX: string,
  motif: string,
  statut: string,
  serveur?: string | null,
): Promise<void> {
  await run(
    `INSERT INTO journal_sync (uuid_ligne, table_x, motif, statut, serveur) VALUES (?, ?, ?, ?, ?)`,
    [uuid, tableX, motif, statut, serveur ? (typeof serveur === 'string' ? serveur : JSON.stringify(serveur)) : null],
  );
}

export async function listerJournal(limite = 50): Promise<EntreeJournal[]> {
  return getAll<EntreeJournal>('SELECT * FROM journal_sync ORDER BY id DESC LIMIT ?', [limite]);
}

/** « Corriger et revérifier » : la relance remet la ligne en file. */
export async function rouvrirLigne(uuid: string): Promise<void> {
  await run("UPDATE depenses SET sync_state = 'pending' WHERE uuid = ? AND sync_state = 'conflit'", [uuid]);
  await run("UPDATE journal_sync SET resolved = 1 WHERE uuid_ligne = ? AND resolved = 0", [uuid]);
}
