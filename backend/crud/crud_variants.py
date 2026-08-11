from uuid import UUID, uuid4

from sqlalchemy.orm import Session, joinedload

from crud.crud_catalog import _slugify_category_name
from models.catalog import Producto
from models.catalog_attribute import Atributo, AtributoOpcion, CategoriaAtributo
from models.catalog_variant import VarianteAtributo, VarianteProducto
from schemas.catalog_variant_schema import VariantCreate, VariantUpdate


def get_variant(db: Session, id_variante: UUID) -> VarianteProducto | None:
    return (
        db.query(VarianteProducto)
        .options(
            joinedload(VarianteProducto.atributos).joinedload(VarianteAtributo.atributo),
            joinedload(VarianteProducto.atributos).joinedload(VarianteAtributo.opcion),
        )
        .filter(VarianteProducto.id_variante == id_variante)
        .first()
    )


def list_variants(db: Session, id_producto: UUID) -> list[VarianteProducto]:
    return (
        db.query(VarianteProducto)
        .options(
            joinedload(VarianteProducto.atributos).joinedload(VarianteAtributo.atributo),
            joinedload(VarianteProducto.atributos).joinedload(VarianteAtributo.opcion),
        )
        .filter(VarianteProducto.id_producto == id_producto)
        .order_by(
            VarianteProducto.es_predeterminada.desc(),
            VarianteProducto.created_at.asc(),
        )
        .all()
    )


def list_store_variants(db: Session, id_tienda: UUID) -> list[VarianteProducto]:
    return (
        db.query(VarianteProducto)
        .options(
            joinedload(VarianteProducto.atributos).joinedload(VarianteAtributo.atributo),
            joinedload(VarianteProducto.atributos).joinedload(VarianteAtributo.opcion),
        )
        .filter(VarianteProducto.id_tienda == id_tienda)
        .order_by(
            VarianteProducto.id_producto.asc(),
            VarianteProducto.es_predeterminada.desc(),
            VarianteProducto.created_at.asc(),
        )
        .all()
    )


def serialize_variant(variant: VarianteProducto) -> dict:
    return {
        "id_variante": variant.id_variante,
        "id_tienda": variant.id_tienda,
        "id_producto": variant.id_producto,
        "sku": variant.sku,
        "precio_venta": variant.precio_venta,
        "costo_adquisicion": variant.costo_adquisicion,
        "stock_actual": variant.stock_actual,
        "imagen_url": variant.imagen_url,
        "activa": variant.activa,
        "es_predeterminada": variant.es_predeterminada,
        "created_at": variant.created_at,
        "updated_at": variant.updated_at,
        "atributos": [
            {
                "id_atributo": item.id_atributo,
                "nombre": item.atributo.nombre,
                "codigo": item.atributo.codigo,
                "id_opcion": item.id_opcion,
                "valor": item.opcion.valor,
            }
            for item in sorted(
                variant.atributos,
                key=lambda item: item.atributo.nombre.lower(),
            )
        ],
    }


def _configured_variant_attributes(
    db: Session,
    product: Producto,
) -> dict[UUID, Atributo]:
    category_id = product.id_categoria_principal or product.id_categoria
    if category_id is None:
        return {}
    rows = (
        db.query(CategoriaAtributo)
        .options(joinedload(CategoriaAtributo.atributo))
        .filter(
            CategoriaAtributo.id_categoria == category_id,
            CategoriaAtributo.usado_en_variantes.is_(True),
        )
        .all()
    )
    return {
        row.id_atributo: row.atributo
        for row in rows
        if row.atributo.activo and row.atributo.usable_en_variantes
    }


def _validate_variant_attributes(
    db: Session,
    *,
    product: Producto,
    items,
) -> list[tuple[UUID, UUID]]:
    configured = _configured_variant_attributes(db, product)
    if not configured:
        raise ValueError(
            "Configura al menos un atributo de la categoria para usarlo en variantes.",
        )
    item_attribute_ids = [item.id_atributo for item in items]
    if len(item_attribute_ids) != len(set(item_attribute_ids)):
        raise ValueError("No se puede repetir un atributo en una variante.")
    if set(item_attribute_ids) != set(configured):
        raise ValueError(
            "La variante debe indicar todos los atributos configurados para variantes.",
        )

    combination = []
    for item in items:
        attribute = configured[item.id_atributo]
        if attribute.tipo_dato != "OPTION":
            raise ValueError(
                f"El atributo '{attribute.nombre}' debe ser de tipo lista para crear variantes.",
            )
        option = (
            db.query(AtributoOpcion)
            .filter(AtributoOpcion.id_opcion == item.id_opcion)
            .first()
        )
        if (
            option is None
            or option.id_atributo != attribute.id_atributo
            or not option.activo
        ):
            raise ValueError(f"Opcion invalida para '{attribute.nombre}'.")
        combination.append((item.id_atributo, item.id_opcion))
    return sorted(combination, key=lambda pair: str(pair[0]))


def _ensure_unique_combination(
    db: Session,
    *,
    product: Producto,
    combination: list[tuple[UUID, UUID]],
    exclude_id: UUID | None = None,
) -> None:
    target = {(attribute_id, option_id) for attribute_id, option_id in combination}
    for existing in list_variants(db, product.id_producto):
        if exclude_id is not None and existing.id_variante == exclude_id:
            continue
        existing_set = {
            (item.id_atributo, item.id_opcion)
            for item in existing.atributos
        }
        if existing_set == target:
            raise ValueError("Ya existe una variante con esa combinacion.")


