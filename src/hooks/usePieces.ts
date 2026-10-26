import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  creerPiece,
  desactiverPiece,
  listerPieces,
  modifierPiece,
} from '@/services/piece';
import type { FiltresPieces } from '@/services/piece';

export function usePieces(filtres: FiltresPieces = {}) {
  return useQuery({
    queryKey: ['pieces', filtres],
    queryFn: () => listerPieces(filtres),
  });
}

export function useCreerPiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creerPiece,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pieces'] }),
  });
}

export function useModifierPiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof modifierPiece>[1] }) =>
      modifierPiece(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pieces'] }),
  });
}

export function useDesactiverPiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: desactiverPiece,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pieces'] }),
  });
}
