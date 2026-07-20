import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from api import api_router
from core.config import settings
from middleware.audit_middleware import AuditMiddleware

app = FastAPI(title="Backend Tienda SaaS")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
