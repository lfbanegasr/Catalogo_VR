import logging
import os
from datetime import datetime
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db
from core.deps import get_current_tienda_id, get_current_user, require_role
from crud.crud_catalog import (
    add_product_image,
    create_categoria,
    create_producto,
    deactivate_categoria,
    deactivate_producto,
    get_categoria_by_id,
    get_categoria_by_name,
    get_producto_by_id,
    get_product_image_urls,
    get_tienda_by_name,
    get_tienda_by_slug,
    list_categorias,
    list_productos,
    list_product_images,
    set_product_image,
    update_categoria,
    update_producto,
)
from crud.crud_product_sets import PRODUCT_TYPE_SET, calculate_set_stock_map
from models.catalog import ProductoImagen
from models.catalog_variant import VarianteProducto
from crud.crud_offers import (
    attach_categories_to_offer,
    attach_products_to_offer,
    create_offer,
    deactivate_offer,
    detach_category_from_offer,
    detach_product_from_offer,
    get_offer_by_id,
    list_offer_categories,
    list_offer_products,
    list_offers,
    update_offer,
)
from models.tenant import Tienda, Usuario
from schemas.catalog_schema import (
    CategoriaCreate,
    CategoriaOut,
    CategoriaUpdate,
    OfferCategoryAttach,
    OfferCategoryOut,
    OfferCreate,
    OfferOut,
    OfferProductAttach,
    OfferProductOut,
    OfferUpdate,
    ProductoCreate,
    ProductoOut,
    ProductoUpdate,
)

from core.storage import save_upload_file, build_public_asset_url, delete_asset_file

logger = logging.getLogger("routes_catalog")

router = APIRouter(prefix="/api/catalog", tags=["Catalog"])

UPLOAD_DIR = settings.PRODUCTS_UPLOAD_PATH
OFFERS_UPLOAD_DIR = settings.OFFERS_UPLOAD_PATH
THEME_UPLOAD_DIR = settings.THEME_UPLOAD_PATH


def _safe_invalidate_catalog_cache_only(db: Session, id_tienda: UUID) -> None:
    try:
        from api.routes_public_catalog import invalidate_public_catalog_cache
        from models.tenant import Tienda

        tienda = db.query(Tienda).filter(Tienda.id_tienda == id_tienda).first()
        if tienda is not None and tienda.slug:
            invalidate_public_catalog_cache(tienda.slug)
    except Exception as e:
        logger.warning("Fallo al invalidar cache en memoria para tienda %s: %s", id_tienda, e)


def _invalidate_public_catalog_for_tenant(db: Session, id_tienda: UUID, commit: bool = True) -> None:
    tienda = db.query(Tienda).filter(Tienda.id_tienda == id_tienda).first()
    if not tienda:
        return
    from api.routes_public_catalog import bump_public_catalog_revision

    bump_public_catalog_revision(db, tienda.id_tienda, tienda.slug, commit=commit)


def _resolve_target_tienda_id(
    *,
    db: Session,
    current_user: Usuario,
    current_tienda_id: UUID,
    requested_tienda_id: UUID | None,
    requested_tienda_ref: str | None,
    requested_tienda_name: str | None,
) -> UUID:
    if current_user.rol == "superadmin":
        if requested_tienda_ref:
            tienda = get_tienda_by_slug(db=db, slug=requested_tienda_ref.strip())
            if not tienda:
                tienda = get_tienda_by_name(db=db, nombre_tienda=requested_tienda_ref)
            if not tienda:
                raise HTTPException(status_code=404, detail="Tienda no encontrada")
            return tienda.id_tienda
        if requested_tienda_name:
            tienda = get_tienda_by_name(db=db, nombre_tienda=requested_tienda_name)
            if not tienda:
                raise HTTPException(status_code=404, detail="Tienda no encontrada")
            return tienda.id_tienda
        return requested_tienda_id or current_tienda_id
    return current_tienda_id


