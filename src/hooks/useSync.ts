import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  annulerCodeAppairage,
  arreterServeurSync,
  configurerPareFeu,
  demarrerServeurSync,
  genererCodeAppairage,
  getEtatSync,
  listerAppareils,
  ouvrirDossierJustificatifs,
  revoquerAppareil,
  supprimerAppareil,
  testerPortDisponible,
} from '@/services/sync';

/**
 * État du serveur de synchronisation. Le rafraîchissement périodique de
 * 10 secondes n'est actif que lorsque le serveur tourne : hors service,
 * la carte Paramètres reste sur la dernière lecture.
 */
export function useEtatSync() {
  return useQuery({
    queryKey: ['sync', 'etat'],
    queryFn: getEtatSync,
    refetchInterval: (query) => (query.state.data?.actif ? 10_000 : false),
  });
}

export function useAppareilsSync() {
  return useQuery({ queryKey: ['sync', 'appareils'], queryFn: listerAppareils });
}

export function useDemarrerServeurSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (port?: number) => demarrerServeurSync(port),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sync', 'etat'] });
      qc.invalidateQueries({ queryKey: ['sync', 'appareils'] });
    },
  });
}

export function useArreterServeurSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: arreterServeurSync,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync', 'etat'] }),
  });
}

export function useGenererCodeAppairage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (appareil?: string) => genererCodeAppairage(appareil),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync', 'etat'] }),
  });
}

export function useAnnulerCodeAppairage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: annulerCodeAppairage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync', 'etat'] }),
  });
}

export function useRevoquerAppareil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revoquerAppareil,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sync', 'appareils'] });
      qc.invalidateQueries({ queryKey: ['sync', 'etat'] });
    },
  });
}

export function useSupprimerAppareil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: supprimerAppareil,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sync', 'appareils'] });
      qc.invalidateQueries({ queryKey: ['sync', 'etat'] });
    },
  });
}

export function useOuvrirDossierJustificatifs() {
  return useMutation({ mutationFn: ouvrirDossierJustificatifs });
}

export function useConfigurerPareFeu() {
  return useMutation({ mutationFn: configurerPareFeu });
}

export function useTesterPortDisponible() {
  return useMutation({ mutationFn: testerPortDisponible });
}