def _ensure_unique_sku(
    db: Session,
    *,
    id_tienda: UUID,
    sku: str,
    exclude_id: UUID | None = None,
) -> str:
    query = db.query(VarianteProducto).filter(
        VarianteProducto.id_tienda == id_tienda,
        VarianteProducto.sku == sku,
    )
    if exclude_id is not None:
        query = query.filter(VarianteProducto.id_variante != exclude_id)
    if query.first() is not None:
        raise ValueError("Ya existe una variante con ese SKU en la tienda.")
    return sku


def create_variant(
    db: Session,
    *,
    product: Producto,
    payload: VariantCreate,
) -> VarianteProducto:
    if product.tipo_producto == "SET":
        raise ValueError("Los sets no pueden tener variantes propias.")
    combination = _validate_variant_attributes(db, product=product, items=payload.atributos)
    _ensure_unique_combination(db, product=product, combination=combination)
    sku = payload.sku or (
        f"{_slugify_category_name(product.nombre).upper()}-{str(uuid4())[:8].upper()}"
    )
    _ensure_unique_sku(db, id_tienda=product.id_tienda, sku=sku)

    has_default = (
        db.query(VarianteProducto.id_variante)
        .filter(
            VarianteProducto.id_producto == product.id_producto,
            VarianteProducto.es_predeterminada.is_(True),
        )
        .first()
        is not None
    )
    make_default = payload.es_predeterminada or not has_default
    if make_default:
        db.query(VarianteProducto).filter(
            VarianteProducto.id_producto == product.id_producto,
        ).update({VarianteProducto.es_predeterminada: False})

    variant = VarianteProducto(
        id_tienda=product.id_tienda,
        id_producto=product.id_producto,
        sku=sku.strip(),
        precio_venta=payload.precio_venta,
        costo_adquisicion=payload.costo_adquisicion,
        stock_actual=payload.stock_actual,
        imagen_url=payload.imagen_url,
        activa=payload.activa,
        es_predeterminada=make_default,
    )
    db.add(variant)
    db.flush()
    for attribute_id, option_id in combination:
        db.add(
            VarianteAtributo(
                id_variante=variant.id_variante,
                id_atributo=attribute_id,
                id_opcion=option_id,
            ),
        )
    db.commit()
    return get_variant(db, variant.id_variante)


def update_variant(
    db: Session,
    *,
    product: Producto,
    variant: VarianteProducto,
    payload: VariantUpdate,
) -> VarianteProducto:
    data = payload.model_dump(exclude_unset=True)
    attribute_items = data.pop("atributos", None)
    if "sku" in data and data["sku"] is not None:
        data["sku"] = _ensure_unique_sku(
            db,
            id_tienda=product.id_tienda,
            sku=data["sku"].strip(),
            exclude_id=variant.id_variante,
        )
    was_default = variant.es_predeterminada
    if data.get("es_predeterminada") is True:
        db.query(VarianteProducto).filter(
            VarianteProducto.id_producto == product.id_producto,
            VarianteProducto.id_variante != variant.id_variante,
        ).update({VarianteProducto.es_predeterminada: False})
    for key, value in data.items():
        setattr(variant, key, value)

    needs_replacement = (
        was_default and not variant.es_predeterminada
    ) or (
        variant.es_predeterminada and not variant.activa
    )
    if needs_replacement:
        variant.es_predeterminada = False
        db.flush()
        replacement = (
            db.query(VarianteProducto)
            .filter(
                VarianteProducto.id_producto == variant.id_producto,
                VarianteProducto.id_variante != variant.id_variante,
                VarianteProducto.activa.is_(True),
            )
            .order_by(VarianteProducto.created_at.asc())
            .first()
        )
        if replacement is not None:
            replacement.es_predeterminada = True

    if attribute_items is not None:
        combination = _validate_variant_attributes(
            db,
            product=product,
            items=payload.atributos,
        )
        _ensure_unique_combination(
            db,
            product=product,
            combination=combination,
            exclude_id=variant.id_variante,
        )
        db.query(VarianteAtributo).filter(
            VarianteAtributo.id_variante == variant.id_variante,
        ).delete(synchronize_session=False)
        for attribute_id, option_id in combination:
            db.add(
                VarianteAtributo(
                    id_variante=variant.id_variante,
                    id_atributo=attribute_id,
                    id_opcion=option_id,
                ),
            )

    db.commit()
    return get_variant(db, variant.id_variante)


def deactivate_variant(
    db: Session,
    *,
    variant: VarianteProducto,
) -> VarianteProducto:
    was_default = variant.es_predeterminada
    variant.activa = False
    variant.es_predeterminada = False
    if was_default:
        db.flush()
        replacement = (
            db.query(VarianteProducto)
            .filter(
                VarianteProducto.id_producto == variant.id_producto,
                VarianteProducto.id_variante != variant.id_variante,
                VarianteProducto.activa.is_(True),
            )
            .order_by(VarianteProducto.created_at.asc())
            .first()
        )
        if replacement is not None:
            replacement.es_predeterminada = True
    db.commit()
    return get_variant(db, variant.id_variante)
