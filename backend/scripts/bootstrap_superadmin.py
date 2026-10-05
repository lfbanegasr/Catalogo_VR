from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlalchemy import select

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from core.database import SessionLocal
from core.security import hash_password, verify_password
from models.tenant import Tienda, Usuario


def _slugify(value: str) -> str:
    value = value.strip().lower()
    out = []
    last_dash = False
    for ch in value:
        if ch.isalnum():
            out.append(ch)
            last_dash = False
        else:
            if not last_dash:
                out.append("-")
                last_dash = True
    slug = "".join(out).strip("-")
    return slug or "tienda"


def ensure_tienda(db, nombre_tienda: str, slug: str) -> Tienda:
    stmt = select(Tienda).where(Tienda.slug == slug)
    tienda = db.execute(stmt).scalar_one_or_none()
    if tienda:
        return tienda
    tienda = Tienda(
        nombre_tienda=nombre_tienda,
        slug=slug,
        activa=True,
        dominio_personalizado=None,
    )
    db.add(tienda)
    db.flush()
    return tienda


def ensure_superadmin(db, *, email: str, password: str, tienda: Tienda) -> tuple[Usuario, str]:
    stmt = select(Usuario).where(Usuario.email == email)
    user = db.execute(stmt).scalar_one_or_none()
    if user:
        updated = False
        if user.rol != "superadmin":
            user.rol = "superadmin"
            updated = True
        if user.id_tienda != tienda.id_tienda:
            user.id_tienda = tienda.id_tienda
            updated = True
        if not verify_password(password, user.password_hash):
            user.password_hash = hash_password(password)
            updated = True
        return user, "actualizado" if updated else "encontrado"

    user = Usuario(
        id_tienda=tienda.id_tienda,
        email=email,
        password_hash=hash_password(password),
        rol="superadmin",
    )
    db.add(user)
    db.flush()
    return user, "creado"


def main() -> None:
    parser = argparse.ArgumentParser(description="Crea/actualiza el primer superadmin")
    parser.add_argument("--email", required=True, help="Email del superadmin")
    parser.add_argument("--password", required=True, help="Password del superadmin")
    parser.add_argument(
        "--store-name",
        default="Plataforma Root",
        help="Nombre de tienda tecnica para el superadmin",
    )
    parser.add_argument(
        "--store-slug",
        default="platform-root",
        help="Slug de tienda tecnica para el superadmin",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        slug = _slugify(args.store_slug)
        tienda = ensure_tienda(db, nombre_tienda=args.store_name, slug=slug)
        user, status = ensure_superadmin(
            db,
            email=args.email.strip().lower(),
            password=args.password,
            tienda=tienda,
        )
        db.commit()
        print("Bootstrap superadmin OK")
        print(f"- usuario: {user.email} ({status})")
        print(f"- rol: {user.rol}")
        print(f"- tienda: {tienda.slug}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
