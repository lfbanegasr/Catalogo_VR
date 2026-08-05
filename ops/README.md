# Operaci?n segura

## Migrar con respaldo

Configura una carpeta de respaldos fuera del repositorio y ejecuta:

```powershell
$env:CATALOGOVR_BACKUP_DIR = "C:\backups-catalogovr"
.\ops\safe_migrate.ps1
```

`safe_migrate.ps1` no llama a Alembic si `pg_dump` falla o el archivo no puede ser le?do por
`pg_restore`. Los respaldos contienen datos sensibles y no deben subirse a Git.
Si las herramientas PostgreSQL no estan instaladas, usa automaticamente Docker con
`postgres:18-alpine` mediante `backup_database_docker.ps1`.

El respaldo SQL no incluye `backend/uploads`. Antes de cambiar de proveedor hay que copiar esos
archivos a almacenamiento persistente u object storage y conservar sus URLs publicas.

## Probar restauraci?n

Crea una base PostgreSQL desechable distinta de producci?n y define su URL:

```powershell
$env:STAGING_RESTORE_DATABASE_URL = "postgresql://usuario:clave@host:5432/catalogovr_restore_test"
.\ops\restore_drill.ps1 -BackupPath "C:\backups-catalogovr\catalogovr-fecha.dump" -ConfirmReplaceTestDatabase
```

El segundo comando elimina y reconstruye objetos solamente dentro de la base indicada por
`STAGING_RESTORE_DATABASE_URL`; se niega a ejecutarse si coincide con `DATABASE_URL`.

## Staging

Usa `deploy/staging.env.example` como lista de variables, pero entrega valores reales desde el
panel del proveedor. Staging debe tener una base, dominio, secreto JWT y almacenamiento de
archivos diferentes de producci?n. Nunca copies clientes reales; usa `Demo Accesorios`.

## Smoke E2E

La prueba de lectura no modifica datos:

```powershell
python backend\scripts\e2e_staging_catalog.py --base-url https://staging-api.example.com
```

Para probar compra, variante, inventario y seguimiento sobre staging:

```powershell
python backend\scripts\e2e_staging_catalog.py --base-url https://staging-api.example.com --exercise-checkout --confirm STAGING
```
