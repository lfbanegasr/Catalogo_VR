from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import get_current_user, require_role
from crud.crud_tenant import (
    create_tienda,
    create_usuario,
    get_tienda_by_id,
    list_tiendas,
    list_usuarios,
    reset_usuario_password,
    update_tienda,
    update_tienda_theme,
    update_usuario,
)
from schemas.tenant_schema import (
    MyStoreUpdate,
    TiendaCreate,
    TiendaThemeUpdate,
    TiendaOut,
    TiendaUpdate,
    UserResetPasswordIn,
    UsuarioCreate,
    UsuarioOut,
    UsuarioUpdate,
)
from models.tenant import Usuario

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.post(
    "/tiendas",
    response_model=TiendaOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("superadmin"))],
)
def admin_create_tienda(
    payload: TiendaCreate,
    db: Session = Depends(get_db),
):
    try:
        return create_tienda(db=db, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/tiendas",
    response_model=list[TiendaOut],
    dependencies=[Depends(require_role("superadmin"))],
)
def admin_list_tiendas(db: Session = Depends(get_db)):
    return list_tiendas(db)


@router.patch(
    "/tiendas/{id_tienda}",
    response_model=TiendaOut,
    dependencies=[Depends(require_role("superadmin"))],
)
def admin_update_tienda(
    id_tienda: UUID,
    payload: TiendaUpdate,
    db: Session = Depends(get_db),
):
    try:
        updated = update_tienda(db=db, id_tienda=id_tienda, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    return updated


@router.patch(
    "/tiendas/{id_tienda}/theme",
    response_model=TiendaOut,
    dependencies=[Depends(require_role("superadmin"))],
)
def admin_set_tienda_theme(
    id_tienda: UUID,
    payload: TiendaThemeUpdate,
    db: Session = Depends(get_db),
):
    updated = update_tienda_theme(db=db, id_tienda=id_tienda, payload=payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    return updated


@router.get(
    "/my-store",
    response_model=TiendaOut,
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def admin_get_my_store(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    store = get_tienda_by_id(db=db, id_tienda=current_user.id_tienda)
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    return store


@router.patch(
    "/my-store",
    response_model=TiendaOut,
    dependencies=[Depends(require_role("superadmin", "admin", "empleado"))],
)
def admin_update_my_store(
    payload: MyStoreUpdate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    update_payload = TiendaUpdate(whatsapp_number=payload.whatsapp_number)
    updated = update_tienda(
        db=db,
        id_tienda=current_user.id_tienda,
        payload=update_payload,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    return updated


@router.post(
    "/users",
    response_model=UsuarioOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("superadmin"))],
)
def admin_create_user(
    payload: UsuarioCreate,
    db: Session = Depends(get_db),
):
    if payload.rol not in {"admin", "empleado"}:
        raise HTTPException(
            status_code=400,
            detail="En este endpoint solo se permite crear usuarios admin o empleado",
        )
    try:
        return create_usuario(db=db, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/users",
    response_model=list[UsuarioOut],
    dependencies=[Depends(require_role("superadmin"))],
)
def admin_list_users(
    tienda: UUID | None = Query(default=None),
    rol: str | None = Query(default=None),
    activo: bool | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return list_usuarios(db=db, id_tienda=tienda, rol=rol, activo=activo)


@router.patch(
    "/users/{id_usuario}",
    response_model=UsuarioOut,
    dependencies=[Depends(require_role("superadmin"))],
)
def admin_update_user(
    id_usuario: UUID,
    payload: UsuarioUpdate,
    db: Session = Depends(get_db),
):
    try:
        updated = update_usuario(db=db, id_usuario=id_usuario, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return updated


@router.post(
    "/users/{id_usuario}/reset-password",
    response_model=UsuarioOut,
    dependencies=[Depends(require_role("superadmin"))],
)
def admin_reset_user_password(
    id_usuario: UUID,
    payload: UserResetPasswordIn,
    db: Session = Depends(get_db),
):
    updated = reset_usuario_password(db=db, id_usuario=id_usuario, payload=payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return updated
