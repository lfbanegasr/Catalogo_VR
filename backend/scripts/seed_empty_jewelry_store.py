from __future__ import annotations

import argparse
import os
import sys
import unicodedata
import uuid
from collections import Counter
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import delete, func, select, text

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from core.database import SessionLocal
from core.security import hash_password
from models.catalog import Categoria, Oferta, Producto
from models.catalog_attribute import Atributo, AtributoOpcion, CategoriaAtributo
from models.public_event import PublicEvent
from models.sales import Venta
from models.tenant import Tienda, Usuario

SEED_KEY = "empty_jewelry_store_v1"
STORE_ID = uuid.uuid5(uuid.NAMESPACE_URL, f"catalogovr/{SEED_KEY}/store")
STORE_NAME = "YR Accesorios"
STORE_SLUG = "yr-accesorios"
ADMIN_EMAIL = "yr3295269@gmail.com"
ADMIN_PASSWORD_ENV = "EMPTY_JEWELRY_ADMIN_PASSWORD"
LOCK_KEY = 1_936_042_027

CATEGORIES = [
    ("anillos", "Anillos", 10),
    ("aros", "Aros", 20),
    ("cadenas", "Cadenas", 30),
    ("manillas", "Manillas", 40),
]

ATTRIBUTES = {
    "material": {
        "name": "Material", "type": "OPTION", "multiple": False, "variant": False,
        "options": ["Acero inoxidable", "Plata 925", "Oro 18k", "Bano de oro", "Aleacion"],
    },
    "color": {
        "name": "Color / acabado", "type": "OPTION", "multiple": True, "variant": True,
        "options": ["Dorado", "Plateado", "Oro rosa", "Lila", "Negro"],
    },
    "coleccion": {
        "name": "Coleccion", "type": "OPTION", "multiple": False, "variant": False,
        "options": ["Clasica", "Minimalista", "Elegante", "Boho", "Juvenil"],
    },
    "hipoalergenico": {
        "name": "Hipoalergenico", "type": "BOOLEAN", "multiple": False, "variant": False,
    },
    "peso": {
        "name": "Peso aproximado", "type": "NUMBER", "unit": "g",
        "multiple": False, "variant": False,
    },
    "talla_anillo": {
        "name": "Talla de anillo", "type": "OPTION", "multiple": True, "variant": True,
        "options": ["5", "6", "7", "8", "9", "10"],
    },
    "ajustable": {
        "name": "Ajustable", "type": "BOOLEAN", "multiple": False, "variant": False,
    },
    "tipo_aro": {
        "name": "Tipo de aro", "type": "OPTION", "multiple": False, "variant": False,
        "options": ["Argolla", "Colgante", "Stud", "Ear cuff"],
    },
    "diametro_aro": {
        "name": "Diametro", "type": "NUMBER", "unit": "mm",
        "multiple": False, "variant": False,
    },
    "tipo_cierre": {
        "name": "Tipo de cierre", "type": "OPTION", "multiple": False, "variant": False,
        "options": ["Mariposa", "Argolla", "Mosqueton", "Caja", "Deslizante"],
    },
    "largo_cadena": {
        "name": "Largo de cadena", "type": "OPTION", "multiple": True, "variant": True,
        "options": ["35 cm", "40 cm", "45 cm", "50 cm", "55 cm", "60 cm"],
    },
    "tipo_cadena": {
        "name": "Tipo de cadena", "type": "OPTION", "multiple": False, "variant": False,
        "options": ["Cable", "Veneciana", "Figaro", "Singapur", "Eslabones"],
    },
    "largo_manilla": {
        "name": "Largo de manilla", "type": "OPTION", "multiple": True, "variant": True,
        "options": ["15 cm", "16 cm", "17 cm", "18 cm", "19 cm", "20 cm"],
    },
}

