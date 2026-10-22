# Implementation Plan — Ajout du type de fret « intrant »

## Contexte architectural

Le projet est une application Tauri v2 (Rust + SQLite backend) + React/TypeScript (Vite frontend).

**Contrainte SQLite clé :** SQLite ne permet pas de modifier une contrainte `CHECK` via
`ALTER TABLE`. Les tables `tarifs` et `bordereaux` ont toutes deux un `CHECK (type_fret IN
('direct', 'retour', 'evacuation', 'transfert'))` figé. La seule approche valide est la
migration v4 classique : renommer la table, recréer avec la nouvelle contrainte, copier les
données, supprimer l'ancienne table.

**Points hardcodés identifiés lors de l'exploration :**

| Fichier | Élément hardcodé |
|---|---|
| `src-tauri/migrations/001_initial.sql` | `CHECK (type_fret IN ('direct','retour','evacuation','transfert'))` × 2 (tarifs + bordereaux) |
| `src-tauri/src/db/mod.rs` | Migration v1 : même CHECK dans `tarifs_v1` et dans l'ALTER bordereau |
| `src-tauri/src/services/tarification.rs` | `pub const TYPES_FRET: [&str; 4]` |
| `src/types/index.ts` | `type TypeFret = 'direct' \| 'retour' \| 'evacuation' \| 'transfert'` |
| `src/utils/index.ts` | `TYPES_FRET` array + `LIBELLES_COURTS_FRET` Record |
| `src/pages/referentiels/tarifs/index.tsx` | `z.enum(['direct','retour','evacuation','transfert'])` |
| `src/pages/operations/bordereaux/index.tsx` | `type_fret: 'direct' \| 'retour' \| 'evacuation' \| 'transfert'` (FormValues) + `z.enum(...)` |
| `src/templates/factureDocument.tsx` | Table NB ARTICLE 9 : 3 colonnes fixes DISTANCE \| FRET DIRECT \| FRET RETOUR |

---

## Plan d'implémentation

