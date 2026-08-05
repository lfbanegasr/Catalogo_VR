import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID

from core.database import Base


class PublicEvent(Base):
    __tablename__ = "public_events"

    id_evento = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_tienda = Column(
        UUID(as_uuid=True),
        ForeignKey("tiendas.id_tienda", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    id_producto = Column(
        UUID(as_uuid=True),
        ForeignKey("productos.id_producto", ondelete="SET NULL"),
        nullable=True,
    )
    evento = Column(String(50), nullable=False)
    ip = Column(String(64), nullable=True)
    user_agent = Column(String(500), nullable=True)
    fecha = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


Index(
    "ix_public_events_tienda_evento_fecha",
    PublicEvent.id_tienda,
    PublicEvent.evento,
    PublicEvent.fecha,
)
Index(
    "ix_public_events_producto_evento_fecha",
    PublicEvent.id_producto,
    PublicEvent.evento,
    PublicEvent.fecha,
)
