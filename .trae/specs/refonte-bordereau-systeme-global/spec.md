# Spécifications – Refonte Bordereau : Système Global ABAF

> Document en français – conforme à la langue de travail du projet ABAF.

## 1. Problème

### Contexte
L'application ABAF comprend aujourd'hui plusieurs modules autonomes (Référentiels : Camions, Chauffeurs, Usines ; Opérations : Missions, BSM/Gasoil, Bordereaux). Chaque module a sa propre page de gestion CRUD accessible via la sidebar.

### Problème utilisateur
L'expérience utilisateur est fragmentée : pour saisir un seul **bordereau de transport**, l'utilisateur doit potentiellement naviguer dans 5 pages différentes (camion, chauffeur, usine, mission, gasoil) avant de pouvoir revenir sur le formulaire Bordereau. Les références se construisent au fur et à mesure dans des écrans séparés, ce qui casse le flux de saisie.

### But
**Transformer la création d'un Bordereau en un « Système Global » d'entrée unique**, où :
- Les référentiels (Camions, Chauffeurs, Usines) se créent à la volée depuis le formulaire Bordereau si besoin ;
- La Mission est créée automatiquement par le backend à partir du Bordereau (plus de sélection Mission) ;
- Le Gasoil/BSM est saisi directement dans le Bordereau, et 1 BSM est automatiquement généré à la validation si une quantité est saisie ;
- Les données **continuent d'être enregistrées dans leurs tables respectives** (elles restent les données globales du système, réutilisables par les autres modules).

---

## 2. Utilisateurs cibles

- **Saisisseurs ABAF** (utilisateurs principaux) : utilisent l'écran Bordereaux comme portail d'entrée unique pour toute activité du jour.
- **Contrôleurs de gestion** : consultent les listes (factures, paiements, rapports) et peuvent toujours voir/éditer un Bordereau existant.

---

## 3. Objectifs

| # | Objectif |
|---|---|
| O1 | Faire de la page « Bordereaux » (Opérations > Bordereaux) l'écran de saisie central de toute opération. |
| O2 | Permettre la création de Camions, Chauffeurs, Usines depuis le formulaire Bordereau (mini-modal inline, pattern déjà utilisé pour CGI/AV). |
| O3 | Éliminer le champ « Mission » du formulaire Bordereau (plus de sélection à la main) ; le backend crée ou rattache automatiquement une Mission cohérente. |
| O4 | Ajouter une section optionnelle « Gasoil » au formulaire Bordereau (quantité L, prix/L, bénéficiaire, imputation, référence) ; à la validation du bordereau, générer 1 BSM lié si quantité > 0. |
| O5 | Supprimer complètement les pages autonomes et routes dédiées à Camions, Chauffeurs, Usines, Missions, BSM/Gasoil de la sidebar et du routeur. |
| O6 | Conserver intacte toute la logique métier existante : tables SQL séparées, vérifications FK, contraintes, numérotations automatiques, validations statutaires. |

## 4. Non-objectifs (Hors-scope)

- **Pas de refonte** des autres modules (Pesées, Livraisons, Factures, Paiements, Avances, Saisons, Tarifs, Prix-Gasoil, CGI, AV, Clients, Rapports, Impression, Paramètres). Ces modules restent accessibles.
- **Pas de suppression des tables SQL** `camions`, `chauffeurs`, `usines`, `missions`, `bsm` — au contraire, elles continuent d'être les sources de vérité.
- **Pas de modification du cycle de vie des statuts** des Missions (brouillon → … → payé). Les Missions créées automatiquement sont initialisées avec un statut de départ cohérent (ex. `brouillon` ou `gasoil_pris` selon ce qui est renseigné) ; les transitions restent possibles via backend si nécessaire.
- **Pas de refonte des pages de listes** existantes des Bordereaux (tableau, pagination, filtres statuts, impressions). La liste des Bordereaux garde son UI actuelle.
- **Pas de modification des pages d'impression** BSM et Bordereau ; elles continuent de consommer les mêmes tables.

---

## 5. Exigences Fonctionnelles (EF)

### EF1. Formulaires référentiels inline dans Bordereau (Camion, Chauffeur, Usine)

