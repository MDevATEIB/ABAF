# ABAF Terrain — mobile

Application **Expo Router / React Native TypeScript** de saisie terrain pour le
module *Exploitation* d'ABAF (transport coton graine). Elle fonctionne **hors
ligne** sur un SQLite local et se synchronise avec le serveur HTTP intégré au
desktop ABAF (axum, port **9470**).

## Rôles

- **Desktop = serveur & source de vérité.** Le mobile ne manipule **que** des
  UUID (jamais les `INTEGER` internes du PC).
- **Mobile = client offline-first.** Toute écriture est locale d'abord
  (`sync_state = pending`), poussée ensuite.

## Lancer l'application

```bash
cd mobile
npm install
npm start        # ou : npx expo start
```

Scanner le QR code avec **Expo Go** (aucun dev client requis). Autoriser HTTP
clair sur le réseau local (déjà configuré dans `app.json`).

## Parcours

1. **Connexion / appairage** (`app/index.tsx`) : détection automatique des
   passerelles (`192.168.43.1`, `172.20.10.1`, `192.168.137.1`) via
   `GET /sync/hello` ou saisie manuelle `IP:port`, puis code à 6 chiffres généré
   au desktop. Le jeton (32 o) est stocké dans `expo-secure-store`.
2. **Onglets** : *Aujourd'hui*, *Dépenses*, *＋* (nouvelle dépense + photo),
   *Synchro* (état, file, curseur, journal des conflits).
3. **Référentiels** : consultation / création rapide d'intervenants et de pièces.

## Architecture

- `src/db/` — ouverture SQLite, schéma local, repos (`depenses`, `referentiels`)
  qui posent toujours `sync_state`.
- `src/sync/` — moteur `engine.ts` (verrou mutuel, **push → photos → pull**),
  client HTTP typé, découverte, appairage, résolution de conflits.
- `src/store/` — zustand : `session`, `sync`, `catalogue`.
- `src/types/api.ts` — miroir TypeScript des payloads réseau ; **à maintenir en
  pas** avec `src-tauri/src/sync/payloads.rs`.

## Règles de synchronisation

- Dépense déjà **validée / rejetée** au bureau → le **PC gagne**, le push est
  `rejected` et visible au journal (« Corriger et revérifier » repasse en
  `pending`).
- Brouillon → *last-write-wins* sur `updated_at`.
- Référentiel créé sur le terrain avec une clé métier existante (immatriculation,
  nom) → réponse `merged`, UUID réécrit via `uuid_alias`.
- Photos JPEG 1280 px / qualité 0.6, poussées par lots ≤ 4 Mo, purgées localement
  après acquittement.

## Vérification & test manuel

```bash
npx tsc --noEmit     # typecheck strict, doit sortir 0
```

Scénario de bout en bout (deux téléphones + PC) détaillé dans
[TESTING.md](TESTING.md).
