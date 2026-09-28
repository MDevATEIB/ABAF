import { invoke } from '@tauri-apps/api/core';
import type { BSM, StatutBSM } from '@/types';

export interface FiltresBsm {
  saison_id?: number;
  statut?: StatutBSM;
}

export async function listerBsm(filtres: FiltresBsm = {}): Promise<BSM[]> {
  return invoke<BSM[]>('lister_bsm', {
    saisonId: filtres.saison_id ?? null,
    statut: filtres.statut ?? null,
  });
}

export async function creerBsm(payload: {
  /** Numéro du BSM. Optionnel : si absent/vide, le backend attribue une
   *  valeur séquentielle par année (format `2026-0138`). */
  numero?: string | null;
  saison_id: number;
  mission_id?: number;
  camion_id: number;
  usine_id?: number;
  date_bsm: string;
  beneficiaire?: string;
  quantite_litres: number;
  prix_litre: number;
  imputation?: string;
  reference?: string;
}): Promise<BSM> {
  return invoke<BSM>('creer_bsm', { payload });
}

export async function modifierBsm(
  id: number,
  payload: {
    numero: string;
    mission_id?: number;
    camion_id: number;
    usine_id?: number;
    date_bsm: string;
    beneficiaire?: string;
    quantite_litres: number;
    prix_litre: number;
    imputation?: string;
    reference?: string;
  },
): Promise<BSM> {
  return invoke<BSM>('modifier_bsm', { id, payload });
}

export async function changerStatutBsm(id: number, statut: StatutBSM): Promise<BSM> {
  return invoke<BSM>('changer_statut_bsm', { id, nouveauStatut: statut });
}
