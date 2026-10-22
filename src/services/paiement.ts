import { invoke } from '@tauri-apps/api/core';
import type { Paiement, StatutPaiement } from '@/types';

export interface FiltresPaiements {
  saison_id?: number;
  statut?: StatutPaiement;
}

export interface CreerPaiementInput {
  facture_id: number;
  date_paiement: string;
  montant: number;
  mode_paiement?: string;
  reference?: string;
  statut: StatutPaiement;
  observations?: string;
}

export async function listerPaiements(filtres: FiltresPaiements = {}): Promise<Paiement[]> {
  return invoke<Paiement[]>('lister_paiements', {
    saisonId: filtres.saison_id ?? null,
    statut: filtres.statut ?? null,
  });
}

export async function creerPaiement(payload: CreerPaiementInput): Promise<Paiement> {
  return invoke<Paiement>('creer_paiement', { payload });
}

export async function modifierPaiement(
  id: number,
  payload: Omit<CreerPaiementInput, 'facture_id'>,
): Promise<Paiement> {
  return invoke<Paiement>('modifier_paiement', { id, payload });
}
