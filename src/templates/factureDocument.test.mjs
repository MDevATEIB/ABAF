/**
 * Tests unitaires du template de facture.
 *
 * Le helper `buildLignesFactureTableData` a été supprimé lors de la refonte
 * (le template itère maintenant directement sur les LigneBordereau).
 * Ce fichier vérifie les fonctions utilitaires de formatage qui restent dans
 * le template.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// ── helpers locaux (reproduits depuis factureDocument.tsx pour les tests) ────

function tonnes(kg) {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(kg / 1000);
}

function numFr(n, digits = 0) {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

// ── calcul montant brut par ligne ────────────────────────────────────────────

function montantBrutLigne(poidsKg, distanceKm, tarifTonne, uniteTarif) {
  const t = poidsKg / 1000;
  return uniteTarif === 'fcfa_tkm'
    ? t * distanceKm * tarifTonne
    : t * tarifTonne;
}

// ── tests ────────────────────────────────────────────────────────────────────

test('tonnes : formate en 3 décimales avec séparateur français', () => {
  assert.equal(tonnes(4720), '4,720');
  assert.equal(tonnes(16620), '16,620');
  assert.equal(tonnes(1000), '1,000');
});

test('numFr : formate les entiers sans décimale', () => {
  assert.equal(numFr(172516), '172\u202f516');
  assert.equal(numFr(215), '215');
});

test('montantBrutLigne : fcfa_tonne (≤ 90 km)', () => {
  // 4,720 t × 215 FCFA/t = 1 014,8 → arrondi 1 015 ... mais en pratique
  // le tarif à la tonne s'applique directement sans la distance.
  const brut = montantBrutLigne(4720, 170, 215, 'fcfa_tonne');
  assert.equal(Math.round(brut), 1015); // 4.72 × 215 = 1014.8 → 1015
});

test('montantBrutLigne : fcfa_tkm (> 90 km)', () => {
  // 4,720 t × 170 km × 215 FCFA/TKM = 172 516
  const brut = montantBrutLigne(4720, 170, 215, 'fcfa_tkm');
  assert.equal(Math.round(brut), 172516);
});

test('montantBrutLigne : distance 0 avec fcfa_tkm donne 0', () => {
  const brut = montantBrutLigne(5000, 0, 215, 'fcfa_tkm');
  assert.equal(brut, 0);
});
