import { invoke } from '@tauri-apps/api/core';
import type { Bordereau, LigneBordereau, StatutBordereau, TypeFret } from '@/types';

export interface FiltresBordereaux {
  saison_id?: number;
  statut?: StatutBordereau;
}

export interface LigneBordereauInput {
  av_id?: number;
  localite?: string;
  poids_kg: number;
  code?: string;
  observations?: string;
}

export async function listerBordereaux(filtres: FiltresBordereaux = {}): Promise<Bordereau[]> {
  return invoke<Bordereau[]>('lister_bordereaux', {
    saisonId: filtres.saison_id ?? null,
    statut: filtres.statut ?? null,
  });
}

export async function getLignesBordereau(bordereauId: number): Promise<LigneBordereau[]> {
  return invoke<LigneBordereau[]>('get_lignes_bordereau', { bordereauId });
}

export async function creerBordereau(payload: {
  numero: string;
  saison_id: number;
  mission_id?: number;
  camion_id: number;
  chauffeur_id?: number;
  usine_id?: number;
  cgi_id?: number;
  date_bordereau: string;
  distance_km?: number;
  type_fret?: TypeFret;
  observations?: string;
  lignes: LigneBordereauInput[];
}): Promise<Bordereau> {
  return invoke<Bordereau>('creer_bordereau', { payload });
}

export async function modifierBordereau(
  id: number,
  payload: {
    numero: string;
    mission_id?: number;
    camion_id: number;
    chauffeur_id?: number;
    usine_id?: number;
    cgi_id?: number;
    date_bordereau: string;
    distance_km?: number;
    type_fret?: TypeFret;
    observations?: string;
    lignes: LigneBordereauInput[];
  },
): Promise<Bordereau> {
  return invoke<Bordereau>('modifier_bordereau', { id, payload });
}

export async function validerBordereau(id: number): Promise<Bordereau> {
  return invoke<Bordereau>('valider_bordereau', { id });
}

export async function devaliderBordereau(id: number): Promise<Bordereau> {
  return invoke<Bordereau>('devalider_bordereau', { id });
}
