import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from api import api_router
from core.config import settings
from middleware.audit_middleware import AuditMiddleware
from middleware.security_middleware import RateLimitMiddleware, SecurityHeadersMiddleware
from sqlalchemy import text

from core.database import SessionLocal

settings.validate_runtime_security()

app = FastAPI(title="Backend Tienda SaaS")
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.CORS_ALLOW_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "If-None-Match"],
    expose_headers=["ETag", "Retry-After"],
)

app.add_middleware(AuditMiddleware)

# Initialize storage paths
uploads_dir = settings.UPLOADS_PATH
products_dir = settings.PRODUCTS_UPLOAD_PATH
offers_dir = settings.OFFERS_UPLOAD_PATH
theme_dir = settings.THEME_UPLOAD_PATH

uploads_dir.mkdir(parents=True, exist_ok=True)
products_dir.mkdir(parents=True, exist_ok=True)
offers_dir.mkdir(parents=True, exist_ok=True)
theme_dir.mkdir(parents=True, exist_ok=True)

# Startup diagnostic logging (Phase 9 & Phase 2 specifications)
directory_exists = uploads_dir.exists()
writable = os.access(str(uploads_dir), os.W_OK)

print(f"[storage] UPLOADS_DIR={uploads_dir.as_posix()}", flush=True)
print(f"[storage] PRODUCTS_UPLOAD_DIR={products_dir.as_posix()}", flush=True)
print(f"[storage] directory_exists={str(directory_exists).lower()}", flush=True)
print(f"[storage] writable={str(writable).lower()}", flush=True)
print(f"[storage] static_mount=/uploads -> {uploads_dir.as_posix()}", flush=True)

app.mount("/uploads", StaticFiles(directory=str(uploads_dir), check_dir=True), name="uploads")

app.include_router(api_router)


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
def readiness():
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready", "database": "ok"}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from exc
    finally:
        db.close()
