# Builder l'APK Android — ABAF Terrain

Configuration native : `app.json` (workflow **géré** — le dossier `android/` est
généré par `expo prebuild`, jamais committé). Identifiant figé :
`com.abaf.terrain`, `versionCode` 1.

## Prérequis (voies locales)

| Outil | Version | Vérification |
|---|---|---|
| Node | ≥ 20 | `node -v` |
| JDK | **17** ( LTS ) | `java -version` |
| Android SDK (plateforme + build-tools + platform-tools) | API 34+ | Android Studio → SDK Manager |
| `ANDROID_HOME` | ex. `C:\Users\<vous>\AppData\Local\Android\Sdk` | `echo $env:ANDROID_HOME` |

`npx expo-doctor` (réseau requis) contrôle l'ensemble.

## Voie A — APK local via EAS (recommandée si compte Expo disponible)

`eas build --local` compile **sur ta machine** (rien n'est envoyé au cloud,
seuls les identifiants/keystore transitent par le compte Expo) ; le profil
`preview` d'[eas.json](eas.json) produit un `.apk` :

```powershell
cd mobile
npm install -g eas-cli
eas login                      # une fois
eas build --profile preview --platform android --local
```

L'APK final atterrit dans `mobile/build/` (ou le chemin affiché en fin de build).

## Voie B — APK local 100 % Gradle (sans aucun compte)

### 1. Générer le projet natif

```powershell
cd mobile
npx expo prebuild --platform android --clean
```

### 2. Créer le keystore de signature (une seule fois, à garder précieusement)

```powershell
keytool -genkeypair -v -storetype PKCS12 `
  -keystore abaf-terrain.keystore -alias abaf-terrain `
  -keyalg RSA -keysize 2048 -validity 10000
```

Placer `abaf-terrain.keystore` **hors du dépôt** (il est ignoré par git), et
créer `mobile/android/keystore.properties` (également ignoré) :

```properties
storeFile=C:/chemin/vers/abaf-terrain.keystore
storePassword=<mot de passe>
keyAlias=abaf-terrain
keyPassword=<mot de passe>
```

### 3. Raccorder la signature au Gradle

Dans `mobile/android/app/build.gradle`, insérer au début (après le `apply`
`exponent.gradle` existant) :

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

et dans `android { ... }`, remplacer/ajouter le bloc `signingConfigs` :

```gradle
signingConfigs {
    release {
        if (keystorePropertiesFile.exists()) {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        shrinkResources true
    }
}
```

### 4. Compiler

```powershell
cd android
.\gradlew assembleRelease
```

APK signé : `android/app/build/outputs/apk/release/app-release.apk`.

> ⚠️ Après chaque `prebuild --clean`, le dossier `android/` est régénéré :
> refaire l'étape 3 (ou le verser dans un plugin config `withGradleSigning`,
> à faire si les builds deviennent fréquents).

## Voie C — Cloud EAS (si Internet et quota)

```powershell
eas build --profile preview --platform android
```

Build sur les serveurs Expo, lien de téléchargement en fin de queue.

## Après le build

1. Installer : copier l'APK sur le téléphone (ou `adb install -r app-release.apk`).
2. Vérifier le scénario [TESTING.md](TESTING.md) §2 à §5 **avec l'APK** (Expo Go
   n'est plus nécessaire) : l'app doit joindre le poste en `http://<ip-du-pc>:9470`
   — `usesCleartextTraffic` est déjà actif, aucune config TLS requise sur réseau
   local.
3. Versionner à chaque livraison : incrémenter `android.versionCode` (et
   `version` pour le nommage) dans `app.json` — `appVersionSource` est
   « local », c'est manuel.

## Fichiers préparés

| Fichier | Rôle |
|---|---|
| `app.json` | package `com.abaf.terrain`, versionCode, icônes, splash, permissions caméra/photos |
| `eas.json` | profils development / preview (APK) / production (AAB) |
| `assets/*.png` | icônes **provisoires** (script régénérable : `assets/make-icons.ps1`) |
| `.gitignore` | `android/`, `ios/`, keystores et `keystore.properties` exclus |
