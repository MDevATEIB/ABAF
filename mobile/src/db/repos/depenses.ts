/**
 * Repo local des dépenses. Toute écriture pose `sync_state` :
 * une ligne du terrain naît `pending`, une ligne tirée du poste est `synced`.
 */
import * as Crypto from 'expo-crypto';
import { getAll, getFirst, run } from '../client';
import { nowSqlite } from '../../utils/time';
import type { DepensePayload, DepenseWire } from '../../types/api';

export type EtatSyncLocal = 'pending' | 'synced' | 'conflit';

export interface DepenseLocale {
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
  photo: string | null;
  statut: string;
  motif_rejet: string | null;
  source: string;
  sync_state: EtatSyncLocal;
  created_at: string;
  updated_at: string;
  // Jointures d'affichage.
  camion_immat: string | null;
  chauffeur_nom: string | null;
}

export interface ChampsDepense {
  saison_uuid: string;
  camion_uuid?: string | null;
  chauffeur_uuid?: string | null;
  apprenti_uuid?: string | null;
  mecanicien_uuid?: string | null;
  piece_uuid?: string | null;
  categorie: string;
  designation: string;
  quantite?: number | null;
  unite?: string | null;
  montant: number;
  date_depense: string;
  lieu?: string | null;
  observations?: string | null;
}

const SELECT = `
SELECT d.*,
       c.immatriculation AS camion_immat,
       TRIM(IFNULL(ch.nom, '') || ' ' || IFNULL(ch.prenom, '')) AS chauffeur_nom
  FROM depenses d
  LEFT JOIN camions c ON c.uuid = d.camion_uuid
  LEFT JOIN chauffeurs ch ON ch.uuid = d.chauffeur_uuid
`;

export async function creerDepense(champs: ChampsDepense): Promise<string> {
  const uuid = Crypto.randomUUID();
  const maintenant = nowSqlite();
  await run(
    `INSERT INTO depenses (
       uuid, saison_uuid, camion_uuid, mission_uuid, chauffeur_uuid, apprenti_uuid,
       mecanicien_uuid, piece_uuid, categorie, designation, quantite, unite, montant,
       date_depense, lieu, observations, photo, statut, motif_rejet, source,
       sync_state, created_at, updated_at
     ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'brouillon', NULL, 'mobile', 'pending', ?, ?)`,
    [
      uuid,
      champs.saison_uuid,
      champs.camion_uuid ?? null,
      champs.chauffeur_uuid ?? null,
      champs.apprenti_uuid ?? null,
      champs.mecanicien_uuid ?? null,
      champs.piece_uuid ?? null,
      champs.categorie,
      champs.designation.trim(),
      champs.quantite ?? null,
      champs.unite ?? null,
      champs.montant,
      champs.date_depense,
      champs.lieu?.trim() || null,
      champs.observations?.trim() || null,
      maintenant,
      maintenant,
    ],
  );
  return uuid;
}

/** Le terrain ne modifie que ses propres lignes non auditées. */
export async function modifierDepense(uuid: string, champs: ChampsDepense): Promise<void> {
  await run(
    `UPDATE depenses
        SET saison_uuid = ?, camion_uuid = ?, chauffeur_uuid = ?, apprenti_uuid = ?,
            mecanicien_uuid = ?, piece_uuid = ?, categorie = ?, designation = ?,
            quantite = ?, unite = ?, montant = ?, date_depense = ?, lieu = ?,
            observations = ?, sync_state = 'pending', updated_at = ?
      WHERE uuid = ?`,
    [
      champs.saison_uuid,
      champs.camion_uuid ?? null,
      champs.chauffeur_uuid ?? null,
      champs.apprenti_uuid ?? null,
      champs.mecanicien_uuid ?? null,
      champs.piece_uuid ?? null,
      champs.categorie,
      champs.designation.trim(),
      champs.quantite ?? null,
      champs.unite ?? null,
      champs.montant,
      champs.date_depense,
      champs.lieu?.trim() || null,
      champs.observations?.trim() || null,
      nowSqlite(),
      uuid,
    ],
  );
}

/** Suppression locale autorisée tant que la ligne n'a pas été acceptée au poste. */
export async function supprimerDepense(uuid: string): Promise<void> {
  await run("DELETE FROM depenses WHERE uuid = ? AND sync_state != 'synced'", [uuid]);
  await run('DELETE FROM photos_en_attente WHERE depense_uuid = ?', [uuid]);
}

export async function getDepense(uuid: string): Promise<DepenseLocale | null> {
  return getFirst<DepenseLocale>(`${SELECT} WHERE d.uuid = ?`, [uuid]);
}

export interface FiltresLocaux {
  date?: string;
  camionUuid?: string;
  categorie?: string;
  etat?: EtatSyncLocal;
  saisonUuid?: string;
  recherche?: string;
}

