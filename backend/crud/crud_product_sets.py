from __future__ import annotations

from collections import defaultdict
from typing import Iterable
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.catalog import Categoria, Producto
from models.catalog_variant import VarianteProducto
from models.product_set import ProductoComponente


SETS_CATEGORY_CODE = "SETS"
SETS_CATEGORY_NAME = "Sets"
PRODUCT_TYPE_SIMPLE = "SIMPLE"
PRODUCT_TYPE_SET = "SET"


def ensure_sets_category(db: Session, id_tienda: UUID) -> Categoria:
    category = (
        db.query(Categoria)
        .filter(
            Categoria.id_tienda == id_tienda,
            Categoria.codigo_sistema == SETS_CATEGORY_CODE,
        )
        .first()
    )
    if category is None:
        category = (
            db.query(Categoria)
            .filter(
                Categoria.id_tienda == id_tienda,
                func.lower(Categoria.nombre) == SETS_CATEGORY_NAME.lower(),
            )
            .first()
        )
    if category is None:
        slug = "sets"
        suffix = 2
        while (
            db.query(Categoria.id_categoria)
            .filter(Categoria.id_tienda == id_tienda, Categoria.slug == slug)
            .first()
            is not None
        ):
            slug = f"sets-{suffix}"
            suffix += 1
        category = Categoria(
            id_tienda=id_tienda,
            nombre=SETS_CATEGORY_NAME,
            slug=slug,
            codigo_sistema=SETS_CATEGORY_CODE,
            id_categoria_padre=None,
            orden=9000,
            activa=True,
        )
        db.add(category)
        db.flush()
        return category

    category.nombre = SETS_CATEGORY_NAME
    category.codigo_sistema = SETS_CATEGORY_CODE
    category.id_categoria_padre = None
    category.activa = True
    db.flush()
    return category


def _variant_label(variant: VarianteProducto | None) -> str | None:
    if variant is None:
        return None
    values = [
        item.opcion.valor
        for item in variant.atributos
        if item.opcion is not None
    ]
    return " / ".join(values) or variant.sku


def validate_set_components(
    db: Session,
    *,
    id_tienda: UUID,
    components: Iterable,
    set_product_id: UUID | None = None,
) -> list[dict]:
    normalized: list[dict] = []
    seen: set[tuple[str, str]] = set()
    total_units = 0

    for item in components:
        product_id = item.id_producto_componente
        variant_id = item.id_variante_componente
        quantity = int(item.cantidad)
        key = (str(product_id), str(variant_id or "simple"))
        if key in seen:
            raise ValueError("Un componente no puede repetirse dentro del mismo set.")
        seen.add(key)

        product = (
            db.query(Producto)
            .filter(
                Producto.id_producto == product_id,
                Producto.id_tienda == id_tienda,
            )
            .first()
        )
        if product is None:
            raise ValueError("Uno de los productos seleccionados no existe o pertenece a otra tienda.")
        if set_product_id is not None and product.id_producto == set_product_id:
            raise ValueError("Un set no puede incluirse a si mismo.")
        if product.tipo_producto == PRODUCT_TYPE_SET:
            raise ValueError("Por ahora un set no puede contener otro set.")
        if not product.activo:
            raise ValueError(f"El componente '{product.nombre}' esta inactivo.")

        active_variants = (
            db.query(VarianteProducto)
            .filter(
                VarianteProducto.id_producto == product.id_producto,
                VarianteProducto.activa.is_(True),
            )
            .all()
        )
        variant = None
        if variant_id is not None:
            variant = next(
                (candidate for candidate in active_variants if candidate.id_variante == variant_id),
                None,
            )
            if variant is None:
                raise ValueError(
                    f"La variante seleccionada de '{product.nombre}' no existe o esta inactiva.",
                )
        elif active_variants:
            raise ValueError(f"Selecciona una variante especifica para '{product.nombre}'.")

        normalized.append(
            {
                "product": product,
                "variant": variant,
                "quantity": quantity,
            },
        )
        total_units += quantity

    if total_units < 2:
        raise ValueError("Un set debe contener al menos dos unidades de productos.")

    return normalized


