import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listerSaisons, creerSaison, modifierSaison, cloturerSaison } from '@/services/saison';

export function useSaisons() {
  return useQuery({ queryKey: ['saisons'], queryFn: listerSaisons });
}

export function useCreerSaison() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creerSaison,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saisons'] }),
  });
}

export function useModifierSaison() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof modifierSaison>[1] }) =>
      modifierSaison(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saisons'] }),
  });
}

export function useCloturerSaison() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cloturerSaison,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saisons'] }),
  });
}
