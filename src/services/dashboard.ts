import { invoke } from '@tauri-apps/api/core';
import type { DashboardStats } from '@/types';

/**
 * Indicateurs du tableau de bord (AGENT.md §17) : opérations, transport,
 * gasoil et finances de la campagne, camions actifs du parc et comparaison
 * des campagnes pour les graphiques. Sans campagne précisée, la campagne
 * ouverte est utilisée.
 */
export async function getDashboardStats(saisonId?: number): Promise<DashboardStats> {
  return invoke<DashboardStats>('get_dashboard_stats', { saisonId: saisonId ?? null });
}
