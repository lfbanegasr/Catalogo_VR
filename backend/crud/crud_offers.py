from __future__ import annotations

from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from uuid import UUID

from sqlalchemy import and_, inspect, or_, select
from sqlalchemy.orm import Session

from models.catalog import Categoria, Oferta, OfertaCategoria, OfertaProducto, Producto
from schemas.catalog_schema import OfferCategoryAttach, OfferCreate, OfferProductAttach, OfferUpdate

TWOPLACES = Decimal("0.01")


def _offer_categories_table_exists(db: Session) -> bool:
    bind = db.get_bind()
    inspector = inspect(bind)
    return inspector.has_table("oferta_categorias")


def _ensure_offer_categories_feature_ready(db: Session) -> None:
    if not _offer_categories_table_exists(db):
        raise RuntimeError(
            "Falta ejecutar la migracion de categorias de ofertas. Ejecuta: alembic upgrade head",
        )


def _round_money(value: Decimal | float | int) -> Decimal:
    decimal_value = value if isinstance(value, Decimal) else Decimal(str(value))
    return decimal_value.quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def _validate_offer_payload(payload: dict[str, Any]) -> None:
    tipo = payload.get("tipo")
    porcentaje = payload.get("porcentaje")
    if tipo == "PERCENT" and porcentaje is None:
        raise ValueError("Las ofertas PERCENT requieren porcentaje.")
    if tipo == "PRICE_OVERRIDE":
        payload["porcentaje"] = None
    if payload.get("fecha_inicio") and payload.get("fecha_fin"):
        if payload["fecha_fin"] < payload["fecha_inicio"]:
            raise ValueError("fecha_fin no puede ser anterior a fecha_inicio.")


def create_offer(db: Session, id_tienda: UUID, payload: OfferCreate) -> Oferta:
    data = payload.model_dump()
    _validate_offer_payload(data)
    offer = Oferta(id_tienda=id_tienda, **data)
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return offer


def list_offers(db: Session, id_tienda: UUID) -> list[Oferta]:
    return (
        db.query(Oferta)
        .filter(Oferta.id_tienda == id_tienda)
        .order_by(Oferta.prioridad.desc(), Oferta.created_at.desc())
        .all()
    )


def get_offer_by_id(db: Session, id_oferta: UUID) -> Oferta | None:
    return db.query(Oferta).filter(Oferta.id_oferta == id_oferta).first()


def update_offer(db: Session, offer: Oferta, payload: OfferUpdate) -> Oferta:
    data = payload.model_dump(exclude_unset=True)
    merged = {
        "tipo": offer.tipo,
        "porcentaje": offer.porcentaje,
        "fecha_inicio": offer.fecha_inicio,
        "fecha_fin": offer.fecha_fin,
        **data,
    }
    _validate_offer_payload(merged)
    if merged["tipo"] == "PRICE_OVERRIDE":
        if _offer_categories_table_exists(db):
            has_category_targets = (
                db.query(OfertaCategoria)
                .filter(
                    OfertaCategoria.id_oferta == offer.id_oferta,
                    OfertaCategoria.activo.is_(True),
                )
                .first()
                is not None
            )
            if has_category_targets:
                raise ValueError("Una oferta con categorias asociadas no puede ser PRICE_OVERRIDE.")

    for key, value in data.items():
        setattr(offer, key, value)

    db.commit()
    db.refresh(offer)
    return offer


def deactivate_offer(db: Session, offer: Oferta) -> Oferta:
    offer.activa = False
    db.commit()
    db.refresh(offer)
    return offer


def attach_products_to_offer(db: Session, offer: Oferta, payload: OfferProductAttach) -> list[OfertaProducto]:
    attached: list[OfertaProducto] = []
    for item in payload.productos:
        producto = db.query(Producto).filter(Producto.id_producto == item.id_producto).first()
        if not producto:
            raise ValueError(f"Producto no encontrado: {item.id_producto}")
        if producto.id_tienda != offer.id_tienda:
            raise ValueError(f"El producto {item.id_producto} no pertenece a la tienda de la oferta.")
        if offer.tipo == "PRICE_OVERRIDE" and item.precio_override is None:
            raise ValueError("Las ofertas PRICE_OVERRIDE requieren precio_override por producto.")

        relation = (
            db.query(OfertaProducto)
            .filter(
                OfertaProducto.id_oferta == offer.id_oferta,
                OfertaProducto.id_producto == item.id_producto,
            )
            .first()
        )
        if relation:
            relation.precio_override = item.precio_override
            relation.activo = item.activo
        else:
            relation = OfertaProducto(
                id_oferta=offer.id_oferta,
                id_producto=item.id_producto,
                precio_override=item.precio_override,
                activo=item.activo,
            )
            db.add(relation)
        attached.append(relation)

    db.commit()
    for relation in attached:
        db.refresh(relation)
    return attached


