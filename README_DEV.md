# Desarrollo Local (Backend)

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

## 4) Seed de datos demo

```powershell
python scripts/seed_dev.py
```

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

Si aun no tienes un superadmin inicial:

```powershell
python scripts/bootstrap_superadmin.py --email superadmin@tuapp.com --password "Cambiar123!"
```

Esto crea (o actualiza) un usuario `superadmin` y una tienda tecnica `platform-root`.

## Seeder minimo para despliegue (solo tu superadmin)

Si quieres iniciar "desde cero" sin catalogo demo, usa:

```powershell
python scripts/seed_superadmin_only.py
```

Por defecto crea/actualiza:

- Email: `luisfernando.banegasro22@gmail.com`
- Password: `kiritoLore2203`
- Rol: `superadmin`

Nota tecnica: el modelo actual exige `usuarios.id_tienda`, por eso se crea una tienda interna
`__internal-root__` (inactiva) solo como soporte del superadmin.

## Arquitectura de rutas (actual)

- Publico: `/api/public/*`
- Auth: `/api/auth/*`
- Sesion actual: `/api/me`
- Catalogo privado por tenant: `/api/catalog/*`
- Admin plataforma (superadmin): `/api/admin/tiendas`, `/api/admin/users`
- Auditoria admin: `/api/admin/audit-logs`, `/api/admin/public-events`

## Themes por tienda

- El catalogo publico consume `tienda.theme_id` y `tienda.theme_config` desde `GET /api/public/catalog/{slug}`.
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
  "hero_image_url": "/uploads/theme/hero1.jpg",
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

## Recuperacion de contrasena (Forgot Password)

### Endpoints

- `POST /api/auth/forgot-password`
  - body: `{ "email": "usuario@correo.com" }`
  - respuesta generica para no filtrar usuarios
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

- Si `SMTP_HOST` o `SMTP_FROM_EMAIL` no estan configurados, el sistema no envia correo real.
- Para desarrollo local puedes activar:
  - `PASSWORD_RESET_DEBUG_RETURN_TOKEN=true`
  - asi el endpoint devuelve `reset_url` y `reset_token` para pruebas manuales.
- Checklist y smoke test rapido:
  - `E2E_PASSWORD_RESET_CHECKLIST.md`
  - `backend/scripts/e2e_password_reset_smoke.ps1`
  