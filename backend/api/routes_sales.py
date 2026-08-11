from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import get_current_tienda_id, get_current_user, require_role
from schemas.sales_schema import (
    ClienteAdminOut,
    ClienteUpdate,
    VentaCreate,
    VentaEstadoUpdate,
    VentaOut,
)
from crud.crud_sales import (
    create_venta,
    get_cliente_detail,
    list_ventas,
    list_clientes,
    get_venta,
    update_venta_estado,
    update_cliente,
    get_dashboard_metrics,
    StockInsuficienteError,
)
from models.tenant import Tienda, Usuario

router = APIRouter(prefix="/api/sales", tags=["Sales"])
def _invalidate_public_catalog(db: Session, id_tienda: UUID) -> None:
    store = db.query(Tienda).filter(Tienda.id_tienda == id_tienda).first()
    if store is None:
        return
    from api.routes_public_catalog import invalidate_public_catalog_cache

    invalidate_public_catalog_cache(store.slug)




def _venta_out(venta) -> VentaOut:
    return VentaOut.model_validate(venta)


def _resolve_target_tienda_id(
    *,
    current_user: Usuario,
    current_tienda_id: UUID,
    requested_tienda_id: UUID | None,
) -> UUID:
    if current_user.rol == "superadmin":
        return requested_tienda_id or current_tienda_id
    return current_tienda_id


@router.get(
    "/clientes",
    response_model=List[ClienteAdminOut],
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_list_clientes(
    search: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
    id_tienda: UUID = Depends(get_current_tienda_id),
    current_user: Usuario = Depends(get_current_user),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
):
    target_tienda_id = _resolve_target_tienda_id(
        current_user=current_user,
        current_tienda_id=id_tienda,
        requested_tienda_id=id_tienda_target,
    )
    return list_clientes(
        db,
        id_tienda=target_tienda_id,
        search=search,
        limit=limit,
    )


@router.get(
    "/clientes/{id_cliente}",
    response_model=ClienteAdminOut,
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_get_cliente(
    id_cliente: UUID,
    db: Session = Depends(get_db),
    id_tienda: UUID = Depends(get_current_tienda_id),
    current_user: Usuario = Depends(get_current_user),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
):
    target_tienda_id = _resolve_target_tienda_id(
        current_user=current_user,
        current_tienda_id=id_tienda,
        requested_tienda_id=id_tienda_target,
    )
    cliente = get_cliente_detail(
        db,
        id_tienda=target_tienda_id,
        id_cliente=id_cliente,
    )
    if cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente


@router.patch(
    "/clientes/{id_cliente}",
    response_model=ClienteAdminOut,
    dependencies=[Depends(require_role("superadmin", "admin"))],
)
def api_update_cliente(
    id_cliente: UUID,
    payload: ClienteUpdate,
    db: Session = Depends(get_db),
    id_tienda: UUID = Depends(get_current_tienda_id),
    current_user: Usuario = Depends(get_current_user),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
):
    target_tienda_id = _resolve_target_tienda_id(
        current_user=current_user,
        current_tienda_id=id_tienda,
        requested_tienda_id=id_tienda_target,
    )
    cliente = update_cliente(
        db,
        id_tienda=target_tienda_id,
        id_cliente=id_cliente,
        payload=payload,
    )
    if cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente


@router.post(
    "/ventas",
    response_model=VentaOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_create_venta(
    payload: VentaCreate,
    db: Session = Depends(get_db),
    id_tienda: UUID = Depends(get_current_tienda_id),
    current_user: Usuario = Depends(get_current_user),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
):
    try:
        target_tienda_id = _resolve_target_tienda_id(
            current_user=current_user,
            current_tienda_id=id_tienda,
            requested_tienda_id=id_tienda_target,
        )
        venta = create_venta(db=db, id_tienda=target_tienda_id, payload=payload)
        _invalidate_public_catalog(db, target_tienda_id)

        return _venta_out(venta)
    except StockInsuficienteError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/ventas",
    response_model=List[VentaOut],
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_list_ventas(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    id_tienda: UUID = Depends(get_current_tienda_id),
    current_user: Usuario = Depends(get_current_user),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
):
    target_tienda_id = _resolve_target_tienda_id(
        current_user=current_user,
        current_tienda_id=id_tienda,
        requested_tienda_id=id_tienda_target,
    )
    ventas = list_ventas(db=db, id_tienda=target_tienda_id, limit=limit, offset=offset)

    return [
        _venta_out(v)
        for v in ventas
    ]


@router.get(
    "/ventas/{id_venta}",
    response_model=VentaOut,
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_get_venta(
    id_venta: UUID,
    db: Session = Depends(get_db),
    id_tienda: UUID = Depends(get_current_tienda_id),
    current_user: Usuario = Depends(get_current_user),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
):
    target_tienda_id = _resolve_target_tienda_id(
        current_user=current_user,
        current_tienda_id=id_tienda,
        requested_tienda_id=id_tienda_target,
    )
    venta = get_venta(db=db, id_tienda=target_tienda_id, id_venta=id_venta)
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    return _venta_out(venta)


@router.patch(
    "/ventas/{id_venta}/estado",
    response_model=VentaOut,
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_update_venta_estado(
    id_venta: UUID,
    payload: VentaEstadoUpdate,
    db: Session = Depends(get_db),
    id_tienda: UUID = Depends(get_current_tienda_id),
    current_user: Usuario = Depends(get_current_user),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
):
    target_tienda_id = _resolve_target_tienda_id(
        current_user=current_user,
        current_tienda_id=id_tienda,
        requested_tienda_id=id_tienda_target,
    )
    try:
        venta = update_venta_estado(
            db=db,
            id_tienda=target_tienda_id,
            id_venta=id_venta,
            nuevo_estado=payload.estado,
            id_usuario=current_user.id_usuario,
            nota=payload.nota,
        )
        _invalidate_public_catalog(db, target_tienda_id)
        return _venta_out(venta)
    except StockInsuficienteError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/metrics",
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def api_get_metrics(
    db: Session = Depends(get_db),
    id_tienda: UUID = Depends(get_current_tienda_id),
    current_user: Usuario = Depends(get_current_user),
    id_tienda_target: UUID | None = Query(default=None, alias="id_tienda"),
):
    target_tienda_id = _resolve_target_tienda_id(
        current_user=current_user,
        current_tienda_id=id_tienda,
        requested_tienda_id=id_tienda_target,
    )
    return get_dashboard_metrics(db=db, id_tienda=target_tienda_id)
