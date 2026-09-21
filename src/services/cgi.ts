import { invoke } from '@tauri-apps/api/core';
import type { CGI } from '@/types';

export async function listerCgis(usine_id?: number): Promise<CGI[]> {
  return invoke<CGI[]>('lister_cgis', { usineId: usine_id ?? null });
}

export async function creerCgi(payload: {
  nom: string;
  usine_id: number;
  localite?: string;
}): Promise<CGI> {
  return invoke<CGI>('creer_cgi', { payload });
}

export async function modifierCgi(
  id: number,
  payload: { nom?: string; usine_id?: number; localite?: string },
): Promise<CGI> {
  return invoke<CGI>('modifier_cgi', { id, payload });
}
