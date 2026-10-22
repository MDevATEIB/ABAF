import { invoke } from '@tauri-apps/api/core';
import type { Saison } from '@/types';

export async function listerSaisons(): Promise<Saison[]> {
  return invoke<Saison[]>('lister_saisons');
}

export async function creerSaison(payload: {
  libelle: string;
  date_debut: string;
  date_fin?: string;
}): Promise<Saison> {
  return invoke<Saison>('creer_saison', { payload });
}

export async function modifierSaison(
  id: number,
  payload: { libelle?: string; date_debut?: string; date_fin?: string },
): Promise<Saison> {
  return invoke<Saison>('modifier_saison', { id, payload });
}

export async function cloturerSaison(id: number): Promise<Saison> {
  return invoke<Saison>('cloturer_saison', { id });
}
