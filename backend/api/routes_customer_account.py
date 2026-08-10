from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import create_access_token, decode_token
from crud.crud_catalog import get_tienda_by_slug
from crud.crud_customer_account import (
    authenticate_customer,
    list_customer_orders,
    register_customer,
)
from models.sales import Cliente
from schemas.customer_account_schema import (
    CustomerLoginIn,
    CustomerOrderOut,
    CustomerProfileOut,
    CustomerRegisterIn,
    CustomerTokenOut,
)

router = APIRouter(prefix="/api/public/catalog", tags=["Customer Account"])
bearer = HTTPBearer(auto_error=False)


def _active_store(db: Session, slug: str):
    store = get_tienda_by_slug(db, slug)
    if not store or not store.activa:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    return store


def get_current_customer(
    slug: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Cliente:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sesion de cliente invalida o expirada",
    )
    if credentials is None:
        raise unauthorized
    payload = decode_token(credentials.credentials)
    subject = str(payload.get("sub") or "")
    if payload.get("rol") != "cliente" or not subject.startswith("customer:"):
        raise unauthorized
    store = _active_store(db, slug)
    if str(payload.get("id_tienda")) != str(store.id_tienda):
        raise unauthorized
    customer = db.get(Cliente, subject.removeprefix("customer:"))
    if not customer or customer.id_tienda != store.id_tienda or not customer.password_hash:
        raise unauthorized
    return customer


def get_optional_current_customer(
    slug: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Cliente | None:
    if credentials is None:
        return None
    try:
        return get_current_customer(slug=slug, credentials=credentials, db=db)
    except HTTPException:
        return None


def _token_for(customer: Cliente) -> CustomerTokenOut:
    token = create_access_token(
        sub=f"customer:{customer.id_cliente}",
        id_tienda=str(customer.id_tienda),
        rol="cliente",
    )
    return CustomerTokenOut(access_token=token, customer=customer)


@router.post("/{slug}/customers/register", response_model=CustomerTokenOut, status_code=201)
def customer_register(slug: str, payload: CustomerRegisterIn, db: Session = Depends(get_db)):
    store = _active_store(db, slug)
    try:
        customer = register_customer(db, id_tienda=store.id_tienda, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _token_for(customer)


@router.post("/{slug}/customers/login", response_model=CustomerTokenOut)
def customer_login(slug: str, payload: CustomerLoginIn, db: Session = Depends(get_db)):
    store = _active_store(db, slug)
    customer = authenticate_customer(
        db,
        id_tienda=store.id_tienda,
        email=payload.email,
        password=payload.password,
    )
    if customer is None:
        raise HTTPException(status_code=401, detail="Correo o contrasena incorrectos")
    return _token_for(customer)


@router.get("/{slug}/customers/me", response_model=CustomerProfileOut)
def customer_me(customer: Cliente = Depends(get_current_customer)):
    return customer


@router.get("/{slug}/customers/me/orders", response_model=list[CustomerOrderOut])
def customer_orders(
    customer: Cliente = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    orders = list_customer_orders(
        db,
        id_tienda=customer.id_tienda,
        id_cliente=customer.id_cliente,
    )
    return [
        CustomerOrderOut(
            codigo_seguimiento=order.codigo_seguimiento,
            estado=order.estado,
            fecha_pedido=order.fecha_venta,
            fecha_actualizacion=order.fecha_actualizacion or order.fecha_venta,
            metodo_entrega=order.metodo_entrega,
            total_venta=order.total_venta,
            productos=[
                {
                    "nombre": detail.producto.nombre if detail.producto else "Producto",
                    "variante": detail.nombre_variante,
                    "cantidad": detail.cantidad,
                }
                for detail in order.detalles
            ],
        )
        for order in orders
    ]