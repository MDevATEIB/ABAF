import { useQuery } from '@tanstack/react-query';
import { listerClients } from '@/services/client';

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: listerClients,
  });
}
