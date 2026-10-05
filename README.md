# Catalogo VR — Multi-Tenant Virtual Catalog Platform

> **Español** · [Quick start](#quick-start) · [Español / Spanish](#español)

A modular, multi-tenant SaaS platform that lets small businesses publish
shareable product catalogs and manage orders through WhatsApp — all from one
self-hosted backend.

---

## What it solves

Small retailers in Latin America rely on WhatsApp to sell products, but managing
orders, inventory and product presentation through chat is chaotic. Catalogo VR
gives each store a branded, mobile-first catalog page with cart, checkout, and
real-time order tracking — while keeping every tenant's data completely isolated.

---

## Live Features

| Area | Implemented |
|------|-------------|
| **Multi-tenant isolation** | Each store's products, categories, orders, and users are fully isolated |
| **Public catalog** | Branded storefront per tenant with themes, banners, and category images |
| **Cart & WhatsApp checkout** | Cart persists in browser localStorage, checkout records the order before redirecting to WhatsApp |
| **Order tracking** | Customers can track orders by code (`?pedido=XXX`) |
| **Image management** | Upload, gallery, per-image adjustments (zoom, fit, position); auto-convert to WebP |
| **Product variants** | SKU-level variants with independent stock, price, and images |
| **Product sets** | Bundle products with computed set stock |
| **Product attributes** | Filterable attributes; category-level filter UI |
| **Offer campaigns** | Percent and price-override discounts with banner images and date ranges |
| **3 built-in themes** | `modern_banner`, `soft_beige`, `minimal_clean`; fully configurable colors, fonts, and layouts |
| **Admin panel** | Full CRUD for categories, products, offers, variants, attributes, theme |
| **Superadmin panel** | Cross-tenant management, audit logs, public event analytics |
| **Customer accounts** | Optional registration; view own orders from the public storefront |
| **Password reset** | Email-based token flow with configurable SMTP |
| **Rate limiting** | Sliding-window per-IP rate limits on auth, checkout and public endpoints |
| **Security headers** | HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| **Storage backends** | Local filesystem and Cloudflare R2 (S3-compatible) |
| **PDF catalog** | Exportable PDF catalog with cover and product pages |
| **Audit log** | All sensitive mutations are logged with user, IP and timestamp |
| **Privacy pages** | `?page=privacy` and `?page=terms` pages linked from the catalog footer |

---

## Planned / Roadmap

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the full roadmap.

- [ ] CI/CD pipeline and automated end-to-end testing suite
- [ ] Automated data purge and scheduled retention jobs
- [ ] Dashboard with sales metrics, margin, and charts
- [ ] Inventory state management (completed / cancelled orders adjust stock)
- [ ] Export sales to CSV / PDF
- [ ] Subscription plans (Free, Pro, Premium) with payment integration
- [ ] Advanced tenant management (suspend, configure, quota limits)
- [ ] Flutter mobile app consuming the same FastAPI backend

---

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│                    Client devices                          │
│   Browser (Public catalog)  ·  Browser (Admin panel)      │
│              ·  Flutter app (future)                       │
└──────────────┬──────────────────────┬─────────────────────┘
               │                      │
       React/Vite SPA            React/Vite SPA
       (Vercel: frontend/)       (Vercel: frontend-admin/)
               │                      │
               └──────────┬───────────┘
                          │ HTTPS / REST
                 ┌────────▼────────┐
                 │  FastAPI        │  ← Render (backend/)
                 │  + SQLAlchemy   │
                 │  + Alembic      │
                 └────────┬────────┘
               ┌──────────┴──────────┐
        Neon PostgreSQL         Cloudflare R2
       (SSL connection)       (image storage)
```

> **Nota de infraestructura:** En producción, los dos frontends son alojados en **Vercel**, el backend FastAPI se ejecuta en **Render**, la base de datos PostgreSQL administrada reside en **Neon** (con conexión SSL obligatoria) y los activos multimedia se almacenan en **Cloudflare R2**. Docker Compose está reservado exclusivamente para el entorno de desarrollo local.

### Key design decisions

- **Row-level multi-tenancy** — every table carries `id_tienda`; no cross-tenant
  queries are possible without superadmin role.
- **Single backend, two frontends** — the public catalog and the admin panel are
  separate Vite apps sharing the same FastAPI API.
- **Immutable image names** — uploaded images get a UUID + timestamp filename so
  they can be cached indefinitely (`Cache-Control: immutable`).
- **WebP optimization pipeline** — new uploads are validated by magic bytes,
  decompression bomb protection preserved, EXIF-stripped, resized if needed,
  and converted to WebP before storage.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | Python 3.11 · FastAPI 0.110 · SQLAlchemy 2.0 |
| Database | PostgreSQL 15 · Alembic migrations |
| Image processing | Pillow 12 |
| Cloud storage | Cloudflare R2 (boto3 / S3-compatible) / Local storage |
| Auth | JWT (python-jose) · bcrypt (passlib) |
| Email | SMTP (aiosmtplib-compatible config) |
| Frontend (public) | React 18 · Vite · Vanilla CSS |
| Frontend (admin) | React 18 · Vite · Vanilla CSS |
| Mobile (planned) | Flutter |
| Containerization | Docker + Docker Compose |

---

## Repository Structure

```
core/
├── backend/              # FastAPI application
│   ├── api/              # Route handlers
│   ├── core/             # Config, DB, storage, image pipeline
│   ├── crud/             # Database operations
│   ├── middleware/        # Rate limiting, security headers, audit
│   ├── models/           # SQLAlchemy models
│   ├── schemas/          # Pydantic schemas
│   ├── scripts/          # Seed scripts, bootstrap, and optimization tools
│   ├── alembic/          # Database migrations
│   └── tests/            # Unit and integration test suite
├── frontend/             # Public catalog (React/Vite)
│   └── src/
│       ├── pages/        # CatalogPage, ProductDetailPage, PrivacyPage, TermsPage
│       ├── components/   # ProductCard, CartDrawer, ThemeLayouts, ...
│       ├── api/          # API calls and data normalization
│       └── utils/        # legalConfig.js, price formatter, WhatsApp helper
├── frontend-admin/       # Admin panel (React/Vite)
│   └── src/
│       └── components/   # Dashboard, Catalog, Users, Sales, Theme, Audit, ...
├── mobile/               # Flutter app (work in progress)
├── deploy/               # Deployment configuration
├── docs/                 # Extended documentation
│   ├── ROADMAP.md
│   ├── DEMO.md
│   ├── PRIVACY_DATA_MAP.md
│   └── DATABASE_DEPLOYMENT_SAFETY.md
├── docker-compose.yml
└── README.md
```

---

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local frontend development)
- Python 3.11+ (for local backend development)

### With Docker (recommended)

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/catalogo-vr.git
cd catalogo-vr/core

# 2. Copy and configure environment
cp backend/.env.example backend/.env
# Edit backend/.env — at minimum set SECRET_KEY

# 3. Start the stack
docker compose up -d

# 4. Run migrations
docker compose exec backend alembic upgrade head

# 5. Seed a demo store
docker compose exec backend python scripts/seed_accessories_store.py
```

The backend will be available at `http://localhost:8000`.

---

### Local Backend (without Docker)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Copy and fill the environment file
cp .env.example .env

# Apply migrations
alembic upgrade head

# Create superadmin
python scripts/bootstrap_superadmin.py --email admin@example.com --password "ChangeMe123!"

# Start the server
uvicorn main:app --reload
```

### Local Frontend — Public Catalog

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173/?slug=demo-accesorios
```

### Local Frontend — Admin Panel

```bash
cd frontend-admin
npm install
npm run dev
# → http://localhost:5174
```

---

## Environment Variables

Full reference in [`backend/.env.example`](backend/.env.example). Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | _(required)_ |
| `SECRET_KEY` | JWT signing key (≥ 32 chars in production) | _(required)_ |
| `ENVIRONMENT` | `development` or `production` | `development` |
| `STORAGE_BACKEND` | `local` or `r2` | `local` |
| `R2_*` | Cloudflare R2 credentials (required if `STORAGE_BACKEND=r2`) | _(empty = local storage)_ |
| `PUBLIC_ASSET_BASE_URL` | Base URL for serving uploaded images | _(empty = relative paths)_ |
| `IMAGE_MAX_INPUT_BYTES` | Max upload size in bytes | `10485760` (10 MB) |
| `IMAGE_MAX_WIDTH` | Max image width in pixels | `4096` |
| `IMAGE_MAX_HEIGHT` | Max image height in pixels | `4096` |
| `IMAGE_MAX_PIXELS` | Max total pixels (anti-bomb) | `25000000` |
| `IMAGE_WEBP_QUALITY` | WebP output quality (1-100) | `82` |
| `IMAGE_OPTIMIZE_ENABLED` | Enable/disable WebP conversion | `true` |
| `SMTP_HOST` | SMTP server for password reset emails | _(empty = no email)_ |
| `PASSWORD_RESET_DEBUG_RETURN_TOKEN` | Return token in API response (dev only!) | `false` |

---

## Database Migrations

```bash
# Apply all pending migrations
alembic upgrade head

# Create a new migration after model changes
alembic revision --autogenerate -m "description"

# Roll back one step (reversible migrations only)
alembic downgrade -1
```

> ⚠ Read [`docs/DATABASE_DEPLOYMENT_SAFETY.md`](docs/DATABASE_DEPLOYMENT_SAFETY.md)
> before running migrations in production.

---

## Demo Seed

The non-destructive seed script creates a complete demo store:

```bash
# Accessories / jewelry demo store (recommended versioned demo)
python scripts/seed_accessories_store.py
```

This script is idempotent: re-running it will not duplicate data.

See [`docs/DEMO.md`](docs/DEMO.md) for detailed demo setup instructions.

---

## Running Tests

Execute the backend test suite using Python's built-in `unittest` runner:

```bash
cd backend
python -m unittest discover -s tests -v
```

On Windows (PowerShell):
```powershell
cd backend
.\venv\Scripts\python.exe -m unittest discover -s tests -v
```

The test suite covers:
- Image processing pipeline (`test_image_pipeline.py`)
- Local and Cloudflare R2 storage handlers (`test_storage.py`)
- Safe image migrator and database rollback (`test_image_migrator.py`)
- Order tracking, variant management, and catalog features.

---

## Image Storage

### Local storage (default)

Images are stored in `backend/uploads/` and served as static files at `/uploads/*`.

### Cloudflare R2

Set `STORAGE_BACKEND=r2` and provide valid `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT_URL`, and `R2_PUBLIC_BASE_URL` in `.env`. New images will be uploaded directly to R2.

### Image optimization pipeline

All uploaded images are automatically:
1. Stream-read with bounded buffer limit (`IMAGE_MAX_INPUT_BYTES + 1`)
2. Validated by magic bytes and Pillow structure (`verify()` and `load()`)
3. Protected against decompression bombs via native Pillow threshold and project pixel limit
4. EXIF-corrected (rotation orientation fix) and EXIF-stripped
5. Resized proportionally if exceeding configured dimensions
6. Converted to WebP at the configured quality level

### Optimizing existing images

The migration script `backend/scripts/optimize_existing_images.py` safely inspects and upgrades legacy JPEG/PNG images:

```bash
# Simulación segura por defecto (dry-run, no modifica archivos ni base de datos):
python scripts/optimize_existing_images.py

# Simular sobre una subcarpeta específica:
python scripts/optimize_existing_images.py --subfolder products

# Aplicar cambios reales (requiere --apply explícito):
# Convierte a WebP, valida el archivo resultante y actualiza atómicamente la base de datos
python scripts/optimize_existing_images.py --apply
```

> **Garantías de seguridad:** El migrador nunca elimina un archivo original sin antes verificar que el archivo WebP sea válido y que todas las referencias en la base de datos hayan sido confirmadas (`commit`). En caso de error, realiza `rollback`, preserva el original y remueve únicamente el WebP generado durante ese intento.

---

## Privacy and Legal

The public catalog includes privacy and terms pages accessible via query parameters:
- `?page=privacy`
- `?page=terms`

These pages describe the actual technical data handling of the application (e.g. `localStorage` for cart persistence, public navigation event logging, and EXIF sanitization).

Configure legal metadata via environment variables:

```env
VITE_LEGAL_OPERATOR_NAME=Nombre del Operador o Comercio
VITE_LEGAL_COUNTRY=Bolivia
VITE_LEGAL_CONTACT_EMAIL=contacto@tudominio.com
```

> ⚠ Before publishing, set `VITE_LEGAL_OPERATOR_NAME` and `VITE_LEGAL_CONTACT_EMAIL` with real contact details, and review the terms with a qualified legal advisor.

---

## Deployment

## Deployment Architecture

The production architecture is distributed across specialized cloud providers:
- **Public Frontend:** Hosted on **Vercel** (`frontend/`).
- **Admin Panel:** Hosted on **Vercel** (`frontend-admin/`).
- **Backend API:** Hosted on **Render** (`backend/` via Docker).
- **Relational Database:** Hosted on **Neon** (PostgreSQL Serverless with SSL).
- **Media & Asset Storage:** Hosted on **Cloudflare R2** (S3-compatible object storage).
- **Local Development:** Uses Docker Compose and local PostgreSQL/storage exclusively.

---

### Backend (Render Web Service)

1. Deploy the backend as a Web Service using Docker (`backend/Dockerfile`).
   - Render automatically injects the `PORT` environment variable; the Dockerfile respects this via `${PORT:-8000}`.
2. Configure mandatory production environment variables in the Render Dashboard:
   - `ENVIRONMENT=production`
   - `DATABASE_URL`: Connection string provided by Neon (must include `?sslmode=require`).
     > ⚠ **CRITICAL SECURITY NOTE:** `DATABASE_URL` contains sensitive database credentials. Never commit this value to Git or include it in client-side code.
   - `SECRET_KEY`: A cryptographically secure random string (e.g. generated via `openssl rand -hex 32`).
   - `CORS_ORIGINS`: Comma-separated list of allowed frontend origins, including your Vercel domains (e.g. `https://tu-catalogo.vercel.app,https://tu-admin.vercel.app`).
   - `ALLOWED_HOSTS`: Comma-separated list of allowed hostnames (e.g. `tu-backend.onrender.com`).
   - `STORAGE_BACKEND=r2`
   - Cloudflare R2 credentials:
     - `R2_BUCKET_NAME`
     - `R2_ACCESS_KEY_ID`
     - `R2_SECRET_ACCESS_KEY`
     - `R2_ENDPOINT_URL` (e.g. `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)
     - `R2_PUBLIC_BASE_URL` (e.g. `https://pub-<HASH>.r2.dev` or custom domain)
   - SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`): Only if email password reset is enabled.
3. **Proxy Headers Security (`TRUST_PROXY_HEADERS`):**
   - The default configuration keeps `TRUST_PROXY_HEADERS=false` to prevent spoofing of client IP addresses via forged `X-Forwarded-For` headers.
   - In Render, traffic passes through Render's TLS-terminating reverse proxy. If client IP resolution is required for rate-limiting behind Render, only set `TRUST_PROXY_HEADERS=true` after ensuring upstream network policies prevent direct external header spoofing.
4. Run migrations during build/release or via terminal: `alembic upgrade head`.

---

### Frontends (Vercel)

Both `frontend/` and `frontend-admin/` are deployed as static single-page applications (SPAs) on Vercel:
1. Configure `VITE_API_BASE` in the Vercel project settings:
   ```env
   VITE_API_BASE=https://tu-backend.onrender.com
   ```
2. **Strict Production Requirement:** `VITE_API_BASE` is strictly required in production. If omitted, the frontend throws a clear configuration error instead of failing silently or falling back to development or legacy URLs.
3. `vercel.json` in both frontend roots handles SPA routing (routing all paths to `/index.html`) without legacy rewrites to external hosts.
4. Images hosted on Cloudflare R2 with absolute URLs are loaded directly from R2's CDN. Legacy `/uploads/...` paths are automatically prepended with `VITE_API_BASE`.

### Known limitations

- The in-process catalog cache (LRU, 256 stores) resets on each server restart.
  For multi-instance deployments, replace with Redis.
- PDF generation is synchronous and may be slow for large catalogs.
- Scheduled automatic data purging is pending formal definition and background worker implementation.
- Continuous Integration (CI) and automated browser end-to-end tests are not yet implemented.

---

## License

The license for this project has not been finalized. Before contributing or
using this code commercially, consider the following options:

| License | Use case |
|---------|---------|
| **MIT** | Maximum openness; anyone can fork, use commercially, and relicense |
| **Apache 2.0** | Similar to MIT but includes explicit patent grant |
| **AGPL-3.0** | Copyleft; requires open-sourcing modifications even when run as a service |
| **BSL 1.1** | Source-available; restricts production use for a time window, then goes OSS |
| **Proprietary** | All rights reserved; suitable if you plan to sell the platform |

Please decide on a license before public release and add a `LICENSE` file.

---

## GitHub Repository Metadata (Recommended)

**Description:**
> Multi-tenant e-commerce catalog and order management platform built with FastAPI, React and PostgreSQL.

**Topics:**
`saas` `multi-tenant` `ecommerce` `fastapi` `react` `postgresql` `order-tracking` `whatsapp` `alembic` `cloudflare-r2`

---

## Español

Esta plataforma es un catálogo virtual multi-inquilino para pequeños comercios.
Cada tienda tiene su propio catálogo público con carrito, seguimiento de pedidos
y panel de administración. El backend está construido con FastAPI y PostgreSQL,
los frontends con React/Vite, y las imágenes se almacenan localmente o en
Cloudflare R2.

Para comenzar localmente consulta la sección [Quick Start](#quick-start).
Para el roadmap completo ve a [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## Author

Built and maintained by **[lfbanegasr]**.

---

> **Aviso legal:** Los documentos de privacidad y términos incluidos son plantillas informativas sobre el funcionamiento técnico del código. Deben ser completadas y validadas por un asesor legal antes de publicarse comercialmente.
