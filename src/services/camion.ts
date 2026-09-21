import { invoke } from '@tauri-apps/api/core';
import type { Camion } from '@/types';

export async function listerCamions(): Promise<Camion[]> {
  return invoke<Camion[]>('lister_camions');
}

export async function creerCamion(payload: {
  immatriculation: string;
  marque?: string;
  modele?: string;
  capacite_tonnes?: number;
}): Promise<Camion> {
  return invoke<Camion>('creer_camion', { payload });
}

export async function modifierCamion(
  id: number,
  payload: {
    immatriculation?: string;
    marque?: string;
    modele?: string;
    capacite_tonnes?: number;
  },
): Promise<Camion> {
  return invoke<Camion>('modifier_camion', { id, payload });
}

export async function desactiverCamion(id: number): Promise<Camion> {
  return invoke<Camion>('desactiver_camion', { id });
}
