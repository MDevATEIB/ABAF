import { invoke } from '@tauri-apps/api/core';
import type {
  Facture,
  LigneFacture,
  OperationsDisponiblesFacture,
  StatutFacture,
} from '@/types';

export interface FiltresFactures {
  saison_id?: number;
  statut?: StatutFacture;
}

export interface CreerFactureInput {
  /** Numéro de facture. Optionnel : si absent/vide, le backend attribue
   *  une valeur séquentielle par année (format `2026-0138`). */
  numero?: string | null;
  saison_id: number;
  client_id: number;
  date_facture: string;
  observations?: string;
  /** Mention « ORIGINAL PAYABLE » sur l'exemplaire original (défaut : oui). */
  mention_original_payable?: boolean;
  bordereau_ids: number[];
  bsm_ids: number[];
}

export async function listerFactures(filtres: FiltresFactures = {}): Promise<Facture[]> {
  return invoke<Facture[]>('lister_factures', {
    saisonId: filtres.saison_id ?? null,
    statut: filtres.statut ?? null,
  });
}

export async function getLignesFacture(factureId: number): Promise<LigneFacture[]> {
  return invoke<LigneFacture[]>('get_lignes_facture', { factureId });
}

/** Bordereaux validés et BSM d'une campagne qui ne sont pas encore facturés. */
export async function getOperationsDisponibles(
  saisonId: number,
): Promise<OperationsDisponiblesFacture> {
  return invoke<OperationsDisponiblesFacture>('get_operations_disponibles', { saisonId });
}

export async function creerFacture(payload: CreerFactureInput): Promise<Facture> {
  return invoke<Facture>('creer_facture', { payload });
}

export async function validerFacture(id: number): Promise<Facture> {
  return invoke<Facture>('valider_facture', { id });
}

export async function supprimerFacture(id: number): Promise<void> {
  return invoke<void>('supprimer_facture', { id });
}
