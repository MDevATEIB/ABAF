import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listerPaiements, creerPaiement, modifierPaiement } from '@/services/paiement';
import type { StatutPaiement } from '@/types';

export function usePaiements(saisonId?: number, statut?: StatutPaiement) {
  return useQuery({
    queryKey: ['paiements', saisonId ?? null, statut ?? null],
    queryFn: () => listerPaiements({ saison_id: saisonId, statut }),
  });
}

export function useCreerPaiement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creerPaiement,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paiements'] });
      // Quand la facture est soldée, elle passe à « payée » et les missions à « payé »
      qc.invalidateQueries({ queryKey: ['factures'] });
      qc.invalidateQueries({ queryKey: ['missions'] });
    },
  });
}

export function useModifierPaiement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof modifierPaiement>[1] }) =>
      modifierPaiement(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paiements'] });
      qc.invalidateQueries({ queryKey: ['factures'] });
      qc.invalidateQueries({ queryKey: ['missions'] });
    },
  });
}
