from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from crud.crud_offers import apply_offer_to_products
from models.catalog import Categoria, Producto, ProductoImagen
from models.tenant import Tienda


def _decimal_to_float(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


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
        select(Categoria.id_categoria, Categoria.nombre)
        .where(Categoria.id_tienda == tienda_id, Categoria.activa.is_(True))
        .order_by(Categoria.nombre.asc())
    )
    categorias_rows = db.execute(categorias_stmt).all()

    productos_stmt = (
        select(
            Producto.id_producto,
            Producto.nombre,
            Producto.descripcion,
            Producto.precio_venta,
            Producto.stock_actual,
            Producto.id_categoria,
            Producto.imagen_url,
        )
        .where(Producto.id_tienda == tienda_id, Producto.activo.is_(True))
        .order_by(Producto.fecha_agregado.desc())
    )
    productos_rows = db.execute(productos_stmt).all()

    imagenes_stmt = (
        select(ProductoImagen.id_producto, ProductoImagen.imagen_url, ProductoImagen.orden)
        .join(Producto, Producto.id_producto == ProductoImagen.id_producto)
        .where(Producto.id_tienda == tienda_id, Producto.activo.is_(True))
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
            "imagen_url": imagen_url,
            "imagenes": (
                [imagen_url, *imagenes_por_producto.get(str(producto_id), [])]
                if imagen_url and imagen_url not in imagenes_por_producto.get(str(producto_id), [])
                else imagenes_por_producto.get(str(producto_id), []) or ([imagen_url] if imagen_url else [])
            ),
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
    productos, active_offers = apply_offer_to_products(db=db, id_tienda=tienda_id, products=productos)

    return {
        "tienda": {
            "id": str(tienda_id),
            "nombre": nombre_tienda,
            "slug": tienda_slug,
            "whatsapp_number": whatsapp_number,
            "theme_id": theme_id,
            "theme_config": theme_config,
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
                "banner_url": oferta.banner_url,
                "badge_text": oferta.badge_text,
            }
            for oferta in active_offers
        ],
        "categorias": [
            {
                "id": str(categoria_id),
                "nombre": nombre,
            }
            for categoria_id, nombre in categorias_rows
        ],
        "productos": productos,
    }
