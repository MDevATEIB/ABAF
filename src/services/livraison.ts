import { invoke } from '@tauri-apps/api/core';
import type { SyntheseLivraisons } from '@/types';

/**
 * Synthèse en lecture seule des livraisons (bordereaux validés ou facturés).
 * La livraison s'appuie sur les bordereaux : aucune saisie propre.
 */
export async function getSyntheseLivraisons(saisonId?: number): Promise<SyntheseLivraisons> {
  return invoke<SyntheseLivraisons>('get_synthese_livraisons', {
    saisonId: saisonId ?? null,
  });
}
