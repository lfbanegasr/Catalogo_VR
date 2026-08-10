from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from schemas.sales_schema import SeguimientoProductoOut


class CustomerRegisterIn(BaseModel):
    nombre_completo: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    telefono: Optional[str] = Field(default=None, max_length=20)


class CustomerLoginIn(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


class CustomerProfileOut(BaseModel):
    id_cliente: UUID
    nombre_completo: str
    email: EmailStr
    telefono: Optional[str] = None
    ciudad_region: Optional[str] = None

    class Config:
        from_attributes = True


class CustomerTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    customer: CustomerProfileOut


class CustomerOrderOut(BaseModel):
    codigo_seguimiento: str
    estado: str
    fecha_pedido: datetime
    fecha_actualizacion: datetime
    metodo_entrega: str
    total_venta: Decimal
    productos: list[SeguimientoProductoOut] = Field(default_factory=list)