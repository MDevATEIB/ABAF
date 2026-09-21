import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listerBsm, creerBsm, modifierBsm, changerStatutBsm,
} from '@/services/bsm';
import type { StatutBSM } from '@/types';

export function useBsms(saisonId?: number, statut?: StatutBSM) {
  return useQuery({
    queryKey: ['bsm', saisonId ?? null, statut ?? null],
    queryFn: () => listerBsm({ saison_id: saisonId, statut }),
  });
}

export function useCreerBsm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creerBsm,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bsm'] });
      // Le statut de la mission peut avancer automatiquement après un BSM
      qc.invalidateQueries({ queryKey: ['missions'] });
    },
  });
}

export function useModifierBsm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof modifierBsm>[1] }) =>
      modifierBsm(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bsm'] }),
  });
}

export function useChangerStatutBsm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, statut }: { id: number; statut: StatutBSM }) =>
      changerStatutBsm(id, statut),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bsm'] }),
  });
}
