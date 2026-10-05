# Demo Setup — Catalogo VR

> Instrucciones para crear y mostrar una tienda demo sin datos reales.

---

## ¿Qué es una tienda demo?

Una tienda demo es un tenant completo con productos, categorías, ofertas y tema
configurado, creado con datos ficticios. Permite mostrar todas las funciones de
la plataforma a clientes o reclutadores sin exponer datos reales de ninguna
tienda activa.

---

## Prerequisitos

- Backend corriendo localmente o en Render
- Base de datos conectada y con migraciones aplicadas
- Venv de Python activo

---

## Paso 1 — Crear el superadmin (si no existe)

```powershell
cd backend
python scripts/bootstrap_superadmin.py --email admin@demo.catalogovr.app --password "<TU_PASSWORD_ADMIN>"
```

> ⚠ **Nunca confirmes contraseñas demo en Git.** Usa el script interactivamente
> o mediante variables de entorno y borra la contraseña del historial de la terminal con `Clear-History`.

---

## Paso 2 — Crear tienda(s) demo

### Tienda de accesorios (demo principal versionada, recomendada)

```powershell
python scripts/seed_accessories_store.py
```

Crea:
- Tienda `demo-accesorios` con tema `modern_banner` rosa
- 5 categorías (Anillos, Aretes, Collares, Pulseras, Sets)
- 30+ productos con imágenes, variantes y atributos
- 2 campañas de ofertas activas

### Tienda de joyería (vacía — para mostrar el onboarding)

```powershell
python scripts/seed_empty_jewelry_store.py
```

---

## Paso 3 — Acceder al catálogo demo

```
Catálogo público:  http://localhost:5173/?slug=demo-accesorios
Panel admin:       http://localhost:5174
  Email:           admin@demo.catalogovr.app
  Contraseña:      [la que configuraste en el paso 1]
```

---

## Paso 4 — Modo demo de solo lectura (opcional)

Para presentaciones o demos públicas donde quieras evitar que alguien modifique
datos, configura la variable de entorno:

```env
# backend/.env
DEMO_MODE=true
DEMO_READONLY=true
```

> ⚠ El modo demo de solo lectura **no está implementado** actualmente. Para
> proteger una demo pública, se recomienda:
> 1. Crear un usuario con rol `empleado` para mostrar el panel (sin permisos de borrado).
> 2. No compartir credenciales de admin en la demo pública.

---

## Capturas recomendadas para Upwork

Para tu portafolio en Upwork, captura las siguientes pantallas:

| # | Pantalla | URL / acción |
|---|----------|-------------|
| 1 | **Hero del catálogo** con banner, categorías y productos destacados | `/?slug=demo-accesorios` |
| 2 | **Drawer de carrito** con productos agregados | Agregar 2-3 productos → botón carrito |
| 3 | **Detalle de producto** con galería y variantes | Clic en cualquier producto |
| 4 | **Modal de filtros** con atributos | Botón "Filtros" en el catálogo |
| 5 | **Panel de administración** — pantalla de productos | `localhost:5174/admin/catalog` |
| 6 | **Editor de tema** con vista previa en tiempo real | `localhost:5174/admin/theme` |
| 7 | **Pantalla de ventas** con tabla de pedidos | `localhost:5174/admin/sales` |
| 8 | **Página de privacidad** | `/?slug=demo-accesorios&page=privacy` |

Nota: La carpeta `docs/screenshots/` está contemplada como destino local para organizar los activos gráficos de tu portafolio personal antes de publicarlos en Upwork o plataformas similares.

---

## Notas de seguridad

- Los scripts de seed nunca crean datos en producción si `ENVIRONMENT=production`.
- Los scripts están en `.gitignore` (`backend/scripts/seed*.py`) salvo los
  aprobados explícitamente.
- Las contraseñas demo no deben aparecer en commits, issues ni en el README.

---

## Limpiar la demo

Si necesitas resetear la base de datos de desarrollo:

```powershell
# ¡Solo en desarrollo!
# Borra y recrea la BD (requiere acceso a PostgreSQL)
dropdb tienda_db && createdb tienda_db
alembic upgrade head
python scripts/seed_accessories_store.py
```
