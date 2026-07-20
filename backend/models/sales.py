import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Numeric, Integer, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from core.database import Base


class EstadoVenta(str, enum.Enum):
    generada_whatsapp = "generada_whatsapp"
    pendiente = "pendiente"
    completada = "completada"
    cancelada = "cancelada"


class Cliente(Base):
    __tablename__ = "clientes"

    id_cliente = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_tienda = Column(
        UUID(as_uuid=True),
        ForeignKey("tiendas.id_tienda", ondelete="CASCADE"),
        nullable=False,
    )

    nombre_completo = Column(String(150), nullable=False)
    telefono = Column(String(20), nullable=True)
    ciudad_region = Column(String(100), nullable=True)
    fecha_registro = Column(DateTime, default=datetime.utcnow)

    tienda = relationship("Tienda")


class Venta(Base):
    __tablename__ = "ventas"

    id_venta = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_tienda = Column(
        UUID(as_uuid=True),
        ForeignKey("tiendas.id_tienda", ondelete="CASCADE"),
        nullable=False,
    )
    id_cliente = Column(
        UUID(as_uuid=True),
        ForeignKey("clientes.id_cliente", ondelete="SET NULL"),
        nullable=True,
    )

    fecha_venta = Column(DateTime, default=datetime.utcnow)
    estado = Column(
        SQLEnum(EstadoVenta, name="estado_venta_enum", native_enum=False),
        default=EstadoVenta.generada_whatsapp,
        nullable=False,
    )
    total_venta = Column(Numeric(12, 2), nullable=False)
    origen = Column(String(50), nullable=True, default="caja")

    cliente = relationship("Cliente")
    tienda = relationship("Tienda")

    detalles = relationship(
        "DetalleVenta",
        back_populates="venta",
        cascade="all, delete-orphan",
    )


class DetalleVenta(Base):
    __tablename__ = "detalle_ventas"

    id_detalle = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_venta = Column(
        UUID(as_uuid=True),
        ForeignKey("ventas.id_venta", ondelete="CASCADE"),
        nullable=False,
    )
    id_producto = Column(
        UUID(as_uuid=True),
        ForeignKey("productos.id_producto", ondelete="RESTRICT"),
        nullable=False,
    )

    cantidad = Column(Integer, nullable=False)
    precio_unitario = Column(Numeric(10, 2), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)

    venta = relationship("Venta", back_populates="detalles")
    producto = relationship("Producto")