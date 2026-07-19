from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PublicWhatsappClickIn(BaseModel):
    id_producto: UUID | None = Field(default=None)


class PublicEventOut(BaseModel):
    id_evento: UUID
    id_tienda: UUID
    id_producto: UUID | None = None
    evento: str
    ip: str | None = None
    user_agent: str | None = None
    fecha: datetime

    class Config:
        from_attributes = True
