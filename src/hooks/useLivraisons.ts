import { useQuery } from '@tanstack/react-query';
import { getSyntheseLivraisons } from '@/services/livraison';

export function useSyntheseLivraisons(saisonId?: number) {
  return useQuery({
    queryKey: ['livraisons', 'synthese', saisonId ?? null],
    queryFn: () => getSyntheseLivraisons(saisonId),
  });
}
