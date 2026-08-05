# Seeder de la tienda de accesorios

Este seeder crea una tienda demo independiente llamada **Demo Accesorios** con el slug
`demo-accesorios`. Incluye categorías jerárquicas, atributos filtrables, opciones, 12 productos,
variantes con SKU y stock, imágenes, tema visual y una oferta de lanzamiento.

## Seguridad de datos

- El modo predeterminado es una simulación y no abre ni modifica la base de datos.
- Solo escribe al recibir `--apply`.
- Toda la escritura ocurre en una transacción: ante un error se ejecuta `rollback`.
- No contiene operaciones `DELETE`, `TRUNCATE`, `DROP` ni recreación de tablas.
- No modifica tiendas que no lleven el marcador interno `accessories_catalog_v1`.
- Puede ejecutarse nuevamente: reutiliza los mismos registros y actualiza los datos del seed.
- Verifica que la base esté en el `head` de Alembic antes de escribir.
- Nunca cambia una contraseña existente salvo que se use explícitamente
  `--reset-admin-password`.

## Uso

Desde la carpeta `backend`:

```powershell
.\venv\Scripts\python.exe scripts\seed_accessories_store.py
```

La salida anterior solo muestra el plan. Para crear o actualizar la tienda demo:

```powershell
.\venv\Scripts\python.exe -m alembic upgrade head
.\venv\Scripts\python.exe scripts\seed_accessories_store.py --apply
```

La tienda queda disponible en el catálogo público usando `?slug=demo-accesorios`.

## Administrador opcional

La cuenta `admin@demo-accesorios.local` solo se crea si la contraseña se entrega mediante una
variable de entorno, para evitar contraseñas fijas dentro del repositorio:

```powershell
$env:ACCESSORIES_SEED_ADMIN_PASSWORD = "una-clave-segura"
.\venv\Scripts\python.exe scripts\seed_accessories_store.py --apply
Remove-Item Env:ACCESSORIES_SEED_ADMIN_PASSWORD
```

Una repetición normal conserva la contraseña existente. Para reemplazarla deliberadamente:

```powershell
$env:ACCESSORIES_SEED_ADMIN_PASSWORD = "otra-clave-segura"
.\venv\Scripts\python.exe scripts\seed_accessories_store.py --apply --reset-admin-password
Remove-Item Env:ACCESSORIES_SEED_ADMIN_PASSWORD
```

El número de WhatsApp creado es un marcador (`59170000000`); debe cambiarse desde la
administración antes de publicar la tienda.
