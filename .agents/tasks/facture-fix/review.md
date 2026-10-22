# Invoice template aligned to physical format

The change rewrites `factureDocument.tsx` to render one table row per `LigneBordereau` (individual weighing) instead of one row per `LigneFacture`. The impression page now fires parallel `useQueries` calls to load each bordereau's weighing lines and passes them down as a `Map<number, LigneBordereau[]>`. The helpers file was deleted — its logic was absorbed into the template itself. A fallback path keeps the invoice renderable if no weighing lines are available.

Watch for: **the sub-header column mapping is off** (confirmed) — the row-2 labels are misaligned with the data cells they sit above, mislabelling data in every printed row. The **per-row `montantBrutLigne`** is recomputed from weighing weights and tarifs rather than stored values, so the row totals can diverge from the authoritative `facture.montant_net` footer when distances vary across weighing lines (confirmed structural gap).

**Verdict**: NEEDS_CHANGES

---

## High-level view

The main table header declares 12 columns via rowspan/colspan, matching the physical format requirement. However the sub-header row (row 2) distributes its labels one position to the right of where the parent header expects them — "Montant Brut" gets labelled "Traif / Coton Graine" instead of "Tarif / Montant Brut CG", and "Total" receives the Montant Brut cells. This is a structural mislabelling that persists across every printed row.

The sub-header mislabelling is confirmed: row 2 assigns 10 cells to the 5 column groups, but the labels don't match the data underneath them — col 6 displays `montantBrutLigne` while its header reads "Coton Graine" (a tonnage label).

Per-row `montantBrutLigne` is recomputed from `lb.poids_kg` and `lf.tarif_tonne`. When `lb.distance_km` is `undefined` — which the type declares as optional — the code falls back to `lf.distance_km`, the per-bordereau aggregate. For a bordereau with weighings at different AV distances this produces incorrect per-row bruts, and the divergence between displayed row values and the authoritative `facture.montant_net` footer will be visible on the printed document.

The data-loading side introduces `useQueries` gated on `lignes.data` availability, building a positionally stable `Map<bordereau_id, LigneBordereau[]>`. The three other templates were not modified.

---

<details>
<summary>Issues (3)</summary>

1. **Sub-header column mislabelling** — The second header row distributes 10 cells across 5 groups, but the column boundaries don't match the parent row's `colspan` declarations. "Traif" lands in the Montant Brut group's first cell, but the parent header labels that group "Montant Brut (colspan=2)", so "Traif" should be the tarif sub-column and "Coton Graine" (the next cell) should be the Montant Brut CG sub-column. Instead the label names in row 2 are shifted: what the code labels "Coton Graine" / "Intrant" under Tonnage is correct, but "Traif" appears as the first sub-column of Montant Brut when it should be "Tarif" (spelling) and the second sub-column should be "Montant CG" (the computed brut), not a repeated "Coton Graine". Concretely: data cell col 6 shows `montantBrutLigne` but is headed "Coton Graine" (a tonnage label). Fix: align row-2 labels with the semantic meaning of each data cell.

2. **Per-row brut divergence from footer total** — `distanceKm` falls back to `lf.distance_km` (the per-bordereau aggregate) when `lb.distance_km` is `undefined`. For a bordereau with weighings at different AV distances, each row's `montantBrutLigne` is computed from the wrong distance, and the sum of displayed per-row values will not match the authoritative `facture.montant_brut` / `facture.montant_net` in the footer. The field is typed optional (`distance_km?: number`), so this is the common case for installations that don't record AV-level distances. Fix: decide and document whether `lf.distance_km` is the canonical distance for all rows of a bordereau, or require `lb.distance_km` to be populated; store distance consistently at the LigneBordereau level.

3. **Gasoil deduction applied only to first row but total Montant Brut spread over all rows** — `totalBrut` and `totalNet` come directly from `facture.montant_brut` / `facture.montant_net` (the DB-stored totals), while the per-row `montantBrutLigne` values are recomputed from weighing weights and tarifs. If the sum of recomputed per-row brut values does not equal `facture.montant_brut` (due to rounding or the distance-fallback issue above), the footer total will disagree with the sum of the displayed rows. No reconciliation or assertion exists. This is worth validating with a real multi-line bordereau before shipping.

</details>

---

<details>
<summary>Details</summary>

### Sub-header row column mislabelling

The parent header row establishes these groups and widths:

```
| N° Bdrs (rs=2) | Tonnage (cs=3) | Montant Brut (cs=2) | Total (cs=2) | Gazoil (cs=3) | Montant Net (rs=2) |
```

Row 2 must provide exactly 10 cells: 3 under Tonnage, 2 under Montant Brut, 2 under Total, 3 under Gazoil. The template provides:

```tsx
// Row 2 cells in order:
"Coton Graine" | "Intrant" | "Dist"   ← correct, these are Tonnage sub-cols
"Traif"        | "Coton Graine"        ← Montant Brut sub-cols — labels wrong
"Intrant"      | "Total"               ← Total sub-cols — "Intrant" label wrong
"Qte"          | "P.U"    | "Montant"  ← Gazoil sub-cols — correct
```

The data row maps col 5 = `tarif_tonne`, col 6 = `montantBrutLigne`, col 7 = intrant amount (0), col 8 = 0. So:
- Col 5 is headed "Traif" (typo aside, this is correct — it is the tarif)
- Col 6 is headed "Coton Graine" but displays `montantBrutLigne` — mislabelled (should be "Montant" or "Mt CG")
- Col 7 is headed "Intrant" under the Total group — this is the intrant *amount*, not a sub-total label

The physical format's second header row likely reads: "CG | Intrant | Dist | Tarif | Mt CG | Mt Intrant | Total | Qte | P.U | Montant". The current code's row-2 labels don't match that.

### Per-row Montant Net and distance fallback

For weighing lines where `lb.distance_km` is `undefined` (the majority if AV-level distances aren't recorded), the code falls back to `lf.distance_km`. That field exists on `LigneFacture` and presumably holds the single distance used when the bordereau was invoiced. For a bordereau with all lines at the same distance, this produces correct per-row brut values. For mixed-distance bordereaux (multiple AV stops) it silently uses the aggregate, inflating or deflating the per-row brut relative to what was actually invoiced. The Montant Net for rows after the first is just `montantBrutLigne` (no deduction), so any inflation in brut flows directly to net.

The total footer sidesteps this entirely — it reads `facture.montant_net` from the DB, which is authoritative. But the per-row display will show values that don't add up to the footer total in the mixed-distance case.


</details>

---

<details>
<summary>File map</summary>

- `src/templates/factureDocument.tsx` — rewritten to iterate LigneBordereau rows, 12-column header, fallback path, tarification pivot table
- `src/templates/factureDocument.helpers.js` — deleted; logic inlined into the template
- `src/pages/impression/facture/index.tsx` — adds `useQueries` for per-bordereau LigneBordereau loading, builds and passes `lignesBordereauParBordereauId` Map

Other templates (`bordereauDocument.tsx`, `bsmDocument.tsx`, `releveDocument.tsx`) — not modified.

</details>
