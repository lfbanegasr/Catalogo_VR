# Seeder de tienda de joyería vacía

Reinicia la tienda "YR Accesorios" con el slug "yr-accesorios", sin productos.
Incluye las categorías Anillos, Aros, Cadenas y Manillas, junto con atributos,
opciones, filtros y configuración para variantes.

El reinicio es transaccional y requiere las dos confirmaciones `--apply` y
`--reset-catalog`. Elimina ventas y catálogo de prueba, pero conserva la tienda
y sus usuarios administrativos.

Desde la carpeta `backend`:

```powershell
.\venv\Scripts\python.exe scripts\seed_empty_jewelry_store.py
.\venv\Scripts\python.exe -m alembic upgrade head
.\venv\Scripts\python.exe scripts\seed_empty_jewelry_store.py --apply --reset-catalog
```

Para crear el administrador opcional:

```powershell
$env:EMPTY_JEWELRY_ADMIN_PASSWORD = "<TU_PASSWORD_ADMIN>"
.\venv\Scripts\python.exe scripts\seed_empty_jewelry_store.py --apply
Remove-Item Env:EMPTY_JEWELRY_ADMIN_PASSWORD
```

La cuenta opcional es `admin@yr-accesorios.local`. Para cambiar deliberadamente una
contraseña existente, usa también `--reset-admin-password`.
