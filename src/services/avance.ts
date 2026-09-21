import { invoke } from '@tauri-apps/api/core';
import type { Avance, UtilisationAvance } from '@/types';

export interface CreerAvanceInput {
  saison_id: number;
  date_avance: string;
  montant_initial: number;
  reference?: string;
  observations?: string;
}

export interface UtilisationAvanceInput {
  avance_id: number;
  facture_id?: number;
  date_utilisation: string;
  montant: number;
  observations?: string;
}

/** Liste les avances, éventuellement filtrées par campagne. */
export async function listerAvances(saisonId?: number): Promise<Avance[]> {
  return invoke<Avance[]>('lister_avances', { saisonId: saisonId ?? null });
}

/** Détail des utilisations d'une avance. */
export async function getUtilisationsAvance(avanceId: number): Promise<UtilisationAvance[]> {
  return invoke<UtilisationAvance[]>('get_utilisations_avance', { avanceId });
}

/** Crée une avance de campagne (fonds avancés par le client). */
export async function creerAvance(payload: CreerAvanceInput): Promise<Avance> {
  return invoke<Avance>('creer_avance', { payload });
}

/** Enregistre l'utilisation d'une avance (facture facultative). */
export async function enregistrerUtilisationAvance(
  payload: UtilisationAvanceInput,
): Promise<UtilisationAvance> {
  return invoke<UtilisationAvance>('enregistrer_utilisation_avance', { payload });
}
