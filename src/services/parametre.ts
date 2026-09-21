import { invoke } from '@tauri-apps/api/core';
import type { Parametres } from '@/types';

export async function getParametres(): Promise<Parametres> {
  return invoke<Parametres>('get_parametres');
}

export async function setParametres(payload: Parametres): Promise<Parametres> {
  return invoke<Parametres>('set_parametres', { payload });
}
