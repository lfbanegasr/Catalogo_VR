from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import get_current_user, require_role
from crud.crud_audit import list_audit_logs
from crud.crud_public_events import list_public_events
from models.tenant import Usuario
from schemas.audit_schema import AuditLogOut
from schemas.public_event_schema import PublicEventOut

router = APIRouter(prefix="/api/admin", tags=["Admin Audit"])


@router.get(
    "/audit-logs",
    response_model=list[AuditLogOut],
    dependencies=[Depends(require_role("superadmin"))],
)
def get_audit_logs(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    evento: str | None = Query(None),
    exito: bool | None = Query(None),
    rol: str | None = Query(None),
    fecha_inicio: str | None = Query(None),
    fecha_fin: str | None = Query(None),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant_filter = None if current_user.rol == "superadmin" else current_user.id_tienda
    return list_audit_logs(
        db=db,
        limit=limit,
        offset=offset,
        evento=evento,
        exito=exito,
        id_tienda=tenant_filter,
        rol_usuario=rol,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
    )


@router.get(
    "/public-events",
    response_model=list[PublicEventOut],
    dependencies=[Depends(require_role("superadmin"))],
)
def get_public_events(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    evento: str | None = Query(None),
    db: Session = Depends(get_db),
):
    return list_public_events(db=db, limit=limit, offset=offset, evento=evento)
