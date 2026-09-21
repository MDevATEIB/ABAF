import { invoke } from '@tauri-apps/api/core';
import type { RapportAnnuel, Recapitulatif } from '@/types';

/**
 * Récapitulatif automatique des mouvements d'une campagne (AGENT.md §16).
 * Sans campagne précisée, la campagne ouverte est utilisée.
 */
export async function genererRecapitulatif(saisonId?: number): Promise<Recapitulatif> {
  return invoke<Recapitulatif>('generer_recapitulatif', { saisonId: saisonId ?? null });
}

/**
 * Rapport annuel d'une campagne (AGENT.md §7 et §20.4) : tableau des
 * opérations, totaux, données de gasoil, données BMS, règlements et
 * comparaison avec les campagnes précédentes.
 */
export async function genererRapportAnnuel(saisonId?: number): Promise<RapportAnnuel> {
  return invoke<RapportAnnuel>('generer_rapport_annuel', { saisonId: saisonId ?? null });
}

/**
 * Export Excel du rapport annuel d'une campagne (AGENT.md §20.4) : classeur
 * « Opérations », « Gasoil & BSM », « Règlements » et « Comparaison ».
 * Sans dossier précisé, le fichier est créé dans « Documents/ABAF ».
 * Retourne le chemin complet du fichier généré.
 */
export async function exporterRapportExcel(saisonId?: number, dossier?: string): Promise<string> {
  return invoke<string>('exporter_rapport_excel', {
    saisonId: saisonId ?? null,
    dossier: dossier ?? null,
  });
}

/**
 * Écrit sur disque un PDF du rapport annuel généré dans l'interface (jsPDF).
 * Sans dossier précisé, le fichier est créé dans « Documents/ABAF ».
 * Retourne le chemin complet du fichier généré.
 */
export async function sauvegarderRapportPdf(
  libelleCampagne: string,
  contenu: number[],
  dossier?: string,
): Promise<string> {
  return invoke<string>('sauvegarder_rapport_pdf', {
    dossier: dossier ?? null,
    libelleCampagne,
    contenu,
  });
}
