param(
    [string]$DatabaseUrl = $env:DATABASE_URL,
    [string]$OutputDirectory = $env:CATALOGOVR_BACKUP_DIR,
    [string]$PostgresImage = "postgres:18-alpine"
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) { throw "DATABASE_URL no esta definida." }
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) { throw "Define CATALOGOVR_BACKUP_DIR fuera del repositorio." }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker no esta disponible." }

$normalizedUrl = $DatabaseUrl -replace '^postgresql\+psycopg2://', 'postgresql://'
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null
$backupName = "catalogovr-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".dump"

docker run --rm --env "DB_URL=$normalizedUrl" --env "BACKUP_NAME=$backupName" --volume "${resolvedOutput}:/backup" $PostgresImage sh -c 'pg_dump --dbname="$DB_URL" --format=custom --no-owner --no-acl --file="/backup/$BACKUP_NAME" && pg_restore --list "/backup/$BACKUP_NAME" >/dev/null'
if ($LASTEXITCODE -ne 0) { throw "El respaldo Docker fallo. No se deben ejecutar migraciones." }

$backup = Get-Item -LiteralPath (Join-Path $resolvedOutput $backupName)
if ($backup.Length -lt 1024) { throw "El respaldo generado es demasiado pequeno." }
Write-Output $backup.FullName
