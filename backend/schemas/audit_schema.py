from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: UUID
    id_usuario: UUID | None = None
    email_usuario: str | None = None
    id_tienda: UUID | None = None
    evento: str
    exito: bool | None = None
    email_intentado: str | None = None
    detalle: str | None = None
    accion: str
    endpoint: str
    metodo_http: str
    ip: str | None = None
    user_agent: str | None = None
    fecha_hora: datetime

    class Config:
        from_attributes = True
