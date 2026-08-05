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
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from core.database import Base


ATTRIBUTE_DATA_TYPES = ("TEXT", "NUMBER", "BOOLEAN", "OPTION")


class Atributo(Base):
    __tablename__ = "atributos"
    __table_args__ = (
        UniqueConstraint("id_tienda", "codigo", name="uq_atributos_tienda_codigo"),
    )

    id_atributo = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_tienda = Column(
        UUID(as_uuid=True),
        ForeignKey("tiendas.id_tienda", ondelete="CASCADE"),
        nullable=False,
    )
    nombre = Column(String(100), nullable=False)
    codigo = Column(String(100), nullable=False)
    tipo_dato = Column(
        Enum(*ATTRIBUTE_DATA_TYPES, name="attribute_data_type_enum", native_enum=False),
        nullable=False,
    )
    unidad = Column(String(30), nullable=True)
    permite_multiples = Column(Boolean, nullable=False, default=False)
    usable_en_variantes = Column(Boolean, nullable=False, default=False)
    activo = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    opciones = relationship(
        "AtributoOpcion",
        back_populates="atributo",
        cascade="all, delete-orphan",
        order_by="AtributoOpcion.orden.asc()",
    )


class AtributoOpcion(Base):
    __tablename__ = "atributo_opciones"
    __table_args__ = (
        CheckConstraint(
            "num_nonnulls(id_opcion, valor_texto, valor_numero, valor_booleano) = 1",
            name="ck_producto_atributos_un_valor",
        ),
        UniqueConstraint(
            "id_atributo",
            "valor_normalizado",
            name="uq_atributo_opciones_atributo_valor",
        ),
    )

    id_opcion = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_atributo = Column(
        UUID(as_uuid=True),
        ForeignKey("atributos.id_atributo", ondelete="CASCADE"),
        nullable=False,
    )
    valor = Column(String(120), nullable=False)
    valor_normalizado = Column(String(120), nullable=False)
    orden = Column(Integer, nullable=False, default=0)
    activo = Column(Boolean, nullable=False, default=True)

    atributo = relationship("Atributo", back_populates="opciones")


class CategoriaAtributo(Base):
    __tablename__ = "categoria_atributos"

    id_categoria = Column(
        UUID(as_uuid=True),
        ForeignKey("categorias.id_categoria", ondelete="CASCADE"),
        primary_key=True,
    )
    id_atributo = Column(
        UUID(as_uuid=True),
        ForeignKey("atributos.id_atributo", ondelete="CASCADE"),
        primary_key=True,
    )
    requerido = Column(Boolean, nullable=False, default=False)
    filtrable = Column(Boolean, nullable=False, default=True)
    usado_en_variantes = Column(Boolean, nullable=False, default=False)
    orden = Column(Integer, nullable=False, default=0)

    categoria = relationship("Categoria")
    atributo = relationship("Atributo")


class ProductoAtributo(Base):
    __tablename__ = "producto_atributos"
    __table_args__ = (
        UniqueConstraint(
            "id_producto",
            "id_atributo",
            "id_opcion",
            name="uq_producto_atributos_producto_atributo_opcion",
        ),
    )

    id_producto_atributo = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    id_producto = Column(
        UUID(as_uuid=True),
        ForeignKey("productos.id_producto", ondelete="CASCADE"),
        nullable=False,
    )
    id_atributo = Column(
        UUID(as_uuid=True),
        ForeignKey("atributos.id_atributo", ondelete="CASCADE"),
        nullable=False,
    )
    id_opcion = Column(
        UUID(as_uuid=True),
        ForeignKey("atributo_opciones.id_opcion", ondelete="CASCADE"),
        nullable=True,
    )
    valor_texto = Column(Text, nullable=True)
    valor_numero = Column(Numeric(18, 4), nullable=True)
    valor_booleano = Column(Boolean, nullable=True)

    producto = relationship("Producto")
    atributo = relationship("Atributo")
    opcion = relationship("AtributoOpcion")


Index("ix_atributos_tienda_activo", Atributo.id_tienda, Atributo.activo)
Index(
    "ix_categoria_atributos_categoria_orden",
    CategoriaAtributo.id_categoria,
    CategoriaAtributo.orden,
)
Index(
    "ix_producto_atributos_producto_atributo",
    ProductoAtributo.id_producto,
    ProductoAtributo.id_atributo,
)