def _resolve_categoria_id_for_tienda(
    *,
    db: Session,
    target_tienda_id: UUID,
    requested_categoria_id: UUID | None,
    requested_categoria_name: str | None,
) -> UUID | None:
    if requested_categoria_id and requested_categoria_name:
        categoria_by_id = get_categoria_by_id(db=db, id_categoria=requested_categoria_id)
        if not categoria_by_id:
            raise HTTPException(status_code=404, detail="Categoria no encontrada")
        if categoria_by_id.id_tienda != target_tienda_id:
            raise HTTPException(status_code=403, detail="La categoria no pertenece a la tienda objetivo")
        categoria_by_name = get_categoria_by_name(
            db=db,
            id_tienda=target_tienda_id,
            nombre=requested_categoria_name,
        )
        if not categoria_by_name:
            raise HTTPException(status_code=404, detail="Categoria no encontrada")
        if categoria_by_id.id_categoria != categoria_by_name.id_categoria:
            raise HTTPException(
                status_code=400,
                detail="id_categoria y nombre_categoria no coinciden",
            )
        return categoria_by_id.id_categoria

    if requested_categoria_name:
        categoria = get_categoria_by_name(
            db=db,
            id_tienda=target_tienda_id,
            nombre=requested_categoria_name,
        )
        if not categoria:
            raise HTTPException(status_code=404, detail="Categoria no encontrada")
        return categoria.id_categoria

    if requested_categoria_id:
        categoria = get_categoria_by_id(db=db, id_categoria=requested_categoria_id)
        if not categoria:
            raise HTTPException(status_code=404, detail="Categoria no encontrada")
        if categoria.id_tienda != target_tienda_id:
            raise HTTPException(status_code=403, detail="La categoria no pertenece a la tienda objetivo")
        return categoria.id_categoria

    return None


def _save_product_image_file(id_producto: UUID, file: UploadFile) -> str:
    return save_upload_file(file, "products", id_producto)


def _save_offer_banner_file(id_oferta: UUID, file: UploadFile) -> str:
    return save_upload_file(file, "offers", id_oferta)


def _save_theme_banner_file(id_tienda: UUID, file: UploadFile) -> str:
    return save_upload_file(file, "theme", id_tienda)


def _ensure_user_can_access_tenant(current_user: Usuario, target_tienda_id: UUID) -> None:
    if current_user.rol != "superadmin" and current_user.id_tienda != target_tienda_id:
        raise HTTPException(status_code=403, detail="No autorizado para esta tienda")


def _ensure_resource_matches_target_tienda(resource_tienda_id: UUID, target_tienda_id: UUID) -> None:
    if resource_tienda_id != target_tienda_id:
        raise HTTPException(status_code=403, detail="El recurso no pertenece a la tienda objetivo")


def _ensure_product_images_sync(db: Session, producto) -> list[ProductoImagen]:
    db_images = (
        db.query(ProductoImagen)
        .filter(ProductoImagen.id_producto == producto.id_producto)
        .order_by(ProductoImagen.orden.asc())
        .all()
    )
    if producto.imagen_url:
        # Extraemos el path del asset si viene con dominio
        cleaned_url = producto.imagen_url
        if cleaned_url.startswith("http://") or cleaned_url.startswith("https://"):
            # Obtenemos la ruta relativa extrayendo la parte del path
            from urllib.parse import urlparse
            cleaned_url = urlparse(cleaned_url).path
            if cleaned_url.startswith("/uploads/"):
                cleaned_url = cleaned_url[len("/uploads/"):]
            elif cleaned_url.startswith("uploads/"):
                cleaned_url = cleaned_url[len("uploads/"):]

        urls = [item.imagen_url for item in db_images]
        # También comprobamos con las urls de la DB sin prefijos
        cleaned_db_urls = []
        for item in db_images:
            db_u = item.imagen_url
            if db_u.startswith("/uploads/"):
                db_u = db_u[len("/uploads/"):]
            elif db_u.startswith("uploads/"):
                db_u = db_u[len("uploads/"):]
            cleaned_db_urls.append(db_u)

        if cleaned_url not in cleaned_db_urls and producto.imagen_url not in urls:
            # Creamos un registro ProductoImagen para la imagen actual si no existe
            new_img = ProductoImagen(
                id_producto=producto.id_producto,
                imagen_url=producto.imagen_url,
                orden=0
            )
            db.add(new_img)
            # Incrementamos el orden de las demás imágenes
            for db_img in db_images:
                db_img.orden += 1
            db.commit()
            db.refresh(producto)
            db_images = [new_img] + db_images
    return db_images


def _delete_physical_image_file(imagen_url: str) -> None:
    delete_asset_file(imagen_url)


def _get_target_tienda_id_for_catalog(
    *,
    db: Session,
    current_user: Usuario,
    id_tienda: UUID,
    id_tienda_target: UUID | None,
    tienda_ref: str | None,
    nombre_tienda_target: str | None,
) -> UUID:
    return _resolve_target_tienda_id(
        db=db,
        current_user=current_user,
        current_tienda_id=id_tienda,
        requested_tienda_id=id_tienda_target,
        requested_tienda_ref=tienda_ref,
        requested_tienda_name=nombre_tienda_target,
    )


