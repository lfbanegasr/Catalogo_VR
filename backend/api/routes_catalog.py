from datetime import datetime
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
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
    set_product_image,
    update_categoria,
    update_producto,
)
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
from models.tenant import Usuario
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

from core.storage import save_upload_file, build_public_asset_url

router = APIRouter(prefix="/api/catalog", tags=["Catalog"])

UPLOAD_DIR = settings.PRODUCTS_UPLOAD_PATH
OFFERS_UPLOAD_DIR = settings.OFFERS_UPLOAD_PATH
THEME_UPLOAD_DIR = settings.THEME_UPLOAD_PATH


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
    return create_categoria(db=db, id_tienda=target_tienda_id, data=data)


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
    updated = update_categoria(db=db, id_categoria=id_categoria, data=data)
    if not updated:
        raise HTTPException(status_code=404, detail="Categoria no encontrada")
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
    categoria_id = _resolve_categoria_id_for_tienda(
        db=db,
        target_tienda_id=target_tienda_id,
        requested_categoria_id=create_payload.get("id_categoria"),
        requested_categoria_name=create_payload.get("nombre_categoria"),
    )
    create_payload["id_categoria"] = categoria_id
    create_payload.pop("nombre_categoria", None)
    normalized_data = ProductoCreate(**create_payload)
    return create_producto(db=db, id_tienda=target_tienda_id, data=normalized_data)


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
    return list_productos(db=db, id_tienda=target_tienda_id)


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
    if "id_categoria" in update_payload or "nombre_categoria" in update_payload:
        categoria_id = _resolve_categoria_id_for_tienda(
            db=db,
            target_tienda_id=target_tienda_id,
            requested_categoria_id=update_payload.get("id_categoria"),
            requested_categoria_name=update_payload.get("nombre_categoria"),
        )
        update_payload["id_categoria"] = categoria_id
    update_payload.pop("nombre_categoria", None)
    normalized_data = ProductoUpdate(**update_payload)
    updated = update_producto(db=db, id_producto=id_producto, data=normalized_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
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
        "Sube una imagen (JPG/PNG/WEBP, max 5MB) y actualiza `imagen_url` del producto.\n\n"
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
    updated = set_product_image(db=db, id_producto=id_producto, imagen_url=imagen_url)
    add_product_image(db=db, id_producto=id_producto, imagen_url=imagen_url)
    if not updated:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

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
    banner_url = _save_offer_banner_file(id_oferta=id_oferta, file=file)
    updated = update_offer(db=db, offer=offer, payload=OfferUpdate(banner_url=banner_url))
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
    banner_url = _save_theme_banner_file(id_tienda=target_tienda_id, file=file)
    return {
        "id_tienda": str(target_tienda_id),
        "hero_image_url": build_public_asset_url(banner_url),
        "url": build_public_asset_url(banner_url),
    }
