import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurerBase, sauvegarderBase } from '@/services/sauvegarde';

/**
 * Sauvegarde manuelle de la base (page Paramètres, AGENT.md §24.3).
 * Retourne le chemin complet du fichier créé.
 */
export function useSauvegarderBase() {
  return useMutation({
    mutationFn: () => sauvegarderBase(),
  });
}

/**
 * Restauration de la base depuis une sauvegarde (page Paramètres, AGENT.md
 * §24.3). Toutes les données en cache sont invalidées après succès ; le
 * retour est le chemin de la copie de sécurité créée avant remplacement.
 */
export function useRestaurerBase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (chemin: string) => restaurerBase(chemin),
    onSuccess: () => qc.invalidateQueries(),
  });
}
