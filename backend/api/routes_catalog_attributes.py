from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from api.routes_catalog import _get_target_tienda_id_for_catalog
from core.database import get_db
from core.deps import get_current_tienda_id, get_current_user, require_role
from crud.crud_attributes import (
    create_attribute,
    create_attribute_option,
    get_attribute,
    get_option,
    list_attributes,
    list_category_attributes,
    list_product_attributes,
    replace_category_attributes,
    replace_product_attributes,
    update_attribute,
    update_attribute_option,
)
from crud.crud_catalog import get_categoria_by_id, get_producto_by_id
from models.tenant import Usuario
from schemas.catalog_attribute_schema import (
    AttributeCreate,
    AttributeOptionCreate,
    AttributeOptionOut,
    AttributeOptionUpdate,
    AttributeOut,
    AttributeUpdate,
    CategoryAttributeOut,
    CategoryAttributesReplace,
    ProductAttributeValueOut,
    ProductAttributesReplace,
)


router = APIRouter(
    prefix="/api/catalog",
    tags=["Catalog Attributes"],
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)


def _ensure_tenant_access(current_user: Usuario, resource_tienda_id: UUID) -> None:
    if current_user.rol != "superadmin" and current_user.id_tienda != resource_tienda_id:
        raise HTTPException(status_code=403, detail="No autorizado para esta tienda")


def _target_tenant(
    *,
    db: Session,
    current_user: Usuario,
    current_tienda_id: UUID,
    id_tienda_target: UUID | None,
    tienda_ref: str | None,
    nombre_tienda_target: str | None,
) -> UUID:
    return _get_target_tienda_id_for_catalog(
        db=db,
        current_user=current_user,
        id_tienda=current_tienda_id,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )


@router.post("/attributes", response_model=AttributeOut)
def api_create_attribute(
    payload: AttributeCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    current_tienda_id: UUID = Depends(get_current_tienda_id),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    target_id = _target_tenant(
        db=db,
        current_user=current_user,
        current_tienda_id=current_tienda_id,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    try:
        return create_attribute(db, id_tienda=target_id, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/attributes", response_model=list[AttributeOut])
def api_list_attributes(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    current_tienda_id: UUID = Depends(get_current_tienda_id),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
    tienda_ref: str | None = Query(default=None, alias="tienda"),
    nombre_tienda_target: str | None = Query(default=None, alias="nombre_tienda"),
):
    target_id = _target_tenant(
        db=db,
        current_user=current_user,
        current_tienda_id=current_tienda_id,
        id_tienda_target=id_tienda_target,
        tienda_ref=tienda_ref,
        nombre_tienda_target=nombre_tienda_target,
    )
    return list_attributes(db, id_tienda=target_id)


@router.patch("/attributes/{id_atributo}", response_model=AttributeOut)
def api_update_attribute(
    id_atributo: UUID,
    payload: AttributeUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    attribute = get_attribute(db, id_atributo)
    if attribute is None:
        raise HTTPException(status_code=404, detail="Atributo no encontrado")
    _ensure_tenant_access(current_user, attribute.id_tienda)
    try:
        return update_attribute(db, attribute=attribute, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/attributes/{id_atributo}/options",
    response_model=AttributeOptionOut,
)
def api_create_attribute_option(
    id_atributo: UUID,
    payload: AttributeOptionCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    attribute = get_attribute(db, id_atributo)
    if attribute is None:
        raise HTTPException(status_code=404, detail="Atributo no encontrado")
    _ensure_tenant_access(current_user, attribute.id_tienda)
    try:
        return create_attribute_option(db, attribute=attribute, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch(
    "/attribute-options/{id_opcion}",
    response_model=AttributeOptionOut,
)
def api_update_attribute_option(
    id_opcion: UUID,
    payload: AttributeOptionUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    option = get_option(db, id_opcion)
    if option is None:
        raise HTTPException(status_code=404, detail="Opcion no encontrada")
    attribute = get_attribute(db, option.id_atributo)
    _ensure_tenant_access(current_user, attribute.id_tienda)
    try:
        return update_attribute_option(db, option=option, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/categories/{id_categoria}/attributes",
    response_model=list[CategoryAttributeOut],
)
def api_list_category_attributes(
    id_categoria: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    category = get_categoria_by_id(db, id_categoria)
    if category is None:
        raise HTTPException(status_code=404, detail="Categoria no encontrada")
    _ensure_tenant_access(current_user, category.id_tienda)
    return list_category_attributes(db, id_categoria=id_categoria)


@router.put(
    "/categories/{id_categoria}/attributes",
    response_model=list[CategoryAttributeOut],
)
def api_replace_category_attributes(
    id_categoria: UUID,
    payload: CategoryAttributesReplace,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    category = get_categoria_by_id(db, id_categoria)
    if category is None:
        raise HTTPException(status_code=404, detail="Categoria no encontrada")
    _ensure_tenant_access(current_user, category.id_tienda)
    try:
        return replace_category_attributes(db, category=category, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/products/{id_producto}/attributes",
    response_model=list[ProductAttributeValueOut],
)
def api_list_product_attributes(
    id_producto: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    product = get_producto_by_id(db, id_producto)
    if product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    _ensure_tenant_access(current_user, product.id_tienda)
    return list_product_attributes(db, id_producto=id_producto)


@router.put(
    "/products/{id_producto}/attributes",
    response_model=list[ProductAttributeValueOut],
)
def api_replace_product_attributes(
    id_producto: UUID,
    payload: ProductAttributesReplace,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    product = get_producto_by_id(db, id_producto)
    if product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    _ensure_tenant_access(current_user, product.id_tienda)
    try:
        return replace_product_attributes(db, product=product, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
