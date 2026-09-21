import { invoke } from '@tauri-apps/api/core';
import type { Chauffeur } from '@/types';

export async function listerChauffeurs(): Promise<Chauffeur[]> {
  return invoke<Chauffeur[]>('lister_chauffeurs');
}

export async function creerChauffeur(payload: {
  nom: string;
  prenom?: string;
  telephone?: string;
}): Promise<Chauffeur> {
  return invoke<Chauffeur>('creer_chauffeur', { payload });
}

export async function modifierChauffeur(
  id: number,
  payload: { nom?: string; prenom?: string; telephone?: string },
): Promise<Chauffeur> {
  return invoke<Chauffeur>('modifier_chauffeur', { id, payload });
}

export async function desactiverChauffeur(id: number): Promise<Chauffeur> {
  return invoke<Chauffeur>('desactiver_chauffeur', { id });
}
