from __future__ import annotations

from sqlalchemy.orm import Session

from models.public_event import PublicEvent


def create_public_event(
    db: Session,
    *,
    id_tienda,
    evento: str,
    id_producto=None,
    ip: str | None = None,
    user_agent: str | None = None,
) -> PublicEvent:
    item = PublicEvent(
        id_tienda=id_tienda,
        id_producto=id_producto,
        evento=evento,
        ip=ip,
        user_agent=user_agent,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_public_events(
    db: Session,
    *,
    limit: int = 50,
    offset: int = 0,
    id_tienda=None,
    evento: str | None = None,
) -> list[PublicEvent]:
    query = db.query(PublicEvent)
    if id_tienda is not None:
        query = query.filter(PublicEvent.id_tienda == id_tienda)
    if evento is not None:
        query = query.filter(PublicEvent.evento == evento)

    return query.order_by(PublicEvent.fecha.desc()).offset(offset).limit(limit).all()