def replace_set_components(
    db: Session,
    *,
    set_product: Producto,
    components: Iterable,
) -> list[ProductoComponente]:
    normalized = validate_set_components(
        db,
        id_tienda=set_product.id_tienda,
        components=components,
        set_product_id=set_product.id_producto,
    )
    db.query(ProductoComponente).filter(
        ProductoComponente.id_set == set_product.id_producto,
    ).delete(synchronize_session=False)
    created = []
    for item in normalized:
        component = ProductoComponente(
            id_set=set_product.id_producto,
            id_producto_componente=item["product"].id_producto,
            id_variante_componente=(
                item["variant"].id_variante if item["variant"] is not None else None
            ),
            cantidad=item["quantity"],
        )
        db.add(component)
        created.append(component)
    db.flush()
    db.expire(set_product, ["componentes"])
    return created


def calculate_set_stock_map(
    db: Session,
    set_ids: Iterable[UUID],
) -> dict[UUID, int]:
    ids = list(dict.fromkeys(set_ids))
    if not ids:
        return {}

    rows = (
        db.query(ProductoComponente)
        .options(
            joinedload(ProductoComponente.producto_componente),
            joinedload(ProductoComponente.variante_componente),
        )
        .filter(ProductoComponente.id_set.in_(ids))
        .all()
    )
    grouped: dict[UUID, list[ProductoComponente]] = defaultdict(list)
    for row in rows:
        grouped[row.id_set].append(row)

    simple_product_ids = {
        row.id_producto_componente
        for row in rows
        if row.id_variante_componente is None
    }
    products_with_active_variants = {
        product_id
        for (product_id,) in (
            db.query(VarianteProducto.id_producto)
            .filter(
                VarianteProducto.id_producto.in_(simple_product_ids),
                VarianteProducto.activa.is_(True),
            )
            .distinct()
            .all()
        )
    } if simple_product_ids else set()

    result: dict[UUID, int] = {}
    for set_id in ids:
        components = grouped.get(set_id, [])
        if not components:
            result[set_id] = 0
            continue
        availability = []
        for component in components:
            product = component.producto_componente
            variant = component.variante_componente
            if (
                product is None
                or not product.activo
                or product.tipo_producto != PRODUCT_TYPE_SIMPLE
                or (
                    variant is None
                    and component.id_producto_componente in products_with_active_variants
                )
                or (
                    variant is not None
                    and (
                        not variant.activa
                        or variant.id_producto != component.id_producto_componente
                    )
                )
            ):
                availability.append(0)
                continue
            target = variant or product
            availability.append(
                max(int(target.stock_actual or 0), 0) // component.cantidad,
            )
        result[set_id] = min(availability, default=0)
    return result


def public_set_components(db: Session, set_ids: Iterable[UUID]) -> dict[str, list[dict]]:
    ids = list(dict.fromkeys(set_ids))
    if not ids:
        return {}
    rows = (
        db.query(ProductoComponente)
        .options(
            joinedload(ProductoComponente.producto_componente),
            joinedload(ProductoComponente.variante_componente)
            .joinedload(VarianteProducto.atributos),
        )
        .filter(ProductoComponente.id_set.in_(ids))
        .order_by(ProductoComponente.created_at.asc())
        .all()
    )
    result: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        product = row.producto_componente
        variant = row.variante_componente
        result[str(row.id_set)].append(
            {
                "id_producto": str(row.id_producto_componente),
                "id_variante": (
                    str(row.id_variante_componente)
                    if row.id_variante_componente is not None
                    else None
                ),
                "nombre": product.nombre if product else row.nombre_producto,
                "variante": _variant_label(variant),
                "cantidad": row.cantidad,
            },
        )
    return dict(result)