def attach_categories_to_offer(db: Session, offer: Oferta, payload: OfferCategoryAttach) -> list[OfertaCategoria]:
    _ensure_offer_categories_feature_ready(db)
    if offer.tipo != "PERCENT":
        raise ValueError("Solo las ofertas PERCENT pueden asociarse a categorias.")

    attached: list[OfertaCategoria] = []
    for item in payload.categorias:
        categoria = db.query(Categoria).filter(Categoria.id_categoria == item.id_categoria).first()
        if not categoria:
            raise ValueError(f"Categoria no encontrada: {item.id_categoria}")
        if categoria.id_tienda != offer.id_tienda:
            raise ValueError(f"La categoria {item.id_categoria} no pertenece a la tienda de la oferta.")

        relation = (
            db.query(OfertaCategoria)
            .filter(
                OfertaCategoria.id_oferta == offer.id_oferta,
                OfertaCategoria.id_categoria == item.id_categoria,
            )
            .first()
        )
        if relation:
            relation.activo = item.activo
        else:
            relation = OfertaCategoria(
                id_oferta=offer.id_oferta,
                id_categoria=item.id_categoria,
                activo=item.activo,
            )
            db.add(relation)
        attached.append(relation)

    db.commit()
    for relation in attached:
        db.refresh(relation)
    return attached


def detach_product_from_offer(db: Session, offer: Oferta, id_producto: UUID) -> bool:
    relation = (
        db.query(OfertaProducto)
        .filter(
            OfertaProducto.id_oferta == offer.id_oferta,
            OfertaProducto.id_producto == id_producto,
        )
        .first()
    )
    if not relation:
        return False
    db.delete(relation)
    db.commit()
    return True


def list_offer_products(db: Session, offer: Oferta) -> list[OfertaProducto]:
    return (
        db.query(OfertaProducto)
        .filter(OfertaProducto.id_oferta == offer.id_oferta)
        .order_by(OfertaProducto.id_producto.asc())
        .all()
    )


def detach_category_from_offer(db: Session, offer: Oferta, id_categoria: UUID) -> bool:
    _ensure_offer_categories_feature_ready(db)
    relation = (
        db.query(OfertaCategoria)
        .filter(
            OfertaCategoria.id_oferta == offer.id_oferta,
            OfertaCategoria.id_categoria == id_categoria,
        )
        .first()
    )
    if not relation:
        return False
    db.delete(relation)
    db.commit()
    return True


def list_offer_categories(db: Session, offer: Oferta) -> list[OfertaCategoria]:
    if not _offer_categories_table_exists(db):
        return []
    return (
        db.query(OfertaCategoria)
        .filter(OfertaCategoria.id_oferta == offer.id_oferta)
        .order_by(OfertaCategoria.id_categoria.asc())
        .all()
    )


def get_active_offers_for_tienda(db: Session, id_tienda: UUID, now: datetime | None = None) -> list[Oferta]:
    now = now or datetime.utcnow()
    return (
        db.query(Oferta)
        .filter(
            Oferta.id_tienda == id_tienda,
            Oferta.activa.is_(True),
            or_(Oferta.fecha_inicio.is_(None), Oferta.fecha_inicio <= now),
            or_(Oferta.fecha_fin.is_(None), Oferta.fecha_fin >= now),
        )
        .order_by(Oferta.prioridad.desc(), Oferta.created_at.desc())
        .all()
    )


def _calculate_final_price(
    *,
    base_price: Decimal,
    offer_type: str,
    porcentaje: Decimal | None,
    precio_override: Decimal | None,
) -> tuple[Decimal | None, Decimal | None]:
    if offer_type == "PERCENT":
        if porcentaje is None:
            return None, None
        final_price = _round_money(base_price * (Decimal("1") - (porcentaje / Decimal("100"))))
        return final_price, _round_money(porcentaje)
    if offer_type == "PRICE_OVERRIDE":
        if precio_override is None:
            return None, None
        final_price = _round_money(precio_override)
        if base_price == 0:
            return final_price, None
        pct = _round_money(((base_price - final_price) / base_price) * Decimal("100"))
        return final_price, pct
    return None, None


