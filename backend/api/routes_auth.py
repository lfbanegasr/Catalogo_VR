from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db
from core.email import send_email, smtp_is_configured
from core.security import create_access_token
from crud.crud_audit import create_audit_log
from crud.crud_auth import (
    authenticate_user,
    create_password_reset_token,
    get_user_by_email,
    reset_password_with_token,
)
from schemas.auth_schema import (
    ForgotPasswordIn,
    ForgotPasswordOut,
    LoginIn,
    MessageOut,
    ResetPasswordIn,
    TokenOut,
)

router = APIRouter(prefix="/api/auth", tags=["Auth"])


def _get_request_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first_ip = forwarded_for.split(",")[0].strip()
        if first_ip:
            return first_ip
    return request.client.host if request.client else None


def _register_auth_audit(
    *,
    db: Session,
    request: Request,
    endpoint: str,
    email_intentado: str | None,
    exito: bool,
    evento: str,
    id_usuario=None,
    email_usuario: str | None = None,
    id_tienda=None,
    detalle: str | None = None,
) -> None:
    create_audit_log(
        db=db,
        id_usuario=id_usuario,
        email_usuario=email_usuario,
        id_tienda=id_tienda,
        evento=evento,
        exito=exito,
        email_intentado=email_intentado,
        detalle=detalle,
        accion=f"{request.method}_{endpoint}",
        endpoint=endpoint,
        metodo_http=request.method,
        ip=_get_request_ip(request),
        user_agent=request.headers.get("user-agent"),
    )


def _build_login_token(*, email: str, password: str, db: Session, request: Request) -> TokenOut:
    endpoint = request.url.path
    user = authenticate_user(db, email=email, password=password)
    if not user:
        _register_auth_audit(
            db=db,
            request=request,
            endpoint=endpoint,
            email_intentado=email,
            exito=False,
            evento="login",
            detalle="invalid credentials",
        )
        raise HTTPException(status_code=401, detail="Credenciales invalidas")

    _register_auth_audit(
        db=db,
        request=request,
        endpoint=endpoint,
        email_intentado=email,
        exito=True,
        evento="login",
        id_usuario=user.id_usuario,
        email_usuario=user.email,
        id_tienda=user.id_tienda,
    )

    token = create_access_token(
        sub=user.email,
        id_tienda=str(user.id_tienda),
        rol=user.rol,
    )
    return TokenOut(access_token=token, user=user)


@router.post("/login", response_model=TokenOut)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    return _build_login_token(
        email=form_data.username,
        password=form_data.password,
        db=db,
        request=request,
    )


@router.post("/login-json", response_model=TokenOut)
def login_json(
    payload: LoginIn,
    request: Request,
    db: Session = Depends(get_db),
):
    return _build_login_token(
        email=payload.email,
        password=payload.password,
        db=db,
        request=request,
    )


@router.post("/forgot-password", response_model=ForgotPasswordOut)
def forgot_password(
    payload: ForgotPasswordIn,
    request: Request,
    db: Session = Depends(get_db),
):
    endpoint = request.url.path
    user = get_user_by_email(db=db, email=payload.email)
    generic_message = "Si el correo existe, te enviamos instrucciones para restablecer tu contrasena."

    if not user or not user.activo:
        _register_auth_audit(
            db=db,
            request=request,
            endpoint=endpoint,
            email_intentado=payload.email,
            exito=True,
            evento="forgot_password",
            detalle="generic response for unknown or inactive user",
        )
        return ForgotPasswordOut(message=generic_message)

    raw_token, _token = create_password_reset_token(db=db, user=user)
    reset_url = f"{settings.PASSWORD_RESET_URL_BASE}?token={raw_token}"

    if smtp_is_configured():
        try:
            send_email(
                to_email=user.email,
                subject="Restablece tu contrasena",
                text_body=(
                    "Recibimos una solicitud para restablecer tu contrasena.\n\n"
                    f"Abre este enlace:\n{reset_url}\n\n"
                    f"Este enlace vence en {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutos."
                ),
            )
        except Exception as exc:
            _register_auth_audit(
                db=db,
                request=request,
                endpoint=endpoint,
                email_intentado=payload.email,
                exito=False,
                evento="forgot_password",
                id_usuario=user.id_usuario,
                email_usuario=user.email,
                id_tienda=user.id_tienda,
                detalle=f"smtp error: {exc}",
            )
            raise HTTPException(status_code=503, detail="No se pudo enviar el correo de recuperacion") from exc

    _register_auth_audit(
        db=db,
        request=request,
        endpoint=endpoint,
        email_intentado=payload.email,
        exito=True,
        evento="forgot_password",
        id_usuario=user.id_usuario,
        email_usuario=user.email,
        id_tienda=user.id_tienda,
    )

    return ForgotPasswordOut(
        message=generic_message,
        reset_url=reset_url if settings.PASSWORD_RESET_DEBUG_RETURN_TOKEN else None,
        reset_token=raw_token if settings.PASSWORD_RESET_DEBUG_RETURN_TOKEN else None,
    )


@router.post("/reset-password", response_model=MessageOut)
def reset_password(
    payload: ResetPasswordIn,
    request: Request,
    db: Session = Depends(get_db),
):
    endpoint = request.url.path
    user = reset_password_with_token(
        db=db,
        raw_token=payload.token,
        new_password=payload.new_password,
    )
    if not user:
        _register_auth_audit(
            db=db,
            request=request,
            endpoint=endpoint,
            email_intentado=None,
            exito=False,
            evento="reset_password",
            detalle="invalid or expired token",
        )
        raise HTTPException(status_code=400, detail="Token invalido o expirado")

    _register_auth_audit(
        db=db,
        request=request,
        endpoint=endpoint,
        email_intentado=user.email,
        exito=True,
        evento="reset_password",
        id_usuario=user.id_usuario,
        email_usuario=user.email,
        id_tienda=user.id_tienda,
    )
    return MessageOut(message="Contrasena actualizada correctamente")
