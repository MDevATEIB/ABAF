# Refonte flux Pesée / Camion / Bordereau / CGI / AV — Plan d'implémentation

## Repository Research

### État actuel de l'architecture (lu en phase d'analyse)
- **Couche Types TS :** `src/types/index.ts`
  - `Camion.capacite_tonnes?: number` (tonnes float, champ facultatif)
  - `Pesee.type_pesee: 'vide' | 'charge'` (mécanisme actuel avec 2 pesées par mission)
  - `Bordereau.poids_vide_kg? / poids_charge_kg? / poids_net_kg?`
  - `Bordereau.distance_km?` (**GLOBALE** par bordereau, actuelle)
  - `LigneBordereau { av_id, localite, poids_kg, code, observations }` — **SANS distance_km par ligne**
- **Frontend services (TS invoke Tauri) :** `src/services/bordereau.ts`
  - `LigneBordereauInput` — idem, **SANS distance_km**
  - `creerBordereau / modifierBordereau / validerBordereau(id) -> Bordereau`
- **Formulaire Bordereau (`pages/operations/bordereaux/index.tsx`) :**
  - Schéma `ligneSchema` → 5 champs (av_id, localite, poids, code, obs)
  - Une seule `Input Distance` dans l'entête, associée à `register('distance_km')` (champ global)
  - Un `totalKg = reduce lignes.poids_kg` affiché
- **Module Pesées (`pages/operations/pesees/index.tsx`) :**
  - `PeseeForm` prend un `TypePesee = 'vide' | 'charge'`
  - Dans le détail mission, boutons séparés « Ajouter pesée à vide » / « Ajouter pesée chargée »
  - `poidsNet = calculPoidsNet(peseeCharge - peseeVide)` affiché sous les 2 lignes
- **Référentiels CGI/AV :** pages dédiées (`referentiels/cgis`, `referentiels/avs`) avec `useCreerCgi / useCreerAv` hooks existants → API création **existe déjà** (réutilisable)
- **Couche Backend Rust :**
  - `src-tauri/migrations/001_initial.sql` : schéma BDD (table `ligne_bordereau` sans `distance_km`)
  - `src-tauri/src/models/bordereau.rs` : structs Rust `LigneBordereau` et input
  - `src-tauri/src/commands/bordereau.rs` : `valider_bordereau` et autres commandes → **cette fonction calcule actuellement poids_net via pesées existantes ? À VÉRIFIER puis modifier.**
  - `src-tauri/src/services/tarification.rs` : calculs TKM / tarifs → probablement à adapter pour la distance_par_ligne.

