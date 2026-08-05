from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import get_current_tienda_id, get_current_user, require_role
from crud.crud_catalog import get_producto_by_id
from crud.crud_variants import (
    create_variant,
    deactivate_variant,
    get_variant,
    list_store_variants,
    list_variants,
    serialize_variant,
    update_variant,
)
from models.tenant import Usuario
from schemas.catalog_variant_schema import VariantCreate, VariantOut, VariantUpdate


router = APIRouter(
    prefix="/api/catalog",
    tags=["Catalog Variants"],
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)


def _ensure_product_access(current_user: Usuario, product) -> None:
    if current_user.rol != "superadmin" and current_user.id_tienda != product.id_tienda:
        raise HTTPException(status_code=403, detail="No autorizado para esta tienda")


@router.get("/variants", response_model=list[VariantOut])
def api_list_store_variants(
    db: Session = Depends(get_db),
    id_tienda: UUID = Depends(get_current_tienda_id),
):
    return [serialize_variant(item) for item in list_store_variants(db, id_tienda)]


@router.get("/products/{id_producto}/variants", response_model=list[VariantOut])
def api_list_variants(
    id_producto: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    product = get_producto_by_id(db, id_producto)
    if product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    _ensure_product_access(current_user, product)
    return [serialize_variant(item) for item in list_variants(db, id_producto)]


@router.post("/products/{id_producto}/variants", response_model=VariantOut)
def api_create_variant(
    id_producto: UUID,
    payload: VariantCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    product = get_producto_by_id(db, id_producto)
    if product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    _ensure_product_access(current_user, product)
    try:
        return serialize_variant(create_variant(db, product=product, payload=payload))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/variants/{id_variante}", response_model=VariantOut)
def api_update_variant(
    id_variante: UUID,
    payload: VariantUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    variant = get_variant(db, id_variante)
    if variant is None:
        raise HTTPException(status_code=404, detail="Variante no encontrada")
    product = get_producto_by_id(db, variant.id_producto)
    _ensure_product_access(current_user, product)
    try:
        return serialize_variant(
            update_variant(db, product=product, variant=variant, payload=payload),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/variants/{id_variante}", response_model=VariantOut)
def api_deactivate_variant(
    id_variante: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    variant = get_variant(db, id_variante)
    if variant is None:
        raise HTTPException(status_code=404, detail="Variante no encontrada")
    product = get_producto_by_id(db, variant.id_producto)
    _ensure_product_access(current_user, product)
    return serialize_variant(deactivate_variant(db, variant=variant))
