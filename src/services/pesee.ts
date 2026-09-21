import { invoke } from '@tauri-apps/api/core';
import type { Pesee, TypePesee } from '@/types';

export async function getPeseesMission(missionId: number): Promise<Pesee[]> {
  return invoke<Pesee[]>('get_pesees_mission', { missionId });
}

export async function creerPesee(payload: {
  mission_id: number;
  type_pesee: TypePesee;
  poids_kg: number;
  date_pesee: string;
  heure_pesee?: string;
  ticket_pesee?: string;
}): Promise<Pesee> {
  return invoke<Pesee>('creer_pesee', { payload });
}

export async function supprimerPesee(id: number): Promise<void> {
  return invoke('supprimer_pesee', { id });
}
