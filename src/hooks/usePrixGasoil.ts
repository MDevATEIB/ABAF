import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPrixGasoil, setPrixGasoil } from '@/services/prixGasoil';

export function usePrixGasoil(saison_id: number | undefined) {
  return useQuery({
    queryKey: ['prix_gasoil', saison_id],
    queryFn: () => getPrixGasoil(saison_id!),
    enabled: !!saison_id,
  });
}

export function useSetPrixGasoil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setPrixGasoil,
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: ['prix_gasoil', variables.saison_id] }),
  });
}
