from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_serializer
from core.storage import build_public_asset_url


class ClienteNuevo(BaseModel):
    nombre_completo: str = Field(..., max_length=150)
    telefono: Optional[str] = Field(default=None, max_length=20)
    ciudad_region: Optional[str] = Field(default=None, max_length=100)


class DetalleVentaCreate(BaseModel):
    id_producto: UUID
    cantidad: int = Field(..., ge=1)
    precio_unitario: Optional[Decimal] = None


class VentaCreate(BaseModel):
    id_cliente: Optional[UUID] = None
    cliente_nuevo: Optional[ClienteNuevo] = None
    estado: Optional[str] = "pendiente_whatsapp"
    origen: Optional[str] = "caja"
    detalles: List[DetalleVentaCreate] = Field(..., min_length=1)


class VentaEstadoUpdate(BaseModel):
    estado: str


class ClienteOut(BaseModel):
    id_cliente: UUID
    nombre_completo: str
    telefono: Optional[str] = None
    ciudad_region: Optional[str] = None

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
    total_venta: Decimal
    detalles: List[DetalleVentaOut] = []
    cliente: Optional[ClienteOut] = None

    class Config:
        from_attributes = True