- Chaque champ Select référentiel (Camion, Chauffeur, Usine) dans le formulaire Bordereau est accompagné d'un bouton « + » (icône) ouvrant un modal de **création rapide**.
- **Modal Camion** : immatriculation (obligatoire), marque, modèle, capacité_tonnes (actif = 1 par défaut).
- **Modal Chauffeur** : nom (obligatoire), prénom, téléphone (actif = 1 par défaut).
- **Modal Usine** : nom (obligatoire, unique), localite.
- Chaque création rapide appelle les commandes Rust existantes `creer_camion`, `creer_chauffeur`, `creer_usine` (ou équivalentes), déclenche `invalidateQueries` sur la clé de liste correspondante, puis **sélectionne automatiquement la nouvelle valeur** dans le champ du formulaire Bordereau.
- Patterns identiques aux mini-formulaires `useCreerCgi` / `useCreerAv` déjà présents dans le formulaire Bordereau.
- Les contraintes d'unicité côté base (ex. immatriculation camion) sont gérées via message d'erreur dans le modal, sans casser la saisie du Bordereau.

### EF2. Suppression du champ « Mission » du formulaire Bordereau

- Le formulaire Bordereau n'affiche **plus** de champ sélectionnant une mission existante.
- Les variables/watch `missionActuelle`, la requête `useMissions`, les `defaultValues.mission_id`, etc. sont retirés du formulaire (sauf usage interne pour affichage post-création éventuel).
- Les imports `useMissions` / `Mission` sont retirés s'ils ne servent plus.

### EF3. Création automatique de la Mission côté backend

