import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPeseesMission, creerPesee, supprimerPesee } from '@/services/pesee';

export function usePeseesMission(missionId?: number) {
  return useQuery({
    queryKey: ['pesees', 'mission', missionId ?? null],
    queryFn: () => getPeseesMission(missionId as number),
    enabled: !!missionId,
  });
}

export function useCreerPesee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creerPesee,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pesees'] });
      // Le statut de la mission peut avancer automatiquement après une pesée
      qc.invalidateQueries({ queryKey: ['missions'] });
    },
  });
}

export function useSupprimerPesee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: supprimerPesee,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pesees'] }),
  });
}
