import re
import unicodedata

from sqlalchemy.orm import Session
from sqlalchemy import and_, func, or_, select

from models.catalog import Categoria, Producto, ProductoImagen
from models.catalog_variant import VarianteProducto
from models.tenant import Tienda
from schemas.catalog_schema import CategoriaCreate, CategoriaUpdate, ProductoCreate, ProductoUpdate
from crud.crud_product_sets import (
    PRODUCT_TYPE_SET,
    PRODUCT_TYPE_SIMPLE,
    SETS_CATEGORY_CODE,
    SETS_CATEGORY_NAME,
    calculate_set_stock_map,
    ensure_sets_category,
    replace_set_components,
)


# -------------------------
# CATEGORIAS
# -------------------------
MAX_CATEGORY_DEPTH = 4


def _slugify_category_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.strip().lower())
    ascii_value = "".join(char for char in normalized if not unicodedata.combining(char))
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")
    return slug or "categoria"


def _build_unique_category_slug(
    db: Session,
    *,
    id_tienda,
    nombre: str,
    exclude_id=None,
) -> str:
    base_slug = _slugify_category_name(nombre)
    candidate = base_slug
    suffix = 2
    while True:
        query = db.query(Categoria).filter(
            Categoria.id_tienda == id_tienda,
            Categoria.slug == candidate,
        )
        if exclude_id is not None:
            query = query.filter(Categoria.id_categoria != exclude_id)
        if query.first() is None:
            return candidate
        candidate = f"{base_slug}-{suffix}"
        suffix += 1


def _validate_category_parent(
    db: Session,
    *,
    id_tienda,
    parent_id,
    category_id=None,
) -> None:
    if parent_id is None:
        return
    if category_id is not None and parent_id == category_id:
        raise ValueError("Una categoria no puede ser su propia categoria padre.")

    current = get_categoria_by_id(db=db, id_categoria=parent_id)
    if current is None:
        raise ValueError("La categoria padre no existe.")
    if current.id_tienda != id_tienda:
        raise ValueError("La categoria padre no pertenece a la tienda.")

    depth = 1
    visited = set()
    while current is not None:
        if current.id_categoria in visited:
            raise ValueError("La jerarquia de categorias contiene un ciclo.")
        visited.add(current.id_categoria)
        if category_id is not None and current.id_categoria == category_id:
            raise ValueError("No se puede mover una categoria dentro de sus descendientes.")
        if depth >= MAX_CATEGORY_DEPTH and current.id_categoria_padre is not None:
            raise ValueError(f"La jerarquia admite como maximo {MAX_CATEGORY_DEPTH} niveles.")
        if current.id_categoria_padre is None:
            break
        current = get_categoria_by_id(db=db, id_categoria=current.id_categoria_padre)
        depth += 1


def create_categoria(db: Session, id_tienda, data: CategoriaCreate) -> Categoria:
    _validate_category_parent(
        db,
        id_tienda=id_tienda,
        parent_id=data.id_categoria_padre,
    )
    categoria = Categoria(
        id_tienda=id_tienda,
        nombre=data.nombre,
        id_categoria_padre=data.id_categoria_padre,
        slug=_build_unique_category_slug(db, id_tienda=id_tienda, nombre=data.nombre),
        orden=data.orden,
        activa=data.activa,
        imagen_fit_default=data.imagen_fit_default,
        imagen_posicion_x_default=data.imagen_posicion_x_default,
        imagen_posicion_y_default=data.imagen_posicion_y_default,
        imagen_zoom_default=data.imagen_zoom_default,
        imagen_fondo_default=data.imagen_fondo_default,
    )
    db.add(categoria)
    db.commit()
    db.refresh(categoria)
    return categoria


def list_categorias(db: Session, id_tienda) -> list[Categoria]:
    return (
        db.query(Categoria)
        .filter(Categoria.id_tienda == id_tienda)
        .order_by(Categoria.orden.asc(), Categoria.nombre.asc())
        .all()
    )


def get_categoria_by_id(db: Session, id_categoria) -> Categoria | None:
    return db.query(Categoria).filter(Categoria.id_categoria == id_categoria).first()


def get_categoria_by_name(db: Session, id_tienda, nombre: str) -> Categoria | None:
    normalized = nombre.strip()
    if not normalized:
        return None
    return (
        db.query(Categoria)
        .filter(
            Categoria.id_tienda == id_tienda,
            func.lower(Categoria.nombre) == normalized.lower(),
        )
        .first()
    )


