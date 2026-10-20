from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from core.config import settings
from core.security import hash_password, verify_password
from models.password_reset import PasswordResetToken
from models.tenant import Usuario


def get_user_by_email(db: Session, email: str) -> Optional[Usuario]:
    if not email:
        return None
    stmt = select(Usuario).where(func.lower(Usuario.email) == email.strip().lower())
    return db.execute(stmt).scalar_one_or_none()


def get_user_by_identifier(db: Session, identifier: str) -> Optional[Usuario]:
    """
    Busca un usuario de forma híbrida:
    1. Por correo electrónico exacto (case-insensitive).
    2. Por nombre de usuario exacto (case-insensitive).
    3. Por prefijo del correo antes del '@' (ej: 'luisfernando' para 'luisfernando.banegasro22@gmail.com').
    """
    if not identifier:
        return None
    val = identifier.strip().lower()

    if "@" in val:
        return get_user_by_email(db, val)

    stmt = select(Usuario).where(
        or_(
            func.lower(Usuario.username) == val,
            func.lower(Usuario.email) == val,
            func.lower(func.split_part(Usuario.email, "@", 1)) == val,
        )
    )
    return db.execute(stmt).scalar_one_or_none()


def authenticate_user(db: Session, identifier: str, password: str) -> Optional[Usuario]:
    user = get_user_by_identifier(db, identifier)
    if not user:
        return None
    if not user.activo:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def _hash_reset_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def invalidate_active_reset_tokens(db: Session, id_usuario) -> None:
    now = datetime.utcnow()
    stmt = select(PasswordResetToken).where(
        PasswordResetToken.id_usuario == id_usuario,
        PasswordResetToken.used_at.is_(None),
        PasswordResetToken.expires_at > now,
    )
    tokens = db.execute(stmt).scalars().all()
    for token in tokens:
        token.used_at = now


def create_password_reset_token(db: Session, user: Usuario) -> tuple[str, PasswordResetToken]:
    invalidate_active_reset_tokens(db=db, id_usuario=user.id_usuario)
    raw_token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(
        minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
    )
    token = PasswordResetToken(
        id_usuario=user.id_usuario,
        token_hash=_hash_reset_token(raw_token),
        expires_at=expires_at,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return raw_token, token


def get_reset_token_record(db: Session, raw_token: str) -> PasswordResetToken | None:
    stmt = select(PasswordResetToken).where(
        PasswordResetToken.token_hash == _hash_reset_token(raw_token),
    )
    return db.execute(stmt).scalar_one_or_none()


def reset_password_with_token(db: Session, raw_token: str, new_password: str) -> Usuario | None:
    token = get_reset_token_record(db=db, raw_token=raw_token)
    if not token:
        return None
    if token.used_at is not None:
        return None
    if token.expires_at <= datetime.utcnow():
        return None

    user = db.get(Usuario, token.id_usuario)
    if not user or not user.activo:
        return None

    user.password_hash = hash_password(new_password)
    token.used_at = datetime.utcnow()
    invalidate_active_reset_tokens(db=db, id_usuario=user.id_usuario)
    db.commit()
    db.refresh(user)
    return user
