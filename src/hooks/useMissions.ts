import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listerMissions, creerMission, modifierMission, changerStatutMission,
} from '@/services/mission';
import type { StatutMission } from '@/types';

export function useMissions(saisonId?: number, statut?: StatutMission) {
  return useQuery({
    queryKey: ['missions', saisonId ?? null, statut ?? null],
    queryFn: () => listerMissions({ saison_id: saisonId, statut }),
  });
}

export function useCreerMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creerMission,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['missions'] }),
  });
}

export function useModifierMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof modifierMission>[1] }) =>
      modifierMission(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['missions'] }),
  });
}

export function useChangerStatutMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, statut }: { id: number; statut: StatutMission }) =>
      changerStatutMission(id, statut),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['missions'] }),
  });
}
