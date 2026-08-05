param(
    [string]$DatabaseUrl = $env:DATABASE_URL,
    [string]$OutputDirectory = $env:CATALOGOVR_BACKUP_DIR
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    throw "DATABASE_URL no est? definida."
}
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    throw "Define CATALOGOVR_BACKUP_DIR fuera del repositorio o usa -OutputDirectory."
}
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    throw "pg_dump no est? instalado o no est? disponible en PATH."
}
if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) {
    throw "pg_restore no est? instalado o no est? disponible en PATH."
}

$normalizedUrl = $DatabaseUrl -replace '^postgresql\+psycopg2://', 'postgresql://'
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $resolvedOutput "catalogovr-$timestamp.dump"

& pg_dump --dbname=$normalizedUrl --format=custom --no-owner --no-acl --file=$backupPath
if ($LASTEXITCODE -ne 0) {
    throw "pg_dump termin? con c?digo $LASTEXITCODE. No se ejecutar?n migraciones."
}

$backup = Get-Item -LiteralPath $backupPath
if ($backup.Length -lt 1024) {
    throw "El respaldo es demasiado peque?o ($($backup.Length) bytes): $backupPath"
}

& pg_restore --list $backupPath | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "pg_restore no pudo leer el respaldo: $backupPath"
}

Write-Output $backup.FullName
