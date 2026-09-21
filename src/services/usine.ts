import { invoke } from '@tauri-apps/api/core';
import type { Usine } from '@/types';

export async function listerUsines(): Promise<Usine[]> {
  return invoke<Usine[]>('lister_usines');
}

export async function creerUsine(payload: {
  nom: string;
  localite?: string;
}): Promise<Usine> {
  return invoke<Usine>('creer_usine', { payload });
}

export async function modifierUsine(
  id: number,
  payload: { nom?: string; localite?: string },
): Promise<Usine> {
  return invoke<Usine>('modifier_usine', { id, payload });
}