### Décisions prises (clarifications utilisateur)
1. **Camion** : on **GARDE** le champ `capacite_tonnes` sémantiquement égal au « poids à vide ». Pas de renommage/migration BDD du champ camion. L'UI ajoute simplement une mention explicite « utilisé comme tare par défaut ».
2. **Calcul poids net bordereau** : `poids_net_kg = SUM(lignes.poids_kg)` (somme des lots chargés par ligne d'AV). **Les pesées du module Pesées ne servent PLUS au calcul** lors de `valider_bordereau` (désormais somme des lignes).
3. **Distance** : on AJOUTE `distance_km` PAR LIGNE `LigneBordereau`. La distance globale sur le bordereau peut rester en complément, mais **la validation et la facturation (TKM)** utilisent `lignes.map(l => tkmLigne(l.poids_kg, l.distance_km))`.
4. **CGI & AV inline** : le formulaire Bordereau ajoute un bouton « + Nouveau » à côté de chaque `<Select>` CGI/AV. Il ouvre une **sous-modale inline** (réutilisant les schémas Zod déjà existants dans `referentiels/*`) pour créer le CGI/AV à la volée, appeler `useCreerCgi/useCreerAv`, rafraîchir les options et sélectionner automatiquement la valeur nouvellement créée.

---

## Files and Modules

### Frontend TypeScript (React) — 11 fichiers
| Fichier | Changement prévu |
|---|---|
| `src/types/index.ts` | Ajouter `LigneBordereau.distance_km?: number` |
| `src/services/bordereau.ts` | Ajouter `LigneBordereauInput.distance_km?: number` ; propager |
| `src/pages/operations/bordereaux/index.tsx` | (1) Ajouter `distance_km` dans `ligneSchema` + colonne `Distance (km)` dans le tableau des lignes + valeur `totalKm` affichée. (2) Ajouter boutons « + Nouveau CGI » et « + Nouvel AV » inline (fenêtres modales imbriquées). (3) Mettre à jour le formulaire de visualisation pour afficher poids_vide_camion/poids_brut_calcule/poids_net_lignes. |
| `src/pages/referentiels/camions/index.tsx` | Label + hint précisant que « Capacité (tonnes) = poids à vide utilisé par défaut comme tare » dans `CamionForm`. |
| `src/pages/operations/pesees/index.tsx` | (1) Retirer le bouton « Pesée à vide » du flux (il ne faut plus l'enregistrer). (2) Garder lecture seule les pesées historiques. (3) Afficher en info la **capacité convertie en kg du camion** (poids_vide théorique) dans le détail. |
| `src/utils/index.ts` | (Optionnel) Ajouter helper `capaciteToPoidsVideKg(capaciteT?: number): number \| null`. Adapter les commentaires de `calculPoidsNet` (désormais utilisé seulement en historique). |
| `src/pages/finance/factures/index.tsx` | Revoir la construction des lignes de facture (`LigneFacture`) : chaque bordereau éclatable en plusieurs lignes facture (1 par ligne de bordereau avec sa propre distance_km → sa propre TKM individuelle). Réviser `tkmLigne` usage. |
| `src/templates/factureDocument.tsx` | Tableau impression facture : ajouter colonne `Distance (km)` par ligne, recalculer totaux TKM ligne par ligne. |
| `src/templates/bordereauDocument.tsx` | Ajouter colonne `Distance (km)` dans le tableau des lignes du bordereau imprimable ; afficher les infos poids_vide/poids_brut_calcule/poids_net. |
| `src/pages/operations/livraisons/index.tsx` | Adapter affichage poids_net si besoin (garanti = lignes.sum, cohérent). |
| `src/pages/rapports/*` | Adapter rapport annuel/recap (colonnes distance & poids net déjà cohérentes car basées sur bordereau ; vérifier seulement l'affichage de `poids_coton_kg`). |

### Backend Rust + SQLite — 5 fichiers (minimum à explorer puis modifier)
| Fichier | Changement prévu |
|---|---|
| `src-tauri/migrations/002_add_distance_km_to_ligne_bordereau.sql` | **NOUVEAU FICHIER** : migration SQL `ALTER TABLE ligne_bordereau ADD COLUMN distance_km REAL NULL;` |
| `src-tauri/src/models/bordereau.rs` | Ajouter champ `distance_km: Option<f64>` sur struct `LigneBordereau` et `CreateLigneBordereau`. |
| `src-tauri/src/commands/bordereau.rs` | Adapter `creer_bordereau` / `modifier_bordereau` pour lire + persister `lignes.distance_km`. Réécrire **`valider_bordereau`** : (a) `poids_vide_kg = camion.capacite_tonnes * 1000` (si existe) ; (b) `poids_charge_kg = poids_vide_kg + somme_lignes_poids` (brut calculé) ; (c) `poids_net_kg = somme lignes.poids_kg`. Mettre à jour la distance globale `bordereau.distance_km = MAX par convention des lignes ? ou somme ? Clarifier lors impl (défaut: somme des lignes)`. |
| `src-tauri/src/services/tarification.rs` | Revoir fonction qui facture → TKM se calcule **par ligne de bordereau** (poids ligne × distance ligne), plus au global. |
| `src-tauri/src/models/camion.rs` | Juste vérifier `capacite_tonnes: Option<f64>` est bien accessible en lecture dans `valider_bordereau` (SÉLECTIONNER le camion). |

---

## Implementation Steps (ordre des dépendances)

### Étape 0 — Prérequis backend (OBLIGATOIRE avant TS, sinon BDD cassera)
1. Créer `migrations/002_add_distance_km_to_ligne_bordereau.sql` avec `ALTER TABLE ligne_bordereau ADD COLUMN distance_km REAL NULL;`.
2. Mettre à jour `models/bordereau.rs` (structs Rust avec `distance_km`).
3. Adapter `commands/bordereau.rs` : `creer_bordereau / modifier_bordereau` acceptent le champ dans chaque ligne payload.
4. **Réécrire `valider_bordereau(id)`** avec le nouveau calcul.
5. Mettre à jour `services/tarification.rs` pour TKM ligne par ligne.

### Étape 1 — Couche Types TS
6. Modifier `types/index.ts` → `LigneBordereau.distance_km?: number`.
7. Modifier `services/bordereau.ts` → `LigneBordereauInput.distance_km?: number`.
8. Si besoin ajouter un helper `capaciteToPoidsVideKg` dans `utils`.

### Étape 2 — Formulaire Bordereau (point central)
9. **Ajouter `distance_km` par ligne :**
   - Modifier `ligneSchema` zod → ajouter `distance_km: z.coerce.number().positive().optional()`
   - Ajouter `<Input type=number step=1 Distance (km) />` dans chaque ligne du tableau de lignes (5ème colonne)
   - Afficher `Total km` sous le tableau (somme des lignes)
   - **Rétrocompatibilité :** La distance globale `bordereau.distance_km` devient en lecture seule, auto-remplie par « moyenne » ou « somme » des lignes (au choix ; par défaut : somme).
10. **Création inline CGI/AV :**
    - Ajouter à droite du `Select` CGI un petit bouton `Button variant=outline size=sm icon=Plus label="CGI"` qui ouvre un `<Modal title="Nouveau CGI" size="sm">`.
    - Dans cette modal, utiliser **un mini formulaire** (zod schema copié/réutilisé depuis `referentiels/cgis/index.tsx`) → champs `nom`, `usine_id` (prérempli depuis `usine_id` du bordereau en cours, sinon demandé), `localite`.
    - À `onSubmit` appeler `useCreerCgi().mutateAsync` → `queryClient.invalidateQueries('cgis')` → `setValue('cgi_id', newId)`.
    - Même logique pour **AV** (bouton «+ » à côté du Select AV de chaque ligne). Le formulaire mini demande `nom`, `cgi_id` (prérempli depuis cgi_id du bordereau), `localite`.
11. Mettre à jour le bloc « Révision / Vue » détaillée du bordereau pour afficher le calcul détaillé :
    - Poids à vide camion (capacité * 1000 si capacité renseignée, sinon « — »)
    - Poids brut calculé (poids_vide + coton_total)
    - Poids net retenu (somme lignes)
12. **Validation côté frontend :** Avant soumission `validerBordereau`, vérifier (soft warning) que chaque ligne a bien sa distance_km renseignée.

### Étape 3 — Page Pesées (désactiver pesée à vide, afficher capacité camion)
13. Dans l'UI modale de détail d'une mission :
    - Retirer le bouton d'ajout « Pesée à vide » (seulement laisser « Pesée chargée » pour historique si jamais on veut, ou tout désactiver)
    - Ajouter un cartouche d'information `Tare du camion (capacité) : X kg`
14. Optionnel : Masquer la colonne type dans le tableau historique (ou laisser).

### Étape 4 — Page Camions (clarification UI)
15. Modifier `CamionForm` → label + hint du champ « Capacité (tonnes) » : « Cette valeur est utilisée automatiquement comme **tare (poids à vide)** du camion lors de la validation d'un bordereau. »
16. Modifier la colonne « Capacité » du tableau → tooltip ou badge précisant « Tare utilisée ».

### Étape 5 — Facturation (finance + impression facture)
17. Revoir `pages/finance/factures/index.tsx` : une ligne de bordereau = une ligne sur la facture. Adapter `LigneFacture` pour utiliser `l.distance_km` (ligne bordereau), et réviser la boucle de génération.
18. Recalcul des totaux : `tkm_total = sum lignes (poids_net_kg ligne × distance ligne / 1000)`.
19. Adapter `factureDocument.tsx` → colonne distance par ligne.
20. Adapter `bordereauDocument.tsx` → ajouter colonne distance et cartouches poids calculés.

### Étape 6 — Livraisons & Rapports (vérifications de cohérence)
21. Vérifier que `livraisons/index.tsx` affiche toujours les poids correctement.
22. Vérifier les rapports `recap` et `annuel` (pas de changements structurels car ils consomment déjà les entités `Bordereau` déjà validées → poids_net et distance_km mis à jour via BDD). Lancer un visuel check.

---

## Dependencies and Considerations
- **TanStack Query :** Les hooks `useCreerCgi / useCreerAv` utilisent déjà `invalidateQueries`. On pourra y ajouter `await queryClient.invalidateQueries({ queryKey: ['cgis'] })` explicitement pour garantir que le Select est rafraîchi après création inline.
- **Modal imbriquée (création CGI/AV inline dans BordereauForm) :** Attention, `Modal.tsx` fait body scroll-lock global → deux modales ouvertes = 2 locks successifs. S'assurer que le cleanup dans Modal s'exécute bien. Si problème, remplacer la création CGI/AV par `Modal` enfant avec condition.
- **Anciennes lignes `ligne_bordereau.distance_km = NULL` (avant migration) :** Ajouter fallback : si ligne sans `distance_km` → prendre `bordereau.distance_km` global / nombre_lignes (ou 0 si global aussi null) + warning.
- **Fichiers Rust :** L'étape 0 de ce plan **nécessite d'implémenter et compiler le backend**. Le développeur exécutera `cargo check` (ou `npm run tauri dev`) pour vérifier la compilation Rust après modifs.
- **AGENT.md** : S'il contient des directives contradictoires sur le cycle de vie des statuts mission (ex: `pese_vide` obligatoire), on **met à jour seulement le calcul** et pas les statuts (le workflow des statuts peut rester). Les changements de statut restent manuels jusqu'à plus ample informé.

---

## Validation
1. **Compilation TS :** `npx tsc --noEmit` → 0 erreur.
2. **Compilation Rust :** `cargo check` dans `src-tauri/` → 0 erreur.
3. **Migration BDD :** Démarrer l'appli une 1ère fois pour jouer la migration SQL `002_*.sql` → pas d'erreur, colonne présente.
4. **Cas fonctionnels à tester manuellement (ou à documenter) :**
   - Créer un camion avec `capacite_tonnes = 20`. Dans Pesées, voir « Tare = 20 000 kg ».
   - Créer un bordereau : ajouter 2 lignes (AV1 poids 8000 kg / 80 km ; AV2 poids 6000 kg / 120 km). AV1 n'existe pas → cliquer «+ Nouvel AV » → formulaire rapide → sélection automatique.
   - Valider le bordereau → Vérifier en base : `poids_vide_kg = 20000`, `poids_charge_kg = 34000` (20k+14k), `poids_net_kg = 14000`.
   - Aller dans Factures : générer une facture à partir de ce bordereau → 2 lignes facture avec TKM individuelles.
5. **Régression :** Vérifier que les bordereaux créés avant migration restent lisibles (affichage + calcul correct avec fallback).

---

## Risques
| Risque | Mitigation |
|---|---|
| **Rust backend compil. échoue** | Faire étape 0 avec `cargo check` itératif sur `valider_bordereau` isolément avant toutes autres modifs. |
| **Modal scroll lock imbriqué** | Vérifier `Modal.tsx` cleanup bien restauré body. Si échec, utiliser `Dialog` sans second lock ou désactiver scroll lock dans la sous-modale. |
| **Données historiques (lignes sans distance_km)** | Fallback distance globale / nb lignes ; warning UI. |
| **Poids du camion null (capacité non saisie)** | Afficher warning : « Impossible de calculer le poids brut car le camion n'a pas de capacité enregistrée. » ; marquer bordereau comme incomplet si validation stricte nécessaire (par défaut : autoriser, saisir `poids_vide = null` dans BDD, poids_net = somme lignes). |
