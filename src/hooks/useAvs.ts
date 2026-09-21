import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listerAvs, creerAv, modifierAv } from '@/services/av';

export function useAvs(cgi_id?: number) {
  return useQuery({
    queryKey: ['avs', cgi_id ?? 'all'],
    queryFn: () => listerAvs(cgi_id),
  });
}

export function useCreerAv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creerAv,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avs'] }),
  });
}

export function useModifierAv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof modifierAv>[1] }) =>
      modifierAv(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avs'] }),
  });
}
