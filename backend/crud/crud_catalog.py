from sqlalchemy.orm import Session
from sqlalchemy import func

from models.catalog import Categoria, Producto, ProductoImagen
from models.tenant import Tienda
from schemas.catalog_schema import CategoriaCreate, CategoriaUpdate, ProductoCreate, ProductoUpdate


# -------------------------
# CATEGORIAS
# -------------------------
def create_categoria(db: Session, id_tienda, data: CategoriaCreate) -> Categoria:
    categoria = Categoria(
        id_tienda=id_tienda,
        nombre=data.nombre,
        activa=data.activa,
    )
    db.add(categoria)
    db.commit()
    db.refresh(categoria)
    return categoria


def list_categorias(db: Session, id_tienda) -> list[Categoria]:
    return (
        db.query(Categoria)
        .filter(Categoria.id_tienda == id_tienda)
        .order_by(Categoria.nombre.asc())
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
    if "nombre" in payload and payload["nombre"] is not None:
        categoria.nombre = payload["nombre"]
    if "activa" in payload and payload["activa"] is not None:
        categoria.activa = payload["activa"]
    db.commit()
    db.refresh(categoria)
    return categoria


def deactivate_categoria(db: Session, id_categoria) -> Categoria | None:
    categoria = get_categoria_by_id(db=db, id_categoria=id_categoria)
    if not categoria:
        return None
    categoria.activa = False
    db.commit()
    db.refresh(categoria)
    return categoria


# -------------------------
# PRODUCTOS
# -------------------------
def create_producto(db: Session, id_tienda, data: ProductoCreate) -> Producto:
    producto = Producto(
        id_tienda=id_tienda,
        id_categoria=data.id_categoria,
        nombre=data.nombre,
        descripcion=data.descripcion,
        precio_venta=data.precio_venta,
        costo_adquisicion=data.costo_adquisicion,
        stock_actual=data.stock_actual,
        imagen_url=data.imagen_url,
        activo=data.activo,
    )
    db.add(producto)
    db.commit()
    db.refresh(producto)
    return producto


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
    producto = get_producto_by_id(db=db, id_producto=id_producto)
    if not producto:
        return None
    payload = data.model_dump(exclude_unset=True)
    for key, value in payload.items():
        setattr(producto, key, value)
    db.commit()
    db.refresh(producto)
    return producto


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
    return (
        db.query(Categoria)
        .filter(Categoria.id_tienda == id_tienda, Categoria.activa.is_(True))
        .order_by(Categoria.nombre.asc())
        .all()
    )


def list_public_productos(db: Session, id_tienda, limit: int = 20, offset: int = 0) -> list[Producto]:
    return (
        db.query(Producto)
        .filter(Producto.id_tienda == id_tienda, Producto.activo.is_(True))
        .order_by(Producto.fecha_agregado.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
