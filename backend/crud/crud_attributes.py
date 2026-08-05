from collections import Counter
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from crud.crud_catalog import _slugify_category_name
from models.catalog import Categoria, Producto
from models.catalog_attribute import Atributo, AtributoOpcion, CategoriaAtributo, ProductoAtributo
from models.catalog_variant import VarianteProducto
from schemas.catalog_attribute_schema import (
    AttributeCreate,
    AttributeOptionCreate,
    AttributeOptionUpdate,
    AttributeUpdate,
    CategoryAttributesReplace,
    ProductAttributesReplace,
)


def get_attribute(db: Session, id_atributo: UUID) -> Atributo | None:
    return (
        db.query(Atributo)
        .options(joinedload(Atributo.opciones))
        .filter(Atributo.id_atributo == id_atributo)
        .first()
    )


def get_option(db: Session, id_opcion: UUID) -> AtributoOpcion | None:
    return db.query(AtributoOpcion).filter(AtributoOpcion.id_opcion == id_opcion).first()


def _build_unique_attribute_code(
    db: Session,
    *,
    id_tienda: UUID,
    requested_code: str,
    exclude_id: UUID | None = None,
    allow_suffix: bool,
) -> str:
    base_code = _slugify_category_name(requested_code)
    candidate = base_code
    suffix = 2
    while True:
        query = db.query(Atributo).filter(
            Atributo.id_tienda == id_tienda,
            func.lower(Atributo.codigo) == candidate.lower(),
        )
        if exclude_id is not None:
            query = query.filter(Atributo.id_atributo != exclude_id)
        if query.first() is None:
            return candidate
        if not allow_suffix:
            raise ValueError("Ya existe un atributo con ese codigo en la tienda.")
        candidate = f"{base_code}-{suffix}"
        suffix += 1


def create_attribute(db: Session, *, id_tienda: UUID, payload: AttributeCreate) -> Atributo:
    code = _build_unique_attribute_code(
        db,
        id_tienda=id_tienda,
        requested_code=payload.codigo or payload.nombre,
        allow_suffix=payload.codigo is None,
    )
    attribute = Atributo(
        id_tienda=id_tienda,
        nombre=payload.nombre.strip(),
        codigo=code,
        tipo_dato=payload.tipo_dato,
        unidad=payload.unidad,
        permite_multiples=payload.permite_multiples,
        usable_en_variantes=payload.usable_en_variantes,
        activo=payload.activo,
    )
    db.add(attribute)
    db.commit()
    db.refresh(attribute)
    return get_attribute(db, attribute.id_atributo)


def list_attributes(db: Session, *, id_tienda: UUID) -> list[Atributo]:
    return (
        db.query(Atributo)
        .options(joinedload(Atributo.opciones))
        .filter(Atributo.id_tienda == id_tienda)
        .order_by(Atributo.nombre.asc())
        .all()
    )


def update_attribute(db: Session, *, attribute: Atributo, payload: AttributeUpdate) -> Atributo:
    data = payload.model_dump(exclude_unset=True)
    if "codigo" in data and data["codigo"] is not None:
        data["codigo"] = _build_unique_attribute_code(
            db,
            id_tienda=attribute.id_tienda,
            requested_code=data["codigo"],
            exclude_id=attribute.id_atributo,
            allow_suffix=False,
        )
    if "nombre" in data and data["nombre"] is not None:
        data["nombre"] = data["nombre"].strip()
    for key, value in data.items():
        setattr(attribute, key, value)
    db.commit()
    return get_attribute(db, attribute.id_atributo)


