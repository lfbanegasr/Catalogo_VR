# Despliegues sin p?rdida de datos

Un `git commit`, `git push` o la compilaci?n de los frontends no modifica PostgreSQL. Los datos
solo cambian cuando el backend ejecuta SQL, una migraci?n o un seeder contra la URL configurada
en `DATABASE_URL`.

## Reglas del proyecto

1. La base de producci?n debe vivir en almacenamiento persistente y conservar la misma
   `DATABASE_URL` entre despliegues.
2. Las migraciones de producci?n avanzan ?nicamente con `alembic upgrade head`. No se usa
   `alembic downgrade`, `Base.metadata.drop_all()` ni recreaci?n de esquema.
3. Una migraci?n que renombre, convierta o elimine una columna requiere primero una migraci?n
   compatible de transici?n y una copia de seguridad verificada.
4. `scripts/seed_dev.py` y `scripts/seed_superadmin_only.py` son legados de desarrollo y no
   forman parte del despliegue.
5. `scripts/seed_accessories_store.py` solo administra la tienda aislada `demo-accesorios`,
   necesita `--apply` y no elimina filas.

## Lista de verificaci?n antes de desplegar

Desde `backend`, confirma que el c?digo tiene un ?nico destino de migraci?n:

```powershell
.\venv\Scripts\python.exe -m alembic heads
.\venv\Scripts\python.exe -m alembic current
```

Crea una copia en formato restaurable. La carpeta `backups` debe estar fuera del repositorio y
protegida como secreto operacional:

```powershell
$backupFile = Join-Path "C:\backups-catalogovr" ("catalogovr-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".dump")
pg_dump --dbname="$env:DATABASE_URL" --format=custom --no-owner --no-acl --file="$backupFile"
Get-Item $backupFile
```

Si el archivo existe y tiene un tama?o razonable, aplica la migraci?n:

```powershell
.\venv\Scripts\python.exe -m alembic upgrade head
.\venv\Scripts\python.exe -m alembic current
```

Despu?s del despliegue verifica `/health`, `/ready`, el inicio de sesi?n, el cat?logo p?blico y
un pedido de prueba. No ejecutes ning?n seeder como parte autom?tica del arranque del servidor.

## Recuperaci?n

Una copia no se considera v?lida hasta comprobar que puede restaurarse en una base temporal.
Nunca pruebes una restauraci?n encima de producci?n. Ante un fallo de migraci?n, det?n el
despliegue, conserva la base original y restaura la copia en una instancia separada para analizar
el problema antes de decidir el siguiente paso.

Las contrase?as que alguna vez hayan sido escritas en archivos versionados deben rotarse: borrar
el texto en un commit nuevo no lo elimina del historial anterior de Git.
