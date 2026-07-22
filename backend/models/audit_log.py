import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID

from core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_usuario = Column(UUID(as_uuid=True), nullable=True, index=True)
    email_usuario = Column(String(150), nullable=True)
    id_tienda = Column(UUID(as_uuid=True), nullable=True, index=True)
    evento = Column(String(50), nullable=False, default="request", server_default="request")
    exito = Column(Boolean, nullable=True)
    email_intentado = Column(String(150), nullable=True)
    detalle = Column(String(255), nullable=True)
    accion = Column(String(120), nullable=False)
    endpoint = Column(String(255), nullable=False)
    metodo_http = Column(String(10), nullable=False)
    ip = Column(String(64), nullable=True)
    user_agent = Column(String(500), nullable=True)
    fecha_hora = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    rol_usuario = Column(String(50), nullable=True)
