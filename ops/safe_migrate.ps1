param(
    [string]$DatabaseUrl = $env:DATABASE_URL,
    [string]$OutputDirectory = $env:CATALOGOVR_BACKUP_DIR,
    [string]$BackendDirectory = (Join-Path $PSScriptRoot "..\backend")
)

$ErrorActionPreference = "Stop"
$backendPath = [System.IO.Path]::GetFullPath($BackendDirectory)
$pythonPath = Join-Path $backendPath "venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw "No se encontr? el Python del backend: $pythonPath"
}

$backupScript = if (Get-Command pg_dump -ErrorAction SilentlyContinue) {
    Join-Path $PSScriptRoot "backup_database.ps1"
} elseif (Get-Command docker -ErrorAction SilentlyContinue) {
    Join-Path $PSScriptRoot "backup_database_docker.ps1"
} else {
    throw "Instala pg_dump o Docker antes de migrar."
}
$backupPath = & $backupScript `
    -DatabaseUrl $DatabaseUrl `
    -OutputDirectory $OutputDirectory
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($backupPath)) {
    throw "No se obtuvo un respaldo v?lido. Migraci?n cancelada."
}

$previousDatabaseUrl = $env:DATABASE_URL
try {
    $env:DATABASE_URL = $DatabaseUrl
    Push-Location $backendPath
    & $pythonPath -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) {
        throw "Alembic termin? con c?digo $LASTEXITCODE. Conserva el respaldo: $backupPath"
    }
    & $pythonPath -m alembic current
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo verificar la revisi?n de Alembic."
    }
}
finally {
    Pop-Location
    $env:DATABASE_URL = $previousDatabaseUrl
}

Write-Host "Migraci?n segura completada. Respaldo: $backupPath"
