from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from typing import Literal

from pydantic import BaseModel, Field, field_serializer

from core.storage import build_public_asset_url


class VariantAttributeIn(BaseModel):
    id_atributo: UUID
    id_opcion: UUID


class VariantCreate(BaseModel):
    sku: Optional[str] = Field(default=None, min_length=1, max_length=100)
    precio_venta: Optional[Decimal] = Field(default=None, gt=0)
    costo_adquisicion: Optional[Decimal] = Field(default=None, ge=0)
    stock_actual: int = Field(default=0, ge=0)
    imagen_url: Optional[str] = Field(default=None, max_length=255)
    imagen_fit: Optional[Literal["cover", "contain", "auto"]] = None
    imagen_posicion_x: Optional[int] = Field(default=None, ge=0, le=100)
    imagen_posicion_y: Optional[int] = Field(default=None, ge=0, le=100)
    imagen_zoom: Optional[int] = Field(default=None, ge=80, le=200)
    imagen_fondo: Optional[str] = Field(default=None, max_length=20)
    activa: bool = True
    es_predeterminada: bool = False
    atributos: list[VariantAttributeIn] = Field(..., min_length=1)


class VariantUpdate(BaseModel):
    sku: Optional[str] = Field(default=None, min_length=1, max_length=100)
    precio_venta: Optional[Decimal] = Field(default=None, gt=0)
    costo_adquisicion: Optional[Decimal] = Field(default=None, ge=0)
    stock_actual: Optional[int] = Field(default=None, ge=0)
    imagen_url: Optional[str] = Field(default=None, max_length=255)
    imagen_fit: Optional[Literal["cover", "contain", "auto"]] = None
    imagen_posicion_x: Optional[int] = Field(default=None, ge=0, le=100)
    imagen_posicion_y: Optional[int] = Field(default=None, ge=0, le=100)
    imagen_zoom: Optional[int] = Field(default=None, ge=80, le=200)
    imagen_fondo: Optional[str] = Field(default=None, max_length=20)
    activa: Optional[bool] = None
    es_predeterminada: Optional[bool] = None
    atributos: Optional[list[VariantAttributeIn]] = Field(default=None, min_length=1)


class VariantAttributeOut(BaseModel):
    id_atributo: UUID
    nombre: str
    codigo: str
    id_opcion: UUID
    valor: str


class VariantOut(BaseModel):
    id_variante: UUID
    id_tienda: UUID
    id_producto: UUID
    sku: str
    precio_venta: Optional[Decimal]
    costo_adquisicion: Optional[Decimal]
    stock_actual: int
    imagen_url: Optional[str]
    activa: bool
    imagen_fit: Optional[Literal["cover", "contain", "auto"]]
    imagen_posicion_x: Optional[int]
    imagen_posicion_y: Optional[int]
    imagen_zoom: Optional[int]
    imagen_fondo: Optional[str]
    es_predeterminada: bool
    created_at: datetime
    updated_at: datetime
    atributos: list[VariantAttributeOut] = Field(default_factory=list)

    @field_serializer("imagen_url")
    def serialize_image(self, value: Optional[str]) -> Optional[str]:
        return build_public_asset_url(value)
