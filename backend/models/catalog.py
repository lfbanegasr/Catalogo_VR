import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from core.database import Base

OFFER_TYPES = ("PERCENT", "PRICE_OVERRIDE")


class Categoria(Base):
    __tablename__ = "categorias"
    __table_args__ = (
        CheckConstraint(
            "imagen_fit_default IN ('cover', 'contain', 'auto')",
            name="ck_categorias_imagen_fit_default",
        ),
        CheckConstraint("imagen_posicion_x_default BETWEEN 0 AND 100", name="ck_categorias_imagen_pos_x_default"),
        CheckConstraint("imagen_posicion_y_default BETWEEN 0 AND 100", name="ck_categorias_imagen_pos_y_default"),
        CheckConstraint("imagen_zoom_default BETWEEN 80 AND 200", name="ck_categorias_imagen_zoom_default"),
    )
    id_categoria = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_tienda = Column(
        UUID(as_uuid=True),
        ForeignKey("tiendas.id_tienda", ondelete="CASCADE"),
        nullable=False,
    )

    nombre = Column(String(100), nullable=False)
    id_categoria_padre = Column(
        UUID(as_uuid=True),
        ForeignKey("categorias.id_categoria", ondelete="SET NULL"),
        nullable=True,
    )
    slug = Column(String(120), nullable=False)
    orden = Column(Integer, nullable=False, default=0)
    activa = Column(Boolean, default=True)
    imagen_fit_default = Column(String(12), nullable=False, default="cover")
    imagen_posicion_x_default = Column(Integer, nullable=False, default=50)
    imagen_posicion_y_default = Column(Integer, nullable=False, default=30)
    imagen_zoom_default = Column(Integer, nullable=False, default=100)
    imagen_fondo_default = Column(String(20), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Relaciones
    tienda = relationship("Tienda", back_populates="categorias")
    productos = relationship(
        "Producto",
        back_populates="categoria",
        foreign_keys="Producto.id_categoria",
    )
    productos_principales = relationship(
        "Producto",
        back_populates="categoria_principal",
        foreign_keys="Producto.id_categoria_principal",
    )
    categoria_padre = relationship(
        "Categoria",
        remote_side=[id_categoria],
        back_populates="subcategorias",
    )
    subcategorias = relationship("Categoria", back_populates="categoria_padre")
    ofertas_rel = relationship(
        "OfertaCategoria",
        back_populates="categoria",
        cascade="all, delete-orphan",
    )


class Producto(Base):
    __tablename__ = "productos"
    __table_args__ = (
        UniqueConstraint("id_tienda", "nombre", name="uq_productos_tienda_nombre"),
        CheckConstraint("imagen_fit IS NULL OR imagen_fit IN ('cover', 'contain', 'auto')", name="ck_productos_imagen_fit"),
        CheckConstraint("imagen_posicion_x IS NULL OR imagen_posicion_x BETWEEN 0 AND 100", name="ck_productos_imagen_pos_x"),
        CheckConstraint("imagen_posicion_y IS NULL OR imagen_posicion_y BETWEEN 0 AND 100", name="ck_productos_imagen_pos_y"),
        CheckConstraint("imagen_zoom IS NULL OR imagen_zoom BETWEEN 80 AND 200", name="ck_productos_imagen_zoom"),
    )

    id_producto = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_tienda = Column(
        UUID(as_uuid=True),
        ForeignKey("tiendas.id_tienda", ondelete="CASCADE"),
        nullable=False,
    )
    id_categoria = Column(
        UUID(as_uuid=True),
        ForeignKey("categorias.id_categoria", ondelete="SET NULL"),
        nullable=True,
    )
    id_categoria_principal = Column(
        UUID(as_uuid=True),
        ForeignKey("categorias.id_categoria", ondelete="SET NULL"),
        nullable=True,
    )

    nombre = Column(String(150), nullable=False)
    descripcion = Column(Text, nullable=True)

    precio_venta = Column(Numeric(10, 2), nullable=False)
    costo_adquisicion = Column(Numeric(10, 2), nullable=True)

    stock_actual = Column(Integer, default=0)
    imagen_url = Column(String(255), nullable=True)
    imagen_fit = Column(String(12), nullable=True)
    imagen_posicion_x = Column(Integer, nullable=True)
    imagen_posicion_y = Column(Integer, nullable=True)
    imagen_zoom = Column(Integer, nullable=True)
    imagen_fondo = Column(String(20), nullable=True)
    activo = Column(Boolean, default=True)
    fecha_agregado = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    tienda = relationship("Tienda", back_populates="productos")
    categoria = relationship(
        "Categoria",
        back_populates="productos",
        foreign_keys=[id_categoria],
    )
    categoria_principal = relationship(
        "Categoria",
        back_populates="productos_principales",
        foreign_keys=[id_categoria_principal],
    )
    imagenes_rel = relationship(
        "ProductoImagen",
        back_populates="producto",
        cascade="all, delete-orphan",
        order_by="ProductoImagen.orden.asc()",
    )
    ofertas_rel = relationship(
        "OfertaProducto",
        back_populates="producto",
        cascade="all, delete-orphan",
    )

    @property
    def imagenes(self) -> list[str]:
        urls = [item.imagen_url for item in self.imagenes_rel]
        if self.imagen_url and self.imagen_url not in urls:
            return [self.imagen_url, *urls]
        return urls


Index(
    "ix_categorias_tienda_padre_orden",
    Categoria.id_tienda,
    Categoria.id_categoria_padre,
    Categoria.orden,
)
Index(
    "uq_categorias_raiz_tienda_nombre",
    Categoria.id_tienda,
    func.lower(Categoria.nombre),
    unique=True,
    postgresql_where=text("id_categoria_padre IS NULL"),
)
Index(
    "uq_categorias_hija_tienda_padre_nombre",
    Categoria.id_tienda,
    Categoria.id_categoria_padre,
    func.lower(Categoria.nombre),
    unique=True,
    postgresql_where=text("id_categoria_padre IS NOT NULL"),
)
Index(
    "uq_categorias_tienda_slug",
    Categoria.id_tienda,
    Categoria.slug,
    unique=True,
)
Index(
    "ix_productos_tienda_categoria_principal_activo",
    Producto.id_tienda,
    Producto.id_categoria_principal,
    Producto.activo,
)


class ProductoImagen(Base):
    __tablename__ = "producto_imagenes"

    id_imagen = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_producto = Column(
        UUID(as_uuid=True),
        ForeignKey("productos.id_producto", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    imagen_url = Column(String(255), nullable=False)
    orden = Column(Integer, nullable=False, default=0)

    producto = relationship("Producto", back_populates="imagenes_rel")


class Oferta(Base):
    __tablename__ = "ofertas"

    id_oferta = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_tienda = Column(
        UUID(as_uuid=True),
        ForeignKey("tiendas.id_tienda", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nombre = Column(String(150), nullable=False)
    tipo = Column(
        Enum(*OFFER_TYPES, name="offer_type_enum", native_enum=False),
        nullable=False,
    )
    porcentaje = Column(Numeric(10, 2), nullable=True)
    prioridad = Column(Integer, nullable=False, default=0)
    activa = Column(Boolean, nullable=False, default=True)
    fecha_inicio = Column(DateTime, nullable=True)
    fecha_fin = Column(DateTime, nullable=True)
    banner_url = Column(String(255), nullable=True)
    badge_text = Column(String(80), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    tienda = relationship("Tienda", back_populates="ofertas")
    productos_rel = relationship(
        "OfertaProducto",
        back_populates="oferta",
        cascade="all, delete-orphan",
    )
    categorias_rel = relationship(
        "OfertaCategoria",
        back_populates="oferta",
        cascade="all, delete-orphan",
    )


class OfertaProducto(Base):
    __tablename__ = "oferta_productos"
    __table_args__ = (
        UniqueConstraint("id_oferta", "id_producto", name="uq_oferta_productos_oferta_producto"),
    )

    id_oferta = Column(
        UUID(as_uuid=True),
        ForeignKey("ofertas.id_oferta", ondelete="CASCADE"),
        primary_key=True,
    )
    id_producto = Column(
        UUID(as_uuid=True),
        ForeignKey("productos.id_producto", ondelete="CASCADE"),
        primary_key=True,
    )
    precio_override = Column(Numeric(10, 2), nullable=True)
    activo = Column(Boolean, nullable=False, default=True)

    oferta = relationship("Oferta", back_populates="productos_rel")
    producto = relationship("Producto", back_populates="ofertas_rel")


class OfertaCategoria(Base):
    __tablename__ = "oferta_categorias"
    __table_args__ = (
        UniqueConstraint("id_oferta", "id_categoria", name="uq_oferta_categorias_oferta_categoria"),
    )

    id_oferta = Column(
        UUID(as_uuid=True),
        ForeignKey("ofertas.id_oferta", ondelete="CASCADE"),
        primary_key=True,
    )
    id_categoria = Column(
        UUID(as_uuid=True),
        ForeignKey("categorias.id_categoria", ondelete="CASCADE"),
        primary_key=True,
    )
    activo = Column(Boolean, nullable=False, default=True)

    oferta = relationship("Oferta", back_populates="categorias_rel")
    categoria = relationship("Categoria", back_populates="ofertas_rel")
