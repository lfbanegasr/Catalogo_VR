from fastapi import APIRouter

from .routes_auth import router as auth_router
from .routes_sales import router as sales_router
from .routes_catalog import router as catalog_router
from .routes_public_catalog import router as public_catalog_router
from .routes_admin import router as admin_router
from .routes_admin_audit import router as admin_audit_router
from .routes_me import router as me_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(public_catalog_router)
api_router.include_router(me_router)
api_router.include_router(catalog_router)
api_router.include_router(sales_router)
api_router.include_router(admin_router)
api_router.include_router(admin_audit_router)
