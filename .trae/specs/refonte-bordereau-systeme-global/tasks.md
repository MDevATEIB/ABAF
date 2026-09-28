# Plan de mise en œuvre — Refonte Bordereau Système Global

> Fichier associé : [spec.md](./spec.md)
> Chaque tâche ci-dessous implemente un sous-ensemble vertical des Critères d'Acceptation (CA).

---

## Tâche 1 : Backend — Migration SQL v3 + Payloads Bordereau

| Champ | Valeur |
|---|---|
| Priorité | **high** |
| Statut | `pending` |
| Couvre | ENF1 (migration), EF6 (payloads), base de EF3/EF5 (colonnes) |
| Test Requirements | 3× rule, 0× rubric |

### Contenu
1. **Ajouter une migration SQL v3** : créer `src-tauri/migrations/003_refonte_bordereau.sql` avec :
   - `ALTER TABLE bordereaux ADD COLUMN bsm_id INTEGER NULL REFERENCES bsm(id);`
   - (Optionnel) Index sur `bordereaux.bsm_id`.
2. Dans `src-tauri/src/db/mod.rs`, étendre `appliquer_migrations_versionnees` pour `PRAGMA user_version < 3` et appeler `migration_v3()`.
3. Dans `src-tauri/src/models/bordereau.rs` :
   - Ajouter au struct `Bordereau` existant un champ `pub bsm_id: Option<i64>` (si ce n'est pas le cas, confirmer par lecture).
   - Étendre `CreerBordereauPayload` avec :
     ```rust
     pub quantite_litres_gasoil: Option<f64>,
     pub prix_litre_gasoil:   Option<f64>,
     pub beneficiaire_gasoil: Option<String>,
     pub imputation_gasoil:   Option<String>,
     pub reference_gasoil:    Option<String>,
     ```
     (tous avec `#[serde(default)]`).
   - Étendre `ModifierBordereauPayload` de la même manière.

### TR Locaux

- **TR1.1 (rule)** : `cargo check` compile sans erreur après modifications.  
  *Preuve* : terminal `cargo check` exit 0.
- **TR1.2 (rule)** : Sur une base existante (user_version=2), lancer l'appli applique la migration v3 → on vérifie `PRAGMA user_version = 3` et la colonne `bsm_id` existe (NULL pour les lignes existantes).  
  *Preuve* : test manuel ou lecture du code idempotent de migration (avec `IF NOT EXISTS` via `colonne_existe`).
- **TR1.3 (rule)** : `CreerBordereauPayload` désérialise correctement quand les champs gasoil sont absents.  
  *Preuve* : compilation + pattern `#[serde(default)]` sur chaque champ optionnel.

---

## Tâche 2 : Backend — Commande `creer_bordereau` (Mission auto + BSM auto dans TX)

| Champ | Valeur |
|---|---|
| Priorité | **high** |
| Statut | `pending` |
| Couvre | EF3 (mission auto), EF5 (1 BSM auto si gasoil), ENF2 (1 TX), ENF4, ENF5 |
| Test Requirements | 6× rule, 2× rubric |

### Contenu
Dans `src-tauri/src/commands/bordereau.rs`, fonction `creer_bordereau` :
1. **Retirer** la vérification `verifier_mission(&db, mission_id)?;` quand `mission_id` est fourni (car on ne le fournit plus depuis le frontend). Conserver la struct fallback si mission_id n'est pas null (backward compat bases existantes).
2. **Ajouter une étape de création de mission** avant INSERT bordereau :
   - Rassembler depuis payload/champs dérivés : `saison_id`, `camion_id`, `chauffeur_id`, `usine_id`, `cgi_id`, `av_id` ;
   - Si le payload contient quand-même `mission_id: Some(id)` → utiliser cet id (backward compat) ;
   - Sinon INSERT dans `missions` avec les champs + `date_mission = payload.date_bordereau`, `statut = 'brouillon'` ;
   - Stocker l'id obtenu.
3. **Validation gasoil** (EF5 / ENF5) : si `quantite_litres_gasoil.is_some_and(|q| q > 0.0)` alors exiger `prix_litre_gasoil.is_some_and(|p| p > 0.0)` — sinon renvoyer `Err("Le prix au litre du gasoil est requis si une quantité est saisie".to_string())`.
4. **Après INSERT bordereau + INSERT lignes_bordereau** mais AVANT COMMIT :
   - Si gasoil saisi :
     - Générer numéro BSM via `generer_numero_document(&db, "bsm", "date_bsm", "numero", &payload.date_bordereau)` ;
     - INSERT INTO `bsm` (numero, saison_id, mission_id = nouvelle mission, camion_id, usine_id, date_bsm = date_bordereau, beneficiaire, quantite_litres, prix_litre, imputation, reference, statut = 'ouvert') ;
     - `UPDATE bordereaux SET bsm_id = ? WHERE id = ?` (id du bordereau tout juste créé).
5. **Tout dans la même transaction SQL** (la tx existe déjà via `let tx = db.transaction()?;` vers la fin du fichier ; il faut déplacer la création mission + insertion bsm + update bsm_id DANS cette même tx, avant `tx.commit()`).

### TR Locaux

- **TR2.1 (rule)** : La commande Rust compile (`cargo check`).  
  *Preuve* : terminal exit 0.
- **TR2.2 (rule)** : Lecture du code source : `BEGIN/COMMIT` unique couvre (mission, bordereau, lignes_bordereau, bsm, update bordereaux.bsm_id).  
  *Preuve* : Référence aux lignes de `commands/bordereau.rs` (tx = db.transaction() … tx.commit()).
- **TR2.3 (rule)** : Appel à `creer_bordereau` SANS gasoil → pas d'INSERT dans `bsm`, `bordereaux.bsm_id IS NULL`.  
  *Preuve* : Review condition `if quantite > 0`.
- **TR2.4 (rule)** : Appel à `creer_bordereau` AVEC gasoil → 1 ligne `bsm` créée, `numero` auto, `montant` STORED correct, `bordereaux.bsm_id = bsm.id`.  
  *Preuve* : Vérifiable en runtime ou par review code.
- **TR2.5 (rule)** : `quantite_litres_gasoil = 50.0` et `prix_litre_gasoil = None` → la commande retourne une Err(…).  
  *Preuve* : Lecture du code Early-return Err.
- **TR2.6 (rule)** : Une ligne `missions` est créée (ou réutilisée si mission_id fourni) et liée au bordereau.  
  *Preuve* : Review code.
- **TR2.7 (rubric : Q2 – Propriété du code)** : Échelle 0/1/2 — Seuil ≥ 1.  
  *Justification* : À remplir à la fin de la tâche.  
  *Preuve* : Relire le diff de `bordereau.rs`.
- **TR2.8 (rubric : Q1 – Cohérence UX non applicable, N/A)** : (Ici backend seulement).

---

## Tâche 3 : Backend — Commande `modifier_bordereau` (gestion BSM lié)

| Champ | Valeur |
|---|---|
| Priorité | **high** |
| Statut | `pending` |
| Couvre | EF5 modif, ENF2, ENF4 |
| Test Requirements | 4× rule, 1× rubric |

### Contenu
Dans `commands/bordereau.rs`, fonction `modifier_bordereau` :
1. **Ne PAS créer de mission automatiquement en modification** (spec EF3). Si `mission_id` est null sur le bordereau existant, on laisse null. Si non, on conserve.
2. **Lire le `bsm_id` existant** du bordereau avant update (via SELECT).
3. Règles de gestion du gasoil/BSM :
   - **Cas A** : `bsm_id` existant n'est pas null ET gasoil payload renseigné → UPDATE `bsm` SET beneficiaire, quantite_litres, prix_litre, imputation, reference, date_bsm (optionnel, seulement si changement).
   - **Cas B** : `bsm_id` est null ET payload gasoil.quantite > 0 → créer un nouveau BSM (cf. Tâche 2), puis `UPDATE bordereaux SET bsm_id = ? WHERE id = ?`.
   - **Cas C** : `bsm_id` existe, mais payload gasoil.quantite = 0/null ou absent → on ne supprime PAS le BSM (historique) ; laisser statut actuel. Mettre à jour les autres champs du Bsm uniquement si utilisateur a saisi de nouvelles valeurs (ou laisser tel quel).
4. Même règle de validation que TR2.5 : quantité > 0 ⇒ prix > 0.
5. **Tout dans la même transaction SQL** que le UPDATE bordereau + ses lignes (la tx existe déjà ; intégrer UPDATE/CREATE bsm dedans).

### TR Locaux
- **TR3.1 (rule)** : Compilation Rust sans erreur.  
  *Preuve* : `cargo check` exit 0.
- **TR3.2 (rule)** : Review code — la modification ne crée JAMAIS de mission automatiquement.  
  *Preuve* : Lignes de `modifier_bordereau`.
- **TR3.3 (rule)** : Cas A, B, C tous gérés.  
  *Preuve* : Commentaires ou blocs `if let Some(match)`.
- **TR3.4 (rule)** : Validation prix manquant retourne Err(...) (même message que T2).
- **TR3.5 (rubric : Q2)** : Seuil ≥ 1.

---

## Tâche 4 : Frontend — Services TS + Hooks (payloads gasoil, creerCamion etc.)

| Champ | Valeur |
|---|---|
| Priorité | **high** |
| Statut | `pending` |
| Couvre | EF6 (TS), EF1 (besoins hooks creerCamion/Chauffeur/Usine existants ?) |
| Test Requirements | 3× rule |

### Contenu
1. Dans `src/services/bordereau.ts` : ajouter aux payloads inline de `creerBordereau` / `modifierBordereau` :
   ```ts
   quantite_litres_gasoil?: number | null;
   prix_litre_gasoil?:   number | null;
   beneficiaire_gasoil?: string | null;
   imputation_gasoil?:   string | null;
   reference_gasoil?:    string | null;
   ```
2. Vérifier l'existence des hooks côté frontend :
   - `useCreerCamion`, `useCreerChauffeur`, `useCreerUsine` (si pas encore créés, les implémenter dans `src/hooks/` en suivant le pattern `useCreerCgi`, `useCreerAv`).
   - Appels Tauri correspondants : `commands::camion::creer_camion`, etc. (Confirmer par Grep qu'ils existent.)
3. Vérifier que `usePrixGasoil(saisonId)` est disponible (Bsm page l'utilise déjà) → à utiliser dans Bordereau pour pré-remplir le prix gasoil.
4. `npx tsc --noEmit` sans erreurs.

### TR Locaux
- **TR4.1 (rule)** : `tsc --noEmit` compile sans erreur.
- **TR4.2 (rule)** : Les payloads `creerBordereau` passent `undefined` pour les nouveaux champs quand non fournis (backward compat).
- **TR4.3 (rule)** : Les hooks `useCreerCamion`, `useCreerChauffeur`, `useCreerUsine` existent et appellent les commandes Tauri correspondantes.

---

## Tâche 5 : Frontend — Formulaire Bordereau (mini-forms Camion, Chauffeur, Usine ; supprimer champ Mission ; section Gasoil)

| Champ | Valeur |
|---|---|
| Priorité | **high** |
| Statut | `pending` |
| Couvre | EF1 (mini-forms), EF2 (retrait champ Mission), EF4 (section Gasoil), EF9 (affichage BSM lié) |
| Test Requirements | 6× rule, 2× rubric |

### Contenu
Modifier `src/pages/operations/bordereaux/index.tsx` :
1. **Retirer tout ce qui concerne Mission** :
   - Imports `Mission`, `useMissions`, `missionActuelle` watch ;
   - Select champ Mission dans le JSX ;
   - `defaultValues.mission_id` ;
   - Transmissions `mission_id` dans handleCreate/handleEdit.
2. **Ajouter 3 boutons « + »** à côté des selects Camion / Chauffeur / Usine, suivant le pattern déjà en place pour CGI/AV (boutons `showCgiModal` / `showAvModal`). Créer 3 états :
   - `showCamionModal`, `showChauffeurModal`, `showUsineModal` (bool) ;
   - `camionError`, `chauffeurError`, `usineError` (string|null) ;
   - Schémas Zod mini (Camion : immatriculation `.min(1)`, Chauffeur : nom `.min(1)`, Usine : nom `.min(1)`) ;
   - 3 petits `useForm` mini ;
   - 3 handlers submit qui appellent `useCreer*().mutateAsync`, puis `invalidateQueries([camions|chauffeurs|usines])` et `setValue(camion_id|chauffeur_id|usine_id, nouveau.id)`.
3. **Ajouter une section « Gasoil (BSM) »** après le groupe « Camion / Chauffeur / Usine » :
   - Label de section + checkbox/toggle simple « Inclure un bon de carburant (BSM) » (state `gasoilEnabled: boolean`).
   - Champs conditionnels si activé :
     - Quantité (L, number, min=1) ;
     - Prix au litre (number, min=0.01) ;
     - Bénéficiaire, Imputation, Référence (strings optionnels) ;
     - Aperçu montant (quantité × prix) en label readonly ;
     - Hint : `prochainNumero('bsm', dateBordereau, gasoilEnabled && !isEdit)` affiché.
   - Pré-remplir `prix_litre` automatiquement via `usePrixGasoil(saisonId).data?.prix_litre` si disponible et que le champ n'a pas été modifié manuellement.
4. **Connecter à handleCreate/Edit** : dans handleCreate, transmettre `quantite_litres_gasoil: gasoilEnabled ? quantite : null` et les 4 autres champs ; idem handleEdit.
5. **EF9 (affichage BSM lié)** : En mode modification (`isEdit`) ou dans un panneau de détail, si le bordereau chargé contient `bsm_id != null`, afficher un encart récapitulatif avec quantité, prix, montant, bénéficiaire + lien/bouton vers impression `impression/bsm/${bsm_id}`.
   - Note : il faut étendre le `useBordereaux` pour que le hook renvoie aussi le `bsm_id` et éventuellement les infos Bsm (via une jointure Rust côté `lister_bordereaux` ou via `useBsm(bsm_id)` si un tel hook existe — sinon option simple : un nouveau hook `useBsm(id)` appelant une commande `lire_bsm(id)` Rust à créer si elle manque). Si temps imparti, on peut laisser le lien simple + laisser l'utilisateur ouvrir l'impression qui va chercher le Bsm par son ID (existant probablement déjà). **Étendue minimale acceptable** : afficher `bsm_id` si présent + lien vers impression BSM.

### TR Locaux
- **TR5.1 (rule)** : `tsc --noEmit` compile sans erreur.
- **TR5.2 (rule)** : Le formulaire Bordereau ne comporte plus aucun select/input pour choisir une mission.  
  *Preuve* : Grep `mission` dans le JSX de `bordereaux/index.tsx` — seulement commentaires ou variables internes à delete nettoyés.
- **TR5.3 (rule)** : Les 3 modales (Camion, Chauffeur, Usine) s'ouvrent, acceptent saisie et sélectionnent auto la nouvelle entrée.  
  *Preuve* : Test manuel (ou review code des handlers submit similaires à CGI/AV).
- **TR5.4 (rule)** : Section « Gasoil » — si toggle activé ET quantité saisie, alors handleCreate transmet bien `quantite_litres_gasoil` et `prix_litre_gasoil` numériques. Si toggle OFF, ils sont null.  
  *Preuve* : Review code handleCreate.
- **TR5.5 (rule)** : `usePrixGasoil` pré-remplit bien le `prix_litre_gasoil` dès que la saison change et que toggle est ON.  
  *Preuve* : useEffect watch `saisonId` + `gasoilEnabled`.
- **TR5.6 (rule)** : En modification, si le bordereau a un `bsm_id`, un encart affiche ce lien + un résumé (ou au minimum le bsm_id + lien impression).
- **TR5.7 (rubric : Q1)** : Mini-forms cohérents avec CGI/AV existants. Seuil ≥ 1.
- **TR5.8 (rubric : Q3)** : Périmètre strict (pas de modifications non demandées). Seuil ≥ 1.

---

## Tâche 6 : Frontend — Routeur + Sidebar + suppression fichiers/pages autonomes

| Champ | Valeur |
|---|---|
| Priorité | **high** |
| Statut | `pending` |
| Couvre | EF7, CA R9–R11, Q3 |
| Test Requirements | 5× rule, 1× rubric |

### Contenu
1. **`src/App.tsx`** :
   - Supprimer :
     ```tsx
     <Route path="/referentiels/camions"    … />
     <Route path="/referentiels/chauffeurs" … />
     <Route path="/referentiels/usines"     … />
     <Route path="/operations/missions"     … />
     <Route path="/operations/bsm"          … />
     ```
   - Modifier : `<Route path="/operations" element={<Navigate to="/operations/bordereaux" replace />} />` (au lieu de /operations/missions).
   - Supprimer les imports `CamionsPage`, `ChauffeursPage`, `UsinesPage`, `MissionsPage`, `BsmPage`.
2. **`src/components/layout/Sidebar.tsx`** :
   - Dans `navItems.children` sous Référentiels : retirer les 3 lignes Camions, Chauffeurs, Usines.
   - Dans `navItems.children` sous Opérations : retirer Missions, BSM/Gasoil.
3. **Supprimer les fichiers de pages** :
   - `src/pages/referentiels/camions/index.tsx`
   - `src/pages/referentiels/chauffeurs/index.tsx`
   - `src/pages/referentiels/usines/index.tsx`
   - `src/pages/operations/missions/index.tsx`
   - `src/pages/operations/bsm/index.tsx`
4. **Nettoyer hooks inutilisés** : Grep chaque hook pour vérifier qu'aucun autre module n'utilise des fonctions de ces pages.
   - Hooks/services **à CONSERVER** car aussi utilisés ailleurs : `useMissions`, `useCreerMission`, `useBsms`, `useCreerBsm`, `useModifierBsm`, `useChangerStatutBsm` (utilisés par pages Impression BSM, Factures, Rapports, etc.).
   - Retirer uniquement hooks/services **utilisés exclusivement** par pages supprimées (ex. `useChangerStatutMission` si c'est seulement dans missions/index.tsx ; à confirmer par Grep).
5. **Désormais `/operations` = redirection vers `/operations/bordereaux`**.

### TR Locaux
- **TR6.1 (rule)** : `tsc --noEmit` compile sans erreur.
- **TR6.2 (rule)** : `cargo check` (aucune modif Rust ici, mais juste pour vérifier qu'on n'a rien cassé).
- **TR6.3 (rule)** : Grep `/referentiels/camions` etc. dans App.tsx : aucune Route restante.
- **TR6.4 (rule)** : Grep sidebar — labels Camions, Chauffeurs, Usines, Missions, BSM/Gasoil absents.
- **TR6.5 (rule)** : Fichiers listés en §3 absents du filesystem (ls ne les trouve pas).
- **TR6.6 (rubric : Q3 — Périmètre strict)** : Pas de suppression d'éléments nécessaires ailleurs (factures, rapports, impression fonctionnent toujours). Seuil ≥ 1.

---

## Tâche 7 : Frontend — Ajustements pages Factures (sélection BSM éventuelle) + Diagnostics finaux

| Champ | Valeur |
|---|---|
| Priorité | **medium** |
| Statut | `pending` |
| Couvre | EF8, vérifications Q3, ENF7 |
| Test Requirements | 3× rule |

### Contenu
1. **Vérifier page Factures** (`src/pages/finance/factures/index.tsx`) :
   - La liste de BSM proposés pour inclusion dans facture continue-t-elle de fonctionner ? (Oui, car `useBsms` existe et les tables sont intactes.)
   - Vérifier que les imports et requêtes sont OK.
2. **Vérifier pages Impression** (`impression/bsm/:id`, `impression/bordereau/:id`) :
   - Elles lisent directement via Tauri les données de `bsm` et `bordereaux` par ID. Pas de modifications attendues nécessaires.
3. **Vérifications finales** :
   - Relancer `cargo check` ;
   - Relancer `npx tsc --noEmit` ;
   - (Optionnel) `npm run build` si vite est configuré correctement avec Tauri.

### TR Locaux
- **TR7.1 (rule)** : `cargo check` OK.
- **TR7.2 (rule)** : `tsc --noEmit` OK.
- **TR7.3 (rule)** : Page Factures compile et référence toujours `useBsms` / hooks utiles sans erreurs d'import.

---

## Ordre d'exécution et dépendances

```
T1 (BDD + Payloads Rust)
 └── T2 (creer_bordereau)  → dépend de T1
 └── T3 (modifier_bordereau) → dépend de T1, parallèlisable avec T2 (risque faible de conflit, préférer séquentiel car même fichier)
T4 (Services TS + Hooks)    → dépend de T1/T2/T3 pour les payloads, mais peut être fait en parallèle de T2/T3
T5 (Formulaire Bordereau)   → dépend de T4 (hooks/TS)
T6 (Routeur / Sidebar)      → indépendant (avant/après T5 ok)
T7 (Diagnostics)            → tout le reste fini
```

---

## Matrice de couverture des Critères d'Acceptation (spécification)

| CA | Tâches couvrantes |
|---|---|
| R1, R2 (mini-forms inline, selects) | T5, T4 |
| R3 (retrait champ Mission) | T5 |
| R4 (mission auto en DB) | T2 |
| R5, R6 (BSM auto, 0 ou 1) | T2, T5 |
| R7, R8 (modif BSM lié) | T3, T5 |
| R9, R10, R11 (retrait routes/sidebar + fichiers supprimés) | T6 |
| R12, R13 (compilations) | Toutes (vérif à T7 final) |
| R14 (1 TX) | T2, T3 |
| R15 (migration) | T1 |
| Q1 (Cohérence UX) | T5 |
| Q2 (Propriété code Rust) | T2, T3 |
| Q3 (Périmètre strict) | T5, T6, T7 |