def update_categoria(db: Session, id_categoria, data: CategoriaUpdate) -> Categoria | None:
    categoria = get_categoria_by_id(db=db, id_categoria=id_categoria)
    if not categoria:
        return None
    payload = data.model_dump(exclude_unset=True)
    if categoria.codigo_sistema == SETS_CATEGORY_CODE:
        protected = {
            "nombre": SETS_CATEGORY_NAME,
            "id_categoria_padre": None,
            "activa": True,
        }
        for key, value in protected.items():
            if key in payload and payload[key] != value:
                raise ValueError("La categoria Sets es administrada automaticamente.")
    if "id_categoria_padre" in payload:
        _validate_category_parent(
            db,
            id_tienda=categoria.id_tienda,
            parent_id=payload["id_categoria_padre"],
            category_id=categoria.id_categoria,
        )
        categoria.id_categoria_padre = payload["id_categoria_padre"]
    if "nombre" in payload and payload["nombre"] is not None:
        categoria.nombre = payload["nombre"]
        categoria.slug = _build_unique_category_slug(
            db,
            id_tienda=categoria.id_tienda,
            nombre=payload["nombre"],
            exclude_id=categoria.id_categoria,
        )
    if "orden" in payload and payload["orden"] is not None:
        categoria.orden = payload["orden"]
    if "activa" in payload and payload["activa"] is not None:
        categoria.activa = payload["activa"]
    for field in (
        "imagen_fit_default",
        "imagen_posicion_x_default",
        "imagen_posicion_y_default",
        "imagen_zoom_default",
    ):
        if field in payload and payload[field] is not None:
            setattr(categoria, field, payload[field])
    if "imagen_fondo_default" in payload:
        categoria.imagen_fondo_default = payload["imagen_fondo_default"]
    db.commit()
    db.refresh(categoria)
    return categoria


def deactivate_categoria(db: Session, id_categoria) -> Categoria | None:
    categoria = get_categoria_by_id(db=db, id_categoria=id_categoria)
    if not categoria:
        return None
    if categoria.codigo_sistema == SETS_CATEGORY_CODE:
        return categoria
    categoria.activa = False
    db.commit()
    db.refresh(categoria)
    return categoria


# -------------------------
# PRODUCTOS
# -------------------------
def create_producto(db: Session, id_tienda, data: ProductoCreate) -> Producto:
    components = data.componentes
    if data.tipo_producto == PRODUCT_TYPE_SIMPLE and components:
        raise ValueError("Los productos normales no pueden tener componentes.")

    category_id = data.id_categoria_principal or data.id_categoria
    if data.tipo_producto == PRODUCT_TYPE_SET:
        category_id = ensure_sets_category(db, id_tienda).id_categoria

    producto = Producto(
        id_tienda=id_tienda,
        id_categoria=category_id,
        id_categoria_principal=category_id,
        nombre=data.nombre,
        descripcion=data.descripcion,
        tipo_producto=data.tipo_producto,
        precio_venta=data.precio_venta,
        costo_adquisicion=data.costo_adquisicion,
        stock_actual=0 if data.tipo_producto == PRODUCT_TYPE_SET else data.stock_actual,
        imagen_url=data.imagen_url,
        imagen_fit=data.imagen_fit,
        imagen_posicion_x=data.imagen_posicion_x,
        imagen_posicion_y=data.imagen_posicion_y,
        imagen_zoom=data.imagen_zoom,
        imagen_fondo=data.imagen_fondo,
        activo=data.activo,
    )
    try:
        db.add(producto)
        db.flush()
        if data.tipo_producto == PRODUCT_TYPE_SET:
            replace_set_components(db, set_product=producto, components=components)
        db.commit()
        db.refresh(producto)
        return producto
    except Exception:
        db.rollback()
        raise


def list_productos(db: Session, id_tienda) -> list[Producto]:
    return (
        db.query(Producto)
        .filter(Producto.id_tienda == id_tienda)
        .order_by(Producto.fecha_agregado.desc())
        .all()
    )


def get_producto_by_id(db: Session, id_producto) -> Producto | None:
    return db.query(Producto).filter(Producto.id_producto == id_producto).first()


def update_producto(db: Session, id_producto, data: ProductoUpdate) -> Producto | None:
    producto = (
        db.query(Producto)
        .filter(Producto.id_producto == id_producto)
        .with_for_update()
        .first()
    )
    if not producto:
        return None

    components = data.componentes if "componentes" in data.model_fields_set else None
    payload = data.model_dump(exclude_unset=True)
    payload.pop("componentes", None)
    requested_type = payload.get("tipo_producto")
    if requested_type is not None and requested_type != producto.tipo_producto:
        raise ValueError("El tipo de producto no puede cambiarse despues de crearlo.")
    payload.pop("tipo_producto", None)

    if producto.tipo_producto == PRODUCT_TYPE_SET:
        category = ensure_sets_category(db, producto.id_tienda)
        payload["id_categoria"] = category.id_categoria
        payload["id_categoria_principal"] = category.id_categoria
        payload.pop("stock_actual", None)
        if components is not None:
            replace_set_components(db, set_product=producto, components=components)
    elif components:
        raise ValueError("Los productos normales no pueden tener componentes.")

    if "id_categoria_principal" in payload or "id_categoria" in payload:
        categoria_id = payload.get("id_categoria_principal", payload.get("id_categoria"))
        current_category_id = producto.id_categoria_principal or producto.id_categoria
        if categoria_id != current_category_id:
            has_variants = (
                db.query(VarianteProducto.id_variante)
                .filter(VarianteProducto.id_producto == producto.id_producto)
                .first()
                is not None
            )
            if has_variants:
                raise ValueError(
                    "No puedes cambiar la categoria porque el producto ya tiene "
                    "variantes creadas.",
                )
        payload["id_categoria"] = categoria_id
        payload["id_categoria_principal"] = categoria_id

    try:
        for key, value in payload.items():
            setattr(producto, key, value)
        db.commit()
        db.refresh(producto)
        return producto
    except Exception:
        db.rollback()
        raise


