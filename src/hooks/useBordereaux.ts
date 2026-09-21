import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listerBordereaux, getLignesBordereau, creerBordereau, modifierBordereau,
  validerBordereau, devaliderBordereau,
} from '@/services/bordereau';
import type { StatutBordereau } from '@/types';

export function useBordereaux(saisonId?: number, statut?: StatutBordereau) {
  return useQuery({
    queryKey: ['bordereaux', saisonId ?? null, statut ?? null],
    queryFn: () => listerBordereaux({ saison_id: saisonId, statut }),
  });
}

export function useLignesBordereau(bordereauId?: number) {
  return useQuery({
    queryKey: ['bordereaux', 'lignes', bordereauId ?? null],
    queryFn: () => getLignesBordereau(bordereauId as number),
    enabled: !!bordereauId,
  });
}

export function useCreerBordereau() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creerBordereau,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bordereaux'] });
      // Le statut de la mission peut avancer automatiquement après un bordereau
      qc.invalidateQueries({ queryKey: ['missions'] });
    },
  });
}

export function useModifierBordereau() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof modifierBordereau>[1] }) =>
      modifierBordereau(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bordereaux'] }),
  });
}

export function useValiderBordereau() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: validerBordereau,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bordereaux'] });
      // La validation fait avancer le statut de la mission (déchargement)
      qc.invalidateQueries({ queryKey: ['missions'] });
    },
  });
}

export function useDevaliderBordereau() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: devaliderBordereau,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bordereaux'] }),
  });
}
