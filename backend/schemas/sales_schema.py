from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_serializer, model_validator

from core.storage import build_public_asset_url


class ClienteNuevo(BaseModel):
    nombre_completo: str = Field(..., min_length=2, max_length=150)
    telefono: Optional[str] = Field(default=None, max_length=20)
    email: Optional[str] = Field(default=None, max_length=150)
    ciudad_region: Optional[str] = Field(default=None, max_length=100)


class EntregaPedidoIn(BaseModel):
    metodo: Literal["retiro", "delivery"] = "retiro"
    etiqueta: str = Field(default="Principal", max_length=50)
    destinatario: Optional[str] = Field(default=None, max_length=150)
    telefono: Optional[str] = Field(default=None, max_length=20)
    linea1: Optional[str] = Field(default=None, max_length=255)
    linea2: Optional[str] = Field(default=None, max_length=255)
    ciudad: Optional[str] = Field(default=None, max_length=100)
    region: Optional[str] = Field(default=None, max_length=100)
    referencia: Optional[str] = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def validate_delivery_address(self):
        if self.metodo == "delivery":
            if not str(self.linea1 or "").strip() or not str(self.ciudad or "").strip():
                raise ValueError("La direccion y la ciudad son obligatorias para delivery.")
        return self


class DetalleVentaCreate(BaseModel):
    id_producto: UUID
    id_variante: Optional[UUID] = None
    cantidad: int = Field(..., ge=1)
    precio_unitario: Optional[Decimal] = None


class VentaCreate(BaseModel):
    id_cliente: Optional[UUID] = None
    cliente_nuevo: Optional[ClienteNuevo] = None
    estado: Optional[str] = "pendiente"
    origen: Optional[str] = "caja"
    entrega: EntregaPedidoIn = Field(default_factory=EntregaPedidoIn)
    metodo_pago: Optional[str] = Field(default=None, max_length=30)
    notas_cliente: Optional[str] = Field(default=None, max_length=1000)
    detalles: List[DetalleVentaCreate] = Field(..., min_length=1)


class VentaEstadoUpdate(BaseModel):
    estado: str
    nota: Optional[str] = Field(default=None, max_length=500)


class ClienteOut(BaseModel):
    id_cliente: UUID
    nombre_completo: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    ciudad_region: Optional[str] = None

    class Config:
        from_attributes = True


class DireccionClienteOut(BaseModel):
    id_direccion: UUID
    etiqueta: str
    destinatario: str
    telefono: Optional[str] = None
    linea1: str
    linea2: Optional[str] = None
    ciudad: str
    region: Optional[str] = None
    referencia: Optional[str] = None
    es_predeterminada: bool
    activa: bool

    class Config:
        from_attributes = True


class ClienteUpdate(BaseModel):
    nombre_completo: Optional[str] = Field(default=None, min_length=2, max_length=150)
    telefono: Optional[str] = Field(default=None, max_length=20)
    email: Optional[str] = Field(default=None, max_length=150)
    ciudad_region: Optional[str] = Field(default=None, max_length=100)
    notas: Optional[str] = Field(default=None, max_length=1000)


class ClienteAdminOut(ClienteOut):
    notas: Optional[str] = None
    fecha_registro: Optional[datetime] = None
    total_pedidos: int = 0
    total_comprado: Decimal = Decimal("0")
    direcciones: List[DireccionClienteOut] = Field(default_factory=list)


class HistorialEstadoOut(BaseModel):
    estado_anterior: Optional[str] = None
    estado_nuevo: str
    nota: Optional[str] = None
    visible_cliente: bool
    fecha_evento: datetime

    class Config:
        from_attributes = True


class ProductoMiniOut(BaseModel):
    id_producto: UUID
    nombre: str
    imagen_url: Optional[str] = None
    costo_adquisicion: Optional[Decimal] = None

    @field_serializer("imagen_url")
    def serialize_imagen_url(self, value: Optional[str]) -> Optional[str]:
        return build_public_asset_url(value)

    class Config:
        from_attributes = True


class DetalleVentaOut(BaseModel):
    id_detalle: UUID
    id_venta: UUID
    id_producto: UUID
    id_variante: Optional[UUID] = None
    sku_variante: Optional[str] = None
    nombre_variante: Optional[str] = None
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal
    producto: Optional[ProductoMiniOut] = None

    class Config:
        from_attributes = True


class VentaOut(BaseModel):
    id_venta: UUID
    id_tienda: UUID
    id_cliente: Optional[UUID] = None
    fecha_venta: datetime
    estado: str
    origen: Optional[str] = None
    codigo_seguimiento: Optional[str] = None
    metodo_entrega: str = "retiro"
    metodo_pago: Optional[str] = None
    notas_cliente: Optional[str] = None
    direccion_snapshot: Optional[dict] = None
    fecha_actualizacion: Optional[datetime] = None
    total_venta: Decimal
    detalles: List[DetalleVentaOut] = Field(default_factory=list)
    cliente: Optional[ClienteOut] = None
    historial_estados: List[HistorialEstadoOut] = Field(default_factory=list)

    @field_serializer("fecha_venta")
    def serialize_fecha_venta(self, value: datetime) -> str:
        if value.tzinfo is None:
            return value.isoformat() + "Z"
        return value.isoformat()

    class Config:
        from_attributes = True


class SeguimientoProductoOut(BaseModel):
    nombre: str
    variante: Optional[str] = None
    cantidad: int


class SeguimientoPedidoOut(BaseModel):
    codigo_seguimiento: str
    estado: str
    fecha_pedido: datetime
    fecha_actualizacion: datetime
    metodo_entrega: str
    total_venta: Decimal
    productos: List[SeguimientoProductoOut] = Field(default_factory=list)
    historial: List[HistorialEstadoOut] = Field(default_factory=list)
