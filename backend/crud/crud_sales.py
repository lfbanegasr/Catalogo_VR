from __future__ import annotations

from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session, joinedload

from models.sales import Cliente, Venta, DetalleVenta, EstadoVenta
from models.catalog import Producto, Categoria
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

    # 2) no viene id_cliente, pero viene cliente_nuevo -> buscar por telefono o crear
    if cliente_nuevo:
        # Buscar si ya existe un cliente con ese teléfono en la misma tienda
        cliente = None
        if cliente_nuevo.telefono:
            cliente = (
                db.query(Cliente)
                .filter(Cliente.id_tienda == id_tienda)
                .filter(Cliente.telefono == cliente_nuevo.telefono)
                .first()
            )

        if cliente:
            # Actualizar datos si cambiaron
            cliente.nombre_completo = cliente_nuevo.nombre_completo
            if cliente_nuevo.ciudad_region:
                cliente.ciudad_region = cliente_nuevo.ciudad_region
            db.flush()
            return cliente
        else:
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

    db.commit()
    db.refresh(venta)
    return venta


def list_ventas(db: Session, id_tienda: UUID, limit: int = 50, offset: int = 0) -> List[Venta]:
    return (
        db.query(Venta)
        .options(
            joinedload(Venta.detalles).joinedload(DetalleVenta.producto)
        )
        .filter(Venta.id_tienda == id_tienda)
        .order_by(Venta.fecha_venta.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_venta(db: Session, id_tienda: UUID, id_venta: UUID) -> Optional[Venta]:
    return (
        db.query(Venta)
        .options(
            joinedload(Venta.detalles).joinedload(DetalleVenta.producto)
        )
        .filter(Venta.id_tienda == id_tienda)
        .filter(Venta.id_venta == id_venta)
        .first()
    )


def update_venta_estado(
    db: Session,
    id_tienda: UUID,
    id_venta: UUID,
    nuevo_estado: str,
) -> Venta:
    # Validar que el nuevo estado sea válido
    if nuevo_estado not in [e.value for e in EstadoVenta]:
        raise ValueError(f"Estado de venta inválido: {nuevo_estado}")

    venta = (
        db.query(Venta)
        .filter(Venta.id_tienda == id_tienda)
        .filter(Venta.id_venta == id_venta)
        .with_for_update()
        .first()
    )
    if not venta:
        raise ValueError("Venta no encontrada.")

    estado_anterior = venta.estado
    if estado_anterior == nuevo_estado:
        return venta

    # Lógica de transición de stock
    # 1. Si era activa (generada_whatsapp o completada) y pasa a cancelada -> RESTAURAR stock
    if estado_anterior in [EstadoVenta.generada_whatsapp, EstadoVenta.completada] and nuevo_estado == EstadoVenta.cancelada:
        for detalle in venta.detalles:
            stmt = select(Producto).where(Producto.id_producto == detalle.id_producto).with_for_update()
            prod = db.execute(stmt).scalar_one_or_none()
            if prod:
                if prod.stock_actual is None:
                    prod.stock_actual = 0
                prod.stock_actual += detalle.cantidad

    # 2. Si era cancelada y pasa a activa -> DESCONTAR stock
    elif estado_anterior == EstadoVenta.cancelada and nuevo_estado in [EstadoVenta.generada_whatsapp, EstadoVenta.completada]:
        # Primero validar si hay stock suficiente para todos
        for detalle in venta.detalles:
            stmt = select(Producto).where(Producto.id_producto == detalle.id_producto).with_for_update()
            prod = db.execute(stmt).scalar_one_or_none()
            if not prod:
                raise ValueError(f"El producto con ID {detalle.id_producto} ya no existe.")
            if prod.stock_actual is None:
                prod.stock_actual = 0
            if prod.stock_actual < detalle.cantidad:
                raise StockInsuficienteError(
                    f"Stock insuficiente para reactivar la venta. "
                    f"Producto '{prod.nombre}' disponible={prod.stock_actual}, solicitado={detalle.cantidad}"
                )

        # Si todos tienen stock, descontar
        for detalle in venta.detalles:
            stmt = select(Producto).where(Producto.id_producto == detalle.id_producto).with_for_update()
            prod = db.execute(stmt).scalar_one_or_none()
            prod.stock_actual -= detalle.cantidad

    # Guardar el nuevo estado
    venta.estado = nuevo_estado
    db.commit()
    db.refresh(venta)
    return venta


def get_dashboard_metrics(db: Session, id_tienda: UUID):
    # 1. Ventas por estado (total_venta y cantidad)
    # Sumar total_venta de las que NO están canceladas
    active_sales = (
        db.query(
            func.coalesce(func.sum(Venta.total_venta), 0).label("total_facturado"),
            func.count(Venta.id_venta).label("total_pedidos")
        )
        .filter(Venta.id_tienda == id_tienda)
        .filter(Venta.estado != EstadoVenta.cancelada)
        .first()
    )

    total_sales_amount = Decimal(str(active_sales.total_facturado)) if active_sales else Decimal("0.00")
    total_orders = active_sales.total_pedidos if active_sales else 0

    # 2. Costo de adquisición total (COGS) para ventas activas
    cogs_query = (
        db.query(
            func.coalesce(func.sum(DetalleVenta.cantidad * Producto.costo_adquisicion), 0).label("cogs")
        )
        .select_from(DetalleVenta)
        .join(Venta, DetalleVenta.id_venta == Venta.id_venta)
        .join(Producto, DetalleVenta.id_producto == Producto.id_producto)
        .filter(Venta.id_tienda == id_tienda)
        .filter(Venta.estado != EstadoVenta.cancelada)
        .first()
    )

    total_cogs = Decimal(str(cogs_query.cogs)) if cogs_query else Decimal("0.00")
    net_profit = total_sales_amount - total_cogs
    profit_margin = (net_profit / total_sales_amount * 100).quantize(Decimal("0.01")) if total_sales_amount > 0 else Decimal("0.00")

    # 3. Ventas por estado individual (cantidad de pedidos)
    sales_by_status_rows = (
        db.query(Venta.estado, func.count(Venta.id_venta).label("count"))
        .filter(Venta.id_tienda == id_tienda)
        .group_by(Venta.estado)
        .all()
    )
    sales_by_status = {row.estado: row.count for row in sales_by_status_rows}

    # 4. Top 5 productos más vendidos
    top_products_rows = (
        db.query(
            Producto.nombre,
            func.sum(DetalleVenta.cantidad).label("cantidad_vendida"),
            func.sum(DetalleVenta.subtotal).label("total_recaudado")
        )
        .select_from(DetalleVenta)
        .join(Venta, DetalleVenta.id_venta == Venta.id_venta)
        .join(Producto, DetalleVenta.id_producto == Producto.id_producto)
        .filter(Venta.id_tienda == id_tienda)
        .filter(Venta.estado != EstadoVenta.cancelada)
        .group_by(Producto.nombre)
        .order_by(desc("cantidad_vendida"))
        .limit(5)
        .all()
    )
    top_products = [
        {
            "nombre": row.nombre,
            "cantidad": int(row.cantidad_vendida),
            "recaudado": str(row.total_recaudado)
        }
        for row in top_products_rows
    ]

    # 5. Ventas por Categoría
    sales_by_category_rows = (
        db.query(
            Categoria.nombre,
            func.sum(DetalleVenta.cantidad).label("cantidad_vendida"),
            func.sum(DetalleVenta.subtotal).label("total_recaudado")
        )
        .select_from(DetalleVenta)
        .join(Venta, DetalleVenta.id_venta == Venta.id_venta)
        .join(Producto, DetalleVenta.id_producto == Producto.id_producto)
        .join(Categoria, Producto.id_categoria == Categoria.id_categoria)
        .filter(Venta.id_tienda == id_tienda)
        .filter(Venta.estado != EstadoVenta.cancelada)
        .group_by(Categoria.nombre)
        .all()
    )
    sales_by_category = [
        {
            "nombre": row.nombre,
            "cantidad": int(row.cantidad_vendida),
            "recaudado": str(row.total_recaudado)
        }
        for row in sales_by_category_rows
    ]

    # 6. Historial de ventas diario (últimos 30 días)
    daily_sales_rows = (
        db.query(
            func.date(Venta.fecha_venta).label("fecha"),
            func.coalesce(func.sum(Venta.total_venta), 0).label("total_recaudado"),
            func.count(Venta.id_venta).label("cantidad_pedidos")
        )
        .filter(Venta.id_tienda == id_tienda)
        .filter(Venta.estado != EstadoVenta.cancelada)
        .group_by(func.date(Venta.fecha_venta))
        .order_by("fecha")
        .limit(30)
        .all()
    )
    daily_sales = [
        {
            "fecha": str(row.fecha),
            "recaudado": str(row.total_recaudado),
            "pedidos": int(row.cantidad_pedidos)
        }
        for row in daily_sales_rows
    ]

    # 7. Productos con bajo stock (stock_actual <= 5, activos)
    low_stock_products_rows = (
        db.query(Producto)
        .filter(Producto.id_tienda == id_tienda)
        .filter(Producto.activo == True)
        .filter(Producto.stock_actual <= 5)
        .order_by(Producto.stock_actual.asc())
        .limit(15)
        .all()
    )
    low_stock_products = [
        {
            "id_producto": str(p.id_producto),
            "nombre": p.nombre,
            "stock_actual": p.stock_actual,
            "precio_venta": str(p.precio_venta),
            "costo_adquisicion": str(p.costo_adquisicion) if p.costo_adquisicion is not None else "0.00"
        }
        for p in low_stock_products_rows
    ]

    return {
        "resumen": {
            "ventas_totales": str(total_sales_amount),
            "pedidos_totales": total_orders,
            "costos_totales": str(total_cogs),
            "margen_neto": str(net_profit),
            "margen_porcentaje": str(profit_margin)
        },
        "estados": sales_by_status,
        "productos_top": top_products,
        "categorias_top": sales_by_category,
        "ventas_diarias": daily_sales,
        "bajo_stock": low_stock_products
    }