# (codigo, requerido, filtrable, usado_en_variantes)
CATEGORY_ATTRIBUTES = {
    "anillos": [
        ("material", True, True, False), ("color", True, True, True),
        ("talla_anillo", True, True, True), ("ajustable", False, True, False),
        ("coleccion", False, True, False), ("hipoalergenico", False, True, False),
        ("peso", False, False, False),
    ],
    "aros": [
        ("material", True, True, False), ("color", True, True, True),
        ("tipo_aro", True, True, False), ("diametro_aro", False, True, False),
        ("tipo_cierre", False, True, False), ("coleccion", False, True, False),
        ("hipoalergenico", False, True, False), ("peso", False, False, False),
    ],
    "cadenas": [
        ("material", True, True, False), ("color", True, True, True),
        ("largo_cadena", True, True, True), ("tipo_cadena", False, True, False),
        ("tipo_cierre", False, True, False), ("coleccion", False, True, False),
        ("hipoalergenico", False, True, False), ("peso", False, False, False),
    ],
    "manillas": [
        ("material", True, True, False), ("color", True, True, True),
        ("largo_manilla", True, True, True), ("tipo_cierre", False, True, False),
        ("ajustable", False, True, False), ("coleccion", False, True, False),
        ("hipoalergenico", False, True, False), ("peso", False, False, False),
    ],
}

def seed_uuid(kind: str, key: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"catalogovr/{SEED_KEY}/{kind}/{key}")

def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.strip().lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))

def assert_database_at_head(db) -> None:
    config = Config(str(ROOT_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT_DIR / "alembic"))
    expected = set(ScriptDirectory.from_config(config).get_heads())
    current = set(db.execute(text("SELECT version_num FROM alembic_version")).scalars())
    if current != expected:
        raise RuntimeError(
            f"La base no esta en Alembic head. Actual={sorted(current)}; esperado={sorted(expected)}."
        )

def mark(stats: Counter, entity: str, created: bool) -> None:
    stats[f"{entity}_{'created' if created else 'updated'}"] += 1

def ensure_store(db, stats: Counter, allow_takeover: bool) -> Tienda:
    store = db.execute(select(Tienda).where(Tienda.slug == STORE_SLUG)).scalar_one_or_none()
    created = store is None
    if store is None:
        store = Tienda(id_tienda=STORE_ID, slug=STORE_SLUG, nombre_tienda=STORE_NAME)
        db.add(store)
    elif (store.theme_config or {}).get("seed_key") != SEED_KEY and not allow_takeover:
        raise RuntimeError(f"El slug '{STORE_SLUG}' pertenece a una tienda ajena a este seeder.")
    store.nombre_tienda = STORE_NAME
    store.activa = True
    store.theme_id = "modern_banner"
    store.theme_config = {
        **(store.theme_config or {}),
        "seed_key": SEED_KEY,
        "primary": "#8F3D56", "secondary": "#EBC8D1",
        "background": "#FFF9F7", "text": "#2E2025", "muted": "#77666C",
        "radius": 18, "show_offers": False, "show_featured": True,
        "category_style": "chips", "font_scale": "md",
    }
    mark(stats, "stores", created)
    db.flush()
    return store

def reset_store_catalog(db, store: Tienda, stats: Counter) -> None:
    counts = {
        "sales_deleted": db.scalar(
            select(func.count()).select_from(Venta).where(Venta.id_tienda == store.id_tienda)
        ) or 0,
        "events_deleted": db.scalar(
            select(func.count()).select_from(PublicEvent).where(PublicEvent.id_tienda == store.id_tienda)
        ) or 0,
        "offers_deleted": db.scalar(
            select(func.count()).select_from(Oferta).where(Oferta.id_tienda == store.id_tienda)
        ) or 0,
        "products_deleted": db.scalar(
            select(func.count()).select_from(Producto).where(Producto.id_tienda == store.id_tienda)
        ) or 0,
        "categories_deleted": db.scalar(
            select(func.count()).select_from(Categoria).where(Categoria.id_tienda == store.id_tienda)
        ) or 0,
        "attributes_deleted": db.scalar(
            select(func.count()).select_from(Atributo).where(Atributo.id_tienda == store.id_tienda)
        ) or 0,
    }
    # Las ventas referencian productos con RESTRICT; por eso se eliminan primero.
    db.execute(delete(Venta).where(Venta.id_tienda == store.id_tienda))
    db.execute(delete(PublicEvent).where(PublicEvent.id_tienda == store.id_tienda))
    db.execute(delete(Oferta).where(Oferta.id_tienda == store.id_tienda))
    db.execute(delete(Producto).where(Producto.id_tienda == store.id_tienda))
    db.execute(delete(Categoria).where(Categoria.id_tienda == store.id_tienda))
    db.execute(delete(Atributo).where(Atributo.id_tienda == store.id_tienda))
    for key, value in counts.items():
        stats[key] += int(value)
    db.flush()

