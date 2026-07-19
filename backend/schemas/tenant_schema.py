from datetime import datetime
from uuid import UUID
from typing import Any, Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class TiendaCreate(BaseModel):
    nombre_tienda: str = Field(..., max_length=100)
    slug: Optional[str] = Field(default=None, max_length=120)
    dominio_personalizado: Optional[str] = Field(default=None, max_length=100)
    whatsapp_number: Optional[str] = Field(default=None, max_length=30)
    activa: bool = True


class TiendaOut(BaseModel):
    id_tienda: UUID
    nombre_tienda: str
    slug: str
    dominio_personalizado: Optional[str] = None
    whatsapp_number: Optional[str] = None
    theme_id: str
    theme_config: Optional[dict[str, Any]] = None
    fecha_creacion: datetime
    activa: bool

    class Config:
        from_attributes = True


class UsuarioCreate(BaseModel):
    id_tienda: UUID
    email: EmailStr
    password: str = Field(..., min_length=6)
    rol: Literal["superadmin", "admin", "empleado", "cliente"] = "admin"
    activo: bool = True


class TiendaUpdate(BaseModel):
    nombre_tienda: Optional[str] = Field(default=None, max_length=100)
    slug: Optional[str] = Field(default=None, max_length=120)
    dominio_personalizado: Optional[str] = Field(default=None, max_length=100)
    whatsapp_number: Optional[str] = Field(default=None, max_length=30)
    theme_id: Optional[str] = Field(default=None, max_length=50)
    theme_config: Optional[dict[str, Any]] = None
    activa: Optional[bool] = None


class MyStoreUpdate(BaseModel):
    whatsapp_number: Optional[str] = Field(default=None, max_length=30)


class TiendaThemeUpdate(BaseModel):
    theme_id: str = Field(default="default", min_length=1, max_length=50)
    theme_config: Optional[dict[str, Any]] = None


class UsuarioUpdate(BaseModel):
    id_tienda: Optional[UUID] = None
    email: Optional[EmailStr] = None
    rol: Optional[Literal["superadmin", "admin", "empleado", "cliente"]] = None
    activo: Optional[bool] = None


class UserResetPasswordIn(BaseModel):
    new_password: str = Field(..., min_length=6)


class UsuarioOut(BaseModel):
    id_usuario: UUID
    id_tienda: UUID
    email: EmailStr
    rol: str
    activo: bool
    fecha_registro: datetime

    class Config:
        from_attributes = True
