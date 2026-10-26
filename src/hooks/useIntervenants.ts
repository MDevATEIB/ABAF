import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  creerIntervenant,
  desactiverIntervenant,
  listerIntervenants,
  modifierIntervenant,
} from '@/services/intervenant';
import type { FiltresIntervenants } from '@/services/intervenant';

export function useIntervenants(filtres: FiltresIntervenants = {}) {
  return useQuery({
    queryKey: ['intervenants', filtres],
    queryFn: () => listerIntervenants(filtres),
  });
}

export function useCreerIntervenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creerIntervenant,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intervenants'] }),
  });
}

export function useModifierIntervenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof modifierIntervenant>[1] }) =>
      modifierIntervenant(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intervenants'] }),
  });
}

export function useDesactiverIntervenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: desactiverIntervenant,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intervenants'] }),
  });
}
