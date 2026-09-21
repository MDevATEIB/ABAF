import { invoke } from '@tauri-apps/api/core';
import type { Mission, StatutMission } from '@/types';

export interface FiltresMissions {
  saison_id?: number;
  statut?: StatutMission;
}

export async function listerMissions(filtres: FiltresMissions = {}): Promise<Mission[]> {
  return invoke<Mission[]>('lister_missions', {
    saisonId: filtres.saison_id ?? null,
    statut: filtres.statut ?? null,
  });
}

export async function creerMission(payload: {
  saison_id: number;
  camion_id: number;
  chauffeur_id?: number;
  usine_id?: number;
  cgi_id?: number;
  av_id?: number;
  date_mission: string;
  observations?: string;
}): Promise<Mission> {
  return invoke<Mission>('creer_mission', { payload });
}

export async function modifierMission(
  id: number,
  payload: {
    camion_id: number;
    chauffeur_id?: number;
    usine_id?: number;
    cgi_id?: number;
    av_id?: number;
    date_mission: string;
    observations?: string;
  },
): Promise<Mission> {
  return invoke<Mission>('modifier_mission', { id, payload });
}

export async function changerStatutMission(id: number, statut: StatutMission): Promise<Mission> {
  return invoke<Mission>('changer_statut_mission', { id, nouveauStatut: statut });
}