- [ ] 1. **Migration SQLite v4 — recréer `tarifs` et `bordereaux` avec la nouvelle contrainte**

  SQLite ne supporte pas `ALTER TABLE … DROP CONSTRAINT`. La contrainte CHECK actuelle
  (`'direct','retour','evacuation','transfert'`) doit être remplacée par une incluant
  `'intrant'`. La stratégie est : renommer → recréer → copier → supprimer.
  La migration v4 doit être ajoutée dans `appliquer_migrations_versionnees` après le
  bloc `version < 3` existant, avec `PRAGMA user_version = 4` à la fin.

  **Fichiers à modifier :**
  - `src-tauri/src/db/mod.rs`

  **Ce qu'il faut faire :**

  1. Ajouter dans `appliquer_migrations_versionnees` :
     ```rust
     if version < 4 {
         migration_v4(conn)?;
         conn.execute_batch("PRAGMA user_version = 4")?;
     }
     ```

  2. Ajouter la fonction `migration_v4` (après `migration_v3`) :
     ```rust
     fn migration_v4(conn: &Connection) -> Result<()> {
         // ── Recréer tarifs avec la contrainte étendue ──────────────────────
         conn.execute_batch(
             "ALTER TABLE tarifs RENAME TO tarifs_v3;
              CREATE TABLE tarifs (
                  id              INTEGER PRIMARY KEY AUTOINCREMENT,
                  saison_id       INTEGER NOT NULL REFERENCES saisons(id),
                  type_fret       TEXT    NOT NULL DEFAULT 'direct'
                                  CHECK (type_fret IN ('direct','retour','evacuation','transfert','intrant')),
                  distance_min    REAL    NOT NULL,
                  distance_max    REAL,
                  unite_tarif     TEXT    NOT NULL DEFAULT 'fcfa_tkm'
                                  CHECK (unite_tarif IN ('fcfa_tonne', 'fcfa_tkm')),
                  tarif           REAL    NOT NULL,
                  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
                  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
                  CHECK (distance_max IS NULL OR distance_max > distance_min)
              );
              INSERT INTO tarifs SELECT * FROM tarifs_v3;
              DROP TABLE tarifs_v3;",
         )?;

         // ── Recréer bordereaux avec la contrainte étendue ──────────────────
         // On recréer la table complète en conservant toutes les colonnes
         // actuelles (y compris bsm_id de v3, type_fret/tarif_applique de v1).
         conn.execute_batch(
             "ALTER TABLE bordereaux RENAME TO bordereaux_v3;
              CREATE TABLE bordereaux (
                  id              INTEGER PRIMARY KEY AUTOINCREMENT,
                  numero          TEXT    NOT NULL UNIQUE,
                  saison_id       INTEGER NOT NULL REFERENCES saisons(id),
                  mission_id      INTEGER REFERENCES missions(id),
                  bsm_id          INTEGER NULL REFERENCES bsm(id),
                  camion_id       INTEGER NOT NULL REFERENCES camions(id),
                  chauffeur_id    INTEGER REFERENCES chauffeurs(id),
                  usine_id        INTEGER REFERENCES usines(id),
                  cgi_id          INTEGER REFERENCES cgis(id),
                  date_bordereau  TEXT    NOT NULL,
                  poids_vide_kg   REAL,
                  poids_charge_kg REAL,
                  poids_net_kg    REAL    GENERATED ALWAYS AS (
                                      CASE
                                          WHEN poids_charge_kg IS NOT NULL AND poids_vide_kg IS NOT NULL
                                          THEN MAX(0, poids_charge_kg - poids_vide_kg)
                                          ELSE NULL
                                      END
                                  ) STORED,
                  distance_km     REAL,
                  type_fret       TEXT    CHECK (type_fret IN ('direct','retour','evacuation','transfert','intrant')),
                  tarif_applique  REAL,
                  unite_tarif     TEXT    CHECK (unite_tarif IN ('fcfa_tonne', 'fcfa_tkm')),
                  montant_brut    REAL,
                  statut          TEXT    NOT NULL DEFAULT 'brouillon'
                                  CHECK (statut IN ('brouillon', 'valide', 'facture')),
                  observations    TEXT,
                  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
                  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
              );
              INSERT INTO bordereaux
                  (id, numero, saison_id, mission_id, bsm_id, camion_id, chauffeur_id,
                   usine_id, cgi_id, date_bordereau, poids_vide_kg, poids_charge_kg,
                   distance_km, type_fret, tarif_applique, unite_tarif, montant_brut,
                   statut, observations, created_at, updated_at)
              SELECT
                  id, numero, saison_id, mission_id, bsm_id, camion_id, chauffeur_id,
                  usine_id, cgi_id, date_bordereau, poids_vide_kg, poids_charge_kg,
                  distance_km, type_fret, tarif_applique, unite_tarif, montant_brut,
                  statut, observations, created_at, updated_at
              FROM bordereaux_v3;
              DROP TABLE bordereaux_v3;
              CREATE INDEX IF NOT EXISTS idx_bordereaux_bsm_id ON bordereaux(bsm_id);",
         )?;
         Ok(())
     }
     ```

  **Note importante sur `poids_net_kg` :** c'est une colonne `GENERATED ALWAYS … STORED`.
  Elle ne peut pas figurer dans la liste de `INSERT INTO … SELECT …` car elle est calculée
  automatiquement. C'est pourquoi le SELECT liste explicitement toutes les colonnes sauf
  `poids_net_kg`.

  **Note sur les index :** l'index `idx_bordereaux_bsm_id` (créé en v3) est perdu lors du
  DROP de la vieille table — il doit être recréé avec `CREATE INDEX IF NOT EXISTS`.

  **Verify :** `cargo test -p abaf --lib db` — tous les tests existants doivent passer
  (migration v1/v2/v3 idempotentes). Ajouter un test `migration_v4_ajoute_intrant` dans le
  bloc `#[cfg(test)]` de `mod.rs` pour vérifier qu'un `INSERT INTO tarifs` avec
  `type_fret = 'intrant'` réussit après la migration.

