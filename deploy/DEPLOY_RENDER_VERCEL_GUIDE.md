# Guía y Estado Guardado para Despliegue en Render y Vercel

Este archivo preserva el estado de configuración previo para conectar el proyecto a **Render** (Backend FastAPI), **Vercel** (Frontends React/Vite) y **Neon PostgreSQL / Cloudflare R2** (Base de datos y Storage multimedia en producción).

---

## 1. Variables de Producción Respaldadas

El archivo [`deploy/prod_render_neon_backup.env`](file:///d:/3%20Proyecto%20Tienda%20Virtual/core/deploy/prod_render_neon_backup.env) contiene los valores exactos:

```env
# Neon PostgreSQL (SSL Requerido)
DATABASE_URL=postgresql://neondb_owner:npg_ZbRanKEgN51r@ep-old-tree-axjdq9sj.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require

# Clave Secreta JWT
SECRET_KEY=CAMBIA_ESTA_CLAVE_POR_ALGO_LARGO_Y_SEGURO_123456789
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Cloudflare R2 Bucket
STORAGE_BACKEND=r2
R2_ACCOUNT_ID=1d9a2b92d26b6824ecc02dcde8bb4880
R2_ACCESS_KEY_ID=9415a9b72cfedfb5842ca1bd0496d4c8
R2_SECRET_ACCESS_KEY=558eb313f9f2015c61ce0a8fefc96be32ee6c9598c1c6bf149438da915a3bccd
R2_BUCKET_NAME=catalogovr-images-prod
R2_ENDPOINT_URL=https://1d9a2b92d26b6824ecc02dcde8bb4880.r2.cloudflarestorage.com
R2_PUBLIC_BASE_URL=https://pub-9b5da7a686fe4bdc8ee5536a4ff4effe.r2.dev

ENVIRONMENT=production
```

---

## 2. Configuración en Render (Web Service - Backend)

- **Root Directory:** `backend`
- **Runtime:** `Python 3` o `Docker` (usando `Dockerfile`)
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `sh -c "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"`
- **Variables de Entorno necesarias:**
  - `DATABASE_URL` (Conexión a Neon)
  - `SECRET_KEY`
  - `STORAGE_BACKEND=r2`
  - `R2_*` (Credenciales Cloudflare R2)
  - `CORS_ORIGINS`: URLs de Vercel (ej: `https://tu-catalogo.vercel.app,https://tu-admin.vercel.app`)
  - `ALLOWED_HOSTS`: Dominio asignado por Render (ej: `tu-api.onrender.com`)

---

## 3. Configuración en Vercel (Frontends)

1. **Frontend Público (`frontend`)**:
   - Framework Preset: `Vite`
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Variables de Entorno:
     - `VITE_API_BASE`: `https://tu-api.onrender.com`
     - `VITE_DEFAULT_STORE_SLUG`: `loriglow-cosmetics`

2. **Frontend Admin (`frontend-admin`)**:
   - Framework Preset: `Vite`
   - Root Directory: `frontend-admin`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Variables de Entorno:
     - `VITE_API_BASE`: `https://tu-api.onrender.com`
     - `VITE_PUBLIC_CATALOG_URL`: `https://tu-catalogo.vercel.app`
