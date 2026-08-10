from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from core.security import hash_password, verify_password
from models.sales import Cliente, DetalleVenta, Venta


def normalize_customer_email(value: str) -> str:
    return str(value or "").strip().lower()


def normalize_customer_phone(value: str | None) -> str | None:
    digits = "".join(character for character in str(value or "") if character.isdigit())
    return digits or None


def get_customer_by_email(db: Session, *, id_tienda, email: str) -> Cliente | None:
    return (
        db.query(Cliente)
        .filter(
            Cliente.id_tienda == id_tienda,
            func.lower(Cliente.email) == normalize_customer_email(email),
        )
        .first()
    )


def register_customer(db: Session, *, id_tienda, payload) -> Cliente:
    email = normalize_customer_email(payload.email)
    customer = get_customer_by_email(db, id_tienda=id_tienda, email=email)
    if customer and customer.password_hash:
        raise ValueError("Ya existe una cuenta con este correo.")
    if customer is None:
        customer = Cliente(
            id_tienda=id_tienda,
            nombre_completo=payload.nombre_completo.strip(),
            email=email,
            telefono=normalize_customer_phone(payload.telefono),
        )
        db.add(customer)
    else:
        customer.nombre_completo = payload.nombre_completo.strip()
        customer.email = email
        if payload.telefono:
            customer.telefono = normalize_customer_phone(payload.telefono)
    customer.password_hash = hash_password(payload.password)
    db.commit()
    db.refresh(customer)
    return customer


def authenticate_customer(db: Session, *, id_tienda, email: str, password: str) -> Cliente | None:
    customer = get_customer_by_email(db, id_tienda=id_tienda, email=email)
    if not customer or not customer.password_hash:
        return None
    return customer if verify_password(password, customer.password_hash) else None


def list_customer_orders(db: Session, *, id_tienda, id_cliente) -> list[Venta]:
    return (
        db.query(Venta)
        .options(
            joinedload(Venta.detalles).joinedload(DetalleVenta.producto),
            joinedload(Venta.historial_estados),
        )
        .filter(Venta.id_tienda == id_tienda, Venta.id_cliente == id_cliente)
        .order_by(Venta.fecha_venta.desc())
        .all()
    )