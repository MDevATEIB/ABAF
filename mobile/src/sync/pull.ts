/**
 * Pull poste → terrain : application du journal `sync_oplog` par table, en
 * boucle tant que `has_more`. Idempotent : le curseur est relu à chaque
 * tour et les upserts sont des `INSERT ... ON CONFLICT`.
 *
 * Si le poste signale `reset` (journal compacté sous notre curseur), on
 * purge les miroirs `synced` en gardant les files `pending`/`conflit`, puis
 * on rejoue depuis 0.
 */
import { requete } from './client';
import { getMetaNumber, META_CLES, run, setMeta } from '../db/client';
import {
  appliquerDepensePull,
  supprimerDepensePull,
} from '../db/repos/depenses';
import {
  appliquerCamionPull,
  appliquerChauffeurPull,
  appliquerIntervenantPull,
  appliquerPiecePull,
  appliquerSaisonPull,
  supprimerCamionPull,
  supprimerChauffeurPull,
  supprimerIntervenantPull,
  supprimerPiecePull,
} from '../db/repos/referentiels';
import type {
  CamionPayload,
  Changement,
  ChauffeurPayload,
  DepensePayload,
  IntervenantPayload,
  PiecePayload,
  PullResponse,
  SaisonPayload,
} from '../types/api';

function appliquerChangement(c: Changement): Promise<void> {
  if (c.op === 'delete') {
    switch (c.table_x) {
      case 'depenses':
        return supprimerDepensePull(c.ref);
      case 'camions':
        return supprimerCamionPull(c.ref);
      case 'chauffeurs':
        return supprimerChauffeurPull(c.ref);
      case 'intervenants':
        return supprimerIntervenantPull(c.ref);
      case 'pieces_rechange':
        return supprimerPiecePull(c.ref);
      default:
        return Promise.resolve(); // saisons et autres : tombstone ignoré
    }
  }
  const payload = c.payload ?? {};
  switch (c.table_x) {
    case 'depenses':
      return appliquerDepensePull(payload as unknown as DepensePayload);
    case 'camions':
      return appliquerCamionPull(payload as unknown as CamionPayload);
    case 'chauffeurs':
      return appliquerChauffeurPull(payload as unknown as ChauffeurPayload);
    case 'intervenants':
      return appliquerIntervenantPull(payload as unknown as IntervenantPayload);
    case 'pieces_rechange':
      return appliquerPiecePull(payload as unknown as PiecePayload);
    case 'saisons':
      return appliquerSaisonPull(payload as unknown as SaisonPayload);
    default:
      // usines, cgis, avs, missions : hors périmètre du terrain pour l'instant.
      return Promise.resolve();
  }
}

async function purgerMiroirs(): Promise<void> {
  // On ne garde que ce qui n'existe qu'ici (pending) et les lignes en conflit.
  await run("DELETE FROM depenses WHERE sync_state = 'synced'");
  await run('DELETE FROM camions');
  await run('DELETE FROM chauffeurs');
  await run('DELETE FROM saisons');
  await run("DELETE FROM intervenants_local WHERE sync_state = 'synced'");
  await run("DELETE FROM pieces_rechange WHERE sync_state = 'synced'");
  await setMeta(META_CLES.curseurPull, '0');
}

export interface BilanPull {
  tirees: number;
  curseur: number;
  serverTime: string;
}

export async function tirer(
  surProgression?: (nb: number) => void,
): Promise<BilanPull> {
  let since = await getMetaNumber(META_CLES.curseurPull, 0);
  let reponse = await requete<PullResponse>('/sync/pull', { corps: { since, limit: 500 } });

  if (reponse.reset) {
    await purgerMiroirs();
    since = 0;
    reponse = await requete<PullResponse>('/sync/pull', { corps: { since, limit: 500 } });
  }

  let tirees = 0;
  for (;;) {
    for (const changement of reponse.changes) {
      await appliquerChangement(changement);
    }
    tirees += reponse.changes.length;
    surProgression?.(tirees);
    await setMeta(META_CLES.curseurPull, String(reponse.cursor));
    if (!reponse.has_more) {
      return { tirees, curseur: reponse.cursor, serverTime: reponse.server_time };
    }
    reponse = await requete<PullResponse>('/sync/pull', { corps: { since: reponse.cursor, limit: 500 } });
  }
}