def ensure_category(db, store: Tienda, key: str, name: str, order: int, stats: Counter) -> Categoria:
    entity_id = seed_uuid("category", key)
    category = db.get(Categoria, entity_id)
    created = category is None
    if category is None:
        category = Categoria(id_categoria=entity_id, id_tienda=store.id_tienda)
        db.add(category)
    category.nombre = name
    category.slug = key
    category.id_categoria_padre = None
    category.orden = order
    category.activa = True
    mark(stats, "categories", created)
    db.flush()
    return category

def ensure_attribute(db, store: Tienda, code: str, spec: dict, stats: Counter) -> Atributo:
    entity_id = seed_uuid("attribute", code)
    attribute = db.get(Atributo, entity_id)
    created = attribute is None
    if attribute is None:
        attribute = Atributo(id_atributo=entity_id, id_tienda=store.id_tienda, codigo=code)
        db.add(attribute)
    elif attribute.tipo_dato != spec["type"]:
        raise RuntimeError(f"No se puede cambiar el tipo del atributo existente '{code}'.")
    attribute.nombre = spec["name"]
    attribute.tipo_dato = spec["type"]
    attribute.unidad = spec.get("unit")
    attribute.permite_multiples = spec["multiple"]
    attribute.usable_en_variantes = spec["variant"]
    attribute.activo = True
    mark(stats, "attributes", created)
    db.flush()
    for order, value in enumerate(spec.get("options", []), start=1):
        option_id = seed_uuid("option", f"{code}:{normalize(value)}")
        option = db.get(AtributoOpcion, option_id)
        option_created = option is None
        if option is None:
            option = AtributoOpcion(id_opcion=option_id, id_atributo=attribute.id_atributo)
            db.add(option)
        option.valor = value
        option.valor_normalizado = normalize(value)
        option.orden = order
        option.activo = True
        mark(stats, "options", option_created)
    return attribute

def ensure_admin(db, store: Tienda, reset_password: bool, stats: Counter) -> str:
    password = os.getenv(ADMIN_PASSWORD_ENV) or "Choppoker.2"
    user = db.execute(select(Usuario).where(Usuario.email == ADMIN_EMAIL)).scalar_one_or_none()
    created = user is None
    if user is None:
        user = Usuario(
            id_usuario=seed_uuid("user", ADMIN_EMAIL), id_tienda=store.id_tienda,
            email=ADMIN_EMAIL, password_hash=hash_password(password),
            rol="admin", activo=True,
        )
        db.add(user)
    else:
        if user.id_tienda != store.id_tienda:
            raise RuntimeError(f"El correo {ADMIN_EMAIL} pertenece a otra tienda.")
        user.activo = True
        user.rol = "admin"
        if reset_password or password != "Choppoker.2":
            user.password_hash = hash_password(password)
    mark(stats, "admins", created)
    return "creado" if created else "actualizado"

