from __future__ import annotations

from typing import Callable
from uuid import UUID

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import decode_token
from models.tenant import Tienda, Usuario

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> Usuario:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token)
        email: str | None = payload.get("sub")
        if not email:
            raise credentials_exception
    except HTTPException:
        raise credentials_exception

    stmt = select(Usuario).where(Usuario.email == email)
    user = db.execute(stmt).scalar_one_or_none()
    if not user:
        raise credentials_exception
    if not user.activo:
        raise credentials_exception

    return user


def require_roles(*roles: str) -> Callable:
    def _dep(user: Usuario = Depends(get_current_user)) -> Usuario:
        if roles and user.rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No autorizado (rol insuficiente)",
            )
        return user

    return _dep


def require_role(*roles: str) -> Callable:
    return require_roles(*roles)


def get_current_tienda_id(user: Usuario = Depends(get_current_user)) -> UUID:
    return user.id_tienda


def get_current_tenant(
    request: Request,
    db: Session = Depends(get_db),
) -> Tienda:
    # 1. Intentar flujo administrativo (B2B): buscar token JWT
    auth_header = request.headers.get("Authorization")
    id_tienda = None

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = decode_token(token)
            id_tienda = payload.get("id_tienda")
        except HTTPException:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token invalido o expirado",
                headers={"WWW-Authenticate": "Bearer"},
            )

    tienda = None

    # Si obtuvimos el id_tienda del token, buscamos por ID
    if id_tienda:
        try:
            tienda_uuid = UUID(id_tienda) if isinstance(id_tienda, str) else id_tienda
            stmt = select(Tienda).where(Tienda.id_tienda == tienda_uuid)
            tienda = db.execute(stmt).scalar_one_or_none()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato de id_tienda invalido en el token"
            )
    else:
        # 2. Intentar flujo público (B2C): buscar slug
        slug = None

        # a) Buscar en los path params de la ruta
        slug = request.path_params.get("slug")

        # b) Si no, en cabeceras personalizadas
        if not slug:
            slug = request.headers.get("X-Tenant") or request.headers.get("X-Tenant-Slug")

        # c) Si no, en query params
        if not slug:
            slug = request.query_params.get("tenant") or request.query_params.get("slug")

        # d) Si no, extraer del subdominio del host
        if not slug and request.base_url.host:
            host_parts = request.base_url.host.split(".")
            if len(host_parts) > 2:
                subdomain = host_parts[0]
                if subdomain not in ("www", "api", "admin", "localhost"):
                    slug = subdomain

        if not slug:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo identificar el tenant (slug o token ausente)"
            )

        stmt = select(Tienda).where(Tienda.slug == slug)
        tienda = db.execute(stmt).scalar_one_or_none()

    if not tienda:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tienda no encontrada"
        )

    if not tienda.activa:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tienda inactiva"
        )

    return tienda