export async function listerDepenses(filtres: FiltresLocaux = {}): Promise<DepenseLocale[]> {
  const conditons: string[] = [];
  const params: (string | number)[] = [];
  if (filtres.date) {
    conditons.push('d.date_depense = ?');
    params.push(filtres.date);
  }
  if (filtres.camionUuid) {
    conditons.push('d.camion_uuid = ?');
    params.push(filtres.camionUuid);
  }
  if (filtres.categorie) {
    conditons.push('d.categorie = ?');
    params.push(filtres.categorie);
  }
  if (filtres.etat) {
    conditons.push('d.sync_state = ?');
    params.push(filtres.etat);
  }
  if (filtres.saisonUuid) {
    conditons.push('d.saison_uuid = ?');
    params.push(filtres.saisonUuid);
  }
  if (filtres.recherche) {
    conditons.push('(d.designation LIKE ? OR d.lieu LIKE ? OR c.immatriculation LIKE ?)');
    const motif = `%${filtres.recherche}%`;
    params.push(motif, motif, motif);
  }
  const where = conditons.length ? ` WHERE ${conditons.join(' AND ')}` : '';
  return getAll<DepenseLocale>(
    `${SELECT}${where} ORDER BY d.date_depense DESC, d.updated_at DESC LIMIT 300`,
    params,
  );
}

/** Agrégat « Aujourd'hui » : total et lignes par catégorie du jour. */
export async function depensesDuJour(
  date: string,
): Promise<{ total: number; nb: number; parCategorie: { categorie: string; montant: number; nb: number }[] }> {
  const totaux = await getFirst<{ total: number | null; nb: number }>(
    'SELECT SUM(montant) AS total, COUNT(*) AS nb FROM depenses WHERE date_depense = ?',
    [date],
  );
  const parCategorie = await getAll<{ categorie: string; montant: number; nb: number }>(
    'SELECT categorie, SUM(montant) AS montant, COUNT(*) AS nb FROM depenses WHERE date_depense = ? GROUP BY categorie ORDER BY montant DESC',
    [date],
  );
  return { total: totaux?.total ?? 0, nb: totaux?.nb ?? 0, parCategorie };
}

export async function compterEnAttente(): Promise<number> {
  const ligne = await getFirst<{ nb: number }>(
    "SELECT COUNT(*) AS nb FROM depenses WHERE sync_state = 'pending'",
  );
  return ligne?.nb ?? 0;
}

// ─── Alimentation du push ───────────────────────────────────────────────────

export async function depensesPending(lot: number): Promise<DepenseWire[]> {
  const lignes = await getAll<DepenseLocale>(
    "SELECT * FROM depenses WHERE sync_state = 'pending' ORDER BY updated_at LIMIT ?",
    [lot],
  );
  return lignes.map((d) => ({
    uuid: d.uuid,
    saison_uuid: d.saison_uuid,
    camion_uuid: d.camion_uuid,
    mission_uuid: d.mission_uuid,
    chauffeur_uuid: d.chauffeur_uuid,
    apprenti_uuid: d.apprenti_uuid,
    mecanicien_uuid: d.mecanicien_uuid,
    piece_uuid: d.piece_uuid,
    categorie: d.categorie,
    designation: d.designation,
    quantite: d.quantite,
    unite: d.unite,
    montant: d.montant,
    date_depense: d.date_depense,
    lieu: d.lieu,
    observations: d.observations,
    photo: d.photo,
    created_at: d.created_at,
    updated_at: d.updated_at,
  }));
}

export async function marquerDepenseSynced(uuid: string): Promise<void> {
  await run("UPDATE depenses SET sync_state = 'synced' WHERE uuid = ?", [uuid]);
}

export async function marquerDepenseConflit(uuid: string): Promise<void> {
  await run("UPDATE depenses SET sync_state = 'conflit' WHERE uuid = ?", [uuid]);
}

// ─── Application du pull (image du poste, autorité) ─────────────────────────

export async function appliquerDepensePull(payload: DepensePayload): Promise<void> {
  await run(
    `INSERT INTO depenses (
       uuid, saison_uuid, camion_uuid, mission_uuid, chauffeur_uuid, apprenti_uuid,
       mecanicien_uuid, piece_uuid, categorie, designation, quantite, unite, montant,
       date_depense, lieu, observations, photo, statut, motif_rejet, source,
       sync_state, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)
     ON CONFLICT(uuid) DO UPDATE SET
       saison_uuid = excluded.saison_uuid, camion_uuid = excluded.camion_uuid,
       mission_uuid = excluded.mission_uuid, chauffeur_uuid = excluded.chauffeur_uuid,
       apprenti_uuid = excluded.apprenti_uuid, mecanicien_uuid = excluded.mecanicien_uuid,
       piece_uuid = excluded.piece_uuid, categorie = excluded.categorie,
       designation = excluded.designation, quantite = excluded.quantite,
       unite = excluded.unite, montant = excluded.montant, date_depense = excluded.date_depense,
       lieu = excluded.lieu, observations = excluded.observations, photo = excluded.photo,
       statut = excluded.statut, motif_rejet = excluded.motif_rejet, source = excluded.source,
       sync_state = 'synced', updated_at = excluded.updated_at`,
    [
      payload.uuid,
      payload.saison_uuid ?? '',
      payload.camion_uuid,
      payload.mission_uuid,
      payload.chauffeur_uuid,
      payload.apprenti_uuid,
      payload.mecanicien_uuid,
      payload.piece_uuid,
      payload.categorie,
      payload.designation,
      payload.quantite,
      payload.unite,
      payload.montant,
      payload.date_depense,
      payload.lieu,
      payload.observations,
      payload.photo,
      payload.statut,
      payload.motif_rejet,
      payload.source,
      payload.created_at,
      payload.updated_at,
    ],
  );
}

export async function supprimerDepensePull(uuid: string): Promise<void> {
  await run('DELETE FROM depenses WHERE uuid = ?', [uuid]);
  await run('DELETE FROM photos_en_attente WHERE depense_uuid = ?', [uuid]);
}
