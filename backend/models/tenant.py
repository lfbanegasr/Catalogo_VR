import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID

from core.database import Base

VALID_USER_ROLES = ("superadmin", "admin", "empleado", "cliente")


class Tienda(Base):
    __tablename__ = "tiendas"

    id_tienda = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre_tienda = Column(String(100), nullable=False)
    slug = Column(String(120), unique=True, index=True, nullable=False)
    dominio_personalizado = Column(String(100), unique=True, nullable=True)
    whatsapp_number = Column(String(30), nullable=True)
    theme_id = Column(String(50), nullable=False, default="default")
    theme_config = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    activa = Column(Boolean, default=True)

    # Relaciones (lado "uno")
    usuarios = relationship("Usuario", back_populates="tienda", cascade="all, delete-orphan")
    categorias = relationship("Categoria", back_populates="tienda", cascade="all, delete-orphan")
    productos = relationship("Producto", back_populates="tienda", cascade="all, delete-orphan")
    ofertas = relationship("Oferta", back_populates="tienda", cascade="all, delete-orphan")


class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = (
        CheckConstraint(
            "rol IS NULL OR rol IN ('superadmin','admin','empleado','cliente')",
            name="ck_usuarios_rol_valid",
        ),
    )

    id_usuario = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_tienda = Column(
        UUID(as_uuid=True),
        ForeignKey("tiendas.id_tienda", ondelete="CASCADE"),
        nullable=True,
    )

    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    rol = Column(String(50), default="admin")
    activo = Column(Boolean, default=True, nullable=False)
    fecha_registro = Column(DateTime, default=datetime.utcnow)

    # Relación (lado "muchos")
    tienda = relationship("Tienda", back_populates="usuarios")
