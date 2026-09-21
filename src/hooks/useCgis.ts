import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listerCgis, creerCgi, modifierCgi } from '@/services/cgi';

export function useCgis(usine_id?: number) {
  return useQuery({
    queryKey: ['cgis', usine_id ?? 'all'],
    queryFn: () => listerCgis(usine_id),
  });
}

export function useCreerCgi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creerCgi,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cgis'] }),
  });
}

export function useModifierCgi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof modifierCgi>[1] }) =>
      modifierCgi(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cgis'] }),
  });
}
