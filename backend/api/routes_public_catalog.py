import hashlib
import json
from collections import OrderedDict
from threading import Lock
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from core.database import get_db
from core.request_security import get_client_ip
from crud.crud_public import get_catalog_public
from crud.crud_public_events import create_public_event
from api.routes_customer_account import get_optional_current_customer
from models.sales import Cliente
from crud.crud_catalog import (
    get_producto_by_id,
    get_tienda_by_slug,
    list_public_categorias,
    list_public_productos,
)
from schemas.public_event_schema import PublicEventIn, PublicWhatsappClickIn
from schemas.catalog_schema import CategoriaPublicOut, ProductoPublicOut
from schemas.sales_schema import SeguimientoPedidoOut, VentaCreate, VentaOut
from crud.crud_sales import create_venta, get_public_order_tracking, StockInsuficienteError

router = APIRouter(prefix="/api/public", tags=["Public Catalog"])
CATALOG_CACHE_TTL_SECONDS = 15
CATALOG_CACHE_MAX_STORES = 256
_catalog_cache: OrderedDict[str, tuple[float, dict]] = OrderedDict()
_catalog_cache_lock = Lock()


def invalidate_public_catalog_cache(slug: str) -> None:
    with _catalog_cache_lock:
        _catalog_cache.pop(slug, None)


def _get_active_tienda_or_404(db: Session, slug: str):
    tienda = get_tienda_by_slug(db, slug)
    if not tienda or not tienda.activa:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    return tienda


def _public_product_out(producto) -> ProductoPublicOut:
    categoria = producto.categoria_principal or producto.categoria
    return ProductoPublicOut(
        id_producto=producto.id_producto,
        id_categoria=producto.id_categoria_principal or producto.id_categoria,
        nombre=producto.nombre,
        descripcion=producto.descripcion,
        precio_venta=producto.precio_venta,
        imagen_url=producto.imagen_url,
        imagenes=producto.imagenes,
        imagen_fit=producto.imagen_fit or getattr(categoria, "imagen_fit_default", None) or "cover",
        imagen_posicion_x=(
            producto.imagen_posicion_x
            if producto.imagen_posicion_x is not None
            else getattr(categoria, "imagen_posicion_x_default", 50)
        ),
        imagen_posicion_y=(
            producto.imagen_posicion_y
            if producto.imagen_posicion_y is not None
            else getattr(categoria, "imagen_posicion_y_default", 30)
        ),
        imagen_zoom=(
            producto.imagen_zoom
            if producto.imagen_zoom is not None
            else getattr(categoria, "imagen_zoom_default", 100)
        ),
        imagen_fondo=producto.imagen_fondo or getattr(categoria, "imagen_fondo_default", None),
        fecha_agregado=producto.fecha_agregado,
    )


def _get_cached_public_catalog(db: Session, slug: str):
    now = monotonic()
    with _catalog_cache_lock:
        cached = _catalog_cache.get(slug)
        if cached is not None and now - cached[0] < CATALOG_CACHE_TTL_SECONDS:
            _catalog_cache.move_to_end(slug)
            return cached[1]
    catalog = get_catalog_public(db=db, slug=slug)
    if catalog is None:
        return None
    with _catalog_cache_lock:
        _catalog_cache[slug] = (now, catalog)
        _catalog_cache.move_to_end(slug)
        while len(_catalog_cache) > CATALOG_CACHE_MAX_STORES:
            _catalog_cache.popitem(last=False)
    return catalog


@router.get("/catalog/{slug}")
def get_public_catalog(
    slug: str,
    request: Request,
    db: Session = Depends(get_db),
):
    catalog = _get_cached_public_catalog(db=db, slug=slug)
    if catalog is None:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    encoded_catalog = jsonable_encoder(catalog)
    serialized = json.dumps(
        encoded_catalog,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    etag = '"' + hashlib.sha256(serialized).hexdigest() + '"'
    headers = {
        "ETag": etag,
        "Cache-Control": "public, max-age=15, stale-while-revalidate=45",
    }
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=headers)
    return JSONResponse(content=encoded_catalog, headers=headers)


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
        ip=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )

    return {"ok": True, "id_evento": str(event.id_evento)}


@router.post("/catalog/{slug}/events", status_code=status.HTTP_201_CREATED)
def register_public_catalog_event(
    slug: str,
    payload: PublicEventIn,
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
        evento=payload.evento,
        ip=get_client_ip(request),
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
    products = list_public_productos(
        db=db,
        id_tienda=tienda.id_tienda,
        limit=limit,
        offset=offset,
    )
    return [_public_product_out(product) for product in products]


@router.post(
    "/catalog/{slug}/checkout",
    response_model=VentaOut,
    status_code=status.HTTP_201_CREATED,
)
def api_public_checkout(
    slug: str,
    payload: VentaCreate,
    customer: Cliente | None = Depends(get_optional_current_customer),
    db: Session = Depends(get_db),
):
    print(f"[checkout] Recibido slug: {slug}", flush=True)
    tienda = _get_active_tienda_or_404(db, slug)
    try:
        # Forzar estado inicial y origen para la creación
        payload.estado = "pendiente"
        payload.origen = "whatsapp"
        payload.id_cliente = customer.id_cliente if customer else None
        
        venta = create_venta(db=db, id_tienda=tienda.id_tienda, payload=payload)
        invalidate_public_catalog_cache(slug)

        # Logs mínimos requeridos para confirmar la operación
        print(f"[checkout] Venta creada con ID: {venta.id_venta}", flush=True)
        print(f"[checkout] Estado: {venta.estado}", flush=True)
        print(f"[checkout] Origen: {venta.origen}", flush=True)

        return VentaOut.model_validate(venta)
    except StockInsuficienteError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/catalog/{slug}/orders/{codigo_seguimiento}",
    response_model=SeguimientoPedidoOut,
)
def api_public_order_tracking(
    slug: str,
    codigo_seguimiento: str,
    db: Session = Depends(get_db),
):
    tienda = _get_active_tienda_or_404(db, slug)
    venta = get_public_order_tracking(
        db,
        id_tienda=tienda.id_tienda,
        codigo_seguimiento=codigo_seguimiento,
    )
    if venta is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return SeguimientoPedidoOut(
        codigo_seguimiento=venta.codigo_seguimiento,
        estado=venta.estado,
        fecha_pedido=venta.fecha_venta,
        fecha_actualizacion=venta.fecha_actualizacion or venta.fecha_venta,
        metodo_entrega=venta.metodo_entrega,
        total_venta=venta.total_venta,
        productos=[
            {
                "nombre": detalle.producto.nombre if detalle.producto else "Producto",
                "variante": detalle.nombre_variante,
                "cantidad": detalle.cantidad,
            }
            for detalle in venta.detalles
        ],
        historial=[
            evento
            for evento in venta.historial_estados
            if evento.visible_cliente
        ],
    )
