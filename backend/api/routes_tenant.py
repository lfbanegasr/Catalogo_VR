from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import get_current_tienda_id, require_role
from crud.crud_tenant import create_tienda, create_usuario, list_tiendas, list_usuarios
from schemas.tenant_schema import TiendaCreate, TiendaOut, UsuarioCreate, UsuarioOut

router = APIRouter(prefix="/api/tenant", tags=["Tenant"])


@router.post(
    "/tiendas",
    response_model=TiendaOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("superadmin"))],
)
def api_create_tienda(payload: TiendaCreate, db: Session = Depends(get_db)):
    try:
        return create_tienda(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/tiendas",
    response_model=List[TiendaOut],
    dependencies=[Depends(require_role("superadmin"))],
)
def api_list_tiendas(db: Session = Depends(get_db)):
    return list_tiendas(db)


@router.post(
    "/usuarios",
    response_model=UsuarioOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("superadmin"))],
)
def api_create_usuario(payload: UsuarioCreate, db: Session = Depends(get_db)):
    try:
        return create_usuario(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/usuarios", response_model=List[UsuarioOut], dependencies=[Depends(require_role("superadmin"))])
def api_list_usuarios(
    id_tienda: UUID = Depends(get_current_tienda_id),
    db: Session = Depends(get_db),
):
    return list_usuarios(db, id_tienda)