def _is_better_candidate(current: dict[str, Any] | None, candidate: dict[str, Any]) -> bool:
    if current is None:
        return True
    if candidate["prioridad"] != current["prioridad"]:
        return candidate["prioridad"] > current["prioridad"]
    if candidate["precio_final"] != current["precio_final"]:
        return candidate["precio_final"] < current["precio_final"]
    return candidate["scope_rank"] > current["scope_rank"]


def apply_offer_to_products(
    db: Session,
    *,
    id_tienda: UUID,
    products: list[dict[str, Any]],
    now: datetime | None = None,
) -> tuple[list[dict[str, Any]], list[Oferta]]:
    context = load_offer_pricing_context(
        db=db,
        id_tienda=id_tienda,
        products=products,
        now=now,
    )
    return apply_offer_pricing_context(products=products, context=context), context["active_offers"]


def load_offer_pricing_context(
    db: Session,
    *,
    id_tienda: UUID,
    products: list[dict[str, Any]],
    now: datetime | None = None,
) -> dict[str, Any]:
    """Load offer rules once so products and variants can reuse them."""
    if not products:
        return {"active_offers": [], "product_rows": [], "category_rows": []}

    now = now or datetime.utcnow()
    product_ids = list({UUID(str(item["id"])) for item in products if item.get("id")})
    if not product_ids:
        return {"active_offers": [], "product_rows": [], "category_rows": []}

    target_rows = db.execute(
        select(
            Oferta,
            OfertaProducto.id_producto,
            OfertaProducto.precio_override,
            OfertaCategoria.id_categoria,
        )
        .outerjoin(
            OfertaProducto,
            and_(
                OfertaProducto.id_oferta == Oferta.id_oferta,
                OfertaProducto.activo.is_(True),
            ),
        )
        .outerjoin(
            OfertaCategoria,
            and_(
                OfertaCategoria.id_oferta == Oferta.id_oferta,
                OfertaCategoria.activo.is_(True),
            ),
        )
        .where(
            Oferta.id_tienda == id_tienda,
            Oferta.activa.is_(True),
            or_(Oferta.fecha_inicio.is_(None), Oferta.fecha_inicio <= now),
            or_(Oferta.fecha_fin.is_(None), Oferta.fecha_fin >= now),
        )
        .order_by(Oferta.prioridad.desc(), Oferta.created_at.desc())
    ).all()

    active_offers: list[Oferta] = []
    seen_offer_ids = set()
    product_rows = []
    seen_product_targets = set()
    category_rows = []
    seen_category_targets = set()
    for offer, product_id, price_override, category_id in target_rows:
        if offer.id_oferta not in seen_offer_ids:
            active_offers.append(offer)
            seen_offer_ids.add(offer.id_oferta)
        if product_id is not None:
            product_key = (offer.id_oferta, product_id)
            if product_key not in seen_product_targets:
                product_rows.append(
                    (
                        product_id,
                        offer.id_oferta,
                        offer.nombre,
                        offer.tipo,
                        offer.porcentaje,
                        offer.prioridad,
                        offer.banner_url,
                        offer.badge_text,
                        offer.fecha_inicio,
                        offer.fecha_fin,
                        price_override,
                    ),
                )
                seen_product_targets.add(product_key)
        if category_id is not None:
            category_key = (offer.id_oferta, category_id)
            if category_key not in seen_category_targets:
                category_rows.append(
                    (
                        category_id,
                        offer.id_oferta,
                        offer.nombre,
                        offer.tipo,
                        offer.porcentaje,
                        offer.prioridad,
                        offer.banner_url,
                        offer.badge_text,
                        offer.fecha_inicio,
                        offer.fecha_fin,
                    ),
                )
                seen_category_targets.add(category_key)

    return {
        "active_offers": active_offers,
        "product_rows": product_rows,
        "category_rows": category_rows,
    }


