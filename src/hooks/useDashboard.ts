import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from '@/services/dashboard';

/**
 * Indicateurs et graphiques du tableau de bord (page Tableau de bord).
 * Sans campagne précisée, la campagne ouverte est utilisée.
 */
export function useDashboardStats(saisonId?: number) {
  return useQuery({
    queryKey: ['dashboard', 'stats', saisonId ?? null],
    queryFn: () => getDashboardStats(saisonId),
  });
}
