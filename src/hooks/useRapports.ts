import { useMutation, useQuery } from '@tanstack/react-query';
import {
  exporterRapportExcel,
  genererRapportAnnuel,
  genererRecapitulatif,
  sauvegarderRapportPdf,
} from '@/services/rapport';
import type { RapportAnnuel } from '@/types';

/**
 * Récapitulatif des mouvements d'une campagne (page Rapports › Récapitulatif).
 * Sans campagne précisée, la campagne ouverte est utilisée.
 */
export function useRecapitulatif(saisonId?: number) {
  return useQuery({
    queryKey: ['rapports', 'recap', saisonId ?? null],
    queryFn: () => genererRecapitulatif(saisonId),
  });
}

/**
 * Rapport annuel d'une campagne (page Rapports › Rapport Annuel).
 */
export function useRapportAnnuel(saisonId?: number) {
  return useQuery({
    queryKey: ['rapports', 'annuel', saisonId ?? null],
    queryFn: () => genererRapportAnnuel(saisonId),
  });
}

/**
 * Export Excel du rapport annuel (page Rapports › Export Excel).
 * Retourne le chemin complet du fichier généré.
 */
export function useExporterRapportExcel() {
  return useMutation({
    mutationFn: ({ saisonId, dossier }: { saisonId?: number; dossier?: string }) =>
      exporterRapportExcel(saisonId, dossier),
  });
}

/**
 * Export PDF du rapport annuel (page Rapports › Export PDF) : le document est
 * généré dans l'interface (jsPDF, chargé à la demande) puis écrit sur disque
 * par le backend. Retourne le chemin complet du fichier généré.
 */
export function useExporterRapportPdf() {
  return useMutation({
    mutationFn: async ({ rapport, dossier }: { rapport: RapportAnnuel; dossier?: string }) => {
      const { genererRapportPdf } = await import('@/templates/rapportAnnuelPdf');
      const document = genererRapportPdf(rapport);
      const buffer = document.output('arraybuffer') as ArrayBuffer;
      return sauvegarderRapportPdf(
        rapport.saison_libelle,
        Array.from(new Uint8Array(buffer)),
        dossier,
      );
    },
  });
}
