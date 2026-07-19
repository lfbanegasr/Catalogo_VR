from fastapi import APIRouter, Depends, HTTPException

from core.deps import get_current_user
from core.database import get_db
from crud.crud_tenant import update_tienda_theme
from models.tenant import Usuario
from schemas.tenant_schema import TiendaOut, TiendaThemeUpdate, UsuarioOut
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api", tags=["Me"])


@router.get("/me", response_model=UsuarioOut)
def get_me(current_user: Usuario = Depends(get_current_user)):
    return current_user


@router.patch("/me/theme", response_model=TiendaOut)
def update_my_theme(
    payload: TiendaThemeUpdate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Solo admin puede actualizar el theme de su tienda")
    tienda = update_tienda_theme(db=db, id_tienda=current_user.id_tienda, payload=payload)
    if not tienda:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    return tienda
