import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listerChauffeurs,
  creerChauffeur,
  modifierChauffeur,
  desactiverChauffeur,
} from '@/services/chauffeur';

export function useChauffeurs() {
  return useQuery({ queryKey: ['chauffeurs'], queryFn: listerChauffeurs });
}

export function useCreerChauffeur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creerChauffeur,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chauffeurs'] }),
  });
}

export function useModifierChauffeur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Parameters<typeof modifierChauffeur>[1];
    }) => modifierChauffeur(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chauffeurs'] }),
  });
}

export function useDesactiverChauffeur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: desactiverChauffeur,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chauffeurs'] }),
  });
}
