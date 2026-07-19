import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.security import hash_password, verify_password
from models.tenant import Tienda, Usuario, VALID_USER_ROLES
from schemas.tenant_schema import (
    TiendaCreate,
    TiendaThemeUpdate,
    TiendaUpdate,
    UserResetPasswordIn,
    UsuarioCreate,
    UsuarioUpdate,
)


def _slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value or "tienda"


def _slug_exists(db: Session, slug: str, exclude_tienda_id=None) -> bool:
    stmt = select(Tienda).where(Tienda.slug == slug)
    tienda = db.execute(stmt).scalar_one_or_none()
    if not tienda:
        return False
    if exclude_tienda_id and tienda.id_tienda == exclude_tienda_id:
        return False
    return True


def _build_unique_slug(db: Session, base_text: str) -> str:
    base_slug = _slugify(base_text)
    candidate = base_slug
    counter = 2
    while _slug_exists(db, candidate):
        candidate = f"{base_slug}-{counter}"
        counter += 1
    return candidate


def create_tienda(db: Session, payload: TiendaCreate) -> Tienda:
    slug = _slugify(payload.slug or payload.nombre_tienda)
    if payload.slug and _slug_exists(db, slug):
        raise ValueError("Ya existe una tienda con ese slug.")
    if not payload.slug:
        slug = _build_unique_slug(db, payload.nombre_tienda)

    tienda = Tienda(
        nombre_tienda=payload.nombre_tienda,
        slug=slug,
        dominio_personalizado=payload.dominio_personalizado,
        whatsapp_number=payload.whatsapp_number,
        theme_id="default",
        theme_config=None,
        activa=payload.activa,
    )
    db.add(tienda)
    db.commit()
    db.refresh(tienda)
    return tienda


def list_tiendas(db: Session):
    return db.query(Tienda).order_by(Tienda.fecha_creacion.desc()).all()


def get_tienda_by_id(db: Session, id_tienda) -> Tienda | None:
    return db.query(Tienda).filter(Tienda.id_tienda == id_tienda).first()


def update_tienda(db: Session, id_tienda, payload: TiendaUpdate) -> Tienda | None:
    tienda = get_tienda_by_id(db, id_tienda)
    if not tienda:
        return None

    data = payload.model_dump(exclude_unset=True)
    if "slug" in data and data["slug"] is not None:
        slug = _slugify(data["slug"])
        if _slug_exists(db, slug, exclude_tienda_id=tienda.id_tienda):
            raise ValueError("Ya existe una tienda con ese slug.")
        tienda.slug = slug

    if "nombre_tienda" in data and data["nombre_tienda"] is not None:
        tienda.nombre_tienda = data["nombre_tienda"]
    if "dominio_personalizado" in data:
        tienda.dominio_personalizado = data["dominio_personalizado"]
    if "whatsapp_number" in data:
        tienda.whatsapp_number = data["whatsapp_number"]
    if "theme_id" in data and data["theme_id"] is not None:
        tienda.theme_id = data["theme_id"]
    if "theme_config" in data:
        tienda.theme_config = data["theme_config"]
    if "activa" in data and data["activa"] is not None:
        tienda.activa = data["activa"]

    db.commit()
    db.refresh(tienda)
    return tienda


def update_tienda_theme(db: Session, id_tienda, payload: TiendaThemeUpdate) -> Tienda | None:
    tienda = get_tienda_by_id(db, id_tienda)
    if not tienda:
        return None
    tienda.theme_id = payload.theme_id
    tienda.theme_config = payload.theme_config
    db.commit()
    db.refresh(tienda)
    return tienda


def get_user_by_email(db: Session, email: str) -> Usuario | None:
    stmt = select(Usuario).where(Usuario.email == email)
    return db.execute(stmt).scalar_one_or_none()


def get_user_by_id(db: Session, id_usuario) -> Usuario | None:
    return db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()


def create_usuario(db: Session, payload: UsuarioCreate) -> Usuario:
    existing = get_user_by_email(db, payload.email)
    if existing:
        raise ValueError("Ya existe un usuario con ese email.")
    if payload.rol not in VALID_USER_ROLES:
        raise ValueError("Rol invalido.")

    user = Usuario(
        id_tienda=payload.id_tienda,
        email=payload.email,
        password_hash=hash_password(payload.password),
        rol=payload.rol or "admin",
        activo=payload.activo,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_usuario(db: Session, id_usuario, payload: UsuarioUpdate) -> Usuario | None:
    user = get_user_by_id(db, id_usuario)
    if not user:
        return None

    data = payload.model_dump(exclude_unset=True)
    if "email" in data and data["email"] is not None and data["email"] != user.email:
        existing = get_user_by_email(db, data["email"])
        if existing and existing.id_usuario != user.id_usuario:
            raise ValueError("Ya existe un usuario con ese email.")
        user.email = data["email"]
    if "rol" in data and data["rol"] is not None:
        if data["rol"] not in VALID_USER_ROLES:
            raise ValueError("Rol invalido.")
        user.rol = data["rol"]
    if "id_tienda" in data and data["id_tienda"] is not None:
        user.id_tienda = data["id_tienda"]
    if "activo" in data and data["activo"] is not None:
        user.activo = data["activo"]

    db.commit()
    db.refresh(user)
    return user


def reset_usuario_password(db: Session, id_usuario, payload: UserResetPasswordIn) -> Usuario | None:
    user = get_user_by_id(db, id_usuario)
    if not user:
        return None
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    db.refresh(user)
    return user


def list_usuarios(db: Session, id_tienda=None, rol: str | None = None, activo: bool | None = None):
    query = db.query(Usuario)
    if id_tienda is not None:
        query = query.filter(Usuario.id_tienda == id_tienda)
    if rol is not None:
        query = query.filter(Usuario.rol == rol)
    if activo is not None:
        query = query.filter(Usuario.activo == activo)
    return query.order_by(Usuario.fecha_registro.desc()).all()


def authenticate_user(db: Session, email: str, password: str) -> Usuario | None:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not user.activo:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user
