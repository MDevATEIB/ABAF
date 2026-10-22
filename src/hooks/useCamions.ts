import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listerCamions, creerCamion, modifierCamion, desactiverCamion } from '@/services/camion';

export function useCamions() {
  return useQuery({ queryKey: ['camions'], queryFn: listerCamions });
}

export function useCreerCamion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creerCamion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['camions'] }),
  });
}

export function useModifierCamion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof modifierCamion>[1] }) =>
      modifierCamion(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['camions'] }),
  });
}

export function useDesactiverCamion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: desactiverCamion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['camions'] }),
  });
}
