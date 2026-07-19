from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# -------------------------
# CATEGORIAS
# -------------------------
class CategoriaCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    activa: bool = True


class CategoriaUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=100)
    activa: Optional[bool] = None


class CategoriaOut(BaseModel):
    id_categoria: UUID
    id_tienda: UUID
    nombre: str
    activa: bool

    class Config:
        from_attributes = True  # permite devolver objetos ORM


# -------------------------
# PRODUCTOS
# -------------------------
class ProductoCreate(BaseModel):
    id_categoria: Optional[UUID] = None
    nombre_categoria: Optional[str] = Field(default=None, min_length=1, max_length=100)
    nombre: str = Field(..., min_length=1, max_length=150)
    descripcion: Optional[str] = None

    precio_venta: Decimal = Field(..., gt=0)
    costo_adquisicion: Optional[Decimal] = Field(default=None, ge=0)

    stock_actual: int = Field(default=0, ge=0)
    imagen_url: Optional[str] = Field(default=None, max_length=255)
    activo: bool = True


class ProductoUpdate(BaseModel):
    id_categoria: Optional[UUID] = None
    nombre_categoria: Optional[str] = Field(default=None, min_length=1, max_length=100)
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=150)
    descripcion: Optional[str] = None
    precio_venta: Optional[Decimal] = Field(default=None, gt=0)
    costo_adquisicion: Optional[Decimal] = Field(default=None, ge=0)
    stock_actual: Optional[int] = Field(default=None, ge=0)
    imagen_url: Optional[str] = Field(default=None, max_length=255)
    activo: Optional[bool] = None


class ProductoOut(BaseModel):
    id_producto: UUID
    id_tienda: UUID
    id_categoria: Optional[UUID]
    nombre: str
    descripcion: Optional[str]
    precio_venta: Decimal
    costo_adquisicion: Optional[Decimal]
    stock_actual: int
    imagen_url: Optional[str]
    imagenes: list[str] = []
    activo: bool
    fecha_agregado: datetime

    class Config:
        from_attributes = True


# -------------------------
# PUBLIC CATALOG
# -------------------------
class CategoriaPublicOut(BaseModel):
    id_categoria: UUID
    nombre: str

    class Config:
        from_attributes = True


class ProductoPublicOut(BaseModel):
    id_producto: UUID
    id_categoria: Optional[UUID]
    nombre: str
    descripcion: Optional[str]
    precio_venta: Decimal
    imagen_url: Optional[str]
    imagenes: list[str] = []
    fecha_agregado: datetime
    precio_original: Optional[Decimal] = None
    precio_final: Optional[Decimal] = None
    descuento_pct: Optional[Decimal] = None
    badge_text: Optional[str] = None
    id_oferta_aplicada: Optional[UUID] = None

    class Config:
        from_attributes = True


class OfferCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=150)
    tipo: Literal["PERCENT", "PRICE_OVERRIDE"]
    porcentaje: Optional[Decimal] = Field(default=None, ge=0, le=100)
    prioridad: int = 0
    activa: bool = True
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    banner_url: Optional[str] = Field(default=None, max_length=255)
    badge_text: Optional[str] = Field(default=None, max_length=80)


class OfferUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=150)
    tipo: Optional[Literal["PERCENT", "PRICE_OVERRIDE"]] = None
    porcentaje: Optional[Decimal] = Field(default=None, ge=0, le=100)
    prioridad: Optional[int] = None
    activa: Optional[bool] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    banner_url: Optional[str] = Field(default=None, max_length=255)
    badge_text: Optional[str] = Field(default=None, max_length=80)


class OfferOut(BaseModel):
    id_oferta: UUID
    id_tienda: UUID
    nombre: str
    tipo: Literal["PERCENT", "PRICE_OVERRIDE"]
    porcentaje: Optional[Decimal]
    prioridad: int
    activa: bool
    fecha_inicio: Optional[datetime]
    fecha_fin: Optional[datetime]
    banner_url: Optional[str]
    badge_text: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OfferProductAttachItem(BaseModel):
    id_producto: UUID
    precio_override: Optional[Decimal] = Field(default=None, ge=0)
    activo: bool = True


class OfferProductAttach(BaseModel):
    productos: list[OfferProductAttachItem] = Field(..., min_length=1)


class OfferProductOut(BaseModel):
    id_oferta: UUID
    id_producto: UUID
    precio_override: Optional[Decimal]
    activo: bool

    class Config:
        from_attributes = True


class OfferCategoryAttachItem(BaseModel):
    id_categoria: UUID
    activo: bool = True


class OfferCategoryAttach(BaseModel):
    categorias: list[OfferCategoryAttachItem] = Field(..., min_length=1)


class OfferCategoryOut(BaseModel):
    id_oferta: UUID
    id_categoria: UUID
    activo: bool

    class Config:
        from_attributes = True
