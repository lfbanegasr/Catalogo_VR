from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from core.database import get_db
from crud.crud_public import get_catalog_public
from crud.crud_public_events import create_public_event
from crud.crud_catalog import (
    get_producto_by_id,
    get_tienda_by_slug,
    list_public_categorias,
    list_public_productos,
)
from schemas.public_event_schema import PublicWhatsappClickIn
from schemas.catalog_schema import CategoriaPublicOut, ProductoPublicOut

router = APIRouter(prefix="/api/public", tags=["Public Catalog"])


def _get_active_tienda_or_404(db: Session, slug: str):
    tienda = get_tienda_by_slug(db, slug)
    if not tienda or not tienda.activa:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    return tienda


def _get_request_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first_ip = forwarded_for.split(",")[0].strip()
        if first_ip:
            return first_ip
    return request.client.host if request.client else None


@router.get("/catalog/{slug}")
def get_public_catalog(slug: str, db: Session = Depends(get_db)):
    catalog = get_catalog_public(db=db, slug=slug)
    if catalog is None:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    return catalog


@router.post("/catalog/{slug}/whatsapp-click", status_code=status.HTTP_201_CREATED)
def register_whatsapp_click(
    slug: str,
    payload: PublicWhatsappClickIn,
    request: Request,
    db: Session = Depends(get_db),
):
    tienda = _get_active_tienda_or_404(db, slug)

    if payload.id_producto is not None:
        producto = get_producto_by_id(db=db, id_producto=payload.id_producto)
        if not producto or producto.id_tienda != tienda.id_tienda:
            raise HTTPException(status_code=404, detail="Producto no encontrado")

    event = create_public_event(
        db=db,
        id_tienda=tienda.id_tienda,
        id_producto=payload.id_producto,
        evento="whatsapp_click",
        ip=_get_request_ip(request),
        user_agent=request.headers.get("user-agent"),
    )

    return {"ok": True, "id_evento": str(event.id_evento)}


@router.get("/catalog/{slug}/categories", response_model=list[CategoriaPublicOut])
def get_public_categories(slug: str, db: Session = Depends(get_db)):
    tienda = _get_active_tienda_or_404(db, slug)
    return list_public_categorias(db=db, id_tienda=tienda.id_tienda)


@router.get("/catalog/{slug}/products", response_model=list[ProductoPublicOut])
def get_public_products(
    slug: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    tienda = _get_active_tienda_or_404(db, slug)
    return list_public_productos(
        db=db,
        id_tienda=tienda.id_tienda,
        limit=limit,
        offset=offset,
    )
