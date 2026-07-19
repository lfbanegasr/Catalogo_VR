from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import get_current_tienda_id, get_current_user, require_role
from schemas.sales_schema import VentaCreate, VentaOut
from crud.crud_sales import create_venta, list_ventas, StockInsuficienteError
from models.tenant import Usuario

router = APIRouter(prefix="/api/sales", tags=["Sales"])


def _resolve_target_tienda_id(
    *,
    current_user: Usuario,
    current_tienda_id: UUID,
    requested_tienda_id: UUID | None,
) -> UUID:
    if current_user.rol == "superadmin":
        return requested_tienda_id or current_tienda_id
    return current_tienda_id


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

        return VentaOut(
            id_venta=venta.id_venta,
            id_tienda=venta.id_tienda,
            id_cliente=venta.id_cliente,
            fecha_venta=venta.fecha_venta,
            estado=venta.estado,
            total_venta=venta.total_venta,
            detalles=venta.detalles or [],
        )
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
        VentaOut(
            id_venta=v.id_venta,
            id_tienda=v.id_tienda,
            id_cliente=v.id_cliente,
            fecha_venta=v.fecha_venta,
            estado=v.estado,
            total_venta=v.total_venta,
            detalles=[],
        )
        for v in ventas
    ]
