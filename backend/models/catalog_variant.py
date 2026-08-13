import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy import CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from core.database import Base


class VarianteProducto(Base):
    __tablename__ = "variantes_producto"
    __table_args__ = (
        UniqueConstraint("id_tienda", "sku", name="uq_variantes_tienda_sku"),
        CheckConstraint(
            "imagen_fit IS NULL OR imagen_fit IN ('cover', 'contain', 'auto')",
            name="ck_variantes_imagen_fit",
        ),
        CheckConstraint(
            "imagen_posicion_x IS NULL OR imagen_posicion_x BETWEEN 0 AND 100",
            name="ck_variantes_imagen_pos_x",
        ),
        CheckConstraint(
            "imagen_posicion_y IS NULL OR imagen_posicion_y BETWEEN 0 AND 100",
            name="ck_variantes_imagen_pos_y",
        ),
        CheckConstraint(
            "imagen_zoom IS NULL OR imagen_zoom BETWEEN 80 AND 200",
            name="ck_variantes_imagen_zoom",
        ),
    )

    id_variante = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_tienda = Column(
        UUID(as_uuid=True),
        ForeignKey("tiendas.id_tienda", ondelete="CASCADE"),
        nullable=False,
    )
    id_producto = Column(
        UUID(as_uuid=True),
        ForeignKey("productos.id_producto", ondelete="CASCADE"),
        nullable=False,
    )
    sku = Column(String(100), nullable=False)
    precio_venta = Column(Numeric(10, 2), nullable=True)
    costo_adquisicion = Column(Numeric(10, 2), nullable=True)
    stock_actual = Column(Integer, nullable=False, default=0)
    imagen_fit = Column(String(12), nullable=True)
    imagen_posicion_x = Column(Integer, nullable=True)
    imagen_posicion_y = Column(Integer, nullable=True)
    imagen_zoom = Column(Integer, nullable=True)
    imagen_fondo = Column(String(20), nullable=True)
    imagen_url = Column(String(255), nullable=True)
    activa = Column(Boolean, nullable=False, default=True)
    es_predeterminada = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    producto = relationship("Producto")
    atributos = relationship(
        "VarianteAtributo",
        back_populates="variante",
        cascade="all, delete-orphan",
    )


class VarianteAtributo(Base):
    __tablename__ = "variante_atributos"

    id_variante = Column(
        UUID(as_uuid=True),
        ForeignKey("variantes_producto.id_variante", ondelete="CASCADE"),
        primary_key=True,
    )
    id_atributo = Column(
        UUID(as_uuid=True),
        ForeignKey("atributos.id_atributo", ondelete="CASCADE"),
        primary_key=True,
    )
    id_opcion = Column(
        UUID(as_uuid=True),
        ForeignKey("atributo_opciones.id_opcion", ondelete="RESTRICT"),
        nullable=False,
    )

    variante = relationship("VarianteProducto", back_populates="atributos")
    atributo = relationship("Atributo")
    opcion = relationship("AtributoOpcion")


Index(
    "ix_variantes_producto_activa",
    VarianteProducto.id_producto,
    VarianteProducto.activa,
)
Index(
    "ix_variantes_tienda_stock",
    VarianteProducto.id_tienda,
    VarianteProducto.stock_actual,
)
Index(
    "uq_variantes_producto_predeterminada",
    VarianteProducto.id_producto,
    unique=True,
    postgresql_where=text("es_predeterminada IS TRUE"),
)
