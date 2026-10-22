import { invoke } from '@tauri-apps/api/core';
import type { PrixGasoil } from '@/types';

export async function getPrixGasoil(saison_id: number): Promise<PrixGasoil | null> {
  return invoke<PrixGasoil | null>('get_prix_gasoil', { saisonId: saison_id });
}

export async function setPrixGasoil(payload: {
  saison_id: number;
  prix_litre: number;
}): Promise<PrixGasoil> {
  return invoke<PrixGasoil>('set_prix_gasoil', { payload });
}
