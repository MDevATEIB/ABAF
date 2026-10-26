# ABAF Terrain — protocole de test manuel

Application mobile **Expo Go** (offline-first) synchronisée avec le serveur HTTP
intégré au desktop ABAF (`src-tauri`, axum, port **9470**). Ce document décrit le
scénario de bout en bout à suivre sur deux téléphones et un PC.

## 0. Prérequis

- **PC** : application ABAF desktop lancée, base `abaf.db` avec une campagne
  (saison) **ouverte** et au moins un camion + un chauffeur (référentiels que le
  mobile tirera).
- **Serveur sync** : Paramètres → carte **Synchronisation mobile** → interrupteur
  serveur **actif** (port 9470). Noter les **IP affichées** à donner au terrain.
- **Pare-feu Windows** : bouton « Configurer le pare-feu » (élévation requise) pour
  autoriser TCP 9470 + UDP 9471 en entrée, **ou** règle manuelle :
  ```powershell
  netsh advfirewall firewall add rule name="ABAF Sync" dir=in action=allow protocol=TCP localport=9470
  netsh advfirewall firewall add rule name="ABAF Sync UDP" dir=in action=allow protocol=UDP localport=9471
  ```
- **Téléphones** : Expo Go installé. Depuis `mobile/`, lancer `npm start` (ou
  `npx expo start`) et scanner le QR code. HTTP clair est autorisé
  (`android.usesCleartextTraffic`) — pas besoin de HTTPS sur le réseau local.

> Le mobile ne manipule **que** des UUID ; jamais les `INTEGER` internes du PC.

## 1. Topologie réseau (les deux sens sont supportés)

Le PC tient **toujours** le rôle de serveur ; seul le hotspot change.

- **Hotspot du téléphone** : le PC se connecte au partage de connexion du
  téléphone. Le mobile cherche alors le PC sur la passerelle du réseau hotspot
  (`192.168.43.1` Android / `172.20.10.1` iPhone) ou l'IP affichée par le desktop.
- **Hotspot du PC** : les téléphones se connectent au partage de connexion Windows ;
  passerelle `192.168.137.1`.

⚠️ Certains hotspots Android pratiquent l'**isolation client** : dans ce cas le PC
doit être **client** du hotspot du téléphone (pas l'inverse). L'app restant
utilisable hors ligne, aucun test n'est bloqué par ce point.

## 2. Connexion + appairage (téléphone A)

1. Ouvrir l'app → écran **Connexion**. Le scan automatique sonde les 3 passerelles
   candidates via `GET /sync/hello` ; le téléphone détecté apparaît comme
   « PC connecté ». Sinon, saisir manuellement `IP:port` (ex. `192.168.137.1:9470`).
2. Sur le **PC** : Paramètres → Synchronisation mobile → **Générer un code
   d'appairage** (6 chiffres, valable **10 min**, usage unique).
3. Sur le téléphone : saisir le **code**, le **nom de l'appareil** (ex. « Terrain 1 »)
   et l'**agent** (nom du saisisseur terrain) → **Appairer**.
4. Le téléphone reçoit un **jeton** (32 o) stocké dans `expo-secure-store` (jamais
   en clair dans SQLite). Le pied d'écran passe à « PC connecté ».

## 3. Saisie hors ligne + photos (téléphones A et B)

**Sans réseau** (mode avion), sur chaque téléphone :

1. Onglet **＋** → formulaire dépense : catégorie (puces), désignation, **montant
   FCFA**, camion / chauffeur / apprenti / mécanicien (listes issues du cache tiré
   précédemment), quantité/unité, date, lieu, observations.
2. **Photo** : prendre / galerie → compression immédiate JPEG 1280 px / qualité
   0.6 (~200–400 Ko), base64 mise en file `photos_en_attente`.
3. Créer au moins **3 dépenses** avec photos sur le téléphone A, et **2 dépenses**
   sur le téléphone B. Badge « en attente » visible sur chaque ligne.

**Sur le téléphone B**, créer un nouvel **apprenti** (Écran Intervenants → ＋) nommé
ex. « Bahit Aldji ». **Sur le téléphone A**, créer un intervenant avec le **même
nom** et le **même rôle** — la fusion sera vérifiée à l'étape 5.

## 4. Première synchronisation

1. Rétablir le réseau. Onglet **Synchro** → **Synchroniser maintenant** (la synchro
   se déclenche aussi automatiquement au retour au premier plan / recouvrement
   réseau / toutes les 60 s).
2. Orchestration : **push** (lots de 50 lignes) → **photos** (lots ≤ 4 Mo) →
   **pull** (oplog par `lvn`, paginé). Barre de progression + compteurs.
3. Sur le **PC** : module **Exploitation → Dépenses de terrain** : toutes les
   dépenses apparaissent avec `statut = brouillon`, `source = mobile`, badge
   « saisie sur le terrain » et le nom de l'appareil d'origine. Les photos sont
   lisibles depuis le détail (`GET /sync/justificatif/{uuid}`).

## 5. Règles de conflit (le bureau gagne)

1. Sur le **PC**, **valider** une dépense mobile (bouton *Valider*).
2. Sur le **téléphone**, **modifier** cette même dépense puis resynchroniser.
3. Résolution attendue : le push renvoie `status = rejected`,
   `motif = déjà_traitee_au_bureau`. La ligne passe en `sync_state = conflit`,
   s'inscrit au **journal** (onglet Synchro) avec le libellé « le poste a gagné »
   et la ligne serveur en regard. Action **« Corriger et revérifier »** repasse la
   ligne en `pending` pour un nouveau push volontaire.
4. **Fusion par clé métier** : les deux apprentis « Bahit Aldji / mécanicien » créés
   sur A et B sont fusionnés côté serveur en **un seul** enregistrement ; le second
   téléphone reçoit `status = merged` + `merged_into`, réécrit son UUID via
   `uuid_alias` et supprime sa ligne locale dupliquée.

## 6. Avertissement d'horloge

LWW compare les `updated_at` (format SQLite UTC, sans `T` ni `Z`). Le serveur
réétalonne `server_time` à chaque pull ; si l'écart horloge du téléphone dépasse
**5 min**, un avertissement s'affiche sur l'écran **Synchro**.

## 7. Multi-appareils et révocation

- Chaque écriture porte son `device_id` + `agent` (visible au desktop).
- Paramètres desktop → table des **appareils** : nom, agent, dernière synchro,
  nb de lignes. Bouton **Révoquer** → le jeton du téléphone devient invalide ;
  au prochain push il reçoit `403 appareil_revoque`, est **déconnecté** et doit être
  ré-appairé.

## 8. Vérifications techniques (hors scénario)

Depuis `mobile/` :

```bash
npx tsc --noEmit        # typecheck strict, doit sortir 0
```

Le contrat réseau est détaillé dans [src/types/api.ts](src/types/api.ts) — miroir
à maintenir en pas avec `src-tauri/src/sync/payloads.rs`.

## 9. Recette desktop associée

- Tableau de bord : charges et **marge nette** affichées.
- Exploitation → **Rentabilité** : CA net − charges validées, marge par camion,
  répartition par catégorie, exports Excel / PDF (bloc « Synthèse exploitation »).
- Les charges **ne touchent ni** aux factures **ni** au CDC v1.1 : agrégation pure.
