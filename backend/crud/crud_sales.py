from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy import case, desc, func, or_, select
from sqlalchemy.orm import Session, joinedload

from crud.crud_offers import apply_offer_to_products
from models.sales import (
    Cliente,
    DetalleVenta,
    DireccionCliente,
    EstadoVenta,
    HistorialEstadoPedido,
    Venta,
)
from models.catalog import Producto, Categoria
from models.catalog_variant import VarianteProducto
from models.public_event import PublicEvent
from schemas.sales_schema import VentaCreate


class StockInsuficienteError(Exception):
    """Se lanza cuando el stock no alcanza para completar la venta."""
    pass


ACTIVE_ORDER_STATES = {state.value for state in EstadoVenta if state != EstadoVenta.cancelada}
ORDER_STATE_RANK = {
    EstadoVenta.generada_whatsapp.value: 0,
    EstadoVenta.pendiente.value: 1,
    EstadoVenta.confirmada.value: 2,
    EstadoVenta.preparando.value: 3,
    EstadoVenta.lista.value: 4,
    EstadoVenta.enviada.value: 5,
    EstadoVenta.completada.value: 6,
}


def _decimal(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _normalize_phone(value: str | None) -> str | None:
    digits = "".join(character for character in str(value or "") if character.isdigit())
    return digits or None


def _new_tracking_code(db: Session) -> str:
    for _ in range(8):
        code = secrets.token_hex(6).upper()
        exists = (
            db.query(Venta.id_venta)
            .filter(Venta.codigo_seguimiento == code)
            .first()
            is not None
        )
        if not exists:
            return code
    raise RuntimeError("No se pudo generar un codigo de seguimiento unico.")


def _delivery_snapshot(entrega, cliente: Cliente | None) -> dict | None:
    if entrega.metodo != "delivery":
        return None
    return {
        "etiqueta": entrega.etiqueta,
        "destinatario": entrega.destinatario or (cliente.nombre_completo if cliente else None),
        "telefono": _normalize_phone(entrega.telefono)
        or (cliente.telefono if cliente else None),
        "linea1": str(entrega.linea1 or "").strip(),
        "linea2": str(entrega.linea2 or "").strip() or None,
        "ciudad": str(entrega.ciudad or "").strip(),
        "region": str(entrega.region or "").strip() or None,
        "referencia": str(entrega.referencia or "").strip() or None,
    }


def _save_customer_address(
    db: Session,
    *,
    cliente: Cliente | None,
    snapshot: dict | None,
) -> None:
    if cliente is None or snapshot is None:
        return
    address = (
        db.query(DireccionCliente)
        .filter(
            DireccionCliente.id_cliente == cliente.id_cliente,
            DireccionCliente.linea1 == snapshot["linea1"],
            DireccionCliente.ciudad == snapshot["ciudad"],
        )
        .first()
    )
    if address is None:
        db.query(DireccionCliente).filter(
            DireccionCliente.id_cliente == cliente.id_cliente,
        ).update({DireccionCliente.es_predeterminada: False})
        address = DireccionCliente(
            id_tienda=cliente.id_tienda,
            id_cliente=cliente.id_cliente,
            es_predeterminada=True,
            **snapshot,
        )
        db.add(address)
    else:
        for key, value in snapshot.items():
            setattr(address, key, value)
        address.activa = True


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
        normalized_phone = _normalize_phone(cliente_nuevo.telefono)
        # Buscar si ya existe un cliente con ese teléfono en la misma tienda
        cliente = None
        if normalized_phone:
            cliente = (
                db.query(Cliente)
                .filter(Cliente.id_tienda == id_tienda)
                .filter(Cliente.telefono == normalized_phone)
                .first()
            )
        if cliente is None and cliente_nuevo.email:
            cliente = (
                db.query(Cliente)
                .filter(
                    Cliente.id_tienda == id_tienda,
                    func.lower(Cliente.email) == cliente_nuevo.email.strip().lower(),
                )
                .first()
            )

        if cliente:
            # Actualizar datos si cambiaron
            cliente.nombre_completo = cliente_nuevo.nombre_completo
            if normalized_phone:
                cliente.telefono = normalized_phone
            if cliente_nuevo.email:
                cliente.email = cliente_nuevo.email.strip().lower()
            if cliente_nuevo.ciudad_region:
                cliente.ciudad_region = cliente_nuevo.ciudad_region
            db.flush()
            return cliente
        else:
            nuevo = Cliente(
                id_tienda=id_tienda,
                nombre_completo=cliente_nuevo.nombre_completo,
                telefono=normalized_phone,
                email=cliente_nuevo.email.strip().lower() if cliente_nuevo.email else None,
                ciudad_region=cliente_nuevo.ciudad_region,
            )
            db.add(nuevo)
            db.flush()
            return nuevo

    return None


def create_venta(db: Session, id_tienda: UUID, payload: VentaCreate) -> Venta:
    try:
        # cliente
        cliente = _get_or_create_cliente(
            db,
            id_tienda=id_tienda,
            id_cliente=payload.id_cliente,
            cliente_nuevo=payload.cliente_nuevo,
        )

        requested_state = payload.estado or EstadoVenta.pendiente.value
        if requested_state not in {state.value for state in EstadoVenta}:
            raise ValueError(f"Estado de venta invalido: {requested_state}")
        address_snapshot = _delivery_snapshot(payload.entrega, cliente)
        _save_customer_address(db, cliente=cliente, snapshot=address_snapshot)

        venta = Venta(
            id_tienda=id_tienda,
            id_cliente=cliente.id_cliente if cliente else None,
            estado=requested_state,
            origen=payload.origen or "caja",
            codigo_seguimiento=_new_tracking_code(db),
            metodo_entrega=payload.entrega.metodo,
            metodo_pago=payload.metodo_pago,
            notas_cliente=payload.notas_cliente,
            direccion_snapshot=address_snapshot,
            fecha_actualizacion=datetime.utcnow(),
            total_venta=Decimal("0.00"),
        )
        db.add(venta)
        db.flush()  # id_venta
        db.add(
            HistorialEstadoPedido(
                id_venta=venta.id_venta,
                estado_anterior=None,
                estado_nuevo=requested_state,
                nota="Pedido registrado",
                visible_cliente=True,
            ),
        )

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

            active_variants_exist = (
                db.query(VarianteProducto.id_variante)
                .filter(
                    VarianteProducto.id_producto == producto.id_producto,
                    VarianteProducto.activa.is_(True),
                )
                .first()
                is not None
            )
            variant = None
            stock_target = producto
            if item.id_variante is not None:
                variant = db.execute(
                    select(VarianteProducto)
                    .where(
                        VarianteProducto.id_variante == item.id_variante,
                        VarianteProducto.id_producto == producto.id_producto,
                        VarianteProducto.id_tienda == id_tienda,
                        VarianteProducto.activa.is_(True),
                    )
                    .with_for_update()
                ).scalar_one_or_none()
                if variant is None:
                    raise ValueError("La variante seleccionada no existe o no esta disponible.")
                stock_target = variant
            elif active_variants_exist:
                raise ValueError(f"Selecciona una variante para '{producto.nombre}'.")

            if stock_target.stock_actual is None:
                stock_target.stock_actual = 0
            if stock_target.stock_actual < item.cantidad:
                raise StockInsuficienteError(
                    f"Stock insuficiente para '{producto.nombre}'. "
                    f"Disponible={stock_target.stock_actual}, solicitado={item.cantidad}"
                )

            base_price = _decimal(
                variant.precio_venta
                if variant is not None and variant.precio_venta is not None
                else producto.precio_venta
            )
            if payload.origen == "whatsapp":
                effective_category = producto.id_categoria_principal or producto.id_categoria
                priced, _ = apply_offer_to_products(
                    db=db,
                    id_tienda=id_tienda,
                    products=[{
                        "id": str(producto.id_producto),
                        "precio": base_price,
                        "categoria_id": str(effective_category) if effective_category else None,
                    }],
                )
                precio_unit = _decimal(priced[0]["precio_final"])
            else:
                precio_unit = (
                    _decimal(item.precio_unitario)
                    if item.precio_unitario is not None
                    else base_price
                )
            subtotal = (precio_unit * _decimal(item.cantidad)).quantize(Decimal("0.00"))
            variant_label = None
            if variant is not None:
                variant_label = " / ".join(
                    attribute.opcion.valor
                    for attribute in variant.atributos
                    if attribute.opcion is not None
                ) or variant.sku

            detalle = DetalleVenta(
                id_venta=venta.id_venta,
                id_producto=producto.id_producto,
                id_variante=variant.id_variante if variant is not None else None,
                sku_variante=variant.sku if variant is not None else None,
                nombre_variante=variant_label,
                cantidad=item.cantidad,
                precio_unitario=precio_unit,
                subtotal=subtotal,
            )
            db.add(detalle)
            detalles_creados.append(detalle)

            stock_target.stock_actual -= item.cantidad
            total += subtotal

        venta.total_venta = total.quantize(Decimal("0.00"))
        venta.detalles = detalles_creados

        db.commit()
        db.refresh(venta)
        return venta
    except Exception as e:
        db.rollback()
        raise e


def list_ventas(db: Session, id_tienda: UUID, limit: int = 50, offset: int = 0) -> List[Venta]:
    return (
        db.query(Venta)
        .options(
            joinedload(Venta.detalles).joinedload(DetalleVenta.producto),
            joinedload(Venta.cliente),
            joinedload(Venta.historial_estados),
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
            joinedload(Venta.detalles).joinedload(DetalleVenta.producto),
            joinedload(Venta.cliente),
            joinedload(Venta.historial_estados),
        )
        .filter(Venta.id_tienda == id_tienda)
        .filter(Venta.id_venta == id_venta)
        .first()
    )


def get_public_order_tracking(
    db: Session,
    *,
    id_tienda: UUID,
    codigo_seguimiento: str,
) -> Venta | None:
    return (
        db.query(Venta)
        .options(
            joinedload(Venta.detalles).joinedload(DetalleVenta.producto),
            joinedload(Venta.historial_estados),
        )
        .filter(
            Venta.id_tienda == id_tienda,
            Venta.codigo_seguimiento == codigo_seguimiento.strip().upper(),
        )
        .first()
    )


def list_clientes(
    db: Session,
    *,
    id_tienda: UUID,
    search: str | None = None,
    limit: int = 100,
) -> list[dict]:
    active_total = case(
        (Venta.estado != EstadoVenta.cancelada, Venta.total_venta),
        else_=Decimal("0"),
    )
    query = (
        db.query(
            Cliente,
            func.count(Venta.id_venta).label("total_pedidos"),
            func.coalesce(func.sum(active_total), 0).label("total_comprado"),
        )
        .outerjoin(Venta, Venta.id_cliente == Cliente.id_cliente)
        .filter(Cliente.id_tienda == id_tienda)
    )
    normalized_search = str(search or "").strip()
    if normalized_search:
        pattern = f"%{normalized_search}%"
        query = query.filter(
            or_(
                Cliente.nombre_completo.ilike(pattern),
                Cliente.telefono.ilike(pattern),
                Cliente.email.ilike(pattern),
            ),
        )
    rows = (
        query
        .group_by(Cliente.id_cliente)
        .order_by(Cliente.fecha_registro.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id_cliente": cliente.id_cliente,
            "nombre_completo": cliente.nombre_completo,
            "telefono": cliente.telefono,
            "email": cliente.email,
            "ciudad_region": cliente.ciudad_region,
            "notas": cliente.notas,
            "fecha_registro": cliente.fecha_registro,
            "total_pedidos": int(total_pedidos or 0),
            "total_comprado": total_comprado or Decimal("0"),
            "direcciones": [],
        }
        for cliente, total_pedidos, total_comprado in rows
    ]


def get_cliente_detail(
    db: Session,
    *,
    id_tienda: UUID,
    id_cliente: UUID,
) -> dict | None:
    cliente = (
        db.query(Cliente)
        .options(joinedload(Cliente.direcciones))
        .filter(
            Cliente.id_tienda == id_tienda,
            Cliente.id_cliente == id_cliente,
        )
        .first()
    )
    if cliente is None:
        return None
    totals = (
        db.query(
            func.count(Venta.id_venta),
            func.coalesce(
                func.sum(
                    case(
                        (Venta.estado != EstadoVenta.cancelada, Venta.total_venta),
                        else_=Decimal("0"),
                    ),
                ),
                0,
            ),
        )
        .filter(Venta.id_cliente == cliente.id_cliente)
        .first()
    )
    return {
        "id_cliente": cliente.id_cliente,
        "nombre_completo": cliente.nombre_completo,
        "telefono": cliente.telefono,
        "email": cliente.email,
        "ciudad_region": cliente.ciudad_region,
        "notas": cliente.notas,
        "fecha_registro": cliente.fecha_registro,
        "total_pedidos": int(totals[0] or 0),
        "total_comprado": totals[1] or Decimal("0"),
        "direcciones": sorted(
            cliente.direcciones,
            key=lambda address: (not address.es_predeterminada, address.etiqueta.lower()),
        ),
    }


def update_cliente(
    db: Session,
    *,
    id_tienda: UUID,
    id_cliente: UUID,
    payload,
) -> dict | None:
    cliente = db.query(Cliente).filter(
        Cliente.id_tienda == id_tienda,
        Cliente.id_cliente == id_cliente,
    ).first()
    if cliente is None:
        return None
    data = payload.model_dump(exclude_unset=True)
    if "telefono" in data:
        data["telefono"] = _normalize_phone(data["telefono"])
    if data.get("email"):
        data["email"] = data["email"].strip().lower()
    for key, value in data.items():
        setattr(cliente, key, value)
    db.commit()
    return get_cliente_detail(db, id_tienda=id_tienda, id_cliente=id_cliente)


def update_venta_estado(
    db: Session,
    id_tienda: UUID,
    id_venta: UUID,
    nuevo_estado: str,
    id_usuario: UUID | None = None,
    nota: str | None = None,
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

    estado_anterior = (
        venta.estado.value if isinstance(venta.estado, EstadoVenta) else str(venta.estado)
    )
    if estado_anterior == nuevo_estado:
        return venta
    if estado_anterior == EstadoVenta.cancelada.value:
        if nuevo_estado != EstadoVenta.pendiente.value:
            raise ValueError("Un pedido cancelado solo puede reactivarse como pendiente.")
    elif nuevo_estado != EstadoVenta.cancelada.value:
        current_rank = ORDER_STATE_RANK.get(estado_anterior, 0)
        next_rank = ORDER_STATE_RANK.get(nuevo_estado, -1)
        if next_rank < current_rank:
            raise ValueError("No puedes retroceder el estado operativo del pedido.")

    def lock_stock_target(detalle):
        if detalle.id_variante is not None:
            target = db.execute(
                select(VarianteProducto)
                .where(VarianteProducto.id_variante == detalle.id_variante)
                .with_for_update()
            ).scalar_one_or_none()
            if target is None:
                raise ValueError(
                    f"La variante {detalle.sku_variante or detalle.id_variante} ya no existe.",
                )
            return target
        if detalle.sku_variante:
            raise ValueError(
                f"No se puede ajustar el stock de la variante eliminada {detalle.sku_variante}.",
            )
        return db.execute(
            select(Producto)
            .where(Producto.id_producto == detalle.id_producto)
            .with_for_update()
        ).scalar_one_or_none()

    # 1. Si era activa (generada_whatsapp, pendiente o completada) y pasa a cancelada -> RESTAURAR stock
    if estado_anterior in ACTIVE_ORDER_STATES and nuevo_estado == EstadoVenta.cancelada.value:
        for detalle in venta.detalles:
            stock_target = lock_stock_target(detalle)
            if stock_target:
                if stock_target.stock_actual is None:
                    stock_target.stock_actual = 0
                stock_target.stock_actual += detalle.cantidad

    # 2. Si era cancelada y pasa a activa -> DESCONTAR stock
    elif estado_anterior == EstadoVenta.cancelada.value and nuevo_estado in ACTIVE_ORDER_STATES:
        # Primero validar si hay stock suficiente para todos
        for detalle in venta.detalles:
            stock_target = lock_stock_target(detalle)
            if not stock_target:
                raise ValueError(f"El producto con ID {detalle.id_producto} ya no existe.")
            if stock_target.stock_actual is None:
                stock_target.stock_actual = 0
            if stock_target.stock_actual < detalle.cantidad:
                raise StockInsuficienteError(
                    f"Stock insuficiente para reactivar la venta. "
                    f"Disponible={stock_target.stock_actual}, solicitado={detalle.cantidad}"
                )

        # Si todos tienen stock, descontar
        for detalle in venta.detalles:
            stock_target = lock_stock_target(detalle)
            stock_target.stock_actual -= detalle.cantidad

    # Guardar el nuevo estado
    venta.estado = nuevo_estado
    venta.fecha_actualizacion = datetime.utcnow()
    db.add(
        HistorialEstadoPedido(
            id_venta=venta.id_venta,
            id_usuario=id_usuario,
            estado_anterior=estado_anterior,
            estado_nuevo=nuevo_estado,
            nota=nota,
            visible_cliente=True,
        ),
    )
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

    active_sales_today = (
        db.query(
            func.coalesce(func.sum(Venta.total_venta), 0).label("total_facturado"),
            func.count(Venta.id_venta).label("total_pedidos")
        )
        .filter(Venta.id_tienda == id_tienda)
        .filter(Venta.estado != EstadoVenta.cancelada)
        .filter(func.date(Venta.fecha_venta) == func.current_date())
        .first()
    )

    total_sales_amount = Decimal(str(active_sales.total_facturado)) if active_sales else Decimal("0.00")
    total_orders = active_sales.total_pedidos if active_sales else 0
    today_sales_amount = Decimal(str(active_sales_today.total_facturado)) if active_sales_today else Decimal("0.00")
    today_orders = active_sales_today.total_pedidos if active_sales_today else 0


    # 2. Costo de adquisición total (COGS) para ventas activas
    cogs_query = (
        db.query(
            func.coalesce(
                func.sum(
                    DetalleVenta.cantidad
                    * func.coalesce(
                        VarianteProducto.costo_adquisicion,
                        Producto.costo_adquisicion,
                        0,
                    ),
                ),
                0,
            ).label("cogs")
        )
        .select_from(DetalleVenta)
        .join(Venta, DetalleVenta.id_venta == Venta.id_venta)
        .join(Producto, DetalleVenta.id_producto == Producto.id_producto)
        .outerjoin(
            VarianteProducto,
            DetalleVenta.id_variante == VarianteProducto.id_variante,
        )
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

    analytics_since = datetime.utcnow() - timedelta(days=30)
    event_count_rows = (
        db.query(PublicEvent.evento, func.count(PublicEvent.id_evento))
        .filter(
            PublicEvent.id_tienda == id_tienda,
            PublicEvent.fecha >= analytics_since,
        )
        .group_by(PublicEvent.evento)
        .all()
    )
    event_counts = {event: int(count) for event, count in event_count_rows}
    catalog_views = event_counts.get("catalog_view", 0)
    online_orders = (
        db.query(func.count(Venta.id_venta))
        .filter(
            Venta.id_tienda == id_tienda,
            Venta.origen == "whatsapp",
            Venta.estado != EstadoVenta.cancelada,
            Venta.fecha_venta >= analytics_since,
        )
        .scalar()
        or 0
    )
    conversion_rate = (
        Decimal(online_orders) / Decimal(catalog_views) * 100
        if catalog_views > 0
        else Decimal("0")
    )
    most_viewed_rows = (
        db.query(
            Producto.nombre,
            func.count(PublicEvent.id_evento).label("vistas"),
        )
        .join(Producto, Producto.id_producto == PublicEvent.id_producto)
        .filter(
            PublicEvent.id_tienda == id_tienda,
            PublicEvent.evento == "product_view",
            PublicEvent.fecha >= analytics_since,
        )
        .group_by(Producto.id_producto, Producto.nombre)
        .order_by(desc("vistas"))
        .limit(5)
        .all()
    )

    return {
        "resumen": {
            "ventas_totales": str(total_sales_amount),
            "pedidos_totales": total_orders,
            "ventas_hoy": str(today_sales_amount),
            "pedidos_hoy": today_orders,
            "costos_totales": str(total_cogs),
            "margen_neto": str(net_profit),
            "margen_porcentaje": str(profit_margin)
        },
        "estados": sales_by_status,
        "productos_top": top_products,
        "categorias_top": sales_by_category,
        "ventas_diarias": daily_sales,
        "bajo_stock": low_stock_products,
        "catalogo": {
            "periodo_dias": 30,
            "visitas": catalog_views,
            "productos_vistos": event_counts.get("product_view", 0),
            "busquedas": event_counts.get("search", 0),
            "clicks_whatsapp": event_counts.get("whatsapp_click", 0),
            "pedidos_online": int(online_orders),
            "conversion_porcentaje": str(conversion_rate.quantize(Decimal("0.01"))),
            "productos_mas_vistos": [
                {"nombre": row.nombre, "vistas": int(row.vistas)}
                for row in most_viewed_rows
            ],
        },
    }
