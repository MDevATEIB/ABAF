# Invoice template aligned to physical format

The change rewrites `factureDocument.tsx` to render one table row per `LigneBordereau` (individual weighing) instead of one row per `LigneFacture`. The impression page fires parallel `useQueries` calls to load each bordereau's weighing lines and passes them down as a `Map<number, LigneBordereau[]>`. The helpers file was deleted — its logic absorbed into the template. A fallback path keeps the invoice renderable when no weighing lines are available.

Watch for: **broken test** (confirmed) — `factureDocument.test.mjs` imports `buildLignesFactureTableData` from the deleted `factureDocument.helpers.js`, so the test suite will throw a module-not-found error on next run. **Per-row brut computation** uses a 90-km hardcoded boundary to switch between FCFA/tonne and FCFA/TKM formulas, but the actual unit is stored on the `Tarif` record — divergence possible if a tarif is set at a non-90-km boundary (likely for edge cases).

**Verdict**: NEEDS_CHANGES

---

## High-level view

The 12-column header matches the physical spec exactly: `N° Bdrs (rs=2) | Tonnage (cs=3) | Montant Brut (cs=2) | Total (cs=2) | Gazoil (cs=3) | Montant Net (rs=2)`, and the sub-header row provides the correct 10 cells in the correct order. There is a minor typo ("Traif" instead of "Tarif") in the Montant Brut first sub-column.

Per-row `montantBrutLigne` is recomputed from `lb.poids_kg × lf.tarif_tonne` (or `× distanceKm` for >90 km routes). The formula hard-codes 90 km as the flat-rate boundary. The `Tarif` table records `unite_tarif` per row (`fcfa_tonne` vs `fcfa_tkm`), which the template ignores in favour of the distance threshold. For the common COTONTCHAD operational profile (uniform distances per bordereau) this produces correct results; a bordereau straddling the 90-km threshold with a non-standard tarif unit would produce a wrong brut.

The test file `factureDocument.test.mjs` imports `buildLignesFactureTableData` from `factureDocument.helpers.js`, which was deleted as part of this change. That test will fail with a module-not-found error.

The three other templates were not modified.

---

<details>
<summary>Issues (3)</summary>

1. **Broken test after helpers deletion** — `factureDocument.test.mjs` still imports `buildLignesFactureTableData` from the deleted `factureDocument.helpers.js`. The test will throw a module-not-found error on next run. Either delete the test file or rewrite it to cover the current template behaviour.

2. **Header typo "Traif"** — The first sub-column of Montant Brut is labelled "Traif" instead of "Tarif". Non-blocking cosmetically but wrong on every printed invoice.

3. **Hardcoded 90 km tarif-unit boundary** — `montantBrutLigne` switches between `tonnesLb * lf.tarif_tonne` and `tonnesLb * distanceKm * lf.tarif_tonne` based on `distanceKm <= 90`. The canonical unit for a tarif is `lf.unite_tarif` (or the `Tarif` record), not a hardcoded kilometre threshold. For routes that cross the 90-km boundary with a `fcfa_tonne` tarif, or routes under 90 km with a `fcfa_tkm` tarif, the formula applies the wrong multiplier and every affected per-row brut will be wrong.

</details>

---

<details>
<summary>Details</summary>

### Broken test after helpers deletion

`factureDocument.test.mjs` at line 4 imports `buildLignesFactureTableData` from `./factureDocument.helpers.js`. That file was deleted as part of this change. Node will throw `ERR_MODULE_NOT_FOUND` before any assertion runs. The test must be updated to match the new architecture: either remove it (the logic it tested no longer exists in isolation) or replace it with a test of the new `FactureDocument` rendering behaviour.

### Hardcoded tarif-unit boundary

```ts
const montantBrutLigne =
  distanceKm <= 90
    ? tonnesLb * lf.tarif_tonne
    : tonnesLb * distanceKm * lf.tarif_tonne;
```

`LigneFacture` has no `unite_tarif` field — the stored `tarif_tonne` value is numeric, but whether it's FCFA/t or FCFA/TKM depends on the `Tarif` record that was applied at invoicing time. The template infers the unit from the 90-km threshold, which is the CDC v1.1 rule. For the current data this is almost certainly fine. The concern is that if a tarif is ever configured at a different boundary, or a bordereau is created with a custom distance that sits just above 90 km with a flat-rate tarif, the per-row brut will be silently wrong while the footer total (read directly from `facture.montant_brut`) remains correct. The visual discrepancy between row totals and the footer total would be the only symptom.

</details>

---

<details>
<summary>File map</summary>

- `src/templates/factureDocument.tsx` — rewritten to iterate LigneBordereau rows, 12-column header, fallback path, tarification pivot table
- `src/templates/factureDocument.helpers.js` — deleted; logic inlined into the template
- `src/pages/impression/facture/index.tsx` — adds `useQueries` for per-bordereau LigneBordereau loading, builds and passes `lignesBordereauParBordereauId` Map
- `src/templates/factureDocument.test.mjs` — NOT updated; still imports deleted `buildLignesFactureTableData`; will break on next test run

Other templates (`bordereauDocument.tsx`, `bsmDocument.tsx`, `releveDocument.tsx`) — not modified.

</details>
