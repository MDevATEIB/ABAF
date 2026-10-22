import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  creerAvance,
  enregistrerUtilisationAvance,
  getUtilisationsAvance,
  listerAvances,
} from '@/services/avance';

/** Liste des avances, filtrable par campagne. */
export function useAvances(saisonId?: number) {
  return useQuery({
    queryKey: ['avances', saisonId ?? null],
    queryFn: () => listerAvances(saisonId),
  });
}

/** Utilisations d'une avance (chargées à la demande pour la consultation). */
export function useUtilisationsAvance(avanceId?: number) {
  return useQuery({
    queryKey: ['avances', 'utilisations', avanceId ?? null],
    queryFn: () => getUtilisationsAvance(avanceId as number),
    enabled: !!avanceId,
  });
}

export function useCreerAvance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: creerAvance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avances'] });
    },
  });
}

export function useEnregistrerUtilisationAvance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: enregistrerUtilisationAvance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avances'] });
    },
  });
}
