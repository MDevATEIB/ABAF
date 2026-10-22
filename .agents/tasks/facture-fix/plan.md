# Implementation Plan — Facture template fix

> Objectif : aligner le document imprimé facture avec la version physique scannée.
> Le template actuel affiche une ligne par `LigneFacture` (= par bordereau).
> La version physique montre une ligne par `LigneBordereau` (= par pesée individuelle).

---

## Files involved

| File | Action |
|---|---|
| `src/templates/factureDocument.tsx` | Rewrite the table body + header + tarif section |
| `src/templates/factureDocument.helpers.js` | Replace helper with `groupLignesBordereauParBordereau` |
| `src/pages/impression/facture/index.tsx` | Add `useQueries` to load all `LigneBordereau` sets |
| `src/types/index.ts` | *(read-only — `LigneBordereau` already typed, no change needed)* |

---

## Step-by-step plan

---

- [ ] 1. **Replace `buildLignesFactureTableData` in `factureDocument.helpers.js` with `groupLignesBordereauParBordereau`.**

  The old helper returned flat display rows from `LigneFacture`; the new one just
  groups `LigneBordereau[]` by `bordereau_id` for use in the template loop.
  This is a pure JS file so TypeScript won't complain — but the import in
  `factureDocument.tsx` must also be updated at the same time (see step 3).

  **What to write** — replace the entire file content with:
  ```js
  /**
   * Groupe les LigneBordereau par bordereau_id pour le rendu de la facture.
   * @param {import('@/types').LigneBordereau[]} lignesBordereau
   * @returns {Map<number, import('@/types').LigneBordereau[]>}
   */
  export function groupLignesBordereauParBordereau(lignesBordereau) {
    const map = new Map();
    for (const lb of lignesBordereau) {
      const list = map.get(lb.bordereau_id) ?? [];
      list.push(lb);
      map.set(lb.bordereau_id, list);
    }
    return map;
  }
  ```

  **Files:** `src/templates/factureDocument.helpers.js`

  **Verify:** `cd c:\Dev\ABAF && npm run build -- --noEmit` — no TypeScript errors.

---