- La commande Rust `creer_bordereau` (dans `src-tauri/src/commands/bordereau.rs`) est étendue :
  1. Elle crée une nouvelle mission (INSERT INTO `missions`) avec :
     - `saison_id`, `camion_id`, `chauffeur_id`, `usine_id`, `cgi_id`, `av_id` (si `cgi_id` est null mais que la première ligne de bordereau a un `av_id`, on remonte `cgi_id` depuis l'AV pour renseigner la mission ; sinon null) ;
     - `date_mission = date_bordereau` ;
     - `statut = 'brouillon'` (statut initial) ;
     - `observations = observations du bordereau` (ou null si non renseigné).
  2. Elle récupère l'`id` de la mission créée.
  3. Elle insère le Bordereau avec ce `mission_id` renseigné (plus nullable en création, mais reste nullable en modification — ex. bases anciennes).
- La commande `modifier_bordereau` **ne crée pas de mission automatiquement** ; si le `mission_id` existe déjà elle le conserve, sinon elle laisse `mission_id` à NULL (pas de rattachement magique en modification, pour éviter la perte de contrôle).
- Toute la transaction bordereau (INSERT missions + INSERT bordereaux + INSERT lignes_bordereau) se déroule dans **une seule transaction SQL** : aucune mission orpheline si l'insertion du bordereau échoue.
- Si le Bordereau a déjà un `mission_id` (cas modification), on ne crée pas de nouvelle mission.
- On s'assure que la commande de création de BSM (EF5) peut retrouver la mission via `bordereau.mission_id`.

### EF4. Section Gasoil optionnelle dans le formulaire Bordereau

- Dans le formulaire Bordereau (écran création **et** modification), ajouter un groupe de champs « **Gasoil (BSM)** » (optionnel, repliable).
- Champs proposés :
  - `quantite_litres : number` (obligatoire seulement si l'un des champs gasoil est renseigné ; sinon 0/ignoré) ;
  - `prix_litre : number` (obligatoire si quantite_litres > 0) ;
  - `beneficiaire : string` (optionnel) ;
  - `imputation : string` (optionnel) ;
  - `reference : string` (optionnel).
- Le **numéro du BSM** n'est pas saisi : il sera généré automatiquement comme les autres documents (format `2026-0138` via `generer_numero_document`).
- Un aperçu du prochain numéro BSM est affiché en hint (via `useProchainNumero('bsm', dateBordereau)`) si la section gasoil est utilisée.
- Calcul client-side du montant FCFA estimé (`quantite * prix`) affiché en lecture seule.
- Pré-remplissage du `prix_litre` : si un `prix_gasoil` existe pour la `saison_id` sélectionnée, proposer automatiquement cette valeur (comme le fait déjà la page BSM autonome via `usePrixGasoil`).
- En **modification** : si le bordereau est lié à un BSM existant (via `lignes_facture` ou via une future colonne à déterminer), les champs gasoil sont pré-remplis et désactivés, ou bien on permet l'édition — voir la règle d'association EF5.

### EF5. Génération d'un BSM unique au moment de la validation du Bordereau

- Lors de `creer_bordereau`, après création de la mission et insertion du bordereau, si `quantite_litres_gasoil > 0` est transmis dans le payload :
  1. Appeler `generer_numero_document` pour obtenir un numéro BSM (`"bsm"`, colonnes `date_bsm`/`numero`) ;
  2. Insérer 1 ligne dans `bsm` avec :
     - `numero` auto,
     - `saison_id = saison_id du bordereau`,
     - `mission_id = mission_id créé (EF3)`,
     - `camion_id = camion_id du bordereau`,
     - `usine_id = usine_id du bordereau`,
     - `date_bsm = date_bordereau`,
     - `beneficiaire`, `quantite_litres`, `prix_litre`, `imputation`, `reference` issus du payload bordereau,
     - `statut = 'ouvert'`,
     - `montant = GENERATED ALWAYS STORED` (on ne renseigne pas, la colonne le calcule).
  3. Insérer le lien de rattachement entre le bordereau et le BSM :
     - **Option retenue** : ajouter une colonne `bsm_id INTEGER REFERENCES bsm(id)` sur `bordereaux` (nullable, unique ; un bordereau peut avoir 0 ou 1 BSM selon cette refonte). Ajout via migration SQL `003_add_bsm_to_bordereaux.sql` (nouveau fichier) appliquée via `appliquer_migrations_versionnees` (PRAGMA user_version = 3). Comme la liste de bordereaux existants n'a pas de lien, on laisse NULL pour l'existant.
- Règle en **modification** (`modifier_bordereau`) :
  - Si le bordereau a déjà un `bsm_id` non-null ET que la section gasoil est renseignée → mettre à jour la ligne BSM correspondante (`UPDATE bsm SET quantite_litres=?, prix_litre=?, beneficiaire=?, imputation=?, reference=? WHERE id = bsm_id`) ;
  - Si le bordereau n'a pas de `bsm_id` ET que la section gasoil devient renseignée → créer un BSM et l'attacher (`UPDATE bordereaux SET bsm_id = ? WHERE id = ?`) ;
  - Si le bordereau avait un `bsm_id` ET que la section gasoil est vidée (quantite_litres = 0) → on ne supprime PAS le BSM (historique), mais on peut passer son statut en `'cloture'` ou laisser tel quel. L'UI affichera une info.
- La génération et mise à jour de BSM se fait **toujours dans la même transaction SQL** que le bordereau pour garantir la cohérence.

### EF6. Payloads Rust + Services TS

- Étendre `CreerBordereauPayload` (Rust) et le payload inline `creerBordereau` (TS) avec des champs optionnels gasoil :
  - `quantite_litres_gasoil?: Option<f64>` (Rust) / `quantite_litres_gasoil?: number \| null` (TS) ;
  - `prix_litre_gasoil?: Option<f64>` ;
  - `beneficiaire_gasoil?: Option<String>` ;
  - `imputation_gasoil?: Option<String>` ;
  - `reference_gasoil?: Option<String>`.
- Les mêmes champs sont ajoutés à `ModifierBordereauPayload` et au TS correspondant.
- `#[serde(default)]` est conservé pour tous ces champs (tous optionnels, pas de break API).

### EF7. Suppression des pages autonomes (routes + sidebar)

Dans `src/App.tsx` (routeur) :
- Retirer les routes `/referentiels/camions`, `/referentiels/chauffeurs`, `/referentiels/usines`, `/operations/missions`, `/operations/bsm`.
- Les redirects `/operations` et `/referentiels` sont ajustés :
  - `/referentiels` redirige vers `/referentiels/saisons` (inchangé).
  - `/operations` redirige **désormais vers `/operations/bordereaux`** (au lieu de `/operations/missions` qui n'existe plus).

Dans `src/components/layout/Sidebar.tsx` :
- Retirer les entrées « Camions », « Chauffeurs », « Usines » du sous-menu « Référentiels ».
- Retirer les entrées « Missions » et « BSM / Gasoil » du sous-menu « Opérations ».
- Garder : Saisons, Tarifs, Prix Gasoil, Clients (Référentiels) ; Bordereaux, Pesées, Livraisons (Opérations).

Suppression des fichiers de pages désormais inutiles :
- `src/pages/referentiels/camions/index.tsx`
- `src/pages/referentiels/chauffeurs/index.tsx`
- `src/pages/referentiels/usines/index.tsx`
- `src/pages/operations/missions/index.tsx`
- `src/pages/operations/bsm/index.tsx`

Si un hook n'est utilisé que par ces pages (`useChangerStatutBsm`, `useChangerStatutMission` par exemple), on peut les retirer ; on gardera `useBsms`, `useCreerBsm`, `useModifierBsm`, `useMissions`, `useCreerMission` (utilisés par d'autres pages : factures, rapports, impression BSM). On vérifie par recherche texte la dépendance.

### EF8. Formulaire Factures : retirer éventuelle sélection BSM autonome

La page Factures liste des BSM à rattacher. Vérifier si ce module utilise `useBsms` / permettait de sélectionner un BSM autonome non lié à un bordereau. Si oui, la laisser fonctionner car les BSM créés via le bordereau auront toujours `bsm_id` renseigné et donc visibles. Pas de modification obligatoire ici : les BSM continuent d'exister en base.

### EF9. Vue de détail Bordereau : afficher le BSM lié

Sur la fiche bordereau (liste des bordereaux, en consultatif), afficher sous forme de badge ou section dédiée si un BSM est lié :
- Montant gasoil, quantité, bénéficiaire ;
- Bouton d'impression du BSM (route `/impression/bsm/:id`) si `bsm_id` est présent.
- La vue existante du bordereau ne nécessitant qu'un ajout léger, on enrichit la table/l'encart de détail existant. (Cette EF est mise en œuvre dans la même tâche que l'UI Bordereau.)

---

## 6. Exigences Non Fonctionnelles (ENF)

| # | Exigence |
|---|---|
| ENF1 | **Compatibilité ascendante / BDD existantes** : toute installation existante doit pouvoir lancer l'app sans perte de données. La nouvelle colonne `bordereaux.bsm_id` est ajoutée via migration `user_version = 3` (nullable) ; les lignes existantes ont `NULL`. |
| ENF2 | **Cohérence transactionnelle** : création Mission + Bordereau + Lignes + (éventuellement) BSM dans une **seule transaction SQL** en création comme en modification. |
| ENF3 | **Sécurité des FK** : les contraintes de clé étrangère sur les tables `camions`, `chauffeurs`, `usines`, `missions`, `bsm`, `lignes_bordereau` **restent activées** (PRAGMA foreign_keys = ON). |
| ENF4 | **Logique métier préservée** : les validations existantes (véhicule non trouvé, numéro disponible, type_fret, calculs de montant, TKM) dans `creer_bordereau` et `modifier_bordereau` sont conservées mot pour mot ; on ajoute les nouvelles règles avant les validations actuelles. |
| ENF5 | **Robustesse** : si `quantite_litres_gasoil` est > 0 mais que `prix_litre_gasoil` est absent, la commande renvoie une erreur structurée (Err("Le prix du gasoil est requis si une quantité est saisie")). |
| ENF6 | **Performance** : l'ajout des mini-modales ne doit pas faire de requête N+1. Les listes de camions/chauffeurs/usines continuent d'être chargées une fois via les hooks React Query existants. |
| ENF7 | **Qualité de code** : `cargo check` sans erreurs (warnings preexistants tolérés) et `npx tsc --noEmit` sans erreurs après chaque tâche. |

---

## 7. Contraintes, Dépendances, Hypothèses

- **Stack imposé** : Tauri v2 (Rust + SQLite) + React 19 + RHF + Zod + React Query v5 + Tailwind. Aucune nouvelle dépendance.
- **Conventions SQL** : tables SQL au pluriel (ABAF) respectées (`lignes_bordereau` reste `lignes_bordereau`).
- **Hypothèses** :
  - H1. Une mission représente un voyage camion + date ; on crée 1 mission par bordereau dans cette refonte (plusieurs bordereaux pourraient partager une même mission à l'avenir, mais ce n'est pas le scope actuel).
  - H2. 1 bordereau = max 1 BSM. Si le besoin de plusieurs BSM par bordereau émerge ultérieurement, on introduira une table de jointure `bordereaux_bsm` ; la colonne `bsm_id` unique est un bon point de départ sans casse.
  - H3. Les hooks/services TS (`useBsms`, `useCreerMission`…) sont conservés car aussi utilisés par les pages Impression BSM, Factures (rattachement BSM), Rapports.

---

## 8. Questions ouvertes résolues (via conversation 2026-09-27)

| Q | Réponse utilisateur | Implication |
|---|---|---|
| Q1 : « Retirer » = masquer ou supprimer ? | **Supprimer complètement pages + routes** | On supprime donc les fichiers de pages et les routes associées dans `App.tsx` + sidebar. |
| Q2 : Mission ? | **Créée automatiquement** | Plus de champ Mission dans le formulaire, backend se charge (EF3). |
| Q3 : BSM/Gasoil dans bordereau ? | **1 BSM auto si gasoil saisi** | Section gasoil optionnelle dans le bordereau + 1 BSM généré à la validation (EF4–EF5). |

---

## 9. Critères d'Acceptation (CA)

Les CA sont exprimés en `rule` (binaire, Vrai/Faux) ou `rubric` (notation 0–2).

### rule — Fonctionnelles

- **R1** : La page Opérations > Bordereaux (liste + modale formulaire) s'ouvre sans erreur JS/Rust ; `useCamions`, `useChauffeurs`, `useUsines` sont toujours chargés pour alimenter les selects.
- **R2** : En cliquant sur le bouton « + » à côté du select Camion, un modal permet de saisir immatriculation (obligatoire), marque, modèle, capacité et crée un nouveau camion sélectionné automatiquement. (Même pattern pour Chauffeur + Usine.)
- **R3** : Le formulaire Bordereau ne contient AUCUN champ select/input pour choisir une mission.
- **R4** : Créer un bordereau sans sélectionner de mission → après enregistrement, `SELECT * FROM missions WHERE id = (SELECT mission_id FROM bordereaux WHERE id = NEW_ID)` renvoie bien 1 ligne (mission créée automatiquement).
- **R5** : Remplir la section « Gasoil » (quantité 100 L, prix/L prix actuel) dans le formulaire création, valider le bordereau → 1 BSM existe avec `numero` généré (ex. `2026-0138`), `montant = 100 * prix_litre` STORED correct, `bordereaux.bsm_id = newBsmId`.
- **R6** : Créer un bordereau SANS section gasoil (quantite = 0/null) → aucune insertion dans `bsm` pour ce bordereau ; `bsm_id = NULL` sur le bordereau.
- **R7** : Modifier un bordereau existant qui n'avait pas de gasoil, ajouter une quantité gasoil → 1 BSM est créé et lié au bordereau (EF5 cas 2).
- **R8** : Modifier un bordereau existant qui avait un `bsm_id`, changer la quantité gasoil → le BSM lié est modifié (UPDATE), son `montant` STORED est recalculé par SQLite.
- **R9** : Routes `/referentiels/camions`, `/referentiels/chauffeurs`, `/referentiels/usines`, `/operations/missions`, `/operations/bsm` → naviguent vers 404/home (ont été supprimées du routeur). L'accès à `/operations` redirige vers `/operations/bordereaux`.
- **R10** : Sidebar n'affiche plus les entrées Camions, Chauffeurs, Usines, Missions, BSM/Gasoil.
- **R11** : Fichiers de pages `camions/index.tsx`, `chauffeurs/index.tsx`, `usines/index.tsx`, `missions/index.tsx`, `bsm/index.tsx` → supprimés.
- **R12** : `cargo check` dans `src-tauri/` termine sans erreurs (exit code 0).
- **R13** : `npx tsc --noEmit` dans la racine termine sans erreurs (exit code 0).
- **R14** : Toute l'opération de création (mission + bordereau + lignes + bsm) dans `creer_bordereau` est exécutée dans une seule transaction SQL (`BEGIN … COMMIT` ; `ROLLBACK` si une étape échoue) : vérifiable par lecture du code source.
- **R15** : Une base existante (avant migration `user_version=2`) démarre correctement, la migration `v3` ajoute `bordereaux.bsm_id` nullable, et aucune donnée existante n'est perdue.

### rubric — Qualité

- **Q1 (Cohérence UX)** : À quel point les mini-formulaires inline (Camion/Chauffeur/Usine) sont-ils cohérents avec les mini-formulaires CGI/AV déjà présents ? Notation :
  - `2` = même pattern (bouton +, modal identique, `invalidateQueries` + `setValue` immédiat ; schémas Zod respectent les champs et messages des payloads Rust).
  - `1` = fonctionnel mais incohérences UI mineures (modal pas même largeur, pas d'invalidation de la liste).
  - `0` = pattern différent ou bugs majeurs (valeur non sélectionnée après création).
  - Seuil : ≥ 1.
- **Q2 (Lisibilité/Propriété du code)** : Nouvelles additions dans `bordereau.rs` (EF3 + EF5) respectent-elles la structure existante (verifications avant tx, tx unique, gestion d'erreurs) ?
  - `2` = respect intégral, commentaires alignés, pas de code dupliqué, fonctions helpers réutilisées.
  - `1` = code fonctionnel mais duplications ou ordre légèrement différent.
  - `0` = code hors transaction, verifications manquantes, ou erreurs de formatage.
  - Seuil : ≥ 1.
- **Q3 (Périmètre strict)** : La suppression des pages autonomes a-t-elle été faite sans effets de bord sur d'autres modules ?
  - `2` = Aucune import orpheline ; hooks/utilitaires conservés si utilisés ailleurs ; app compile.
  - `1` = 1 ou 2 warnings/avertissements TS sans conséquence (corrigés si besoin).
  - `0` = modules cassés (factures, impression, rapports) à cause de suppressions trop agressives.
  - Seuil : ≥ 1.