def create_attribute_option(
    db: Session,
    *,
    attribute: Atributo,
    payload: AttributeOptionCreate,
) -> AtributoOpcion:
    if attribute.tipo_dato != "OPTION":
        raise ValueError("Solo los atributos de tipo OPTION admiten opciones.")
    normalized = _slugify_category_name(payload.valor)
    duplicate = db.query(AtributoOpcion).filter(
        AtributoOpcion.id_atributo == attribute.id_atributo,
        AtributoOpcion.valor_normalizado == normalized,
    ).first()
    if duplicate:
        raise ValueError("Esa opcion ya existe para el atributo.")
    option = AtributoOpcion(
        id_atributo=attribute.id_atributo,
        valor=payload.valor.strip(),
        valor_normalizado=normalized,
        orden=payload.orden,
        activo=payload.activo,
    )
    db.add(option)
    db.commit()
    db.refresh(option)
    return option


def update_attribute_option(
    db: Session,
    *,
    option: AtributoOpcion,
    payload: AttributeOptionUpdate,
) -> AtributoOpcion:
    data = payload.model_dump(exclude_unset=True)
    if "valor" in data and data["valor"] is not None:
        data["valor"] = data["valor"].strip()
        data["valor_normalizado"] = _slugify_category_name(data["valor"])
    for key, value in data.items():
        setattr(option, key, value)
    db.commit()
    db.refresh(option)
    return option


def list_category_attributes(db: Session, *, id_categoria: UUID) -> list[CategoriaAtributo]:
    return (
        db.query(CategoriaAtributo)
        .options(joinedload(CategoriaAtributo.atributo).joinedload(Atributo.opciones))
        .filter(CategoriaAtributo.id_categoria == id_categoria)
        .order_by(CategoriaAtributo.orden.asc())
        .all()
    )


def replace_category_attributes(
    db: Session,
    *,
    category: Categoria,
    payload: CategoryAttributesReplace,
) -> list[CategoriaAtributo]:
    attribute_ids = [item.id_atributo for item in payload.atributos]
    if len(attribute_ids) != len(set(attribute_ids)):
        raise ValueError("No se puede repetir un atributo en la categoria.")
    attributes = {
        item.id_atributo: item
        for item in db.query(Atributo).filter(Atributo.id_atributo.in_(attribute_ids)).all()
    } if attribute_ids else {}
    for item in payload.atributos:
        attribute = attributes.get(item.id_atributo)
        if attribute is None or attribute.id_tienda != category.id_tienda:
            raise ValueError("Uno de los atributos no pertenece a la tienda.")
        if item.usado_en_variantes and not attribute.usable_en_variantes:
            raise ValueError(f"El atributo '{attribute.nombre}' no esta habilitado para variantes.")

    current_variant_ids = {
        row.id_atributo
        for row in db.query(CategoriaAtributo).filter(
            CategoriaAtributo.id_categoria == category.id_categoria,
            CategoriaAtributo.usado_en_variantes.is_(True),
        ).all()
    }
    requested_variant_ids = {
        item.id_atributo for item in payload.atributos if item.usado_en_variantes
    }
    if current_variant_ids != requested_variant_ids:
        has_variants = (
            db.query(VarianteProducto.id_variante)
            .join(Producto, Producto.id_producto == VarianteProducto.id_producto)
            .filter(
                (
                    Producto.id_categoria_principal == category.id_categoria
                ) | (
                    Producto.id_categoria == category.id_categoria
                ),
            )
            .first()
            is not None
        )
        if has_variants:
            raise ValueError(
                "No puedes cambiar los atributos de variantes mientras existan "
                "combinaciones creadas en productos de esta categoria.",
            )

    db.query(CategoriaAtributo).filter(
        CategoriaAtributo.id_categoria == category.id_categoria,
    ).delete(synchronize_session=False)
    for item in payload.atributos:
        db.add(CategoriaAtributo(id_categoria=category.id_categoria, **item.model_dump()))
    db.commit()
    return list_category_attributes(db, id_categoria=category.id_categoria)


def _serialize_product_attribute(row: ProductoAtributo) -> dict:
    if row.opcion is not None:
        value = row.opcion.valor
    elif row.valor_texto is not None:
        value = row.valor_texto
    elif row.valor_numero is not None:
        value = row.valor_numero
    else:
        value = bool(row.valor_booleano)
    return {
        "id_producto_atributo": row.id_producto_atributo,
        "id_producto": row.id_producto,
        "id_atributo": row.id_atributo,
        "nombre": row.atributo.nombre,
        "codigo": row.atributo.codigo,
        "tipo_dato": row.atributo.tipo_dato,
        "unidad": row.atributo.unidad,
        "id_opcion": row.id_opcion,
        "valor": value,
    }


