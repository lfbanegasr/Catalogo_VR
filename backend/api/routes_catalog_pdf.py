import re
from collections import defaultdict
from io import BytesIO
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from core.database import get_db
from core.deps import get_current_tienda_id, get_current_user, require_role
from crud.crud_catalog import get_tienda_by_name, get_tienda_by_slug
from models.catalog import Categoria, Producto
from models.catalog_attribute import ProductoAtributo
from models.tenant import Tienda, Usuario
from schemas.catalog_pdf_schema import CatalogPdfRequest
from services.catalog_pdf_service import build_catalog_pdf


router = APIRouter(prefix="/api/catalog", tags=["Catalog PDF"])


def _target_store(
    *,
    db: Session,
    current_user: Usuario,
    current_tienda_id: UUID,
    tienda_ref: str | None,
) -> Tienda:
    if current_user.rol == "superadmin" and tienda_ref:
        store = get_tienda_by_slug(db=db, slug=tienda_ref.strip())
        if not store:
            store = get_tienda_by_name(db=db, nombre_tienda=tienda_ref.strip())
    else:
        store = db.query(Tienda).filter(Tienda.id_tienda == current_tienda_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    if current_user.rol != "superadmin" and store.id_tienda != current_user.id_tienda:
        raise HTTPException(status_code=403, detail="No autorizado para esta tienda")
    return store


def _descendant_ids(categories: list[Categoria], selected: set[UUID]) -> set[UUID]:
    children: dict[UUID, list[UUID]] = defaultdict(list)
    for category in categories:
        if category.id_categoria_padre:
            children[category.id_categoria_padre].append(category.id_categoria)
    resolved = set(selected)
    pending = list(selected)
    while pending:
        current = pending.pop()
        for child in children.get(current, []):
            if child not in resolved:
                resolved.add(child)
                pending.append(child)
    return resolved


def _attribute_text(row: ProductoAtributo) -> str | None:
    label = str(row.atributo.nombre).strip()
    if row.opcion:
        value = str(row.opcion.valor).strip()
    elif row.valor_texto is not None:
        value = str(row.valor_texto).strip()
    elif row.valor_numero is not None:
        value = f"{row.valor_numero.normalize():f}"
        if row.atributo.unidad:
            value = f"{value} {row.atributo.unidad}"
    elif row.valor_booleano is not None:
        value = "Si" if row.valor_booleano else "No"
    else:
        return None
    return f"{label}: {value}"


@router.post(
    "/pdf/download",
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_download_catalog_pdf(
    payload: CatalogPdfRequest,
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
    categories = (
        db.query(Categoria)
        .filter(Categoria.id_tienda == store.id_tienda)
        .order_by(Categoria.orden.asc(), Categoria.nombre.asc())
        .all()
    )
    known_ids = {category.id_categoria for category in categories}
    selected_ids = set(payload.category_ids)
    if selected_ids - known_ids:
        raise HTTPException(
            status_code=400,
            detail="Una de las categorias seleccionadas no pertenece a la tienda",
        )
    if selected_ids and payload.include_descendants:
        selected_ids = _descendant_ids(categories, selected_ids)

    query = db.query(Producto).filter(Producto.id_tienda == store.id_tienda)
    if payload.only_active_products:
        query = query.filter(Producto.activo.is_(True))
    products = query.all()
    if selected_ids:
        products = [
            product
            for product in products
            if (product.id_categoria_principal or product.id_categoria) in selected_ids
            or (
                payload.include_uncategorized
                and (product.id_categoria_principal or product.id_categoria) is None
            )
        ]
    elif not payload.include_uncategorized:
        products = [
            product
            for product in products
            if (product.id_categoria_principal or product.id_categoria) is not None
        ]

    sorters = {
        "name": lambda item: (item.nombre or "").lower(),
        "price_asc": lambda item: (item.precio_venta, (item.nombre or "").lower()),
        "price_desc": lambda item: (-item.precio_venta, (item.nombre or "").lower()),
        "newest": lambda item: item.fecha_agregado,
    }
    products.sort(key=sorters[payload.sort_by], reverse=payload.sort_by == "newest")
    if not products:
        raise HTTPException(status_code=400, detail="No hay productos que coincidan con la seleccion")

    attributes_by_product: dict[UUID, list[str]] = defaultdict(list)
    if payload.show_attributes:
        rows = (
            db.query(ProductoAtributo)
            .options(
                joinedload(ProductoAtributo.atributo),
                joinedload(ProductoAtributo.opcion),
            )
            .filter(ProductoAtributo.id_producto.in_([item.id_producto for item in products]))
            .all()
        )
        for row in rows:
            rendered = _attribute_text(row)
            if rendered:
                attributes_by_product[row.id_producto].append(rendered)

    # Only a cover previously uploaded for this store may be rendered. This
    # prevents arbitrary URLs in a download request from triggering a fetch.
    saved_cover = (store.theme_config or {}).get("catalog_pdf", {}).get("cover_url")
    payload = payload.model_copy(
        update={"cover_url": saved_cover if payload.cover_url else None}
    )

    pdf_bytes = build_catalog_pdf(
        store=store,
        categories=categories,
        products=products,
        options=payload,
        attributes_by_product=attributes_by_product,
    )
    safe_store_name = re.sub(
        r"[^a-zA-Z0-9_-]+",
        "-",
        store.slug or store.nombre_tienda,
    ).strip("-").lower()
    filename = f"catalogo-{safe_store_name or 'tienda'}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
