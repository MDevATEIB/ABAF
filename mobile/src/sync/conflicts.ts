/**
 * Application des résultats de push : le poste est l'autorité.
 * - `ok` / `updated`      → ligne synchronisée.
 * - `merged`              → notre UUID a été fondu dans une ligne du poste :
 *   on mémorise l'alias et on remplace la ligne locale par l'image serveur.
 * - `rejected`            → conflit : la ligne passe en `conflit` et entre au
 *   journal, avec l'image du poste en regard.
 */
import { run } from '../db/client';
import {
  journaliser,
  enregistrerAlias,
  appliquerIntervenantPull,
  appliquerPiecePull,
} from '../db/repos/referentiels';
import {
  marquerDepenseConflit,
  marquerDepenseSynced,
  appliquerDepensePull,
} from '../db/repos/depenses';
import type { DepensePayload, IntervenantPayload, PiecePayload, ResultatLigne } from '../types/api';

export const MOTIFS_FR: Record<string, string> = {
  deja_traitee_au_bureau: 'Dépense déjà validée ou rejetée au bureau : le poste a gagné.',
  plus_recent_au_bureau: 'Version du bureau plus récente que la vôtre.',
  saison_inconnue: 'Campagne inconnue du poste : re-synchronisez les référentiels.',
  camion_inconnu: 'Camion inconnu du poste.',
  chauffeur_inconnu: 'Chauffeur inconnu du poste.',
  intervenant_inconnu: 'Intervenant inconnu du poste.',
  piece_inconnue: 'Pièce inconnue du poste.',
  mission_inconnue: 'Mission inconnue du poste.',
};

export function motifFrancais(motif: string | undefined): string {
  if (!motif) return 'Rejet inconnu du poste.';
  return MOTIFS_FR[motif] ?? motif;
}

/** Traite les résultats d'un lot de dépenses poussées. */
export async function appliquerResultatsDepenses(results: ResultatLigne[]): Promise<{
  poussees: number;
  rejets: number;
}> {
  let poussees = 0;
  let rejets = 0;
  for (const r of results) {
    if (r.status === 'ok' || r.status === 'updated') {
      await marquerDepenseSynced(r.uuid);
      poussees += 1;
    } else if (r.status === 'rejected') {
      await marquerDepenseConflit(r.uuid);
      await journaliser(r.uuid, 'depenses', motifFrancais(r.motif), 'rejected', r.server_row ? JSON.stringify(r.server_row) : null);
      // L'image du poste reprend la main sur la ligne locale.
      if (r.server_row) {
        try {
          await appliquerDepensePull(r.server_row as unknown as DepensePayload);
        } catch {
          /* image partielle : le prochain pull corrigera */
        }
      }
      rejets += 1;
    }
  }
  return { poussees, rejets };
}

/** Intervenants et pièces : fusion possible en plus du rejet. */
export async function appliquerResultatsReferentiels(
  results: ResultatLigne[],
  table: 'intervenants' | 'pieces_rechange',
): Promise<{ poussees: number; fusionnees: number; rejets: number }> {
  let poussees = 0;
  let fusionnees = 0;
  let rejets = 0;
  for (const r of results) {
    if (r.status === 'ok' || r.status === 'updated') {
      await marquerLigneSynced(table, r.uuid);
      poussees += 1;
    } else if (r.status === 'merged' && r.merged_into) {
      await enregistrerAlias(r.uuid, r.merged_into, table);
      // On efface notre doublon local ; l'image du poste arrivera au prochain pull.
      await supprimerLigneLocale(table, r.uuid);
      if (r.server_row) {
        try {
          if (table === 'intervenants') await appliquerIntervenantPull(r.server_row as unknown as IntervenantPayload);
          else await appliquerPiecePull(r.server_row as unknown as PiecePayload);
        } catch {
          /* le pull rejouera */
        }
      }
      fusionnees += 1;
    } else if (r.status === 'rejected') {
      await marquerLigneConflit(table, r.uuid);
      await journaliser(r.uuid, table, motifFrancais(r.motif), 'rejected', r.server_row ? JSON.stringify(r.server_row) : null);
      rejets += 1;
    }
  }
  return { poussees, fusionnees, rejets };
}

async function marquerLigneSynced(table: 'intervenants' | 'pieces_rechange', uuid: string): Promise<void> {
  const cible = table === 'intervenants' ? 'intervenants_local' : 'pieces_rechange';
  await run(`UPDATE ${cible} SET sync_state = 'synced' WHERE uuid = ?`, [uuid]);
}

async function marquerLigneConflit(table: 'intervenants' | 'pieces_rechange', uuid: string): Promise<void> {
  const cible = table === 'intervenants' ? 'intervenants_local' : 'pieces_rechange';
  await run(`UPDATE ${cible} SET sync_state = 'conflit' WHERE uuid = ?`, [uuid]);
}

async function supprimerLigneLocale(table: 'intervenants' | 'pieces_rechange', uuid: string): Promise<void> {
  const cible = table === 'intervenants' ? 'intervenants_local' : 'pieces_rechange';
  await run(`DELETE FROM ${cible} WHERE uuid = ?`, [uuid]);
}
