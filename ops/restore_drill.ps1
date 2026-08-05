param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,
    [string]$TestDatabaseUrl = $env:STAGING_RESTORE_DATABASE_URL,
    [string]$ProductionDatabaseUrl = $env:DATABASE_URL,
    [switch]$ConfirmReplaceTestDatabase
)

$ErrorActionPreference = "Stop"
if (-not $ConfirmReplaceTestDatabase) {
    throw "Este simulacro reemplaza la base de PRUEBA. Repite con -ConfirmReplaceTestDatabase."
}
if (-not (Test-Path -LiteralPath $BackupPath)) {
    throw "No existe el respaldo: $BackupPath"
}
if ([string]::IsNullOrWhiteSpace($TestDatabaseUrl)) {
    throw "Define STAGING_RESTORE_DATABASE_URL con una base desechable separada."
}

$testUrl = $TestDatabaseUrl -replace '^postgresql\+psycopg2://', 'postgresql://'
$productionUrl = $ProductionDatabaseUrl -replace '^postgresql\+psycopg2://', 'postgresql://'
if ($testUrl -eq $productionUrl) {
    throw "La base de prueba coincide con producci?n. Simulacro cancelado."
}

& pg_restore --clean --if-exists --no-owner --no-acl --dbname=$testUrl $BackupPath
if ($LASTEXITCODE -ne 0) {
    throw "La restauraci?n de prueba fall? con c?digo $LASTEXITCODE."
}

& psql --dbname=$testUrl --command="SELECT version_num FROM alembic_version;" --command="SELECT COUNT(*) AS tiendas FROM tiendas;" --command="SELECT COUNT(*) AS productos FROM productos;"
if ($LASTEXITCODE -ne 0) {
    throw "La restauraci?n termin?, pero las comprobaciones SQL fallaron."
}

Write-Host "Simulacro de restauraci?n completado sobre la base de prueba."
