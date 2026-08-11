import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from core.database import Base


class ProductoComponente(Base):
    __tablename__ = "producto_componentes"
    __table_args__ = (
        CheckConstraint("cantidad > 0", name="ck_producto_componentes_cantidad_positiva"),
        CheckConstraint("id_set <> id_producto_componente", name="ck_producto_componentes_no_autoreferencia"),
    )

    id_componente = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_set = Column(
        UUID(as_uuid=True),
        ForeignKey("productos.id_producto", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    id_producto_componente = Column(
        UUID(as_uuid=True),
        ForeignKey("productos.id_producto", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    id_variante_componente = Column(
        UUID(as_uuid=True),
        ForeignKey("variantes_producto.id_variante", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    cantidad = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    set_producto = relationship("Producto", foreign_keys=[id_set], back_populates="componentes")
    producto_componente = relationship("Producto", foreign_keys=[id_producto_componente])
    variante_componente = relationship("VarianteProducto", foreign_keys=[id_variante_componente])

    @property
    def nombre_producto(self) -> str:
        return self.producto_componente.nombre if self.producto_componente else ""

    @property
    def sku_variante(self) -> str | None:
        return self.variante_componente.sku if self.variante_componente else None

    @property
    def nombre_variante(self) -> str | None:
        if not self.variante_componente:
            return None
        values = [
            item.opcion.valor
            for item in self.variante_componente.atributos
            if item.opcion is not None
        ]
        return " / ".join(values) or self.variante_componente.sku

    @property
    def stock_disponible(self) -> int:
        target = self.variante_componente or self.producto_componente
        return max(int(getattr(target, "stock_actual", 0) or 0), 0)


Index(
    "uq_producto_componentes_set_producto_simple",
    ProductoComponente.id_set,
    ProductoComponente.id_producto_componente,
    unique=True,
    postgresql_where=ProductoComponente.id_variante_componente.is_(None),
)
Index(
    "uq_producto_componentes_set_variante",
    ProductoComponente.id_set,
    ProductoComponente.id_variante_componente,
    unique=True,
    postgresql_where=ProductoComponente.id_variante_componente.is_not(None),
)


class DetalleVentaConsumo(Base):
    __tablename__ = "detalle_venta_consumos"
    __table_args__ = (
        CheckConstraint("cantidad > 0", name="ck_detalle_venta_consumos_cantidad_positiva"),
    )

    id_consumo = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_detalle = Column(
        UUID(as_uuid=True),
        ForeignKey("detalle_ventas.id_detalle", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    id_producto_componente = Column(
        UUID(as_uuid=True),
        ForeignKey("productos.id_producto", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    id_variante_componente = Column(
        UUID(as_uuid=True),
        ForeignKey("variantes_producto.id_variante", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    cantidad = Column(Integer, nullable=False)
    nombre_producto = Column(String(150), nullable=False)
    sku_variante = Column(String(100), nullable=True)
    nombre_variante = Column(String(255), nullable=True)
    costo_unitario = Column(Numeric(10, 2), nullable=True)

    detalle = relationship("DetalleVenta", back_populates="consumos")
    producto_componente = relationship("Producto", foreign_keys=[id_producto_componente])
    variante_componente = relationship("VarianteProducto", foreign_keys=[id_variante_componente])