- [ ] 2. **Update `FactureDocumentProps` and `FeuilletFactureProps` in `factureDocument.tsx`.**

  Add one new required prop:
  ```ts
  lignesBordereauParBordereauId: Map<number, LigneBordereau[]>;
  ```
  - Add `LigneBordereau` to the import from `@/types` (it is already defined in
    `src/types/index.ts` — no type file change needed).
  - Add the prop to both `FactureDocumentProps` and `FeuilletFactureProps`.
  - Pass it through in `FactureDocument` → `FeuilletFacture` (spread `{...props}` already handles this automatically since `FeuilletFactureProps extends FactureDocumentProps`).

  **Files:** `src/templates/factureDocument.tsx`

  **Verify:** `npm run build -- --noEmit` — TS sees the new prop declared; no errors yet
  (the page hasn't passed it yet, so this step alone will cause a TS error there —
  that's expected and is resolved in step 4).

---

- [ ] 3. **Rewrite the table rendering in `FeuilletFacture` in `factureDocument.tsx`.**

  This is the core change. Replace the entire `<table>` block (header + body + footer)
  and the `lignesTransportAffichage` / `lignesGasoil` logic.

  ### 3a — Remove the old helper import, add the new one
  Change:
  ```ts
  import { buildLignesFactureTableData } from './factureDocument.helpers.js';
  ```
  to:
  ```ts
  import { groupLignesBordereauParBordereau } from './factureDocument.helpers.js';
  ```
  *(The function is unused after this step but the import is replaced inline.)*

  ### 3b — Rewrite local variables at top of `FeuilletFacture`

  Remove `lignesTransportAffichage` and `lignesGasoil` lines.
  Keep `lignesTransport` (filtered `lignes` where `bordereau_id != null`).
  Add:
  ```ts
  // Collect all LigneBordereau across all bordereaux of this facture, flat list
  const toutesLignesBordereau: LigneBordereau[] = lignesTransport.flatMap(
    (lf) => lignesBordereauParBordereauId.get(lf.bordereau_id!) ?? []
  );

  const totalPoidsKg = toutesLignesBordereau.reduce((t, lb) => t + lb.poids_kg, 0);
  ```
  Keep the existing `totalBrut`, `totalGasoil`, `totalNet` (they read from `facture.*`
  which is the authoritative DB value — no change needed).
  Rewrite `totalQteGasoil` to sum only from `lignesTransport` (the BSM linked to each
  LigneFacture), keeping the same logic already present:
  ```ts
  const totalQteGasoil = lignesTransport.reduce((t, l) => {
    const bsm = l.bsm_id != null ? bsmParId.get(l.bsm_id) : undefined;
    return t + (bsm?.quantite_litres ?? 0);
  }, 0);
  ```

  ### 3c — Fix table header colspans

  Current:   `Montant Brut colSpan={3}` + `Total colSpan={1}` → **Wrong**
  Required:  `Montant Brut colSpan={2}` + `Total colSpan={2}`

  Full corrected header (12 columns total):
  ```
  Row 1: N° Bdrs (rowSpan=2) | Tonnage (colSpan=3) | Montant Brut (colSpan=2)
         | Total (colSpan=2) | Gazoil (colSpan=3) | Montant Net (rowSpan=2)
  Row 2: Coton Graine | Intrant | Dist | Traif | Coton Graine | Intrant
         | Total | Qte | P.U | Montant
  ```

  ### 3d — Rewrite `<tbody>` to iterate per LigneBordereau

  Replace the two `{lignesTransport.map(...)}` and `{lignesGasoil.map(...)}` blocks
  with a single loop over `lignesTransport` (outer) and their `LigneBordereau` lines
  (inner).

  Pseudocode (implement literally in TSX):
  ```tsx
  {lignesTransport.map((lf) => {
    const bdr = bordereauParId.get(lf.bordereau_id!);
    const lignesBdr = lignesBordereauParBordereauId.get(lf.bordereau_id!) ?? [];
    const bsmLigne = lf.bsm_id != null ? bsmParId.get(lf.bsm_id) : undefined;

    return lignesBdr.map((lb, idx) => {
      const isFirst = idx === 0;

      // Distance: use lb.distance_km if present, else lf.distance_km
      const distanceKm = lb.distance_km ?? lf.distance_km;

      // Montant brut ligne:
      // if distanceKm <= 90: (lb.poids_kg / 1000) * lf.tarif_tonne
      // if distanceKm > 90:  (lb.poids_kg / 1000) * distanceKm * lf.tarif_tonne
      const tonnesLb = lb.poids_kg / 1000;
      const montantBrutLb =
        distanceKm <= 90
          ? tonnesLb * lf.tarif_tonne
          : tonnesLb * distanceKm * lf.tarif_tonne;

      // Montant Net: first row = montantBrutLb - montantGasoil, subsequent = montantBrutLb
      const montantNetLb = isFirst
        ? montantBrutLb - lf.montant_gasoil
        : montantBrutLb;

      return (
        <tr key={lb.id}>
          {/* N° Bdrs — only on first row */}
          <td className="border border-black px-1 py-1 text-center">
            {isFirst ? (bdr?.numero ?? '—') : ''}
          </td>
          {/* Coton Graine (tonnes) */}
          <td className="border border-black px-1 py-1 text-right">
            {tonnes(lb.poids_kg)}
          </td>
          {/* Intrant */}
          <td className="border border-black px-1 py-1 text-right">&nbsp;</td>
          {/* Distance */}
          <td className="border border-black px-1 py-1 text-right">
            {numFr(distanceKm)}
          </td>
          {/* Tarif */}
          <td className="border border-black px-1 py-1 text-right">
            {numFr(lf.tarif_tonne)}
          </td>
          {/* Montant Brut Coton Graine */}
          <td className="border border-black px-1 py-1 text-right">
            {numFr(montantBrutLb)}
          </td>
          {/* Montant Brut Intrant */}
          <td className="border border-black px-1 py-1 text-right">&nbsp;</td>
          {/* Total */}
          <td className="border border-black px-1 py-1 text-right">&nbsp;</td>
          {/* Gasoil Total col */}
          <td className="border border-black px-1 py-1 text-right font-medium">
            {isFirst ? numFr(montantBrutLb) : numFr(montantBrutLb)}
          </td>
          {/* Gasoil Qte — first row only */}
          <td className="border border-black px-1 py-1 text-right">
            {isFirst && bsmLigne ? numFr(bsmLigne.quantite_litres) : ''}
          </td>
          {/* Gasoil P.U — first row only */}
          <td className="border border-black px-1 py-1 text-right">
            {isFirst && bsmLigne ? numFr(bsmLigne.prix_litre) : ''}
          </td>
          {/* Gasoil Montant — first row only */}
          <td className="border border-black px-1 py-1 text-right">
            {isFirst ? numFr(lf.montant_gasoil) : ''}
          </td>
          {/* Montant Net */}
          <td className="border border-black px-1 py-1 text-right font-medium">
            {numFr(montantNetLb)}
          </td>
        </tr>
      );
    });
  })}
  ```

  ### 3e — Rewrite `<tfoot>` TOTAL row

  The total row uses DB-authoritative totals from `facture.*` plus the computed
  `totalPoidsKg` (sum of `LigneBordereau.poids_kg`) and `totalQteGasoil`:

  ```tsx
  <tr className="bg-neutral-100 font-semibold">
    <td className="border border-black px-1 py-1 text-center">TOTAL</td>
    <td className="border border-black px-1 py-1 text-right">
      {tonnes(totalPoidsKg)}
    </td>
    <td className="border border-black px-1 py-1">&nbsp;</td>
    <td className="border border-black px-1 py-1">&nbsp;</td>
    <td className="border border-black px-1 py-1">&nbsp;</td>
    <td className="border border-black px-1 py-1 text-right">
      {numFr(totalBrut)}
    </td>
    <td className="border border-black px-1 py-1">&nbsp;</td>
    <td className="border border-black px-1 py-1">&nbsp;</td>
    <td className="border border-black px-1 py-1 text-right">
      {numFr(totalBrut)}
    </td>
    <td className="border border-black px-1 py-1 text-right">
      {totalQteGasoil > 0 ? numFr(totalQteGasoil) : ''}
    </td>
    <td className="border border-black px-1 py-1">&nbsp;</td>
    <td className="border border-black px-1 py-1 text-right">
      {totalGasoil > 0 ? `− ${numFr(totalGasoil)}` : ''}
    </td>
    <td className="border border-black px-1 py-1 text-right font-bold">
      {numFr(totalNet)}
    </td>
  </tr>
  ```

  **Files:** `src/templates/factureDocument.tsx`

  **Verify:** `npm run build -- --noEmit` — only error remaining is the missing prop in
  the page (resolved next step).

---

- [ ] 4. **Restructure the tarification section (NB: ARTICLE 9) in `factureDocument.tsx`.**

  Replace the current flat 4-column table (DISTANCE | TYPE DE FRET | TARIF | UNITÉ) with
  a 3-column pivot table: DISTANCE | FRET DIRECT | FRET RETOUR.

  ### Logic
  Group `tarifs` by distance range key = `${distance_min}-${distance_max ?? 'max'}-${unite_tarif}`.
  For each group:
  - `direct` type → FRET DIRECT column
  - `retour` type → FRET RETOUR column
  - `evacuation` type → own row with FRET DIRECT column, FRET RETOUR empty

  ### Distance range label helper (inline in template)
  ```ts
  function labelDistance(t: Tarif): string {
    if (t.distance_max == null) return `SUP à ${t.distance_min}`;
    return `DE ${t.distance_min} à ${t.distance_max}`;
  }
  ```

  ### Tarif value formatter (inline)
  ```ts
  function fmtTarif(t: Tarif): string {
    return numFr(t.tarif, t.tarif % 1 === 0 ? 0 : 1);
  }
  ```

  ### Build grouped rows (in component body, before return)
  ```ts
  type TarifRow = {
    key: string;
    label: string;
    direct?: Tarif;
    retour?: Tarif;
    evacuation?: Tarif;
  };

  const tarifRows: TarifRow[] = [];
  const tarifMap = new Map<string, TarifRow>();
  for (const t of (tarifs ?? [])) {
    if (t.type_fret === 'evacuation' || t.type_fret === 'transfert') {
      tarifRows.push({ key: `evac-${t.id}`, label: 'EVACUATION GRAINE', evacuation: t });
      continue;
    }
    const key = `${t.distance_min}-${t.distance_max ?? 'max'}`;
    if (!tarifMap.has(key)) {
      tarifMap.set(key, { key, label: labelDistance(t) });
      tarifRows.push(tarifMap.get(key)!);
    }
    const row = tarifMap.get(key)!;
    if (t.type_fret === 'direct') row.direct = t;
    else if (t.type_fret === 'retour') row.retour = t;
  }
  ```

  ### New table JSX
  ```tsx
  <table className="mt-1 w-[400px] border-collapse text-[10px]">
    <thead>
      <tr className="bg-neutral-50">
        <th className="border border-black px-1.5 py-1 text-left font-semibold">DISTANCE</th>
        <th className="border border-black px-1.5 py-1 text-center font-semibold">FRET DIRECT</th>
        <th className="border border-black px-1.5 py-1 text-center font-semibold">FRET RETOUR</th>
      </tr>
    </thead>
    <tbody>
      {tarifRows.map((row) => (
        <tr key={row.key}>
          <td className="border border-black px-1.5 py-1">{row.label}</td>
          <td className="border border-black px-1.5 py-1 text-right">
            {row.evacuation
              ? fmtTarif(row.evacuation)
              : row.direct
              ? fmtTarif(row.direct)
              : ''}
          </td>
          <td className="border border-black px-1.5 py-1 text-right">
            {row.retour ? fmtTarif(row.retour) : ''}
          </td>
        </tr>
      ))}
      {tarifRows.length === 0 && (
        <tr>
          <td colSpan={3} className="border border-black px-1.5 py-1 text-center">
            Aucun tarif enregistré pour cette campagne
          </td>
        </tr>
      )}
    </tbody>
  </table>
  ```

  **Files:** `src/templates/factureDocument.tsx`

  **Verify:** `npm run build -- --noEmit` — still only the missing prop error from step 2.

---

- [ ] 5. **Add `useQueries` loading of `LigneBordereau` sets in `impression/facture/index.tsx`.**

  This step resolves the TS error introduced in step 2, wires up the new prop, and
  provides the data the new template needs.

  ### Imports to add
  ```ts
  import { useQueries } from '@tanstack/react-query';
  import { getLignesBordereau } from '@/services/bordereau';
  import type { LigneBordereau } from '@/types';
  ```

  ### Collect unique bordereau_ids (after `lignes` data is available)
  Add after the existing `const lignes = useLignesFacture(facture?.id);` line:
  ```ts
  // Unique bordereau_ids referenced by this facture's LigneFacture rows
  const bordereauIds: number[] = Array.from(
    new Set(
      (lignes.data ?? [])
        .map((l) => l.bordereau_id)
        .filter((id): id is number => id != null)
    )
  );
  ```

  ### Load all LigneBordereau sets in parallel with useQueries
  ```ts
  const lignesBordereauQueries = useQueries({
    queries: bordereauIds.map((bid) => ({
      queryKey: ['bordereaux', 'lignes', bid] as const,
      queryFn: () => getLignesBordereau(bid),
      enabled: !!bid,
    })),
  });
  ```

  ### Build the Map
  ```ts
  const lignesBordereauParBordereauId = new Map<number, LigneBordereau[]>(
    bordereauIds.map((bid, i) => [bid, lignesBordereauQueries[i]?.data ?? []])
  );
  ```

  ### Update loading and error state
  ```ts
  const enChargement =
    factures.isLoading ||
    clients.isLoading ||
    bordereaux.isLoading ||
    bsms.isLoading ||
    camions.isLoading ||
    usines.isLoading ||
    saisons.isLoading ||
    tarifs.isLoading ||
    lignes.isLoading ||
    parametres.isLoading ||
    lignesBordereauQueries.some((q) => q.isLoading);

  const erreur =
    factures.error ??
    clients.error ??
    bordereaux.error ??
    bsms.error ??
    camions.error ??
    usines.error ??
    saisons.error ??
    tarifs.error ??
    lignes.error ??
    parametres.error ??
    lignesBordereauQueries.find((q) => q.error)?.error ?? null;
  ```

  ### Pass the new prop to `FactureDocument`
  Add to the `<FactureDocument ...>` JSX:
  ```tsx
  lignesBordereauParBordereauId={lignesBordereauParBordereauId}
  ```

  **Files:** `src/pages/impression/facture/index.tsx`

  **Verify:** `cd c:\Dev\ABAF && npm run build -- --noEmit`
  Expected outcome: **zero TypeScript errors, build completes successfully.**

---

## Column count audit (sanity check for the implementer)

The new header has exactly 13 `<th>` cells (1 rowspan + 11 in row 2 + 1 rowspan).
The new data rows must also have exactly 13 `<td>` cells.
The TOTAL row must have exactly 13 `<td>` cells.

Count from the header definition:
```
N° Bdrs (rowspan=2) = 1 col
  Tonnage: Coton Graine | Intrant | Dist  = 3 cols
  Montant Brut: Coton Graine | Intrant    = 2 cols (colspan was 3, now 2)
  Total: Total | (gasoil total)           = 2 cols (colspan was 1, now 2)
  Gazoil: Qte | P.U | Montant            = 3 cols
Montant Net (rowspan=2) = 1 col
TOTAL = 1+3+2+2+3+1 = 12 cols
```

Wait — re-reading the spec carefully:

> Row 1: N° Bdrs (rowspan=2) | Tonnage (colspan=3) | Montant Brut (colspan=2) |
>        Total (colspan=2) | Gazoil (colspan=3) | Montant Net (rowspan=2)
> Row 2: Coton Graine | Intrant | Dist | Traif | Coton Graine | Intrant | Total | Qte | P.U | Montant

Count row 2: 3 (Tonnage) + 1 (Tarif in Montant Brut header) + 1 (Coton Graine MB) + 1 (Intrant MB) + 2 (Total cols) + 3 (Gazoil) = **but the spec says Montant Brut colspan=2 covering Tarif+Coton Graine only, Intrant is part of Total colspan=2**.

The exact mapping is:
- Tonnage (colspan=3): Coton Graine | Intrant | Dist — 3 sub-cols
- Montant Brut (colspan=2): Traif | Coton Graine — 2 sub-cols  
  *(Traif is listed under Montant Brut in the physical document)*
- Total (colspan=2): Intrant | Total — 2 sub-cols
- Gazoil (colspan=3): Qte | P.U | Montant — 3 sub-cols
- Total columns = 1 + 3 + 2 + 2 + 3 + 1 = **12 columns**

The implementer must ensure every `<tr>` in `<tbody>` and `<tfoot>` has exactly **12** `<td>` elements (counting only those where `colSpan` defaults to 1).

---

## Dependency order

```
Step 1 (helpers.js)
  └── Step 2 (add prop to tsx types)
        └── Step 3 (rewrite table body/header)
              └── Step 4 (rewrite tarif section)
                    └── Step 5 (page loads data, resolves TS error)
```

Each step leaves the codebase in a buildable state (TypeScript may report the
missing-prop error from step 2 onward until step 5 is complete, but the build
completes for each step individually after step 5).

> **Note:** The implementer can combine steps 2–4 into a single edit of
> `factureDocument.tsx` if preferred, completing in one pass.
