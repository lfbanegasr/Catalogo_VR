# Seeder de tienda de joyeria vacia

Reinicia la tienda "YR Accesorios" con el slug "yr-accesorios", sin productos.
Incluye las categorias Anillos, Aros, Cadenas y Manillas, junto con atributos,
opciones, filtros y configuracion para variantes.

El reinicio es transaccional y requiere las dos confirmaciones --apply y
--reset-catalog. Elimina ventas y catalogo de prueba, pero conserva la tienda
y sus usuarios administrativos.

Desde la carpeta backend:

    .envScriptspython.exe scriptsseed_empty_jewelry_store.py
    .envScriptspython.exe -m alembic upgrade head
    .envScriptspython.exe scriptsseed_empty_jewelry_store.py --apply --reset-catalog

Para crear el administrador opcional:

    $env:EMPTY_JEWELRY_ADMIN_PASSWORD = "una-clave-segura"
    .envScriptspython.exe scriptsseed_empty_jewelry_store.py --apply
    Remove-Item Env:EMPTY_JEWELRY_ADMIN_PASSWORD

La cuenta opcional es "admin@yr-accesorios.local". Para cambiar deliberadamente una
contrasena existente, usa tambien --reset-admin-password.
