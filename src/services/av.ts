import { invoke } from '@tauri-apps/api/core';
import type { AV } from '@/types';

export async function listerAvs(cgi_id?: number): Promise<AV[]> {
  return invoke<AV[]>('lister_avs', { cgiId: cgi_id ?? null });
}

export async function creerAv(payload: {
  nom: string;
  cgi_id?: number;
  localite?: string;
}): Promise<AV> {
  return invoke<AV>('creer_av', { payload });
}

export async function modifierAv(
  id: number,
  payload: { nom?: string; cgi_id?: number; localite?: string },
): Promise<AV> {
  return invoke<AV>('modifier_av', { id, payload });
}
