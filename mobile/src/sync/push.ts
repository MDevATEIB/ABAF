/**
 * Push terrain → poste, par lots de 50 lignes. Résolution des alias UUID
 * avant envoi (une pièce fusionnée la veille doit être renvoyée sous l'UUID
 * du poste). Les résultats sont traités par `conflicts.ts`.
 */
import { requete } from './client';
import { depensesPending } from '../db/repos/depenses';
import {
  listerIntervenants,
  listerPieces,
  intervenantWire,
  pieceWire,
  resoudreAlias,
} from '../db/repos/referentiels';
import {
  appliquerResultatsDepenses,
  appliquerResultatsReferentiels,
} from './conflicts';
import type { DepenseWire, PushRequest, PushResponse, ResultatLigne } from '../types/api';

const LOT = 50;

export interface BilanPush {
  depensesPoussees: number;
  intervenantsPousses: number;
  piecesPoussees: number;
  rejets: number;
  fusionnees: number;
}

export function bilanVide(): BilanPush {
  return { depensesPoussees: 0, intervenantsPousses: 0, piecesPoussees: 0, rejets: 0, fusionnees: 0 };
}

/** Résout les UUID référencés d'une dépense via la table `uuid_alias`. */
async function resoudreDepense(d: DepenseWire): Promise<DepenseWire> {
  const [camion, chauffeur, apprenti, mecanicien, piece] = await Promise.all([
    d.camion_uuid ? resoudreAlias(d.camion_uuid) : null,
    d.chauffeur_uuid ? resoudreAlias(d.chauffeur_uuid) : null,
    d.apprenti_uuid ? resoudreAlias(d.apprenti_uuid) : null,
    d.mecanicien_uuid ? resoudreAlias(d.mecanicien_uuid) : null,
    d.piece_uuid ? resoudreAlias(d.piece_uuid) : null,
  ]);
  return {
    ...d,
    camion_uuid: camion ?? d.camion_uuid,
    chauffeur_uuid: chauffeur ?? d.chauffeur_uuid,
    apprenti_uuid: apprenti ?? d.apprenti_uuid,
    mecanicien_uuid: mecanicien ?? d.mecanicien_uuid,
    piece_uuid: piece ?? d.piece_uuid,
  };
}

async function pousserLot(corps: PushRequest): Promise<ResultatLigne[]> {
  const reponse = await requete<PushResponse>('/sync/push', { corps });
  return reponse.results;
}

export async function pousser(surProgression?: (fait: number, total: number) => void): Promise<BilanPush> {
  const bilan = bilanVide();

  // 1. Dépenses, par lots de 50 tant qu'il en reste.
  for (;;) {
    const brutes = await depensesPending(LOT);
    if (brutes.length === 0) break;
    const lot = await Promise.all(brutes.map(resoudreDepense));
    const results = await pousserLot({ depenses: lot });
    const res = await appliquerResultatsDepenses(results);
    bilan.depensesPoussees += res.poussees;
    bilan.rejets += res.rejets;
    surProgression?.(bilan.depensesPoussees, bilan.depensesPoussees + res.rejets);
    // Si plus rien ne sort du lot (toutes en conflit), on s'arrête : depensesPending
    // ne remonte plus ces lignes.
  }

  // 2. Intervenants créés sur le terrain.
  const intervenants = (await listerIntervenants()).filter((i) => i.sync_state === 'pending');
  if (intervenants.length > 0) {
    const results = await pousserLot({ intervenants: intervenants.map(intervenantWire) });
    const res = await appliquerResultatsReferentiels(results, 'intervenants');
    bilan.intervenantsPousses += res.poussees;
    bilan.fusionnees += res.fusionnees;
    bilan.rejets += res.rejets;
  }

  // 3. Pièces ajoutées au catalogue depuis le terrain.
  const pieces = (await listerPieces()).filter((p) => p.sync_state === 'pending');
  if (pieces.length > 0) {
    const results = await pousserLot({ pieces_rechange: pieces.map(pieceWire) });
    const res = await appliquerResultatsReferentiels(results, 'pieces_rechange');
    bilan.piecesPoussees += res.poussees;
    bilan.fusionnees += res.fusionnees;
    bilan.rejets += res.rejets;
  }

  return bilan;
}