---

- [ ] 2. **Service Rust — ajouter « intrant » à `TYPES_FRET`**

  La constante `TYPES_FRET` est utilisée dans `tarif.rs` (`verifier_valeurs`) et dans
  `bordereau.rs` (`normaliser_type_fret`). Passer de `[&str; 4]` à `[&str; 5]` suffit ;
  les deux appelants iterent sur la constante sans index fixe.

  **Fichier à modifier :**
  - `src-tauri/src/services/tarification.rs` — ligne 19

  **Ce qu'il faut faire :**
  ```rust
  // Avant
  pub const TYPES_FRET: [&str; 4] = ["direct", "retour", "evacuation", "transfert"];
  // Après
  pub const TYPES_FRET: [&str; 5] = ["direct", "retour", "evacuation", "transfert", "intrant"];
  ```

  **Verify :** `cargo check` — aucune erreur de compilation (le changement de taille du
  tableau est détecté à la compilation si un code destructure avec un pattern de longueur
  fixe, mais il n'y en a pas dans ce projet).

---

- [ ] 3. **Type TypeScript — ajouter `'intrant'` à `TypeFret`**

  Le type `TypeFret` est le point de vérité côté TS. En l'ajoutant ici, TypeScript signalera
  toutes les occurrences exhaustives (`switch`, `Record<TypeFret, …>`) manquantes.

  **Fichier à modifier :**
  - `src/types/index.ts` — ligne 34

  **Ce qu'il faut faire :**
  ```ts
  // Avant
  export type TypeFret = 'direct' | 'retour' | 'evacuation' | 'transfert';
  // Après
  export type TypeFret = 'direct' | 'retour' | 'evacuation' | 'transfert' | 'intrant';
  ```

  **Verify :** `npm run build` — TypeScript signalera les endroits non mis à jour (étapes
  suivantes). Cette étape seule DOIT produire des erreurs de build TS sur les
  `Record<TypeFret, string>` et `z.enum([...])` non mis à jour ; c'est le signal que les
  étapes 4 et 5 sont nécessaires.

---

- [ ] 4. **Utils TypeScript — mettre à jour `TYPES_FRET` array et `LIBELLES_COURTS_FRET`**

  `TYPES_FRET` alimente les `<Select>` de la page tarifs et de la page bordereaux via
  `options={TYPES_FRET}`. Les deux pages utilisent ce tableau importé de `@/utils` — elles
  n'ont PAS de liste hardcodée dans leur sélecteur `<Select>`. Les schémas Zod, eux, sont
  hardcodés (étape 5).

  **Fichier à modifier :**
  - `src/utils/index.ts`

  **Ce qu'il faut faire :**

  1. Ajouter `'intrant'` dans `TYPES_FRET` (après `'evacuation'`, avant `'transfert'` selon
     l'ordre naturel de présentation — ou en fin de liste pour cohérence avec Rust) :
     ```ts
     export const TYPES_FRET: { value: TypeFret; label: string }[] = [
       { value: 'direct',     label: 'Direct — coton graine' },
       { value: 'retour',     label: 'Retour (à vide)' },
       { value: 'evacuation', label: 'Évacuation' },
       { value: 'intrant',    label: 'Intrant' },
       { value: 'transfert',  label: 'Transfert' },
     ];
     ```

  2. Ajouter `'intrant'` dans `LIBELLES_COURTS_FRET` :
     ```ts
     const LIBELLES_COURTS_FRET: Record<TypeFret, string> = {
       direct:     'Direct',
       retour:     'Retour',
       evacuation: 'Évacuation',
       intrant:    'Intrant',
       transfert:  'Transfert',
     };
     ```

  **Verify :** `npm run build` — les erreurs TS liées à `LIBELLES_COURTS_FRET` doivent
  disparaître après cette étape. Les erreurs sur les schémas Zod restent jusqu'à l'étape 5.

---

- [ ] 5. **Pages Bordereaux et Tarifs — mettre à jour les schémas Zod hardcodés**

  Les sélecteurs `<Select options={TYPES_FRET} />` sont déjà dynamiques (ils lisent le
  tableau de l'étape 4). Ce qui reste hardcodé sont les schémas Zod de validation de
  formulaire dans les deux pages. Ces schémas valident la valeur côté client avant envoi
  au backend ; ils doivent inclure `'intrant'`.

  **Fichiers à modifier :**
  - `src/pages/referentiels/tarifs/index.tsx`
  - `src/pages/operations/bordereaux/index.tsx`

  **Dans `tarifs/index.tsx` :**
  ```ts
  // Avant
  type_fret: z.enum(['direct', 'retour', 'evacuation', 'transfert']),
  // Après
  type_fret: z.enum(['direct', 'retour', 'evacuation', 'transfert', 'intrant']),
  ```

  **Dans `bordereaux/index.tsx` :**

  Deux occurrences à corriger dans ce fichier :

  a. Dans `FormValues` (type explicite, ligne ~70) :
  ```ts
  // Avant
  type_fret: 'direct' | 'retour' | 'evacuation' | 'transfert';
  // Après
  type_fret: TypeFret;   // importer TypeFret depuis @/types si pas déjà fait
  ```

  b. Dans le schéma Zod `schema` (ligne ~100) :
  ```ts
  // Avant
  type_fret: z.enum(['direct', 'retour', 'evacuation', 'transfert']),
  // Après
  type_fret: z.enum(['direct', 'retour', 'evacuation', 'transfert', 'intrant']),
  ```

  **Verify :** `npm run build` — aucune erreur TypeScript ne doit subsister après cette
  étape. Les deux pages compilent proprement.

---

- [ ] 6. **Template facture — ajouter la colonne INTRANT dans le tableau NB ARTICLE 9**

  Le tableau « NB : ARTICLE 9 TARIFICATION » en bas de la facture affiche actuellement 3
  colonnes : DISTANCE | FRET DIRECT | FRET RETOUR. Le type `intrant` a la même structure
  tarifaire que `direct` (tranche FCFA/tonne ≤ 90 km + FCFA/TKM > 90 km) mais représente
  une marchandise différente. Il mérite sa propre colonne dans ce tableau de référence.

  **Approche choisie :** ajouter une 4e colonne `FRET INTRANT` à droite de `FRET RETOUR`,
  en miroir exact de la colonne `FRET DIRECT`. Les lignes d'évacuation continuent à
  s'afficher dans la colonne `FRET DIRECT` (comportement existant inchangé).

  **Fichier à modifier :**
  - `src/templates/factureDocument.tsx`

  **Ce qu'il faut faire :**

  1. Étendre le type `TarifRow` pour inclure une clé `intrant` :
     ```ts
     type TarifRow = {
       key: string;
       label: string;
       direct?: Tarif;
       retour?: Tarif;
       evacuation?: Tarif;
       intrant?: Tarif;
     };
     ```

  2. Dans la boucle de construction de `tarifRows`, ajouter le cas `'intrant'` :
     ```ts
     for (const t of (tarifs ?? [])) {
       if (t.type_fret === 'evacuation' || t.type_fret === 'transfert') {
         tarifRows.push({ key: `evac-${t.id}`, label: 'EVACUATION GRAINE', evacuation: t });
         continue;
       }
       // 'intrant' : tranche propre, ne se groupe pas avec direct/retour
       if (t.type_fret === 'intrant') {
         const key = `intrant-${t.distance_min}-${t.distance_max ?? 'max'}`;
         if (!tarifMap.has(key)) {
           const row: TarifRow = { key, label: labelDistance(t) };
           tarifMap.set(key, row);
           tarifRows.push(row);
         }
         tarifMap.get(key)!.intrant = t;
         continue;
       }
       // direct / retour : regroupés par tranche (comportement existant)
       const key = `${t.distance_min}-${t.distance_max ?? 'max'}`;
       if (!tarifMap.has(key)) {
         const row: TarifRow = { key, label: labelDistance(t) };
         tarifMap.set(key, row);
         tarifRows.push(row);
       }
       const row = tarifMap.get(key)!;
       if (t.type_fret === 'direct') row.direct = t;
       else if (t.type_fret === 'retour') row.retour = t;
     }
     ```

  3. Dans le JSX du tableau NB ARTICLE 9, ajouter le `<th>` et la `<td>` pour INTRANT :
     ```tsx
     {/* En-tête */}
     <th className="border border-black px-1.5 py-1 text-center font-semibold">
       FRET DIRECT
     </th>
     <th className="border border-black px-1.5 py-1 text-center font-semibold">
       FRET RETOUR
     </th>
     <th className="border border-black px-1.5 py-1 text-center font-semibold">
       INTRANT
     </th>

     {/* Cellules de données */}
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
     <td className="border border-black px-1.5 py-1 text-right">
       {row.intrant ? fmtTarif(row.intrant) : ''}
     </td>

     {/* Cellule colspan du fallback "Aucun tarif" */}
     <td colSpan={4} ...>  {/* était 3, devient 4 */}
     ```

  **Verify :** `npm run build` — compilation TypeScript sans erreur.

---

- [ ] 7. **Vérification finale complète**

  Après toutes les étapes précédentes, vérifier que le projet compile intégralement.

  **Commandes à exécuter dans l'ordre :**

  ```bash
  # 1. Build TypeScript + Vite (frontend)
  npm run build

  # 2. Vérification + tests unitaires Rust (backend)
  cargo test -p abaf --lib

  # 3. Check Rust complet (avec toutes les features Tauri)
  cargo check
  ```

  **Résultat attendu :**
  - `npm run build` : `✓ built in Xs`, aucune erreur TS.
  - `cargo test` : tous les tests passent, y compris le nouveau `migration_v4_ajoute_intrant`.
  - `cargo check` : `Finished … 0 errors`.

  Si des avertissements `dead_code` subsistent sur les fonctions `lire_poids_pesees` et
  `synchroniser_poids_depuis_pesees` (présents avant cette tâche), ils sont hors-scope et
  peuvent être ignorés.

---

## Récapitulatif des fichiers modifiés

| Fichier | Nature de la modification |
|---|---|
| `src-tauri/src/db/mod.rs` | Ajout migration v4 + test associé |
| `src-tauri/src/services/tarification.rs` | `TYPES_FRET` : taille 4→5, ajout `"intrant"` |
| `src/types/index.ts` | `TypeFret` : ajout `\| 'intrant'` |
| `src/utils/index.ts` | `TYPES_FRET` array + `LIBELLES_COURTS_FRET` : ajout `'intrant'` |
| `src/pages/referentiels/tarifs/index.tsx` | `z.enum(...)` : ajout `'intrant'` |
| `src/pages/operations/bordereaux/index.tsx` | `FormValues` type + `z.enum(...)` : ajout `'intrant'` |
| `src/templates/factureDocument.tsx` | `TarifRow` + boucle + colonne INTRANT dans NB ARTICLE 9 |

**Aucune modification nécessaire** dans :
- `src-tauri/src/commands/tarif.rs` : utilise `TYPES_FRET` de tarification.rs (mis à jour en étape 2)
- `src-tauri/src/commands/bordereau.rs` : `normaliser_type_fret` utilise `tarification::TYPES_FRET` (mis à jour en étape 2)
- `src-tauri/src/commands/facture.rs` : ne valide pas `type_fret` en dur, utilise ce qui est en base
- `src-tauri/migrations/001_initial.sql` : ce fichier n'est exécuté qu'à l'initialisation d'une **base vide** (nouvelles installations). La migration v4 corrige les bases existantes. Pour les nouvelles installations, le schéma initial sera décalé avec la contrainte obsolète mais la migration v4 s'exécutera immédiatement après et le corrigera. Pour éviter toute ambiguïté sur les nouvelles installations, il est recommandé de mettre aussi à jour le `CHECK` dans `001_initial.sql` (les deux lignes : table `tarifs` et table `bordereaux`), mais c'est cosmétique car la migration v4 s'en charge dans tous les cas.
