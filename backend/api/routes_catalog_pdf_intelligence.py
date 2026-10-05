from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.routes_catalog_pdf import _target_store
from core.database import get_db
from core.deps import get_current_tienda_id, get_current_user, require_role
from models.catalog import Producto
from models.tenant import Usuario
from schemas.catalog_pdf_edit_schema import CatalogPdfAnalyzeRequest
from services.catalog_pdf.background_removal import background_removal_status
from services.catalog_pdf.florence2 import florence_status
from services.catalog_pdf.intelligence import analyze_catalog_products


router = APIRouter(prefix="/api/catalog", tags=["Catalog PDF Intelligence"])


@router.get(
    "/pdf/ai/status",
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_catalog_pdf_ai_status():
    return {
        "florence": florence_status(),
        "background_removal": background_removal_status(),
    }


@router.post(
    "/pdf/analyze",
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_analyze_catalog_pdf(
    payload: CatalogPdfAnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    current_tienda_id: UUID = Depends(get_current_tienda_id),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
):
    store = _target_store(
        db=db,
        current_user=current_user,
        current_tienda_id=current_tienda_id,
        tienda_ref=tienda_ref,
    )
    query = db.query(Producto).filter(Producto.id_tienda == store.id_tienda)
    if payload.product_ids:
        query = query.filter(Producto.id_producto.in_(payload.product_ids))
    products = query.order_by(Producto.fecha_agregado.asc()).limit(250).all()
    return analyze_catalog_products(products, use_florence=payload.use_florence)
