import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getParametres, setParametres } from '@/services/parametre';

export function useParametres() {
  return useQuery({
    queryKey: ['parametres'],
    queryFn: getParametres,
  });
}

export function useSetParametres() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setParametres,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parametres'] }),
  });
}