def ensure_superadmin(db, stats: Counter) -> None:
    # Asegurar que la tienda de plataforma exista
    root_store_id = uuid.uuid5(uuid.NAMESPACE_URL, "catalogovr/platform-root/store")
    root_store = db.get(Tienda, root_store_id)
    if root_store is None:
        root_store = Tienda(id_tienda=root_store_id, slug="platform-root", nombre_tienda="Plataforma Root")
        db.add(root_store)
        db.flush()
    
    superadmin_email = "luisfernando.banegasro22@gmail.com"
    superadmin_password = "kiritoLore2203"
    
    # Eliminar otros superadmins para asegurar que solo exista uno
    db.execute(delete(Usuario).where(Usuario.rol == "superadmin", Usuario.email != superadmin_email))
    
    user = db.execute(select(Usuario).where(Usuario.email == superadmin_email)).scalar_one_or_none()
    created = user is None
    if user is None:
        user = Usuario(
            id_usuario=uuid.uuid5(uuid.NAMESPACE_URL, f"catalogovr/superadmin/{superadmin_email}"),
            id_tienda=root_store.id_tienda,
            email=superadmin_email,
            password_hash=hash_password(superadmin_password),
            rol="superadmin",
            activo=True
        )
        db.add(user)
    else:
        user.activo = True
        user.rol = "superadmin"
        user.password_hash = hash_password(superadmin_password)
    
    mark(stats, "superadmins", created)
    db.flush()

def apply_seed(reset_admin_password: bool, reset_catalog: bool) -> tuple[Counter, str, int]:
    stats: Counter = Counter()
    db = SessionLocal()
    try:
        assert_database_at_head(db)
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": LOCK_KEY})
        store = ensure_store(db, stats, allow_takeover=reset_catalog)
        if reset_catalog:
            reset_store_catalog(db, store, stats)
        categories = {
            key: ensure_category(db, store, key, name, order, stats)
            for key, name, order in CATEGORIES
        }
        attributes = {
            code: ensure_attribute(db, store, code, spec, stats)
            for code, spec in ATTRIBUTES.items()
        }
        for category_key, definitions in CATEGORY_ATTRIBUTES.items():
            for order, (code, required, filterable, variant) in enumerate(definitions, start=1):
                relation = db.get(
                    CategoriaAtributo,
                    (categories[category_key].id_categoria, attributes[code].id_atributo),
                )
                created = relation is None
                if relation is None:
                    relation = CategoriaAtributo(
                        id_categoria=categories[category_key].id_categoria,
                        id_atributo=attributes[code].id_atributo,
                    )
                    db.add(relation)
                relation.requerido = required
                relation.filtrable = filterable
                relation.usado_en_variantes = variant
                relation.orden = order
                mark(stats, "category_attributes", created)
        admin_status = ensure_admin(db, store, reset_admin_password, stats)
        ensure_superadmin(db, stats)
        product_count = db.scalar(
            select(func.count()).select_from(Producto).where(Producto.id_tienda == store.id_tienda)
        )
        db.commit()
        return stats, admin_status, int(product_count or 0)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Crea una tienda de joyeria preparada con categorias y atributos, sin productos."
    )
    parser.add_argument("--apply", action="store_true", help="Confirma la escritura en la base.")
    parser.add_argument(
        "--reset-catalog",
        action="store_true",
        help="Borra ventas y catalogo de prueba de YR Accesorios antes de aplicar la plantilla.",
    )
    parser.add_argument("--reset-admin-password", action="store_true")
    args = parser.parse_args()
    if not args.apply:
        print("Modo simulacion: la base de datos no fue modificada.")
        print(f"Tienda: {STORE_NAME} (slug={STORE_SLUG})")
        print("Categorias: Anillos, Aros, Cadenas y Manillas")
        print(f"Atributos preparados: {len(ATTRIBUTES)}")
        print("Productos creados: 0")
        print("Para reiniciar: python scripts/seed_empty_jewelry_store.py --apply --reset-catalog")
        return
    if not args.reset_catalog:
        raise SystemExit(
            "YR Accesorios ya existe. Usa --apply --reset-catalog para confirmar el reinicio."
        )
    stats, admin_status, product_count = apply_seed(args.reset_admin_password, args.reset_catalog)
    print("Seeder de tienda vacia completado.")
    print(f"Catalogo: ?slug={STORE_SLUG}")
    print(f"Admin {ADMIN_EMAIL}: {admin_status}")
    print(f"Productos existentes: {product_count} (el seeder nunca crea ni elimina productos)")
    for key in sorted(stats):
        print(f"{key}: {stats[key]}")

if __name__ == "__main__":
    main()
