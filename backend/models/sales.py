import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, String, DateTime, ForeignKey, Numeric, Integer, Enum as SQLEnum, Index, JSON, Text, text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID

from core.database import Base


class EstadoVenta(str, enum.Enum):
    generada_whatsapp = "generada_whatsapp"
    pendiente = "pendiente"
    confirmada = "confirmada"
    preparando = "preparando"
    lista = "lista"
    enviada = "enviada"
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
    email = Column(String(150), nullable=True)
    ciudad_region = Column(String(100), nullable=True)
    notas = Column(Text, nullable=True)
    fecha_registro = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tienda = relationship("Tienda")
    direcciones = relationship(
        "DireccionCliente",
        back_populates="cliente",
        cascade="all, delete-orphan",
    )


class DireccionCliente(Base):
    __tablename__ = "direcciones_cliente"

    id_direccion = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_tienda = Column(
        UUID(as_uuid=True),
        ForeignKey("tiendas.id_tienda", ondelete="CASCADE"),
        nullable=False,
    )
    id_cliente = Column(
        UUID(as_uuid=True),
        ForeignKey("clientes.id_cliente", ondelete="CASCADE"),
        nullable=False,
    )
    etiqueta = Column(String(50), nullable=False, default="Principal")
    destinatario = Column(String(150), nullable=False)
    telefono = Column(String(20), nullable=True)
    linea1 = Column(String(255), nullable=False)
    linea2 = Column(String(255), nullable=True)
    ciudad = Column(String(100), nullable=False)
    region = Column(String(100), nullable=True)
    referencia = Column(String(255), nullable=True)
    latitud = Column(Numeric(10, 7), nullable=True)
    longitud = Column(Numeric(10, 7), nullable=True)
    es_predeterminada = Column(Boolean, nullable=False, default=False)
    activa = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    cliente = relationship("Cliente", back_populates="direcciones")


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
    codigo_seguimiento = Column(String(16), nullable=False, unique=True)
    metodo_entrega = Column(String(30), nullable=False, default="retiro")
    metodo_pago = Column(String(30), nullable=True)
    notas_cliente = Column(Text, nullable=True)
    direccion_snapshot = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    fecha_actualizacion = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    cliente = relationship("Cliente")
    tienda = relationship("Tienda")

    detalles = relationship(
        "DetalleVenta",
        back_populates="venta",
        cascade="all, delete-orphan",
    )
    historial_estados = relationship(
        "HistorialEstadoPedido",
        back_populates="venta",
        cascade="all, delete-orphan",
        order_by="HistorialEstadoPedido.fecha_evento",
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
    id_variante = Column(
        UUID(as_uuid=True),
        ForeignKey("variantes_producto.id_variante", ondelete="SET NULL"),
        nullable=True,
    )
    sku_variante = Column(String(100), nullable=True)
    nombre_variante = Column(String(255), nullable=True)

    cantidad = Column(Integer, nullable=False)
    precio_unitario = Column(Numeric(10, 2), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)

    venta = relationship("Venta", back_populates="detalles")
    producto = relationship("Producto")
    variante = relationship("VarianteProducto")


class HistorialEstadoPedido(Base):
    __tablename__ = "historial_estados_pedido"

    id_evento = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_venta = Column(
        UUID(as_uuid=True),
        ForeignKey("ventas.id_venta", ondelete="CASCADE"),
        nullable=False,
    )
    id_usuario = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )
    estado_anterior = Column(String(50), nullable=True)
    estado_nuevo = Column(String(50), nullable=False)
    nota = Column(String(500), nullable=True)
    visible_cliente = Column(Boolean, nullable=False, default=True)
    fecha_evento = Column(DateTime, nullable=False, default=datetime.utcnow)

    venta = relationship("Venta", back_populates="historial_estados")
    usuario = relationship("Usuario")


Index("ix_detalle_ventas_id_variante", DetalleVenta.id_variante)
Index("ix_clientes_tienda_telefono", Cliente.id_tienda, Cliente.telefono)
Index("ix_clientes_tienda_email", Cliente.id_tienda, Cliente.email)
Index(
    "ix_direcciones_cliente_activas",
    DireccionCliente.id_cliente,
    DireccionCliente.activa,
)
Index(
    "uq_direcciones_cliente_predeterminada",
    DireccionCliente.id_cliente,
    unique=True,
    postgresql_where=text("es_predeterminada IS TRUE"),
)
Index(
    "ix_historial_pedido_fecha",
    HistorialEstadoPedido.id_venta,
    HistorialEstadoPedido.fecha_evento,
)
Index(
    "ix_ventas_tienda_origen_fecha",
    Venta.id_tienda,
    Venta.origen,
    Venta.fecha_venta,
)