def apply_offer_pricing_context(
    *,
    products: list[dict[str, Any]],
    context: dict[str, Any],
) -> list[dict[str, Any]]:
    """Apply preloaded offer rules without additional database queries."""
    active_offers = context["active_offers"]
    product_rows = context["product_rows"]
    category_rows = context["category_rows"]
    if not active_offers:
        for item in products:
            original = _round_money(item["precio"])
            item["precio_original"] = float(original)
            item["precio_final"] = float(original)
            item["descuento_pct"] = None
            item["badge_text"] = None
            item["id_oferta_aplicada"] = None
        return products

    products_by_id: dict[UUID, list[tuple[int, dict[str, Any]]]] = {}
    for item_index, item in enumerate(products):
        if item.get("id"):
            products_by_id.setdefault(UUID(str(item["id"])), []).append((item_index, item))
    winners: dict[int, dict[str, Any]] = {}
    for (
        id_producto,
        id_oferta,
        nombre,
        tipo,
        porcentaje,
        prioridad,
        banner_url,
        badge_text,
        fecha_inicio,
        fecha_fin,
        precio_override,
    ) in product_rows:
        for item_index, product in products_by_id.get(id_producto, []):
            base_price = _round_money(product["precio"])
            final_price, discount_pct = _calculate_final_price(
                base_price=base_price,
                offer_type=tipo,
                porcentaje=porcentaje,
                precio_override=precio_override,
            )
            if final_price is None:
                continue
            candidate = {
                "id_oferta": id_oferta,
                "nombre": nombre,
                "tipo": tipo,
                "porcentaje": porcentaje,
                "prioridad": prioridad,
                "banner_url": banner_url,
                "badge_text": badge_text,
                "fecha_inicio": fecha_inicio,
                "fecha_fin": fecha_fin,
                "precio_final": final_price,
                "descuento_pct": discount_pct,
                "scope_rank": 3,
            }
            current = winners.get(item_index)
            if _is_better_candidate(current, candidate):
                winners[item_index] = candidate

    category_offers_by_category: dict[UUID, list[tuple[Any, ...]]] = {}
    for row in category_rows:
        category_offers_by_category.setdefault(row[0], []).append(row)

    for item_index, item in enumerate(products):
        categoria_id = item.get("categoria_id")
        if not categoria_id:
            continue
        for (
            id_categoria,
            id_oferta,
            nombre,
            tipo,
            porcentaje,
            prioridad,
            banner_url,
            badge_text,
            fecha_inicio,
            fecha_fin,
        ) in category_offers_by_category.get(UUID(str(categoria_id)), []):
            if tipo != "PERCENT":
                continue
            base_price = _round_money(item["precio"])
            final_price, discount_pct = _calculate_final_price(
                base_price=base_price,
                offer_type=tipo,
                porcentaje=porcentaje,
                precio_override=None,
            )
            if final_price is None:
                continue
            candidate = {
                "id_oferta": id_oferta,
                "nombre": nombre,
                "tipo": tipo,
                "porcentaje": porcentaje,
                "prioridad": prioridad,
                "banner_url": banner_url,
                "badge_text": badge_text,
                "fecha_inicio": fecha_inicio,
                "fecha_fin": fecha_fin,
                "precio_final": final_price,
                "descuento_pct": discount_pct,
                "scope_rank": 2,
            }
            current = winners.get(item_index)
            if _is_better_candidate(current, candidate):
                winners[item_index] = candidate

    offers_with_category_target = {
        row[1] for row in category_rows
    }
    global_offers = [
        offer for offer in active_offers
        if offer.id_oferta not in {row[1] for row in product_rows}
        and offer.id_oferta not in offers_with_category_target
    ]

    for item_index, item in enumerate(products):
        for offer in global_offers:
            base_price = _round_money(item["precio"])
            final_price, discount_pct = _calculate_final_price(
                base_price=base_price,
                offer_type=offer.tipo,
                porcentaje=offer.porcentaje,
                precio_override=None,
            )
            if final_price is None:
                continue
            candidate = {
                "id_oferta": offer.id_oferta,
                "nombre": offer.nombre,
                "tipo": offer.tipo,
                "porcentaje": offer.porcentaje,
                "prioridad": offer.prioridad,
                "banner_url": offer.banner_url,
                "badge_text": offer.badge_text,
                "fecha_inicio": offer.fecha_inicio,
                "fecha_fin": offer.fecha_fin,
                "precio_final": final_price,
                "descuento_pct": discount_pct,
                "scope_rank": 1,
            }
            current = winners.get(item_index)
            if _is_better_candidate(current, candidate):
                winners[item_index] = candidate

    for item_index, item in enumerate(products):
        base_price = _round_money(item["precio"])
        winner = winners.get(item_index)
        item["precio_original"] = float(base_price)
        item["precio_final"] = float(winner["precio_final"]) if winner else float(base_price)
        item["descuento_pct"] = float(winner["descuento_pct"]) if winner and winner["descuento_pct"] is not None else None
        item["badge_text"] = winner["badge_text"] if winner else None
        item["id_oferta_aplicada"] = str(winner["id_oferta"]) if winner else None

    return products
