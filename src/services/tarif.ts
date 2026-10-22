import { invoke } from '@tauri-apps/api/core';
import type { Tarif, TypeFret, UniteTarif } from '@/types';

/** Tranche du barème d'une campagne (CDC v1.1). */
export interface PayloadTarif {
  type_fret: TypeFret;
  unite_tarif: UniteTarif;
  distance_min: number;
  /** Distance de fin de tranche ; null = tranche ouverte (« X km et plus »). */
  distance_max: number | null;
  tarif: number;
}

export async function listerTarifs(saison_id: number): Promise<Tarif[]> {
  return invoke<Tarif[]>('lister_tarifs', { saisonId: saison_id });
}

export async function creerTarif(payload: PayloadTarif & { saison_id: number }): Promise<Tarif> {
  return invoke<Tarif>('creer_tarif', { payload });
}

export async function modifierTarif(id: number, payload: PayloadTarif): Promise<Tarif> {
  return invoke<Tarif>('modifier_tarif', { id, payload });
}

export async function supprimerTarif(id: number): Promise<void> {
  return invoke<void>('supprimer_tarif', { id });
}