def list_product_attributes(db: Session, *, id_producto: UUID) -> list[dict]:
    rows = (
        db.query(ProductoAtributo)
        .options(joinedload(ProductoAtributo.atributo), joinedload(ProductoAtributo.opcion))
        .filter(ProductoAtributo.id_producto == id_producto)
        .order_by(ProductoAtributo.id_atributo.asc())
        .all()
    )
    return [_serialize_product_attribute(row) for row in rows]


def replace_product_attributes(
    db: Session,
    *,
    product: Producto,
    payload: ProductAttributesReplace,
) -> list[dict]:
    effective_category_id = product.id_categoria_principal or product.id_categoria
    if payload.atributos and effective_category_id is None:
        raise ValueError("Asigna una categoria al producto antes de agregar atributos.")

    attribute_ids = [item.id_atributo for item in payload.atributos]
    counts = Counter(attribute_ids)
    configured_rows = (
        db.query(CategoriaAtributo)
        .options(joinedload(CategoriaAtributo.atributo))
        .filter(
            CategoriaAtributo.id_categoria == effective_category_id,
            CategoriaAtributo.id_atributo.in_(set(attribute_ids)),
        )
        .all()
    ) if attribute_ids else []
    configured = {row.id_atributo: row.atributo for row in configured_rows}

    prepared = []
    for item in payload.atributos:
        attribute = configured.get(item.id_atributo)
        if attribute is None or attribute.id_tienda != product.id_tienda:
            raise ValueError("El atributo no esta configurado para la categoria del producto.")
        if counts[item.id_atributo] > 1 and not attribute.permite_multiples:
            raise ValueError(f"El atributo '{attribute.nombre}' admite un solo valor.")

        supplied = [
            item.id_opcion is not None,
            item.valor_texto is not None,
            item.valor_numero is not None,
            item.valor_booleano is not None,
        ]
        if sum(supplied) != 1:
            raise ValueError(f"El atributo '{attribute.nombre}' debe recibir exactamente un valor.")

        values = {"id_opcion": None, "valor_texto": None, "valor_numero": None, "valor_booleano": None}
        if attribute.tipo_dato == "OPTION":
            if item.id_opcion is None:
                raise ValueError(f"'{attribute.nombre}' requiere una opcion valida.")
            option = get_option(db, item.id_opcion)
            if option is None or option.id_atributo != attribute.id_atributo or not option.activo:
                raise ValueError(f"Opcion invalida para '{attribute.nombre}'.")
            values["id_opcion"] = item.id_opcion
        elif attribute.tipo_dato == "TEXT":
            if item.valor_texto is None or not item.valor_texto.strip():
                raise ValueError(f"'{attribute.nombre}' requiere texto.")
            values["valor_texto"] = item.valor_texto.strip()
        elif attribute.tipo_dato == "NUMBER":
            if item.valor_numero is None:
                raise ValueError(f"'{attribute.nombre}' requiere un numero.")
            values["valor_numero"] = Decimal(item.valor_numero)
        elif attribute.tipo_dato == "BOOLEAN":
            if item.valor_booleano is None:
                raise ValueError(f"'{attribute.nombre}' requiere verdadero o falso.")
            values["valor_booleano"] = item.valor_booleano

        prepared.append(
            ProductoAtributo(
                id_producto=product.id_producto,
                id_atributo=attribute.id_atributo,
                **values,
            ),
        )

    db.query(ProductoAtributo).filter(
        ProductoAtributo.id_producto == product.id_producto,
    ).delete(synchronize_session=False)
    db.add_all(prepared)
    db.commit()
    return list_product_attributes(db, id_producto=product.id_producto)
