from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


AttributeDataType = Literal["TEXT", "NUMBER", "BOOLEAN", "OPTION"]


class AttributeOptionCreate(BaseModel):
    valor: str = Field(..., min_length=1, max_length=120)
    orden: int = Field(default=0, ge=0)
    activo: bool = True


class AttributeOptionUpdate(BaseModel):
    valor: Optional[str] = Field(default=None, min_length=1, max_length=120)
    orden: Optional[int] = Field(default=None, ge=0)
    activo: Optional[bool] = None


class AttributeOptionOut(BaseModel):
    id_opcion: UUID
    id_atributo: UUID
    valor: str
    valor_normalizado: str
    orden: int
    activo: bool

    class Config:
        from_attributes = True


class AttributeCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    codigo: Optional[str] = Field(default=None, min_length=1, max_length=100)
    tipo_dato: AttributeDataType
    unidad: Optional[str] = Field(default=None, max_length=30)
    permite_multiples: bool = False
    usable_en_variantes: bool = False
    activo: bool = True


class AttributeUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=100)
    codigo: Optional[str] = Field(default=None, min_length=1, max_length=100)
    unidad: Optional[str] = Field(default=None, max_length=30)
    permite_multiples: Optional[bool] = None
    usable_en_variantes: Optional[bool] = None
    activo: Optional[bool] = None


class AttributeOut(BaseModel):
    id_atributo: UUID
    id_tienda: UUID
    nombre: str
    codigo: str
    tipo_dato: AttributeDataType
    unidad: Optional[str]
    permite_multiples: bool
    usable_en_variantes: bool
    activo: bool
    created_at: datetime
    updated_at: datetime
    opciones: list[AttributeOptionOut] = Field(default_factory=list)

    class Config:
        from_attributes = True


class CategoryAttributeItem(BaseModel):
    id_atributo: UUID
    requerido: bool = False
    filtrable: bool = True
    usado_en_variantes: bool = False
    orden: int = Field(default=0, ge=0)


class CategoryAttributesReplace(BaseModel):
    atributos: list[CategoryAttributeItem] = Field(default_factory=list)


class CategoryAttributeOut(CategoryAttributeItem):
    id_categoria: UUID
    atributo: AttributeOut

    class Config:
        from_attributes = True


class ProductAttributeValueIn(BaseModel):
    id_atributo: UUID
    id_opcion: Optional[UUID] = None
    valor_texto: Optional[str] = None
    valor_numero: Optional[Decimal] = None
    valor_booleano: Optional[bool] = None


class ProductAttributesReplace(BaseModel):
    atributos: list[ProductAttributeValueIn] = Field(default_factory=list)


class ProductAttributeValueOut(BaseModel):
    id_producto_atributo: UUID
    id_producto: UUID
    id_atributo: UUID
    nombre: str
    codigo: str
    tipo_dato: AttributeDataType
    unidad: Optional[str] = None
    id_opcion: Optional[UUID] = None
    valor: str | Decimal | bool