def deactivate_producto(db: Session, id_producto) -> Producto | None:
    producto = get_producto_by_id(db=db, id_producto=id_producto)
    if not producto:
        return None
    producto.activo = False
    db.commit()
    db.refresh(producto)
    return producto


def set_product_image(db: Session, id_producto, imagen_url: str) -> Producto | None:
    producto = get_producto_by_id(db=db, id_producto=id_producto)
    if not producto:
        return None
    producto.imagen_url = imagen_url
    db.commit()
    db.refresh(producto)
    return producto


def list_product_images(db: Session, id_producto) -> list[ProductoImagen]:
    return (
        db.query(ProductoImagen)
        .filter(ProductoImagen.id_producto == id_producto)
        .order_by(ProductoImagen.orden.asc())
        .all()
    )


def add_product_image(db: Session, id_producto, imagen_url: str) -> ProductoImagen | None:
    producto = get_producto_by_id(db=db, id_producto=id_producto)
    if not producto:
        return None

    current_count = (
        db.query(ProductoImagen)
        .filter(ProductoImagen.id_producto == id_producto)
        .count()
    )
    imagen = ProductoImagen(
        id_producto=id_producto,
        imagen_url=imagen_url,
        orden=current_count,
    )
    db.add(imagen)

    # Mantener compatibilidad con vistas antiguas que leen imagen_url principal.
    if not producto.imagen_url:
        producto.imagen_url = imagen_url

    db.commit()
    db.refresh(imagen)
    return imagen


def get_product_image_urls(db: Session, id_producto) -> list[str]:
    urls = [item.imagen_url for item in list_product_images(db=db, id_producto=id_producto)]
    producto = get_producto_by_id(db=db, id_producto=id_producto)
    if producto and producto.imagen_url and producto.imagen_url not in urls:
        return [producto.imagen_url, *urls]
    return urls


def get_tienda_by_slug(db: Session, slug: str) -> Tienda | None:
    return db.query(Tienda).filter(Tienda.slug == slug).first()


def get_tienda_by_name(db: Session, nombre_tienda: str) -> Tienda | None:
    normalized = nombre_tienda.strip()
    if not normalized:
        return None
    return (
        db.query(Tienda)
        .filter(func.lower(Tienda.nombre_tienda) == normalized.lower())
        .order_by(Tienda.fecha_creacion.desc())
        .first()
    )


def list_public_categorias(db: Session, id_tienda) -> list[Categoria]:
    categories = (
        db.query(Categoria)
        .filter(Categoria.id_tienda == id_tienda, Categoria.activa.is_(True))
        .order_by(Categoria.orden.asc(), Categoria.nombre.asc())
        .all()
    )
    set_ids = [
        product_id
        for (product_id,) in (
            db.query(Producto.id_producto)
            .filter(
                Producto.id_tienda == id_tienda,
                Producto.tipo_producto == PRODUCT_TYPE_SET,
                Producto.activo.is_(True),
            )
            .all()
        )
    ]
    has_available_set = any(
        stock > 0 for stock in calculate_set_stock_map(db, set_ids).values()
    )
    return [
        category
        for category in categories
        if category.codigo_sistema != SETS_CATEGORY_CODE or has_available_set
    ]


def list_public_productos(db: Session, id_tienda, limit: int = 20, offset: int = 0) -> list[Producto]:
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
    products = (
        db.query(Producto)
        .filter(
            Producto.id_tienda == id_tienda,
            Producto.activo.is_(True),
            or_(
                Producto.tipo_producto == PRODUCT_TYPE_SET,
                and_(active_variant_exists, available_variant_exists),
                and_(~active_variant_exists, func.coalesce(Producto.stock_actual, 0) > 0),
            ),
        )
        .order_by(Producto.fecha_agregado.desc())
        .all()
    )
    set_ids = [
        product.id_producto
        for product in products
        if product.tipo_producto == PRODUCT_TYPE_SET
    ]
    set_stock = calculate_set_stock_map(db, set_ids)
    available = [
        product
        for product in products
        if product.tipo_producto != PRODUCT_TYPE_SET
        or set_stock.get(product.id_producto, 0) > 0
    ]
    return available[offset:offset + limit]
