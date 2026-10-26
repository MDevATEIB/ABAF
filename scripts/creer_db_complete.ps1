# Cree abaf_historique.db en combinant schema + donnees
# Usage : .\creer_db_complete.ps1

$scriptDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$schemaFile   = Join-Path $scriptDir "..\src-tauri\migrations\001_initial.sql"
$dataFile     = Join-Path $scriptDir "import_historique.sql"
$combinedFile = Join-Path $scriptDir "import_complet.sql"
$outputDb     = Join-Path $scriptDir "abaf_historique.db"

# Combiner schema + donnees
Write-Host "Combinaison schema + donnees..."
$schema = Get-Content $schemaFile -Raw -Encoding UTF8
$data   = Get-Content $dataFile   -Raw -Encoding UTF8
($schema + "`n" + $data) | Set-Content $combinedFile -Encoding UTF8
Write-Host "Fichier combine cree : $combinedFile"

# Chercher sqlite3.exe
$sqlite3Exe = $null
$candidates = @(
    "$scriptDir\sqlite3.exe",
    "$env:USERPROFILE\sqlite3.exe",
    "C:\sqlite\sqlite3.exe",
    "C:\tools\sqlite3.exe",
    "C:\sqlite3\sqlite3.exe",
    "C:\Program Files\sqlite3\sqlite3.exe"
)
foreach ($c in $candidates) {
    if (Test-Path $c) {
        $sqlite3Exe = $c
        break
    }
}
if (-not $sqlite3Exe) {
    $cmd = Get-Command sqlite3 -ErrorAction SilentlyContinue
    if ($cmd) { $sqlite3Exe = $cmd.Source }
}

if (-not $sqlite3Exe) {
    Write-Host ""
    Write-Host "sqlite3.exe introuvable."
    Write-Host "Telechargez-le sur : https://www.sqlite.org/download.html"
    Write-Host "Cherchez : sqlite-tools-win-x64-*.zip"
    Write-Host "Extrayez sqlite3.exe dans : $scriptDir"
    Write-Host "Puis relancez ce script."
    exit 1
}

Write-Host "sqlite3 trouve : $sqlite3Exe"

# Supprimer ancienne base
if (Test-Path $outputDb) {
    Remove-Item $outputDb -Force
    Write-Host "Ancienne base supprimee."
}

# Generer la base
Write-Host "Generation de la base..."
& $sqlite3Exe $outputDb ".read `"$combinedFile`""
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    $check = & $sqlite3Exe $outputDb "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('saisons','missions','factures');"
    $size  = [math]::Round((Get-Item $outputDb).Length / 1KB, 1)
    Write-Host ""
    Write-Host "Base generee : $outputDb ($size KB)"
    Write-Host "Tables OK    : $check/3"
    if ($check -eq "3") {
        Write-Host ""
        Write-Host "SUCCES - Pour importer dans ABAF :"
        Write-Host "  1. Lancez ABAF"
        Write-Host "  2. Parametres -> Restaurer la base"
        Write-Host "  3. Selectionnez : $outputDb"
    } else {
        Write-Host "ATTENTION : tables manquantes ($check/3). Verifiez le SQL."
    }
} else {
    Write-Host "ERREUR lors de la generation (code $exitCode)."
}
