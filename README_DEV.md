# Desarrollo Local (Backend)

> Para documentación completa del proyecto ver [README.md](../README.md).

## 1) Activar el entorno virtual (PowerShell)

```powershell
cd backend
.\venv\Scripts\Activate.ps1
```

## 2) Instalar dependencias

```powershell
pip install -r requirements.txt
```

## 3) Migraciones

```powershell
alembic upgrade head
```

Incluye cambios recientes de panel privado (CRUD completo) como `usuarios.activo`.

## 4) Datos demo

```powershell
python scripts/seed_accessories_store.py
```

El comando anterior crea una tienda demo de accesorios completa. Ver
`docs/DEMO.md` para opciones adicionales de seed.

**Nota:** `scripts/seed_dev.py` es legado y se limita a desarrollo local.
No debe ejecutarse contra una base de producción.

Para probar un catálogo completo y aislado de accesorios usa el seeder
no destructivo documentado en `backend/scripts/README_accessories_seed.md`.

## 5) Levantar FastAPI

```powershell
uvicorn main:app --reload
```

Servicio esperado: `http://127.0.0.1:8000`

## VS Code / Pylance

- El repo incluye `.vscode/settings.json` para apuntar a `backend/venv/Scripts/python.exe`.
- Si VS Code sigue mostrando imports no resueltos:
  1. Abre la paleta (`Ctrl+Shift+P`)
  2. Ejecuta `Python: Select Interpreter`
  3. Selecciona `backend\venv\Scripts\python.exe`
  4. Ejecuta `Developer: Reload Window`

## Nota

- Los imports internos del backend (`api`, `middleware`, `crud`, `models`, `schemas`, `core`) se resuelven vía `python.analysis.extraPaths` apuntando a `backend/`.

## Bootstrap superadmin

Si aún no tienes un superadmin inicial:

```powershell
python scripts/bootstrap_superadmin.py --email superadmin@tuapp.com --password "Cambiar123!"
```

Esto crea (o actualiza) un usuario `superadmin` y una tienda técnica `platform-root`.

## Seeder legado de superadministrador

`scripts/seed_superadmin_only.py` se conserva únicamente por compatibilidad local. No debe
ejecutarse durante un despliegue porque modifica una cuenta existente. Para crear el primer
superadministrador usa `bootstrap_superadmin.py` con una contraseña segura entregada de forma
explícita y luego elimina esa contraseña del historial de la terminal.

Antes de desplegar sigue `docs/DATABASE_DEPLOYMENT_SAFETY.md`.

## Arquitectura de rutas (actual)

- Público: `/api/public/*`
- Auth: `/api/auth/*`
- Sesión actual: `/api/me`
- Catálogo privado por tenant: `/api/catalog/*`
- Admin plataforma (superadmin): `/api/admin/tiendas`, `/api/admin/users`
- Auditoría admin: `/api/admin/audit-logs`, `/api/admin/public-events`

## Themes por tienda

- El catálogo público consume `tienda.theme_id` y `tienda.theme_config` desde `GET /api/public/catalog/{slug}`.
- Si la tienda no tiene theme configurado, el frontend usa fallback `modern_banner`.
- Upload de banner para themes: `POST /api/catalog/theme/banner`
  - Guarda archivos en `backend/uploads/theme/`
  - Retorna `hero_image_url` listo para persistir en `theme_config`

### Ejemplo `modern_banner`

```json
{
  "primary": "#E94B8A",
  "secondary": "#F8BBD0",
  "background": "#FFF7FA",
  "text": "#1F1F1F",
  "muted": "#6B7280",
  "radius": 16,
  "hero_image_url": "/uploads/theme/hero1.webp",
  "show_offers": true,
  "show_featured": true,
  "category_style": "round_icons",
  "font_scale": "md"
}
```

### Ejemplo `soft_beige`

```json
{
  "primary": "#C89B8C",
  "secondary": "#E7D3CA",
  "background": "#F6EFEA",
  "text": "#2B2B2B",
  "muted": "#6B7280",
  "radius": 18,
  "show_offers": true,
  "show_featured": false,
  "category_style": "chips",
  "font_scale": "md"
}
```

### Ejemplo `minimal_clean`

```json
{
  "primary": "#6D28D9",
  "secondary": "#EDE9FE",
  "background": "#FFFFFF",
  "text": "#111827",
  "muted": "#6B7280",
  "radius": 12,
  "show_offers": true,
  "show_featured": false,
  "category_style": "chips",
  "font_scale": "sm"
}
```

## Recuperación de contraseña (Forgot Password)

### Endpoints

- `POST /api/auth/forgot-password`
  - body: `{ "email": "usuario@correo.com" }`
  - respuesta genérica para no filtrar usuarios
- `POST /api/auth/reset-password`
  - body: `{ "token": "<token>", "new_password": "<nueva_clave>" }`

### Variables de entorno recomendadas

```env
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=30
PASSWORD_RESET_URL_BASE=http://localhost:5174/admin/reset-password
PASSWORD_RESET_DEBUG_RETURN_TOKEN=false

SMTP_HOST=smtp.tudominio.com
SMTP_PORT=587
SMTP_USER=usuario_smtp
SMTP_PASSWORD=clave_smtp
SMTP_FROM_EMAIL=no-reply@tudominio.com
SMTP_USE_TLS=true
```

### Notas

- Si `SMTP_HOST` o `SMTP_FROM_EMAIL` no están configurados, el sistema no envía correo real.
- Para desarrollo local puedes activar:
  - `PASSWORD_RESET_DEBUG_RETURN_TOKEN=true`
  - así el endpoint devuelve `reset_url` y `reset_token` para pruebas manuales.
- Checklist y smoke test rápido:
  - `E2E_PASSWORD_RESET_CHECKLIST.md`
  - `backend/scripts/e2e_password_reset_smoke.ps1`

## Pipeline de optimización de imágenes

Todas las imágenes subidas se procesan automáticamente:
1. Validación por magic bytes (no solo MIME declarado)
2. Protección contra decompression bombs
3. Corrección de orientación EXIF
4. Eliminación de metadatos EXIF
5. Redimensionamiento si supera los límites configurados
6. Conversión a WebP

### Variables de entorno relacionadas

```env
IMAGE_MAX_INPUT_BYTES=10485760   # 10 MB
IMAGE_MAX_WIDTH=4096
IMAGE_MAX_HEIGHT=4096
IMAGE_MAX_PIXELS=25000000        # 25 MP
IMAGE_WEBP_QUALITY=82
IMAGE_OPTIMIZE_ENABLED=true
```

### Optimizar imágenes existentes

El migrador cuenta con simulación segura por defecto y exige confirmación explícita para aplicar cambios:

```powershell
# Simulación segura por defecto (dry-run, no altera archivos ni base de datos):
python scripts/optimize_existing_images.py

# Simulación sobre una subcarpeta específica:
python scripts/optimize_existing_images.py --subfolder products

# Aplicar optimización y actualizar base de datos atómicamente:
python scripts/optimize_existing_images.py --apply
```

## 6) Ejecutar Pruebas

Para correr la suite de pruebas con el ejecutor oficial de Python:

```powershell
cd backend
.\venv\Scripts\python.exe -m unittest discover -s tests -v
```
