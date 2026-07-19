from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from models.audit_log import AuditLog

logger = logging.getLogger(__name__)


def create_audit_log(
    db: Session,
    id_usuario: UUID | None,
    email_usuario: str | None,
    id_tienda: UUID | None,
    accion: str,
    endpoint: str,
    metodo_http: str,
    ip: str | None,
    user_agent: str | None,
    *,
    evento: str = "request",
    exito: bool | None = None,
    email_intentado: str | None = None,
    detalle: str | None = None,
) -> AuditLog | None:
    try:
        log = AuditLog(
            id_usuario=id_usuario,
            email_usuario=email_usuario,
            id_tienda=id_tienda,
            evento=evento,
            exito=exito,
            email_intentado=email_intentado,
            detalle=detalle,
            accion=accion,
            endpoint=endpoint,
            metodo_http=metodo_http,
            ip=ip,
            user_agent=user_agent,
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log
    except Exception:
        db.rollback()
        logger.exception("No se pudo registrar audit log")
        return None


def list_audit_logs(
    db: Session,
    limit: int = 20,
    offset: int = 0,
    evento: str | None = None,
    exito: bool | None = None,
    id_tienda=None,
) -> list[AuditLog]:
    query = db.query(AuditLog)
    if id_tienda is not None:
        query = query.filter(AuditLog.id_tienda == id_tienda)
    if evento is not None:
        query = query.filter(AuditLog.evento == evento)
    if exito is not None:
        query = query.filter(AuditLog.exito == exito)

    return query.order_by(AuditLog.fecha_hora.desc()).offset(offset).limit(limit).all()
