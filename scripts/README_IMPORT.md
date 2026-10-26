# Import historique ABAF – 5 campagnes

## Contenu

Le fichier `import_historique.sql` contient toutes les données des 5 campagnes
extraites des fichiers Excel fournis.

### Données importées

| Campagne    | Coton (t)  | Intrant (t) | Montant total (FCFA) | Statut  |
|-------------|-----------|-------------|---------------------|---------|
| 2021-2022   | 7 033      | 2 479       | 147 014 288         | Fermée  |
| 2022-2023   | 3 887      | 1 531       | 104 132 679         | Fermée  |
| 2023-2024   | 3 393      | 1 538       | 100 488 742         | Fermée  |
| 2024-2025   | 1 584      | 834         | 49 847 164          | Fermée  |
| 2025-2026   | 2 588      | 965         | 70 513 434          | Active  |

### Références incluses

- **Facture 138/ABAF/MD/2026** (24/04/2026, camion 08T0681A, usine Moundou)
- **Facture 202/ABAF/MD/2026** (14/07/2026, camion 18P2908A, usine Moundou)

## Option 1 : Générer la base .db (recommandé)

Prérequis : avoir `sqlite3.exe` dans le PATH ou dans le dossier `scripts/`.
Téléchargement : https://www.sqlite.org/download.html → "Precompiled Binaries for Windows"

```powershell
cd c:\Dev\ABAF\scripts
.\generer_db_historique.ps1
```

Cela crée `scripts/abaf_historique.db`.

## Option 2 : Import via l'interface ABAF

1. Lancez ABAF (`npm run tauri dev`)
2. **Paramètres** → **Restaurer la base**
3. Sélectionnez `c:\Dev\ABAF\scripts\abaf_historique.db`
4. Confirmez — l'application redémarre avec toutes les données

## Option 3 : Import direct SQLite

Si vous avez accès direct à la base ABAF :

```powershell
$db = "$env:APPDATA\com.abaf.gestion\abaf.db"
sqlite3 $db ".read c:\Dev\ABAF\scripts\import_historique.sql"
```

## Notes importantes

- Les numéros de bordereaux suivent le format `{annee}-{seq:04d}`
- Les factures historiques sont au statut **payée** sauf indication contraire
- Les paiements utilisent des dates estimées en fin de mois
- Les montants sont tirés directement des colonnes "Montant" des fichiers Excel
- Les BSM (gasoil) sont créés pour les lignes ayant une valeur dans la colonne BMS
- `PRAGMA user_version = 6` est appliqué pour que les migrations ABAF ne re-tournent pas
