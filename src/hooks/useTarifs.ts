import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listerTarifs, creerTarif, modifierTarif, supprimerTarif } from '@/services/tarif';

export function useTarifs(saison_id: number | undefined) {
  return useQuery({
    queryKey: ['tarifs', saison_id],
    queryFn: () => listerTarifs(saison_id!),
    enabled: !!saison_id,
  });
}

export function useCreerTarif() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creerTarif,
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: ['tarifs', variables.saison_id] }),
  });
}

export function useModifierTarif(saison_id: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof modifierTarif>[1] }) =>
      modifierTarif(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tarifs', saison_id] }),
  });
}

export function useSupprimerTarif(saison_id: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: supprimerTarif,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tarifs', saison_id] }),
  });
}
