from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from sqlalchemy import select

from core.database import SessionLocal
from core.security import decode_token
from crud.crud_audit import create_audit_log
from models.tenant import Usuario


class AuditMiddleware(BaseHTTPMiddleware):
    TRACKED_METHODS = {"POST", "PUT", "DELETE"}
    INCLUDED_PREFIXES = ("/api/catalog", "/api/admin", "/api/sales", "/api/tenant")
    EXCLUDED_PATHS = {"/openapi.json"}
    EXCLUDED_PREFIXES = ("/docs", "/redoc", "/api/auth/login")

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        if request.method not in self.TRACKED_METHODS:
            return response

        path = request.url.path
        if path in self.EXCLUDED_PATHS or path.startswith(self.EXCLUDED_PREFIXES):
            return response
        if not path.startswith(self.INCLUDED_PREFIXES):
            return response

        try:
            self._log_request(request)
        except Exception:
            # Nunca romper el flujo principal por auditoría.
            pass

        return response

    def _log_request(self, request: Request) -> None:
        token = self._extract_bearer_token(request)
        id_usuario: UUID | None = None
        email_usuario: str | None = None
        id_tienda: UUID | None = None

        if token:
            try:
                payload = decode_token(token)
                email_usuario = payload.get("sub")
                raw_id_tienda = payload.get("id_tienda")
                if raw_id_tienda:
                    try:
                        id_tienda = UUID(str(raw_id_tienda))
                    except ValueError:
                        id_tienda = None
            except HTTPException:
                payload = None
            else:
                if email_usuario:
                    db_lookup = SessionLocal()
                    try:
                        stmt = select(Usuario).where(Usuario.email == email_usuario)
                        user = db_lookup.execute(stmt).scalar_one_or_none()
                        if user:
                            id_usuario = user.id_usuario
                            id_tienda = user.id_tienda or id_tienda
                            email_usuario = user.email
                    finally:
                        db_lookup.close()

        db = SessionLocal()
        try:
            create_audit_log(
                db=db,
                id_usuario=id_usuario,
                email_usuario=email_usuario,
                id_tienda=id_tienda,
                accion=f"{request.method}_{request.url.path}",
                endpoint=request.url.path,
                metodo_http=request.method,
                ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )
        finally:
            db.close()

    @staticmethod
    def _extract_bearer_token(request: Request) -> str | None:
        auth_header = request.headers.get("authorization")
        if not auth_header:
            return None

        parts = auth_header.split(" ", 1)
        if len(parts) != 2:
            return None

        scheme, token = parts
        if scheme.lower() != "bearer" or not token.strip():
            return None

        return token.strip()
