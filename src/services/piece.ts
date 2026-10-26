import { invoke } from '@tauri-apps/api/core';
import type { PieceRechange } from '@/types';

export interface FiltresPieces {
  categorie?: string;
  /** 1 = actives uniquement, 0 = archivées, absent = toutes. */
  actif?: 0 | 1;
  recherche?: string;
}

export async function listerPieces(filtres: FiltresPieces = {}): Promise<PieceRechange[]> {
  return invoke<PieceRechange[]>('lister_pieces', {
    categorie: filtres.categorie ?? null,
    actif: filtres.actif ?? null,
    recherche: filtres.recherche ?? null,
  });
}

export async function creerPiece(payload: {
  nom: string;
  categorie?: string;
  unite?: string;
}): Promise<PieceRechange> {
  return invoke<PieceRechange>('creer_piece', { payload });
}

export async function modifierPiece(
  id: number,
  payload: { nom?: string; categorie?: string; unite?: string },
): Promise<PieceRechange> {
  return invoke<PieceRechange>('modifier_piece', { id, payload });
}

/** Réactive si la pièce est archivée, désactive sinon. */
export async function desactiverPiece(id: number): Promise<PieceRechange> {
  return invoke<PieceRechange>('desactiver_piece', { id });
}
