from __future__ import annotations

from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.sales import Cliente, Venta, DetalleVenta
from models.catalog import Producto
from schemas.sales_schema import VentaCreate


class StockInsuficienteError(Exception):
    """Se lanza cuando el stock no alcanza para completar la venta."""
    pass


def _decimal(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _get_or_create_cliente(
    db: Session,
    *,
    id_tienda: UUID,
    id_cliente: Optional[UUID],
    cliente_nuevo,
) -> Optional[Cliente]:
    # 1) viene id_cliente -> buscar
    if id_cliente:
        cliente = db.get(Cliente, id_cliente)
        if not cliente:
            raise ValueError("El cliente indicado no existe.")
        if cliente.id_tienda != id_tienda:
            raise ValueError("El cliente no pertenece a tu tienda.")
        return cliente

    # 2) no viene id_cliente, pero viene cliente_nuevo -> crear
    if cliente_nuevo:
        nuevo = Cliente(
            id_tienda=id_tienda,
            nombre_completo=cliente_nuevo.nombre_completo,
            telefono=cliente_nuevo.telefono,
            ciudad_region=cliente_nuevo.ciudad_region,
        )
        db.add(nuevo)
        db.flush()
        return nuevo

    return None


def create_venta(db: Session, id_tienda: UUID, payload: VentaCreate) -> Venta:
    with db.begin():
        # cliente
        cliente = _get_or_create_cliente(
            db,
            id_tienda=id_tienda,
            id_cliente=payload.id_cliente,
            cliente_nuevo=payload.cliente_nuevo,
        )

        venta = Venta(
            id_tienda=id_tienda,
            id_cliente=cliente.id_cliente if cliente else None,
            estado=payload.estado or "pendiente_whatsapp",
            total_venta=Decimal("0.00"),
        )
        db.add(venta)
        db.flush()  # id_venta

        total = Decimal("0.00")
        detalles_creados: List[DetalleVenta] = []

        for item in payload.detalles:
            stmt = (
                select(Producto)
                .where(Producto.id_producto == item.id_producto)
                .where(Producto.id_tienda == id_tienda)
                .with_for_update()
            )
            producto = db.execute(stmt).scalar_one_or_none()
            if not producto:
                raise ValueError(f"Producto no existe o no pertenece a tu tienda: {item.id_producto}")

            if producto.stock_actual is None:
                producto.stock_actual = 0

            if producto.stock_actual < item.cantidad:
                raise StockInsuficienteError(
                    f"Stock insuficiente para '{producto.nombre}'. "
                    f"Disponible={producto.stock_actual}, solicitado={item.cantidad}"
                )

            precio_unit = _decimal(item.precio_unitario) if item.precio_unitario is not None else _decimal(producto.precio_venta)
            subtotal = (precio_unit * _decimal(item.cantidad)).quantize(Decimal("0.00"))

            detalle = DetalleVenta(
                id_venta=venta.id_venta,
                id_producto=producto.id_producto,
                cantidad=item.cantidad,
                precio_unitario=precio_unit,
                subtotal=subtotal,
            )
            db.add(detalle)
            detalles_creados.append(detalle)

            producto.stock_actual -= item.cantidad
            total += subtotal

        venta.total_venta = total.quantize(Decimal("0.00"))
        venta.detalles = detalles_creados

        db.flush()
        db.refresh(venta)
        return venta


def list_ventas(db: Session, id_tienda: UUID, limit: int = 50, offset: int = 0) -> List[Venta]:
    return (
        db.query(Venta)
        .filter(Venta.id_tienda == id_tienda)
        .order_by(Venta.fecha_venta.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )