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
  /** Distance de cette livraison ligne par ligne (par AV). */
  distance_km?: number;
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
  /** Numéro du bordereau. Optionnel : si absent/vide, le backend attribue
   *  une valeur séquentielle par année (format `2026-0138`). */
  numero?: string | null;
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
  /** Section Gasoil (BSM) optionnelle. Si quantite_litres_gasoil > 0,
   *  un BSM est auto-généré côté backend et lié via `bordereaux.bsm_id`. */
  quantite_litres_gasoil?: number | null;
  prix_litre_gasoil?: number | null;
  beneficiaire_gasoil?: string | null;
  imputation_gasoil?: string | null;
  reference_gasoil?: string | null;
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
    /** Section Gasoil (BSM) optionnelle (idem création). */
    quantite_litres_gasoil?: number | null;
    prix_litre_gasoil?: number | null;
    beneficiaire_gasoil?: string | null;
    imputation_gasoil?: string | null;
    reference_gasoil?: string | null;
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
