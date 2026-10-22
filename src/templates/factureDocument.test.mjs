import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLignesFactureTableData } from './factureDocument.helpers.js';

test('buildLignesFactureTableData expose bien les poids et distances de chaque bordereau', () => {
  const bordereaux = new Map([
    [101, { numero: 'B-101' }],
    [102, { numero: 'B-102' }],
  ]);

  const lignes = [
    {
      id: 1,
      bordereau_id: 101,
      poids_net_kg: 4200,
      distance_km: 72,
      tarif_tonne: 14500,
      montant_brut: 60900,
      montant_net: 60900,
    },
    {
      id: 2,
      bordereau_id: 102,
      poids_net_kg: 2800,
      distance_km: 48,
      tarif_tonne: 13000,
      montant_brut: 36400,
      montant_net: 36400,
    },
  ];

  const result = buildLignesFactureTableData(lignes, bordereaux);

  assert.deepEqual(result, [
    {
      numeroBordereau: 'B-101',
      cotonGraineKg: 4200,
      distanceKm: 72,
      tarifTonne: 14500,
      montantBrut: 60900,
      montantNet: 60900,
    },
    {
      numeroBordereau: 'B-102',
      cotonGraineKg: 2800,
      distanceKm: 48,
      tarifTonne: 13000,
      montantBrut: 36400,
      montantNet: 36400,
    },
  ]);
});
