# ============================================================
# Génère abaf_historique.db à partir du script SQL d'import
# Usage : .\generer_db_historique.ps1
# Requires : sqlite3.exe dans le PATH ou dans ce dossier
# ============================================================

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile    = Join-Path $scriptDir "import_historique.sql"
$outputDb   = Join-Path $scriptDir "abaf_historique.db"

# Chercher sqlite3 dans le PATH ou dans le dossier scripts
$sqlite3 = Get-Command sqlite3 -ErrorAction SilentlyContinue
if (-not $sqlite3) {
    $localSqlite = Join-Path $scriptDir "sqlite3.exe"
    if (Test-Path $localSqlite) {
        $sqlite3Exe = $localSqlite
    } else {
        Write-Error "sqlite3.exe introuvable. Téléchargez-le sur https://www.sqlite.org/download.html et placez-le dans $scriptDir"
        exit 1
    }
} else {
    $sqlite3Exe = $sqlite3.Source
}

# Supprimer l'ancienne base si elle existe
if (Test-Path $outputDb) {
    Remove-Item $outputDb -Force
    Write-Host "Ancienne base supprimée."
}

# Créer la base depuis le script SQL
Write-Host "Génération de la base historique..."
& $sqlite3Exe $outputDb ".read `"$sqlFile`""

if ($LASTEXITCODE -eq 0) {
    $size = (Get-Item $outputDb).Length / 1KB
    Write-Host "✓ Base générée : $outputDb ($([math]::Round($size,1)) KB)"
    Write-Host ""
    Write-Host "Pour importer dans ABAF :"
    Write-Host "  1. Lancez ABAF"
    Write-Host "  2. Allez dans Paramètres → Restaurer la base"
    Write-Host "  3. Sélectionnez : $outputDb"
} else {
    Write-Error "Erreur lors de la génération. Vérifiez le fichier SQL."
}