@router.post(
    "/categories",
    response_model=CategoriaOut,
    dependencies=[Depends(require_role("admin", "empleado", "superadmin"))],
)
def api_create_categoria(
    data: CategoriaCreate,
    db: Session = Depends(get_db),
    id_tienda: UUID = Depends(get_current_tienda_id),
    current_user: Usuario = Depends(get_current_user),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    try:
        created = create_categoria(db=db, id_tienda=target_tienda_id, data=data)
        _invalidate_public_catalog_for_tenant(db, target_tienda_id)
        return created
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/categories",
    response_model=list[CategoriaOut],
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_list_categorias(
    db: Session = Depends(get_db),
    id_tienda: UUID = Depends(get_current_tienda_id),
    current_user: Usuario = Depends(get_current_user),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    return list_categorias(db=db, id_tienda=target_tienda_id)


@router.patch(
    "/categories/{id_categoria}",
    response_model=CategoriaOut,
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_update_categoria(
    id_categoria: UUID,
    data: CategoriaUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    id_tienda: UUID = Depends(get_current_tienda_id),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    categoria = get_categoria_by_id(db=db, id_categoria=id_categoria)
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria no encontrada")
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    _ensure_user_can_access_tenant(current_user, target_tienda_id)
    _ensure_resource_matches_target_tienda(categoria.id_tienda, target_tienda_id)
    try:
        updated = update_categoria(db=db, id_categoria=id_categoria, data=data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail="Categoria no encontrada")
    _invalidate_public_catalog_for_tenant(db, target_tienda_id)
    return updated


@router.delete(
    "/categories/{id_categoria}",
    response_model=CategoriaOut,
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_delete_categoria(
    id_categoria: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    id_tienda: UUID = Depends(get_current_tienda_id),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    categoria = get_categoria_by_id(db=db, id_categoria=id_categoria)
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria no encontrada")
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    _ensure_user_can_access_tenant(current_user, target_tienda_id)
    _ensure_resource_matches_target_tienda(categoria.id_tienda, target_tienda_id)
    updated = deactivate_categoria(db=db, id_categoria=id_categoria)
    if not updated:
        raise HTTPException(status_code=404, detail="Categoria no encontrada")
    return updated


@router.post(
    "/products",
    response_model=ProductoOut,
    dependencies=[Depends(require_role("admin", "empleado", "superadmin"))],
)
def api_create_producto(
    data: ProductoCreate,
    db: Session = Depends(get_db),
    id_tienda: UUID = Depends(get_current_tienda_id),
    current_user: Usuario = Depends(get_current_user),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    create_payload = data.model_dump()
    legacy_category_id = create_payload.get("id_categoria")
    primary_category_id = create_payload.get("id_categoria_principal")
    if legacy_category_id and primary_category_id and legacy_category_id != primary_category_id:
        raise HTTPException(
            status_code=400,
            detail="id_categoria e id_categoria_principal no coinciden",
        )
    categoria_id = _resolve_categoria_id_for_tienda(
        db=db,
        target_tienda_id=target_tienda_id,
        requested_categoria_id=primary_category_id or legacy_category_id,
        requested_categoria_name=create_payload.get("nombre_categoria"),
    )
    create_payload["id_categoria"] = categoria_id
    create_payload["id_categoria_principal"] = categoria_id
    create_payload.pop("nombre_categoria", None)
    normalized_data = ProductoCreate(**create_payload)
    try:
        created = create_producto(db=db, id_tienda=target_tienda_id, data=normalized_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    _invalidate_public_catalog_for_tenant(db, target_tienda_id)
    return created


@router.get(
    "/products",
    response_model=list[ProductoOut],
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_list_productos(
    db: Session = Depends(get_db),
    id_tienda: UUID = Depends(get_current_tienda_id),
    current_user: Usuario = Depends(get_current_user),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    products = list_productos(db=db, id_tienda=target_tienda_id)
    variant_stock_rows = (
        db.query(
            VarianteProducto.id_producto,
            func.coalesce(func.sum(VarianteProducto.stock_actual), 0),
        )
        .filter(
            VarianteProducto.id_tienda == target_tienda_id,
            VarianteProducto.activa.is_(True),
        )
        .group_by(VarianteProducto.id_producto)
        .all()
    )
    variant_stock = {
        product_id: int(stock or 0)
        for product_id, stock in variant_stock_rows
    }
    set_ids = [
        product.id_producto
        for product in products
        if product.tipo_producto == PRODUCT_TYPE_SET
    ]
    set_stock = calculate_set_stock_map(db, set_ids)
    return [
        ProductoOut.model_validate(product).model_copy(
            update={
                "stock_actual": (
                    set_stock.get(product.id_producto, 0)
                    if product.tipo_producto == PRODUCT_TYPE_SET
                    else variant_stock.get(product.id_producto, product.stock_actual)
                ),
                "tiene_variantes": (
                    product.tipo_producto != PRODUCT_TYPE_SET
                    and product.id_producto in variant_stock
                ),
            },
        )
        for product in products
    ]


@router.patch(
    "/products/{id_producto}",
    response_model=ProductoOut,
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_update_producto(
    id_producto: UUID,
    data: ProductoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    id_tienda: UUID = Depends(get_current_tienda_id),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    producto = get_producto_by_id(db=db, id_producto=id_producto)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    _ensure_user_can_access_tenant(current_user, target_tienda_id)
    _ensure_resource_matches_target_tienda(producto.id_tienda, target_tienda_id)
    update_payload = data.model_dump(exclude_unset=True)
    legacy_category_id = update_payload.get("id_categoria")
    primary_category_id = update_payload.get("id_categoria_principal")
    if legacy_category_id and primary_category_id and legacy_category_id != primary_category_id:
        raise HTTPException(
            status_code=400,
            detail="id_categoria e id_categoria_principal no coinciden",
        )
    if (
        "id_categoria" in update_payload
        or "id_categoria_principal" in update_payload
        or "nombre_categoria" in update_payload
    ):
        categoria_id = _resolve_categoria_id_for_tienda(
            db=db,
            target_tienda_id=target_tienda_id,
            requested_categoria_id=primary_category_id or legacy_category_id,
            requested_categoria_name=update_payload.get("nombre_categoria"),
        )
        update_payload["id_categoria"] = categoria_id
        update_payload["id_categoria_principal"] = categoria_id
    update_payload.pop("nombre_categoria", None)
    normalized_data = ProductoUpdate(**update_payload)
    try:
        updated = update_producto(db=db, id_producto=id_producto, data=normalized_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    _invalidate_public_catalog_for_tenant(db, target_tienda_id)
    return updated


@router.delete(
    "/products/{id_producto}",
    response_model=ProductoOut,
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_delete_producto(
    id_producto: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    id_tienda: UUID = Depends(get_current_tienda_id),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    producto = get_producto_by_id(db=db, id_producto=id_producto)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    target_tienda_id = _resolve_target_tienda_id(
        db=db,
        current_user=current_user,
        current_tienda_id=id_tienda,
        requested_tienda_id=id_tienda_target,
        requested_tienda_ref=tienda_ref,
        requested_tienda_name=nombre_tienda_target,
    )
    _ensure_user_can_access_tenant(current_user, target_tienda_id)
    _ensure_resource_matches_target_tienda(producto.id_tienda, target_tienda_id)
    updated = deactivate_producto(db=db, id_producto=id_producto)
    if not updated:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return updated


@router.post(
    "/products/{id_producto}/image",
    summary="Subir imagen de producto",
    description=(
        "Sube una imagen (JPG/PNG/WEBP, max 10MB) y actualiza `imagen_url` del producto.\n\n"
        "Ejemplo curl:\n"
        'curl -X POST "http://127.0.0.1:8000/api/catalog/products/<ID>/image" '
        '-H "Authorization: Bearer <TOKEN>" '
        '-F "file=@C:/ruta/imagen.jpg"'
    ),
)
def api_upload_product_image(
    id_producto: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    producto = get_producto_by_id(db=db, id_producto=id_producto)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    if current_user.rol not in {"superadmin", "admin", "empleado"}:
        raise HTTPException(status_code=403, detail="No autorizado")

    if current_user.rol != "superadmin" and producto.id_tienda != current_user.id_tienda:
        raise HTTPException(status_code=403, detail="No autorizado para este producto")

    imagen_url = _save_product_image_file(id_producto=id_producto, file=file)
    try:
        updated = set_product_image(db=db, id_producto=id_producto, imagen_url=imagen_url, commit=False)
        if not updated:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        add_product_image(db=db, id_producto=id_producto, imagen_url=imagen_url, commit=False)
        _invalidate_public_catalog_for_tenant(db, producto.id_tienda, commit=False)
        db.commit()
    except Exception:
        db.rollback()
        try:
            delete_asset_file(imagen_url)
        except Exception:
            pass
        raise

    try:
        db.refresh(updated)
    except Exception as e:
        logger.warning("Fallo post-commit al refrescar producto %s: %s", id_producto, e)

    _safe_invalidate_catalog_cache_only(db, producto.id_tienda)

    return {
        "id_producto": str(updated.id_producto),
        "imagen_url": build_public_asset_url(updated.imagen_url),
        "imagenes": [build_public_asset_url(url) for url in get_product_image_urls(db=db, id_producto=id_producto)],
    }


@router.post(
    "/offers",
    response_model=OfferOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("admin", "empleado", "superadmin"))],
)
def api_create_offer(
    data: OfferCreate,
    db: Session = Depends(get_db),
    id_tienda: UUID = Depends(get_current_tienda_id),
    current_user: Usuario = Depends(get_current_user),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    try:
        return create_offer(db=db, id_tienda=target_tienda_id, payload=data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/offers",
    response_model=list[OfferOut],
    dependencies=[Depends(require_role("admin", "empleado", "superadmin"))],
)
def api_list_offers(
    db: Session = Depends(get_db),
    id_tienda: UUID = Depends(get_current_tienda_id),
    current_user: Usuario = Depends(get_current_user),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    return list_offers(db=db, id_tienda=target_tienda_id)


@router.patch(
    "/offers/{id_oferta}",
    response_model=OfferOut,
    dependencies=[Depends(require_role("admin", "empleado", "superadmin"))],
)
def api_update_offer(
    id_oferta: UUID,
    data: OfferUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    id_tienda: UUID = Depends(get_current_tienda_id),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    offer = get_offer_by_id(db=db, id_oferta=id_oferta)
    if not offer:
        raise HTTPException(status_code=404, detail="Oferta no encontrada")
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    _ensure_user_can_access_tenant(current_user, target_tienda_id)
    _ensure_resource_matches_target_tienda(offer.id_tienda, target_tienda_id)
    try:
        return update_offer(db=db, offer=offer, payload=data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete(
    "/offers/{id_oferta}",
    response_model=OfferOut,
    dependencies=[Depends(require_role("admin", "empleado", "superadmin"))],
)
def api_delete_offer(
    id_oferta: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    id_tienda: UUID = Depends(get_current_tienda_id),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    offer = get_offer_by_id(db=db, id_oferta=id_oferta)
    if not offer:
        raise HTTPException(status_code=404, detail="Oferta no encontrada")
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    _ensure_user_can_access_tenant(current_user, target_tienda_id)
    _ensure_resource_matches_target_tienda(offer.id_tienda, target_tienda_id)
    return deactivate_offer(db=db, offer=offer)


@router.get(
    "/offers/{id_oferta}/products",
    response_model=list[OfferProductOut],
    dependencies=[Depends(require_role("admin", "empleado", "superadmin"))],
)
def api_list_offer_products(
    id_oferta: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    id_tienda: UUID = Depends(get_current_tienda_id),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    offer = get_offer_by_id(db=db, id_oferta=id_oferta)
    if not offer:
        raise HTTPException(status_code=404, detail="Oferta no encontrada")
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    _ensure_user_can_access_tenant(current_user, target_tienda_id)
    _ensure_resource_matches_target_tienda(offer.id_tienda, target_tienda_id)
    return list_offer_products(db=db, offer=offer)


@router.post(
    "/offers/{id_oferta}/products",
    response_model=list[OfferProductOut],
    dependencies=[Depends(require_role("admin", "empleado", "superadmin"))],
)
def api_attach_offer_products(
    id_oferta: UUID,
    data: OfferProductAttach,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    id_tienda: UUID = Depends(get_current_tienda_id),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    offer = get_offer_by_id(db=db, id_oferta=id_oferta)
    if not offer:
        raise HTTPException(status_code=404, detail="Oferta no encontrada")
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    _ensure_user_can_access_tenant(current_user, target_tienda_id)
    _ensure_resource_matches_target_tienda(offer.id_tienda, target_tienda_id)
    try:
        return attach_products_to_offer(db=db, offer=offer, payload=data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/offers/{id_oferta}/categories",
    response_model=list[OfferCategoryOut],
    dependencies=[Depends(require_role("admin", "empleado", "superadmin"))],
)
def api_list_offer_categories(
    id_oferta: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    id_tienda: UUID = Depends(get_current_tienda_id),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    offer = get_offer_by_id(db=db, id_oferta=id_oferta)
    if not offer:
        raise HTTPException(status_code=404, detail="Oferta no encontrada")
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    _ensure_user_can_access_tenant(current_user, target_tienda_id)
    _ensure_resource_matches_target_tienda(offer.id_tienda, target_tienda_id)
    try:
        return list_offer_categories(db=db, offer=offer)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post(
    "/offers/{id_oferta}/categories",
    response_model=list[OfferCategoryOut],
    dependencies=[Depends(require_role("admin", "empleado", "superadmin"))],
)
def api_attach_offer_categories(
    id_oferta: UUID,
    data: OfferCategoryAttach,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    id_tienda: UUID = Depends(get_current_tienda_id),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    offer = get_offer_by_id(db=db, id_oferta=id_oferta)
    if not offer:
        raise HTTPException(status_code=404, detail="Oferta no encontrada")
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    _ensure_user_can_access_tenant(current_user, target_tienda_id)
    _ensure_resource_matches_target_tienda(offer.id_tienda, target_tienda_id)
    try:
        return attach_categories_to_offer(db=db, offer=offer, payload=data)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete(
    "/offers/{id_oferta}/categories/{id_categoria}",
    dependencies=[Depends(require_role("admin", "empleado", "superadmin"))],
)
def api_detach_offer_category(
    id_oferta: UUID,
    id_categoria: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    id_tienda: UUID = Depends(get_current_tienda_id),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    offer = get_offer_by_id(db=db, id_oferta=id_oferta)
    if not offer:
        raise HTTPException(status_code=404, detail="Oferta no encontrada")
    categoria = get_categoria_by_id(db=db, id_categoria=id_categoria)
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria no encontrada")
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    _ensure_user_can_access_tenant(current_user, target_tienda_id)
    _ensure_resource_matches_target_tienda(offer.id_tienda, target_tienda_id)
    _ensure_resource_matches_target_tienda(categoria.id_tienda, target_tienda_id)
    try:
        deleted = detach_category_from_offer(db=db, offer=offer, id_categoria=id_categoria)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Categoria no asociada a la oferta")
    return {"ok": True, "id_categoria": str(id_categoria)}


@router.delete(
    "/offers/{id_oferta}/products/{id_producto}",
    dependencies=[Depends(require_role("admin", "empleado", "superadmin"))],
)
def api_detach_offer_product(
    id_oferta: UUID,
    id_producto: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    id_tienda: UUID = Depends(get_current_tienda_id),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    offer = get_offer_by_id(db=db, id_oferta=id_oferta)
    if not offer:
        raise HTTPException(status_code=404, detail="Oferta no encontrada")
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    _ensure_user_can_access_tenant(current_user, target_tienda_id)
    _ensure_resource_matches_target_tienda(offer.id_tienda, target_tienda_id)
    deleted = detach_product_from_offer(db=db, offer=offer, id_producto=id_producto)
    if not deleted:
        raise HTTPException(status_code=404, detail="Producto no asociado a la oferta")
    return {"ok": True, "id_producto": str(id_producto)}


@router.post(
    "/offers/{id_oferta}/banner",
    dependencies=[Depends(require_role("admin", "empleado", "superadmin"))],
    summary="Subir banner de oferta",
    description=(
        "Sube un banner JPG/PNG/WEBP para una oferta y actualiza `banner_url`.\n\n"
        "Ejemplo curl:\n"
        'curl -X POST "http://127.0.0.1:8000/api/catalog/offers/<ID>/banner" '
        '-H "Authorization: Bearer <TOKEN>" '
        '-F "file=@C:/ruta/banner.png"'
    ),
)
def api_upload_offer_banner(
    id_oferta: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    id_tienda: UUID = Depends(get_current_tienda_id),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    offer = get_offer_by_id(db=db, id_oferta=id_oferta)
    if not offer:
        raise HTTPException(status_code=404, detail="Oferta no encontrada")
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    _ensure_user_can_access_tenant(current_user, target_tienda_id)
    _ensure_resource_matches_target_tienda(offer.id_tienda, target_tienda_id)
    old_banner_url = offer.banner_url
    banner_url = _save_offer_banner_file(id_oferta=id_oferta, file=file)
    try:
        updated = update_offer(db=db, offer=offer, payload=OfferUpdate(banner_url=banner_url), commit=False)
        _invalidate_public_catalog_for_tenant(db, target_tienda_id, commit=False)
        db.commit()
    except Exception:
        db.rollback()
        try:
            delete_asset_file(banner_url)
        except Exception:
            pass
        raise

    try:
        db.refresh(updated)
    except Exception as e:
        logger.warning("Fallo post-commit al refrescar oferta %s: %s", id_oferta, e)

    _safe_invalidate_catalog_cache_only(db, target_tienda_id)

    if old_banner_url and old_banner_url != banner_url:
        try:
            delete_asset_file(old_banner_url)
        except Exception as e:
            logger.warning("Error eliminando banner antiguo de oferta %s: %s", old_banner_url, e)

    return {"id_oferta": str(updated.id_oferta), "banner_url": build_public_asset_url(updated.banner_url)}


@router.post(
    "/theme/banner",
    dependencies=[Depends(require_role("admin", "superadmin"))],
    summary="Subir banner del theme de una tienda",
)
def api_upload_theme_banner(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    id_tienda: UUID = Depends(get_current_tienda_id),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    target_tienda_id = _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=id_tienda,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    _ensure_user_can_access_tenant(current_user, target_tienda_id)
    tienda = db.query(Tienda).filter(Tienda.id_tienda == target_tienda_id).first()
    old_banner = (tienda.theme_config or {}).get("hero_image_url") if tienda else None
    banner_url = _save_theme_banner_file(id_tienda=target_tienda_id, file=file)
    if tienda:
        try:
            cfg = dict(tienda.theme_config or {})
            cfg["hero_image_url"] = banner_url
            tienda.theme_config = cfg
            _invalidate_public_catalog_for_tenant(db, target_tienda_id, commit=False)
            db.commit()
        except Exception:
            db.rollback()
            try:
                delete_asset_file(banner_url)
            except Exception:
                pass
            raise

        try:
            db.refresh(tienda)
        except Exception as e:
            logger.warning("Fallo post-commit al refrescar tienda %s: %s", target_tienda_id, e)

        _safe_invalidate_catalog_cache_only(db, target_tienda_id)

        if old_banner and old_banner != banner_url:
            try:
                delete_asset_file(old_banner)
            except Exception as e:
                logger.warning("Error eliminando banner antiguo de tema %s: %s", old_banner, e)

    return {
        "id_tienda": str(target_tienda_id),
        "hero_image_url": build_public_asset_url(banner_url),
        "url": build_public_asset_url(banner_url),
    }


@router.delete(
    "/products/{id_producto}/images",
    response_model=ProductoOut,
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
    summary="Eliminar una imagen específica del producto",
)
def api_delete_product_image(
    id_producto: UUID,
    imagen_url: str = Query(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    producto = get_producto_by_id(db=db, id_producto=id_producto)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    if current_user.rol not in {"superadmin", "admin", "empleado"}:
        raise HTTPException(status_code=403, detail="No autorizado")

    if current_user.rol != "superadmin" and producto.id_tienda != current_user.id_tienda:
        raise HTTPException(status_code=403, detail="No autorizado para este producto")

    db_images = _ensure_product_images_sync(db, producto)

    target_filename = imagen_url.split("/")[-1].split("\\")[-1]

    matched = None
    for db_img in db_images:
        db_filename = db_img.imagen_url.split("/")[-1].split("\\")[-1]
        if db_filename == target_filename:
            matched = db_img
            break

    if not matched:
        # Si no la encuentra en la tabla de imágenes, pero coincide con la imagen principal
        if producto.imagen_url:
            main_filename = producto.imagen_url.split("/")[-1].split("\\")[-1]
            if main_filename == target_filename:
                old_to_delete = producto.imagen_url
                producto.imagen_url = None
                try:
                    _invalidate_public_catalog_for_tenant(db, producto.id_tienda, commit=False)
                    db.commit()
                except Exception:
                    db.rollback()
                    raise

                try:
                    db.refresh(producto)
                except Exception as e:
                    logger.warning("Fallo post-commit al refrescar producto %s: %s", id_producto, e)

                _safe_invalidate_catalog_cache_only(db, producto.id_tienda)

                try:
                    delete_asset_file(old_to_delete)
                except Exception as e:
                    logger.warning("Error eliminando archivo de imagen huérfano %s: %s", old_to_delete, e)
                return producto
        raise HTTPException(status_code=404, detail="Imagen no encontrada en el producto")

    old_to_delete = matched.imagen_url

    # Borramos de la base de datos
    db.delete(matched)
    db.flush()

    # Reordenamos las restantes
    remaining = (
        db.query(ProductoImagen)
        .filter(ProductoImagen.id_producto == id_producto)
        .order_by(ProductoImagen.orden.asc())
        .all()
    )
    for index, img in enumerate(remaining):
        img.orden = index

    # Si era la imagen principal, la actualizamos con la primera restante
    if producto.imagen_url:
        main_filename = producto.imagen_url.split("/")[-1].split("\\")[-1]
        if main_filename == target_filename:
            if remaining:
                producto.imagen_url = remaining[0].imagen_url
            else:
                producto.imagen_url = None

    try:
        _invalidate_public_catalog_for_tenant(db, producto.id_tienda, commit=False)
        db.commit()
    except Exception:
        db.rollback()
        raise

    try:
        db.refresh(producto)
    except Exception as e:
        logger.warning("Fallo post-commit al refrescar producto %s: %s", id_producto, e)

    _safe_invalidate_catalog_cache_only(db, producto.id_tienda)

    try:
        delete_asset_file(old_to_delete)
    except Exception as e:
        logger.warning("Error eliminando archivo de imagen huérfano %s: %s", old_to_delete, e)

    return producto


@router.post(
    "/products/{id_producto}/images/reorder",
    response_model=ProductoOut,
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
    summary="Reordenar las imágenes del producto",
)
def api_reorder_product_images(
    id_producto: UUID,
    imagenes_urls: list[str],
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    producto = get_producto_by_id(db=db, id_producto=id_producto)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    if current_user.rol not in {"superadmin", "admin", "empleado"}:
        raise HTTPException(status_code=403, detail="No autorizado")

    if current_user.rol != "superadmin" and producto.id_tienda != current_user.id_tienda:
        raise HTTPException(status_code=403, detail="No autorizado para este producto")

    db_images = _ensure_product_images_sync(db, producto)

    # Creamos un mapa de filename -> ProductoImagen para búsqueda rápida
    image_map = {}
    for db_img in db_images:
        filename = db_img.imagen_url.split("/")[-1].split("\\")[-1]
        image_map[filename] = db_img

    ordered_db_images = []
    for url in imagenes_urls:
        filename = url.split("/")[-1].split("\\")[-1]
        if filename in image_map:
            matched = image_map[filename]
            if matched not in ordered_db_images:
                ordered_db_images.append(matched)

    # Si por alguna razón faltan imágenes en el reorden, las dejamos al final
    for db_img in db_images:
        if db_img not in ordered_db_images:
            ordered_db_images.append(db_img)

    # Actualizamos el orden en la base de datos
    for index, db_img in enumerate(ordered_db_images):
        db_img.orden = index

    # Actualizamos la imagen principal del producto
    if ordered_db_images:
        producto.imagen_url = ordered_db_images[0].imagen_url
    else:
        producto.imagen_url = None

    db.commit()
    try:
        db.refresh(producto)
    except Exception as e:
        logger.warning("Fallo post-commit al refrescar producto %s: %s", id_producto, e)
    _invalidate_public_catalog_for_tenant(db, producto.id_tienda)
    return producto


@router.put(
    "/products/{id_producto}/images/replace",
    response_model=ProductoOut,
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
    summary="Reemplazar una imagen específica del producto",
)
def api_replace_product_image(
    id_producto: UUID,
    target_url: str = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    producto = get_producto_by_id(db=db, id_producto=id_producto)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    if current_user.rol not in {"superadmin", "admin", "empleado"}:
        raise HTTPException(status_code=403, detail="No autorizado")

    if current_user.rol != "superadmin" and producto.id_tienda != current_user.id_tienda:
        raise HTTPException(status_code=403, detail="No autorizado para este producto")

    db_images = _ensure_product_images_sync(db, producto)

    target_filename = target_url.split("/")[-1].split("\\")[-1]

    matched = None
    for db_img in db_images:
        db_filename = db_img.imagen_url.split("/")[-1].split("\\")[-1]
        if db_filename == target_filename:
            matched = db_img
            break

    # Subimos y guardamos el nuevo archivo primero
    new_imagen_url = _save_product_image_file(id_producto=id_producto, file=file)

    if not matched:
        if producto.imagen_url:
            main_filename = producto.imagen_url.split("/")[-1].split("\\")[-1]
            if main_filename == target_filename:
                old_url = producto.imagen_url
                try:
                    producto.imagen_url = new_imagen_url
                    _invalidate_public_catalog_for_tenant(db, producto.id_tienda, commit=False)
                    db.commit()
                except Exception:
                    db.rollback()
                    try:
                        delete_asset_file(new_imagen_url)
                    except Exception:
                        pass
                    raise

                try:
                    db.refresh(producto)
                except Exception as e:
                    logger.warning("Fallo post-commit al refrescar producto %s: %s", id_producto, e)

                _safe_invalidate_catalog_cache_only(db, producto.id_tienda)

                try:
                    delete_asset_file(old_url)
                except Exception as e:
                    logger.warning("Error eliminando archivo huérfano tras reemplazo %s: %s", old_url, e)
                return producto

        try:
            delete_asset_file(new_imagen_url)
        except Exception:
            pass
        raise HTTPException(status_code=404, detail="Imagen objetivo no encontrada en el producto")

    old_url = matched.imagen_url
    try:
        matched.imagen_url = new_imagen_url
        if producto.imagen_url:
            main_filename = producto.imagen_url.split("/")[-1].split("\\")[-1]
            if main_filename == target_filename:
                producto.imagen_url = new_imagen_url
        _invalidate_public_catalog_for_tenant(db, producto.id_tienda, commit=False)
        db.commit()
    except Exception:
        db.rollback()
        try:
            delete_asset_file(new_imagen_url)
        except Exception:
            pass
        raise

    try:
        db.refresh(producto)
    except Exception as e:
        logger.warning("Fallo post-commit al refrescar producto %s: %s", id_producto, e)

    _safe_invalidate_catalog_cache_only(db, producto.id_tienda)

    try:
        delete_asset_file(old_url)
    except Exception as e:
        logger.warning("Error eliminando archivo huérfano tras reemplazo %s: %s", old_url, e)

    return producto
