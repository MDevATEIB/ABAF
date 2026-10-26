import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  creerDepense,
  getRapportExploitation,
  getSyntheseExploitation,
  listerDepenses,
  modifierDepense,
  rejeterDepense,
  supprimerDepense,
  validerDepense,
} from '@/services/depense';
import type { DepenseFields, FiltresDepenses } from '@/types';

/** Grille des dépenses : les filtres font partie de la clé de requête. */
export function useDepenses(filtres: FiltresDepenses = {}, tri?: string, ordre?: 'asc' | 'desc') {
  return useQuery({
    queryKey: ['depenses', filtres, tri, ordre],
    queryFn: () => listerDepenses(filtres, tri, ordre),
  });
}

export function useCreerDepense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { saison_id: number } & DepenseFields) => creerDepense(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['depenses'] }),
  });
}

export function useModifierDepense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: DepenseFields }) =>
      modifierDepense(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['depenses'] }),
  });
}

export function useValiderDepense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: validerDepense,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['depenses'] }),
  });
}

export function useRejeterDepense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motif }: { id: number; motif: string }) => rejeterDepense(id, motif),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['depenses'] }),
  });
}

export function useSupprimerDepense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: supprimerDepense,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['depenses'] }),
  });
}

/** Charges de la campagne pour les cartes du tableau de bord. */
export function useSyntheseExploitation(saisonId?: number) {
  return useQuery({
    queryKey: ['exploitation', 'synthese', saisonId ?? null],
    queryFn: () => getSyntheseExploitation(saisonId),
  });
}

/** État d'exploitation complet : écran Rentabilité et page Rapport. */
export function useRapportExploitation(saisonId?: number) {
  return useQuery({
    queryKey: ['exploitation', 'rapport', saisonId ?? null],
    queryFn: () => getRapportExploitation(saisonId),
  });
}
