import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listerFactures,
  getLignesFacture,
  getOperationsDisponibles,
  creerFacture,
  validerFacture,
  supprimerFacture,
} from '@/services/facture';
import type { StatutFacture } from '@/types';

export function useFactures(saisonId?: number, statut?: StatutFacture) {
  return useQuery({
    queryKey: ['factures', saisonId ?? null, statut ?? null],
    queryFn: () => listerFactures({ saison_id: saisonId, statut }),
  });
}

export function useLignesFacture(factureId?: number) {
  return useQuery({
    queryKey: ['factures', 'lignes', factureId ?? null],
    queryFn: () => getLignesFacture(factureId as number),
    enabled: !!factureId,
  });
}

export function useOperationsDisponibles(saisonId?: number) {
  return useQuery({
    queryKey: ['factures', 'operations', saisonId ?? null],
    queryFn: () => getOperationsDisponibles(saisonId as number),
    enabled: !!saisonId,
  });
}

export function useCreerFacture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creerFacture,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['factures'] }),
  });
}

export function useValiderFacture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: validerFacture,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['factures'] });
      // Les bordereaux, BSM et missions rattachés passent au statut « facturé »
      qc.invalidateQueries({ queryKey: ['bordereaux'] });
      qc.invalidateQueries({ queryKey: ['bsm'] });
      qc.invalidateQueries({ queryKey: ['missions'] });
    },
  });
}

export function useSupprimerFacture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: supprimerFacture,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['factures'] }),
  });
}
