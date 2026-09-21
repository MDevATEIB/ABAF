import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listerUsines, creerUsine, modifierUsine } from '@/services/usine';

export function useUsines() {
  return useQuery({ queryKey: ['usines'], queryFn: listerUsines });
}

export function useCreerUsine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creerUsine,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usines'] }),
  });
}

export function useModifierUsine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof modifierUsine>[1] }) =>
      modifierUsine(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usines'] }),
  });
}
