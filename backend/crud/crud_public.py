from decimal import Decimal

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from core.storage import build_public_asset_url
from crud.crud_offers import apply_offer_pricing_context, load_offer_pricing_context
from models.catalog import Categoria, Producto, ProductoImagen
from models.catalog_attribute import (
    Atributo,
    AtributoOpcion,
    CategoriaAtributo,
    ProductoAtributo,
)
from models.catalog_variant import VarianteAtributo, VarianteProducto
from models.tenant import Tienda


def _decimal_to_float(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


def _filter_products_with_public_stock(products: list[dict]) -> list[dict]:
    return [product for product in products if int(product.get("stock") or 0) > 0]


def get_catalog_public(db: Session, slug: str):
    tienda_stmt = (
        select(
            Tienda.id_tienda,
            Tienda.nombre_tienda,
            Tienda.slug,
            Tienda.whatsapp_number,
            Tienda.theme_id,
            Tienda.theme_config,
        )
        .where(Tienda.slug == slug, Tienda.activa.is_(True))
        .limit(1)
    )
    tienda_row = db.execute(tienda_stmt).one_or_none()

    if tienda_row is None:
        return None

    tienda_id, nombre_tienda, tienda_slug, whatsapp_number, theme_id, theme_config = tienda_row

    categorias_stmt = (
        select(
            Categoria.id_categoria,
            Categoria.nombre,
            Categoria.id_categoria_padre,
            Categoria.slug,
            Categoria.orden,
        )
        .where(Categoria.id_tienda == tienda_id, Categoria.activa.is_(True))
        .order_by(Categoria.orden.asc(), Categoria.nombre.asc())
    )
    categorias_rows = db.execute(categorias_stmt).all()

    active_variant_exists = (
        select(VarianteProducto.id_variante)
        .where(
            VarianteProducto.id_producto == Producto.id_producto,
            VarianteProducto.activa.is_(True),
        )
        .exists()
    )
    available_variant_exists = (
        select(VarianteProducto.id_variante)
        .where(
            VarianteProducto.id_producto == Producto.id_producto,
            VarianteProducto.activa.is_(True),
            VarianteProducto.stock_actual > 0,
        )
        .exists()
    )
    has_public_stock = or_(
        and_(active_variant_exists, available_variant_exists),
        and_(~active_variant_exists, func.coalesce(Producto.stock_actual, 0) > 0),
    )

    productos_stmt = (
        select(
            Producto.id_producto,
            Producto.nombre,
            Producto.descripcion,
            Producto.precio_venta,
            Producto.stock_actual,
            func.coalesce(
                Producto.id_categoria_principal,
                Producto.id_categoria,
            ).label("categoria_id_efectiva"),
            Producto.imagen_url,
        )
        .where(
            Producto.id_tienda == tienda_id,
            Producto.activo.is_(True),
            has_public_stock,
        )
        .order_by(Producto.fecha_agregado.desc())
    )
    productos_rows = db.execute(productos_stmt).all()
    product_ids = [item[0] for item in productos_rows]

    imagenes_stmt = (
        select(ProductoImagen.id_producto, ProductoImagen.imagen_url, ProductoImagen.orden)
        .join(Producto, Producto.id_producto == ProductoImagen.id_producto)
        .where(
            Producto.id_tienda == tienda_id,
            Producto.activo.is_(True),
            ProductoImagen.id_producto.in_(product_ids),
        )
        .order_by(ProductoImagen.id_producto.asc(), ProductoImagen.orden.asc())
    )
    imagenes_rows = db.execute(imagenes_stmt).all()
    imagenes_por_producto: dict[str, list[str]] = {}
    for producto_id, imagen_url, _orden in imagenes_rows:
        key = str(producto_id)
        imagenes_por_producto.setdefault(key, []).append(imagen_url)

    productos = [
        {
            "id": str(producto_id),
            "nombre": nombre,
            "descripcion": descripcion,
            "precio": _decimal_to_float(precio_venta),
            "stock": stock_actual,
            "categoria_id": str(categoria_id) if categoria_id else None,
            "imagen_url": build_public_asset_url(imagen_url),
            "imagenes": [
                build_public_asset_url(img) for img in (
                    [imagen_url, *imagenes_por_producto.get(str(producto_id), [])]
                    if imagen_url and imagen_url not in imagenes_por_producto.get(str(producto_id), [])
                    else imagenes_por_producto.get(str(producto_id), []) or ([imagen_url] if imagen_url else [])
                ) if img
            ],
        }
        for (
            producto_id,
            nombre,
            descripcion,
            precio_venta,
            stock_actual,
            categoria_id,
            imagen_url,
        ) in productos_rows
    ]
    atributos_por_producto: dict[str, list[dict]] = {}
    if product_ids:
        attribute_rows = db.execute(
            select(
                ProductoAtributo.id_producto,
                Atributo.id_atributo,
                Atributo.nombre,
                Atributo.codigo,
                Atributo.tipo_dato,
                Atributo.unidad,
                CategoriaAtributo.filtrable,
                AtributoOpcion.valor,
                ProductoAtributo.valor_texto,
                ProductoAtributo.valor_numero,
                ProductoAtributo.valor_booleano,
            )
            .join(Atributo, Atributo.id_atributo == ProductoAtributo.id_atributo)
            .join(Producto, Producto.id_producto == ProductoAtributo.id_producto)
            .outerjoin(
                CategoriaAtributo,
                and_(
                    CategoriaAtributo.id_atributo == ProductoAtributo.id_atributo,
                    CategoriaAtributo.id_categoria
                    == func.coalesce(
                        Producto.id_categoria_principal,
                        Producto.id_categoria,
                    ),
                ),
            )
            .outerjoin(
                AtributoOpcion,
                AtributoOpcion.id_opcion == ProductoAtributo.id_opcion,
            )
            .where(
                ProductoAtributo.id_producto.in_(product_ids),
                Atributo.activo.is_(True),
            )
            .order_by(Atributo.nombre.asc())
        ).all()
        for (
            product_id,
            attribute_id,
            attribute_name,
            attribute_code,
            data_type,
            unit,
            filterable,
            option_value,
            text_value,
            number_value,
            boolean_value,
        ) in attribute_rows:
            if option_value is not None:
                resolved_value = option_value
            elif text_value is not None:
                resolved_value = text_value
            elif number_value is not None:
                resolved_value = _decimal_to_float(number_value)
            else:
                resolved_value = bool(boolean_value)
            atributos_por_producto.setdefault(str(product_id), []).append(
                {
                    "id_atributo": str(attribute_id),
                    "nombre": attribute_name,
                    "codigo": attribute_code,
                    "tipo_dato": data_type,
                    "unidad": unit,
                    "filtrable": bool(filterable),
                    "valor": resolved_value,
                },
            )
    for product in productos:
        product["atributos"] = atributos_por_producto.get(product["id"], [])
    pricing_context = load_offer_pricing_context(
        db=db,
        id_tienda=tienda_id,
        products=productos,
    )
    productos = apply_offer_pricing_context(products=productos, context=pricing_context)
    active_offers = pricing_context["active_offers"]

    variant_rows = db.execute(
        select(
            VarianteProducto.id_variante,
            VarianteProducto.id_producto,
            VarianteProducto.sku,
            VarianteProducto.precio_venta,
            VarianteProducto.stock_actual,
            VarianteProducto.imagen_url,
            VarianteProducto.es_predeterminada,
        )
        .where(
            VarianteProducto.id_tienda == tienda_id,
            VarianteProducto.id_producto.in_(product_ids),
            VarianteProducto.activa.is_(True),
        )
        .order_by(
            VarianteProducto.id_producto.asc(),
            VarianteProducto.es_predeterminada.desc(),
            VarianteProducto.created_at.asc(),
        )
    ).all()
    variant_ids = [row[0] for row in variant_rows]
    variant_attributes: dict[str, list[dict]] = {}
    if variant_ids:
        variant_attribute_rows = db.execute(
            select(
                VarianteAtributo.id_variante,
                Atributo.id_atributo,
                Atributo.nombre,
                Atributo.codigo,
                AtributoOpcion.id_opcion,
                AtributoOpcion.valor,
            )
            .join(Atributo, Atributo.id_atributo == VarianteAtributo.id_atributo)
            .join(
                AtributoOpcion,
                AtributoOpcion.id_opcion == VarianteAtributo.id_opcion,
            )
            .where(VarianteAtributo.id_variante.in_(variant_ids))
            .order_by(Atributo.nombre.asc())
        ).all()
        for (
            variant_id,
            attribute_id,
            attribute_name,
            attribute_code,
            option_id,
            option_value,
        ) in variant_attribute_rows:
            variant_attributes.setdefault(str(variant_id), []).append(
                {
                    "id_atributo": str(attribute_id),
                    "nombre": attribute_name,
                    "codigo": attribute_code,
                    "id_opcion": str(option_id),
                    "valor": option_value,
                },
            )

    products_by_id = {product["id"]: product for product in productos}
    variant_price_inputs = []
    for variant_row in variant_rows:
        variant_id, product_id, _sku, variant_price, _stock, _image, _default = variant_row
        product = products_by_id.get(str(product_id))
        if product is None:
            continue
        variant_price_inputs.append(
            {
                "id": product["id"],
                "id_variante": str(variant_id),
                "precio": variant_price if variant_price is not None else product["precio_original"],
                "categoria_id": product["categoria_id"],
            },
        )
    apply_offer_pricing_context(products=variant_price_inputs, context=pricing_context)
    variant_prices_by_id = {item["id_variante"]: item for item in variant_price_inputs}

    for (
        variant_id,
        product_id,
        sku,
        variant_price,
        variant_stock,
        variant_image,
        is_default,
    ) in variant_rows:
        product = products_by_id.get(str(product_id))
        if product is None:
            continue
        base_price = variant_price if variant_price is not None else product["precio_original"]
        priced = variant_prices_by_id[str(variant_id)]
        attributes = variant_attributes.get(str(variant_id), [])
        product.setdefault("variantes", []).append(
            {
                "id_variante": str(variant_id),
                "sku": sku,
                "precio": _decimal_to_float(base_price),
                "precio_original": priced["precio_original"],
                "precio_final": priced["precio_final"],
                "descuento_pct": priced["descuento_pct"],
                "stock": variant_stock,
                "imagen_url": build_public_asset_url(variant_image),
                "es_predeterminada": is_default,
                "atributos": attributes,
                "nombre": " / ".join(item["valor"] for item in attributes) or sku,
            },
        )

    for product in productos:
        variants = product.get("variantes", [])
        product["tiene_variantes"] = bool(variants)
        if not variants:
            continue
        product["stock"] = sum(item["stock"] for item in variants)
        cheapest = min(variants, key=lambda item: item["precio_final"])
        product["precio"] = min(item["precio"] for item in variants)
        product["precio_original"] = cheapest["precio_original"]
        product["precio_final"] = cheapest["precio_final"]
        product["descuento_pct"] = cheapest["descuento_pct"]
        if cheapest.get("imagen_url") and not product.get("imagen_url"):
            product["imagen_url"] = cheapest["imagen_url"]

    # Defensa adicional: nunca publicar un producto cuyo stock total sea cero.
    productos = _filter_products_with_public_stock(productos)

    resolved_theme_config = dict(theme_config) if theme_config else {}
    if "hero_image_url" in resolved_theme_config:
        resolved_theme_config["hero_image_url"] = build_public_asset_url(resolved_theme_config["hero_image_url"])
    if "category_images" in resolved_theme_config and isinstance(resolved_theme_config["category_images"], dict):
        resolved_theme_config["category_images"] = {
            cat_id: build_public_asset_url(img_url)
            for cat_id, img_url in resolved_theme_config["category_images"].items()
        }

    return {
        "tienda": {
            "id": str(tienda_id),
            "nombre": nombre_tienda,
            "slug": tienda_slug,
            "whatsapp_number": whatsapp_number,
            "theme_id": theme_id,
            "theme_config": resolved_theme_config,
        },
        "ofertas": [
            {
                "id_oferta": str(oferta.id_oferta),
                "nombre": oferta.nombre,
                "tipo": oferta.tipo,
                "porcentaje": _decimal_to_float(oferta.porcentaje),
                "prioridad": oferta.prioridad,
                "fecha_inicio": oferta.fecha_inicio.isoformat() if oferta.fecha_inicio else None,
                "fecha_fin": oferta.fecha_fin.isoformat() if oferta.fecha_fin else None,
                "banner_url": build_public_asset_url(oferta.banner_url),
                "badge_text": oferta.badge_text,
            }
            for oferta in active_offers
        ],
        "categorias": [
            {
                "id": str(categoria_id),
                "nombre": nombre,
                "id_categoria_padre": str(id_categoria_padre) if id_categoria_padre else None,
                "slug": slug,
                "orden": orden,
            }
            for categoria_id, nombre, id_categoria_padre, slug, orden in categorias_rows
        ],
        "productos": productos,
    }
