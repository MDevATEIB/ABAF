import type { LigneFacture } from '@/types';

export interface FactureTableData {
  numeroBordereau: string;
  cotonGraineKg: number;
  distanceKm: number;
  tarifTonne: number;
  montantBrut: number;
  montantNet: number;
}

export function buildLignesFactureTableData(
  lignes: LigneFacture[],
  bordereauParId?: Map<number, { numero?: string }>,
): FactureTableData[];
