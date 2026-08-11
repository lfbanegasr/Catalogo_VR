from __future__ import annotations

from collections import defaultdict
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
from models.product_set import DetalleVentaConsumo
from crud.crud_product_sets import PRODUCT_TYPE_SET, PRODUCT_TYPE_SIMPLE
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
        requested_ids = sorted(
            {item.id_producto for item in payload.detalles},
            key=str,
        )
        products = db.execute(
            select(Producto)
            .where(
                Producto.id_producto.in_(requested_ids),
                Producto.id_tienda == id_tienda,
            )
            .order_by(Producto.id_producto.asc())
            .with_for_update()
        ).scalars().all()
        products_by_id = {product.id_producto: product for product in products}
        if len(products_by_id) != len(requested_ids):
            missing = next(
                product_id
                for product_id in requested_ids
                if product_id not in products_by_id
            )
            raise ValueError(f"Producto no existe o no pertenece a tu tienda: {missing}")

        detail_plans = []
        aggregated_requirements = defaultdict(int)

        for item in payload.detalles:
            product = products_by_id[item.id_producto]
            if not product.activo:
                raise ValueError(f"El producto '{product.nombre}' no esta disponible.")
            active_variants = (
                db.query(VarianteProducto)
                .filter(
                    VarianteProducto.id_producto == product.id_producto,
                    VarianteProducto.activa.is_(True),
                )
                .all()
            )
            variant = None
            consumptions = []

            if product.tipo_producto == PRODUCT_TYPE_SET:
                if item.id_variante is not None:
                    raise ValueError("Los sets no admiten variantes propias.")
                if not product.componentes:
                    raise ValueError(f"El set '{product.nombre}' no tiene componentes.")
                for component in product.componentes:
                    component_product = component.producto_componente
                    component_variant = component.variante_componente
                    if (
                        component_product is None
                        or component_product.id_tienda != id_tienda
                        or not component_product.activo
                        or component_product.tipo_producto != PRODUCT_TYPE_SIMPLE
                    ):
                        raise StockInsuficienteError(
                            f"El componente del set '{product.nombre}' ya no esta disponible.",
                        )
                    if component_variant is not None:
                        if (
                            not component_variant.activa
                            or component_variant.id_producto != component_product.id_producto
                        ):
                            raise StockInsuficienteError(
                                f"Una variante de '{component_product.nombre}' ya no esta disponible.",
                            )
                    else:
                        component_has_variants = (
                            db.query(VarianteProducto.id_variante)
                            .filter(
                                VarianteProducto.id_producto == component_product.id_producto,
                                VarianteProducto.activa.is_(True),
                            )
                            .first()
                            is not None
                        )
                        if component_has_variants:
                            raise StockInsuficienteError(
                                f"El set requiere seleccionar una variante de '{component_product.nombre}'.",
                            )
                    variant_label = None
                    if component_variant is not None:
                        variant_label = " / ".join(
                            attribute.opcion.valor
                            for attribute in component_variant.atributos
                            if attribute.opcion is not None
                        ) or component_variant.sku
                    consumption = {
                        "product_id": component_product.id_producto,
                        "variant_id": (
                            component_variant.id_variante
                            if component_variant is not None
                            else None
                        ),
                        "quantity": component.cantidad * item.cantidad,
                        "product_name": component_product.nombre,
                        "variant_sku": (
                            component_variant.sku
                            if component_variant is not None
                            else None
                        ),
                        "variant_name": variant_label,
                    }
                    consumptions.append(consumption)
                    aggregated_requirements[
                        (consumption["product_id"], consumption["variant_id"])
                    ] += consumption["quantity"]
            else:
                if item.id_variante is not None:
                    variant = next(
                        (
                            candidate
                            for candidate in active_variants
                            if candidate.id_variante == item.id_variante
                        ),
                        None,
                    )
                    if variant is None:
                        raise ValueError(
                            "La variante seleccionada no existe o no esta disponible.",
                        )
                elif active_variants:
                    raise ValueError(f"Selecciona una variante para '{product.nombre}'.")

                variant_label = None
                if variant is not None:
                    variant_label = " / ".join(
                        attribute.opcion.valor
                        for attribute in variant.atributos
                        if attribute.opcion is not None
                    ) or variant.sku
                consumption = {
                    "product_id": product.id_producto,
                    "variant_id": variant.id_variante if variant is not None else None,
                    "quantity": item.cantidad,
                    "product_name": product.nombre,
                    "variant_sku": variant.sku if variant is not None else None,
                    "variant_name": variant_label,
                }
                consumptions.append(consumption)
                aggregated_requirements[
                    (consumption["product_id"], consumption["variant_id"])
                ] += consumption["quantity"]

            detail_plans.append(
                {
                    "item": item,
                    "product": product,
                    "variant": variant,
                    "consumptions": consumptions,
                },
            )

        stock_product_ids = sorted(
            {key[0] for key in aggregated_requirements},
            key=str,
        )
        locked_products = db.execute(
            select(Producto)
            .where(Producto.id_producto.in_(stock_product_ids))
            .order_by(Producto.id_producto.asc())
            .with_for_update()
        ).scalars().all()
        locked_products_by_id = {
            product.id_producto: product for product in locked_products
        }

        stock_variant_ids = sorted(
            {key[1] for key in aggregated_requirements if key[1] is not None},
            key=str,
        )
        locked_variants = []
        if stock_variant_ids:
            locked_variants = db.execute(
                select(VarianteProducto)
                .where(VarianteProducto.id_variante.in_(stock_variant_ids))
                .order_by(VarianteProducto.id_variante.asc())
                .with_for_update()
            ).scalars().all()
        locked_variants_by_id = {
            variant.id_variante: variant for variant in locked_variants
        }

        stock_targets = {}
        for (product_id, variant_id), required in aggregated_requirements.items():
            product = locked_products_by_id.get(product_id)
            if product is None or not product.activo:
                raise StockInsuficienteError("Uno de los componentes ya no esta disponible.")
            target = (
                locked_variants_by_id.get(variant_id)
                if variant_id is not None
                else product
            )
            if (
                target is None
                or (
                    variant_id is not None
                    and (
                        not target.activa
                        or target.id_producto != product_id
                    )
                )
            ):
                raise StockInsuficienteError(
                    f"Una variante de '{product.nombre}' ya no esta disponible.",
                )
            available = max(int(target.stock_actual or 0), 0)
            if available < required:
                raise StockInsuficienteError(
                    f"Stock insuficiente para '{product.nombre}'. "
                    f"Disponible={available}, solicitado={required}",
                )
            stock_targets[(product_id, variant_id)] = target

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
        db.flush()
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
        for plan in detail_plans:
            item = plan["item"]
            product = plan["product"]
            variant = plan["variant"]
            base_price = _decimal(
                variant.precio_venta
                if variant is not None and variant.precio_venta is not None
                else product.precio_venta
            )
            if payload.origen == "whatsapp":
                effective_category = product.id_categoria_principal or product.id_categoria
                priced, _ = apply_offer_to_products(
                    db=db,
                    id_tienda=id_tienda,
                    products=[{
                        "id": str(product.id_producto),
                        "precio": base_price,
                        "categoria_id": (
                            str(effective_category) if effective_category else None
                        ),
                    }],
                )
                unit_price = _decimal(priced[0]["precio_final"])
            else:
                unit_price = (
                    _decimal(item.precio_unitario)
                    if item.precio_unitario is not None
                    else base_price
                )
            subtotal = (unit_price * _decimal(item.cantidad)).quantize(
                Decimal("0.00"),
            )
            variant_label = None
            if variant is not None:
                variant_label = " / ".join(
                    attribute.opcion.valor
                    for attribute in variant.atributos
                    if attribute.opcion is not None
                ) or variant.sku

            detail = DetalleVenta(
                id_venta=venta.id_venta,
                id_producto=product.id_producto,
                id_variante=variant.id_variante if variant is not None else None,
                sku_variante=variant.sku if variant is not None else None,
                nombre_variante=variant_label,
                cantidad=item.cantidad,
                precio_unitario=unit_price,
                subtotal=subtotal,
            )
            db.add(detail)
            db.flush()
            detalles_creados.append(detail)

            for consumption in plan["consumptions"]:
                component_product = locked_products_by_id[consumption["product_id"]]
                component_variant = (
                    locked_variants_by_id.get(consumption["variant_id"])
                    if consumption["variant_id"] is not None
                    else None
                )
                unit_cost = (
                    component_variant.costo_adquisicion
                    if component_variant is not None
                    and component_variant.costo_adquisicion is not None
                    else component_product.costo_adquisicion
                )
                db.add(
                    DetalleVentaConsumo(
                        id_detalle=detail.id_detalle,
                        id_producto_componente=consumption["product_id"],
                        id_variante_componente=consumption["variant_id"],
                        cantidad=consumption["quantity"],
                        nombre_producto=consumption["product_name"],
                        sku_variante=consumption["variant_sku"],
                        nombre_variante=consumption["variant_name"],
                        costo_unitario=unit_cost,
                    ),
                )
            total += subtotal

        if requested_state in ACTIVE_ORDER_STATES:
            for key, required in aggregated_requirements.items():
                stock_targets[key].stock_actual -= required

        venta.total_venta = total.quantize(Decimal("0.00"))
        venta.detalles = detalles_creados
        db.commit()
        db.refresh(venta)
        return venta
    except Exception:
        db.rollback()
        raise


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

    inventory_requirements = {}
    for detail in venta.detalles:
        sources = detail.consumos or [detail]
        for source in sources:
            if detail.consumos:
                product_id = source.id_producto_componente
                variant_id = source.id_variante_componente
                quantity = source.cantidad
                label = source.nombre_producto
            else:
                product_id = detail.id_producto
                variant_id = detail.id_variante
                quantity = detail.cantidad
                label = detail.producto.nombre if detail.producto else str(product_id)
            key = (product_id, variant_id)
            if key not in inventory_requirements:
                inventory_requirements[key] = {
                    "quantity": 0,
                    "label": label,
                }
            inventory_requirements[key]["quantity"] += quantity

    locked_targets = {}
    for product_id, variant_id in sorted(
        inventory_requirements,
        key=lambda key: (str(key[0]), str(key[1] or "")),
    ):
        if variant_id is not None:
            target = db.execute(
                select(VarianteProducto)
                .where(VarianteProducto.id_variante == variant_id)
                .with_for_update()
            ).scalar_one_or_none()
        else:
            target = db.execute(
                select(Producto)
                .where(Producto.id_producto == product_id)
                .with_for_update()
            ).scalar_one_or_none()
        if target is None:
            raise ValueError(
                f"No se puede ajustar el inventario de {inventory_requirements[(product_id, variant_id)]['label']}.",
            )
        locked_targets[(product_id, variant_id)] = target

    if (
        estado_anterior in ACTIVE_ORDER_STATES
        and nuevo_estado == EstadoVenta.cancelada.value
    ):
        for key, requirement in inventory_requirements.items():
            target = locked_targets[key]
            target.stock_actual = int(target.stock_actual or 0) + requirement["quantity"]

    elif (
        estado_anterior == EstadoVenta.cancelada.value
        and nuevo_estado in ACTIVE_ORDER_STATES
    ):
        for key, requirement in inventory_requirements.items():
            target = locked_targets[key]
            available = int(target.stock_actual or 0)
            if available < requirement["quantity"]:
                raise StockInsuficienteError(
                    f"Stock insuficiente para reactivar la venta de "
                    f"'{requirement['label']}'. Disponible={available}, "
                    f"solicitado={requirement['quantity']}",
                )
        for key, requirement in inventory_requirements.items():
            locked_targets[key].stock_actual -= requirement["quantity"]
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
