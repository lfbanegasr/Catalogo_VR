from __future__ import annotations

import argparse
import os
import sys
import unicodedata
import uuid
from collections import Counter
from decimal import Decimal
from pathlib import Path
from typing import Any

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import select, text, update


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from core.database import SessionLocal
from core.security import hash_password
from models.catalog import (
    Categoria,
    Oferta,
    OfertaCategoria,
    Producto,
    ProductoImagen,
)
from models.catalog_attribute import (
    Atributo,
    AtributoOpcion,
    CategoriaAtributo,
    ProductoAtributo,
)
from models.catalog_variant import VarianteAtributo, VarianteProducto
from models.tenant import Tienda, Usuario


SEED_KEY = "accessories_catalog_v1"
STORE_SLUG = "demo-accesorios"
STORE_ID = uuid.uuid5(uuid.NAMESPACE_URL, f"catalogovr/{SEED_KEY}/store")
LOCK_KEY = 1_936_042_026
ADMIN_EMAIL = "admin@demo-accesorios.local"
ADMIN_PASSWORD_ENV = "ACCESSORIES_SEED_ADMIN_PASSWORD"


IMAGES = {
    "hero": "https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1600&q=85",
    "aros": "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&q=82",
    "manillas": "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&q=82",
    "collares": "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=82",
    "anillos": "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=82",
}


CATEGORIES = [
    {"key": "joyeria", "name": "Joyería", "slug": "joyeria", "parent": None, "order": 0},
    {"key": "aros", "name": "Aros", "slug": "aros", "parent": "joyeria", "order": 10},
    {"key": "manillas", "name": "Manillas", "slug": "manillas", "parent": "joyeria", "order": 20},
    {"key": "collares", "name": "Collares", "slug": "collares", "parent": "joyeria", "order": 30},
    {"key": "anillos", "name": "Anillos", "slug": "anillos", "parent": "joyeria", "order": 40},
]


ATTRIBUTES = [
    {
        "code": "material",
        "name": "Material",
        "type": "OPTION",
        "multiple": False,
        "variant": False,
        "options": ["Acero inoxidable", "Plata 925", "Baño de oro 18k", "Aleación hipoalergénica"],
    },
    {
        "code": "color",
        "name": "Color / acabado",
        "type": "OPTION",
        "multiple": True,
        "variant": True,
        "options": ["Dorado", "Plateado", "Oro rosa", "Negro"],
    },
    {
        "code": "coleccion",
        "name": "Colección",
        "type": "OPTION",
        "multiple": False,
        "variant": False,
        "options": ["Minimalista", "Brillo", "Clásica", "Boho"],
    },
    {
        "code": "tipo_cierre",
        "name": "Tipo de cierre",
        "type": "OPTION",
        "multiple": False,
        "variant": False,
        "options": ["Mariposa", "Argolla", "Mosquetón", "Ajustable"],
    },
    {
        "code": "talla_anillo",
        "name": "Talla de anillo",
        "type": "OPTION",
        "multiple": True,
        "variant": True,
        "options": ["5", "6", "7", "8", "9"],
    },
    {
        "code": "largo_collar",
        "name": "Largo de collar",
        "type": "OPTION",
        "multiple": True,
        "variant": True,
        "options": ["40 cm", "45 cm", "50 cm"],
    },
    {
        "code": "diametro_aro",
        "name": "Diámetro",
        "type": "OPTION",
        "multiple": False,
        "variant": False,
        "options": ["12 mm", "20 mm", "30 mm"],
    },
    {
        "code": "hipoalergenico",
        "name": "Hipoalergénico",
        "type": "BOOLEAN",
        "multiple": False,
        "variant": False,
    },
    {
        "code": "ajustable",
        "name": "Ajustable",
        "type": "BOOLEAN",
        "multiple": False,
        "variant": False,
    },
    {
        "code": "peso",
        "name": "Peso aproximado",
        "type": "NUMBER",
        "unit": "g",
        "multiple": False,
        "variant": False,
    },
]


CATEGORY_ATTRIBUTES = {
    "aros": [
        ("material", True, True, False),
        ("color", True, True, True),
        ("diametro_aro", False, True, False),
        ("tipo_cierre", False, True, False),
        ("coleccion", False, True, False),
        ("hipoalergenico", False, True, False),
        ("peso", False, False, False),
    ],
    "manillas": [
        ("material", True, True, False),
        ("color", True, True, True),
        ("tipo_cierre", False, True, False),
        ("coleccion", False, True, False),
        ("ajustable", False, True, False),
        ("hipoalergenico", False, True, False),
        ("peso", False, False, False),
    ],
    "collares": [
        ("material", True, True, False),
        ("color", True, True, True),
        ("largo_collar", True, True, True),
        ("tipo_cierre", False, True, False),
        ("coleccion", False, True, False),
        ("hipoalergenico", False, True, False),
        ("peso", False, False, False),
    ],
    "anillos": [
        ("material", True, True, False),
        ("color", True, True, True),
        ("talla_anillo", True, True, True),
        ("coleccion", False, True, False),
        ("ajustable", False, True, False),
        ("hipoalergenico", False, True, False),
        ("peso", False, False, False),
    ],
}


PRODUCTS = [
    {
        "key": "aros-luna-minimal",
        "category": "aros",
        "name": "Aros Luna Minimal",
        "description": "Aros livianos en forma de luna, pensados para uso diario y piel sensible.",
        "price": "79.00",
        "cost": "32.00",
        "image": IMAGES["aros"],
        "attributes": {
            "material": "Acero inoxidable", "color": ["Dorado", "Plateado"],
            "diametro_aro": "12 mm", "tipo_cierre": "Mariposa",
            "coleccion": "Minimalista", "hipoalergenico": True, "peso": "4.2",
        },
        "variants": [
            ("AR-LUNA-DOR", "79.00", 12, {"color": "Dorado"}),
            ("AR-LUNA-PLA", "79.00", 10, {"color": "Plateado"}),
        ],
    },
    {
        "key": "argollas-aura",
        "category": "aros",
        "name": "Argollas Aura",
        "description": "Argollas clásicas de perfil fino con acabado pulido y cierre seguro.",
        "price": "89.00", "cost": "37.00", "image": IMAGES["aros"],
        "attributes": {
            "material": "Baño de oro 18k", "color": ["Dorado", "Oro rosa", "Plateado"],
            "diametro_aro": "20 mm", "tipo_cierre": "Argolla",
            "coleccion": "Clásica", "hipoalergenico": True, "peso": "6.1",
        },
        "variants": [
            ("AR-AURA-DOR", "89.00", 9, {"color": "Dorado"}),
            ("AR-AURA-ROS", "92.00", 7, {"color": "Oro rosa"}),
            ("AR-AURA-PLA", "89.00", 8, {"color": "Plateado"}),
        ],
    },
    {
        "key": "aros-estrella-brillo",
        "category": "aros",
        "name": "Aros Estrella Brillo",
        "description": "Diseño de estrella con destello delicado para elevar looks de día o de noche.",
        "price": "99.00", "cost": "42.00", "image": IMAGES["aros"],
        "attributes": {
            "material": "Plata 925", "color": ["Plateado", "Dorado"],
            "diametro_aro": "12 mm", "tipo_cierre": "Mariposa",
            "coleccion": "Brillo", "hipoalergenico": True, "peso": "3.8",
        },
        "variants": [
            ("AR-STAR-PLA", "99.00", 6, {"color": "Plateado"}),
            ("AR-STAR-DOR", "105.00", 5, {"color": "Dorado"}),
        ],
    },
    {
        "key": "manilla-eslabones-alba",
        "category": "manillas",
        "name": "Manilla Eslabones Alba",
        "description": "Cadena de eslabones medianos con presencia elegante y cierre mosquetón.",
        "price": "119.00", "cost": "51.00", "image": IMAGES["manillas"],
        "attributes": {
            "material": "Acero inoxidable", "color": ["Dorado", "Plateado"],
            "tipo_cierre": "Mosquetón", "coleccion": "Clásica",
            "ajustable": False, "hipoalergenico": True, "peso": "12.5",
        },
        "variants": [
            ("MA-ALBA-DOR", "119.00", 8, {"color": "Dorado"}),
            ("MA-ALBA-PLA", "115.00", 11, {"color": "Plateado"}),
        ],
    },
    {
        "key": "pulsera-infinito",
        "category": "manillas",
        "name": "Pulsera Infinito",
        "description": "Pulsera fina con símbolo infinito, extensión regulable y acabado luminoso.",
        "price": "85.00", "cost": "35.00", "image": IMAGES["manillas"],
        "attributes": {
            "material": "Baño de oro 18k", "color": ["Dorado", "Oro rosa"],
            "tipo_cierre": "Mosquetón", "coleccion": "Minimalista",
            "ajustable": True, "hipoalergenico": True, "peso": "5.9",
        },
        "variants": [
            ("MA-INF-DOR", "85.00", 14, {"color": "Dorado"}),
            ("MA-INF-ROS", "88.00", 9, {"color": "Oro rosa"}),
        ],
    },
    {
        "key": "manilla-boho-ajustable",
        "category": "manillas",
        "name": "Manilla Boho Ajustable",
        "description": "Manilla de textura artesanal y ajuste deslizante, cómoda para distintas muñecas.",
        "price": "69.00", "cost": "26.00", "image": IMAGES["manillas"],
        "attributes": {
            "material": "Aleación hipoalergénica", "color": ["Dorado", "Negro"],
            "tipo_cierre": "Ajustable", "coleccion": "Boho",
            "ajustable": True, "hipoalergenico": True, "peso": "8.4",
        },
        "variants": [
            ("MA-BOHO-DOR", "69.00", 13, {"color": "Dorado"}),
            ("MA-BOHO-NEG", "69.00", 10, {"color": "Negro"}),
        ],
    },
    {
        "key": "collar-punto-luz",
        "category": "collares",
        "name": "Collar Punto de Luz",
        "description": "Cadena delicada con cristal central; disponible en tres largos para combinar en capas.",
        "price": "109.00", "cost": "44.00", "image": IMAGES["collares"],
        "attributes": {
            "material": "Plata 925", "color": ["Plateado", "Dorado"],
            "largo_collar": ["40 cm", "45 cm", "50 cm"], "tipo_cierre": "Mosquetón",
            "coleccion": "Brillo", "hipoalergenico": True, "peso": "7.2",
        },
        "variants": [
            ("CO-LUZ-PLA-40", "109.00", 7, {"color": "Plateado", "largo_collar": "40 cm"}),
            ("CO-LUZ-PLA-45", "112.00", 8, {"color": "Plateado", "largo_collar": "45 cm"}),
            ("CO-LUZ-PLA-50", "115.00", 5, {"color": "Plateado", "largo_collar": "50 cm"}),
            ("CO-LUZ-DOR-40", "115.00", 6, {"color": "Dorado", "largo_collar": "40 cm"}),
            ("CO-LUZ-DOR-45", "118.00", 7, {"color": "Dorado", "largo_collar": "45 cm"}),
            ("CO-LUZ-DOR-50", "121.00", 4, {"color": "Dorado", "largo_collar": "50 cm"}),
        ],
    },
    {
        "key": "collar-capas-aurora",
        "category": "collares",
        "name": "Collar Capas Aurora",
        "description": "Dos cadenas coordinadas en una sola pieza para lograr un look en capas sin esfuerzo.",
        "price": "139.00", "cost": "58.00", "image": IMAGES["collares"],
        "attributes": {
            "material": "Baño de oro 18k", "color": ["Dorado", "Oro rosa"],
            "largo_collar": ["45 cm", "50 cm"], "tipo_cierre": "Mosquetón",
            "coleccion": "Boho", "hipoalergenico": True, "peso": "11.6",
        },
        "variants": [
            ("CO-AUR-DOR-45", "139.00", 6, {"color": "Dorado", "largo_collar": "45 cm"}),
            ("CO-AUR-DOR-50", "144.00", 5, {"color": "Dorado", "largo_collar": "50 cm"}),
            ("CO-AUR-ROS-45", "142.00", 4, {"color": "Oro rosa", "largo_collar": "45 cm"}),
            ("CO-AUR-ROS-50", "147.00", 3, {"color": "Oro rosa", "largo_collar": "50 cm"}),
        ],
    },
    {
        "key": "collar-inicial-minimal",
        "category": "collares",
        "name": "Collar Inicial Minimal",
        "description": "Dije de inicial con tipografía limpia y cadena regulable, ideal para regalar.",
        "price": "95.00", "cost": "39.00", "image": IMAGES["collares"],
        "attributes": {
            "material": "Acero inoxidable", "color": ["Dorado", "Plateado"],
            "largo_collar": ["40 cm", "45 cm"], "tipo_cierre": "Mosquetón",
            "coleccion": "Minimalista", "hipoalergenico": True, "peso": "6.8",
        },
        "variants": [
            ("CO-INI-DOR-40", "95.00", 12, {"color": "Dorado", "largo_collar": "40 cm"}),
            ("CO-INI-DOR-45", "98.00", 10, {"color": "Dorado", "largo_collar": "45 cm"}),
            ("CO-INI-PLA-40", "92.00", 11, {"color": "Plateado", "largo_collar": "40 cm"}),
            ("CO-INI-PLA-45", "95.00", 9, {"color": "Plateado", "largo_collar": "45 cm"}),
        ],
    },
    {
        "key": "anillo-solitario-nova",
        "category": "anillos",
        "name": "Anillo Solitario Nova",
        "description": "Solitario contemporáneo con piedra central de brillo sutil y banda cómoda.",
        "price": "129.00", "cost": "54.00", "image": IMAGES["anillos"],
        "attributes": {
            "material": "Plata 925", "color": ["Plateado", "Dorado"],
            "talla_anillo": ["6", "7", "8"], "coleccion": "Brillo",
            "ajustable": False, "hipoalergenico": True, "peso": "3.9",
        },
        "variants": [
            ("AN-NOVA-PLA-6", "129.00", 5, {"color": "Plateado", "talla_anillo": "6"}),
            ("AN-NOVA-PLA-7", "129.00", 7, {"color": "Plateado", "talla_anillo": "7"}),
            ("AN-NOVA-PLA-8", "129.00", 6, {"color": "Plateado", "talla_anillo": "8"}),
            ("AN-NOVA-DOR-6", "135.00", 4, {"color": "Dorado", "talla_anillo": "6"}),
            ("AN-NOVA-DOR-7", "135.00", 5, {"color": "Dorado", "talla_anillo": "7"}),
            ("AN-NOVA-DOR-8", "135.00", 4, {"color": "Dorado", "talla_anillo": "8"}),
        ],
    },
    {
        "key": "anillo-ondas",
        "category": "anillos",
        "name": "Anillo Ondas",
        "description": "Banda orgánica inspirada en ondas, fácil de combinar y usar todos los días.",
        "price": "82.00", "cost": "33.00", "image": IMAGES["anillos"],
        "attributes": {
            "material": "Acero inoxidable", "color": ["Dorado", "Plateado", "Oro rosa"],
            "talla_anillo": ["5", "6", "7", "8", "9"], "coleccion": "Minimalista",
            "ajustable": False, "hipoalergenico": True, "peso": "3.2",
        },
        "variants": [
            (f"AN-OND-{color_code}-{size}", "82.00", 4, {"color": color, "talla_anillo": size})
            for color_code, color in [("DOR", "Dorado"), ("PLA", "Plateado"), ("ROS", "Oro rosa")]
            for size in ["5", "6", "7", "8", "9"]
        ],
    },
    {
        "key": "anillo-sello-luna",
        "category": "anillos",
        "name": "Anillo Sello Luna",
        "description": "Sello pequeño con grabado lunar, acabado vintage y aro ligeramente regulable.",
        "price": "96.00", "cost": "40.00", "image": IMAGES["anillos"],
        "attributes": {
            "material": "Aleación hipoalergénica", "color": ["Dorado", "Plateado"],
            "talla_anillo": ["6", "7", "8"], "coleccion": "Boho",
            "ajustable": True, "hipoalergenico": True, "peso": "4.6",
        },
        "variants": [
            (f"AN-LUNA-{color_code}-{size}", "96.00", 5, {"color": color, "talla_anillo": size})
            for color_code, color in [("DOR", "Dorado"), ("PLA", "Plateado")]
            for size in ["6", "7", "8"]
        ],
    },
]


def seed_uuid(kind: str, key: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"catalogovr/{SEED_KEY}/{kind}/{key}")


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.strip().lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def validate_spec() -> dict[str, int]:
    category_keys = {item["key"] for item in CATEGORIES}
    attribute_by_code = {item["code"]: item for item in ATTRIBUTES}
    assert len(category_keys) == len(CATEGORIES), "Hay claves de categoría duplicadas."
    assert len(attribute_by_code) == len(ATTRIBUTES), "Hay códigos de atributo duplicados."

    skus: set[str] = set()
    names: set[str] = set()
    variant_count = 0
    for product in PRODUCTS:
        assert product["category"] in CATEGORY_ATTRIBUTES, f"Categoría inválida en {product['key']}"
        assert product["name"] not in names, f"Nombre duplicado: {product['name']}"
        names.add(product["name"])
        configured_variants = {
            code for code, _required, _filterable, used in CATEGORY_ATTRIBUTES[product["category"]] if used
        }
        for code, raw_values in product["attributes"].items():
            assert code in attribute_by_code, f"Atributo desconocido {code} en {product['key']}"
            values = raw_values if isinstance(raw_values, list) else [raw_values]
            options = attribute_by_code[code].get("options")
            if options:
                assert all(value in options for value in values), f"Opción inválida para {code} en {product['key']}"
        for sku, _price, stock, values in product["variants"]:
            assert sku not in skus, f"SKU duplicado: {sku}"
            assert stock >= 0, f"Stock negativo: {sku}"
            assert set(values) == configured_variants, f"Atributos de variante incompletos: {sku}"
            for code, value in values.items():
                assert value in attribute_by_code[code]["options"], f"Opción inválida en {sku}"
            skus.add(sku)
            variant_count += 1

    for key in ("aros", "manillas", "collares", "anillos"):
        assert key in category_keys
        assert sum(product["category"] == key for product in PRODUCTS) >= 3

    return {
        "categories": len(CATEGORIES),
        "attributes": len(ATTRIBUTES),
        "attribute_options": sum(len(item.get("options", [])) for item in ATTRIBUTES),
        "products": len(PRODUCTS),
        "variants": variant_count,
    }


def mark(stats: Counter, kind: str, created: bool) -> None:
    stats[f"{kind}_{'created' if created else 'updated'}"] += 1


def assert_database_at_head(db) -> None:
    config = Config(str(ROOT_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT_DIR / "alembic"))
    expected = set(ScriptDirectory.from_config(config).get_heads())
    current = set(db.execute(text("SELECT version_num FROM alembic_version")).scalars())
    if current != expected:
        raise RuntimeError(
            "La base de datos no está en Alembic head. "
            f"Actual={sorted(current)}; esperado={sorted(expected)}. "
            "Ejecuta 'python -m alembic upgrade head' antes del seed."
        )


def ensure_store(db, stats: Counter) -> Tienda:
    store = db.execute(select(Tienda).where(Tienda.slug == STORE_SLUG)).scalar_one_or_none()
    created = store is None
    if store is None:
        store = Tienda(id_tienda=STORE_ID, slug=STORE_SLUG)
        db.add(store)
    else:
        marker = (store.theme_config or {}).get("seed_key")
        if marker != SEED_KEY:
            raise RuntimeError(
                f"Ya existe una tienda no administrada por este seed con slug '{STORE_SLUG}'. "
                "No se modificó nada. Cambia el slug del registro existente o del script."
            )

    store.nombre_tienda = "Demo Accesorios"
    store.activa = True
    store.theme_id = "modern_banner"
    if created and not store.whatsapp_number:
        store.whatsapp_number = "59170000000"
    mark(stats, "stores", created)
    db.flush()
    return store


def ensure_category(db, store: Tienda, item: dict[str, Any], parent: Categoria | None, stats: Counter) -> Categoria:
    entity_id = seed_uuid("category", item["key"])
    category = db.get(Categoria, entity_id)
    if category is None:
        category = db.execute(
            select(Categoria).where(Categoria.id_tienda == store.id_tienda, Categoria.slug == item["slug"])
        ).scalar_one_or_none()
    created = category is None
    if category is None:
        category = Categoria(id_categoria=entity_id, id_tienda=store.id_tienda)
        db.add(category)
    if category.id_tienda != store.id_tienda:
        raise RuntimeError(f"Colisión de identificador en categoría {item['key']}")
    category.nombre = item["name"]
    category.slug = item["slug"]
    category.id_categoria_padre = parent.id_categoria if parent else None
    category.orden = item["order"]
    category.activa = True
    mark(stats, "categories", created)
    db.flush()
    return category


def ensure_attribute(db, store: Tienda, item: dict[str, Any], stats: Counter) -> Atributo:
    entity_id = seed_uuid("attribute", item["code"])
    attribute = db.get(Atributo, entity_id)
    if attribute is None:
        attribute = db.execute(
            select(Atributo).where(Atributo.id_tienda == store.id_tienda, Atributo.codigo == item["code"])
        ).scalar_one_or_none()
    created = attribute is None
    if attribute is None:
        attribute = Atributo(id_atributo=entity_id, id_tienda=store.id_tienda)
        db.add(attribute)
    if attribute.id_tienda != store.id_tienda:
        raise RuntimeError(f"Colisión de identificador en atributo {item['code']}")
    if not created and attribute.tipo_dato != item["type"]:
        raise RuntimeError(f"No se puede cambiar el tipo del atributo existente {item['code']}")
    attribute.nombre = item["name"]
    attribute.codigo = item["code"]
    attribute.tipo_dato = item["type"]
    attribute.unidad = item.get("unit")
    attribute.permite_multiples = item["multiple"]
    attribute.usable_en_variantes = item["variant"]
    attribute.activo = True
    mark(stats, "attributes", created)
    db.flush()
    return attribute


def ensure_option(db, attribute: Atributo, value: str, order: int, stats: Counter) -> AtributoOpcion:
    normalized = normalize(value)
    entity_id = seed_uuid("option", f"{attribute.codigo}:{normalized}")
    option = db.get(AtributoOpcion, entity_id)
    if option is None:
        option = db.execute(
            select(AtributoOpcion).where(
                AtributoOpcion.id_atributo == attribute.id_atributo,
                AtributoOpcion.valor_normalizado == normalized,
            )
        ).scalar_one_or_none()
    created = option is None
    if option is None:
        option = AtributoOpcion(id_opcion=entity_id, id_atributo=attribute.id_atributo)
        db.add(option)
    option.valor = value
    option.valor_normalizado = normalized
    option.orden = order
    option.activo = True
    mark(stats, "options", created)
    db.flush()
    return option


def ensure_category_attribute(
    db,
    category: Categoria,
    attribute: Atributo,
    order: int,
    required: bool,
    filterable: bool,
    used_in_variants: bool,
    stats: Counter,
) -> None:
    relation = db.get(CategoriaAtributo, (category.id_categoria, attribute.id_atributo))
    created = relation is None
    if relation is None:
        relation = CategoriaAtributo(id_categoria=category.id_categoria, id_atributo=attribute.id_atributo)
        db.add(relation)
    relation.requerido = required
    relation.filtrable = filterable
    relation.usado_en_variantes = used_in_variants
    relation.orden = order
    mark(stats, "category_attributes", created)


def ensure_product(db, store: Tienda, category: Categoria, item: dict[str, Any], stats: Counter) -> Producto:
    entity_id = seed_uuid("product", item["key"])
    product = db.get(Producto, entity_id)
    if product is None:
        product = db.execute(
            select(Producto).where(Producto.id_tienda == store.id_tienda, Producto.nombre == item["name"])
        ).scalar_one_or_none()
    created = product is None
    if product is None:
        product = Producto(id_producto=entity_id, id_tienda=store.id_tienda)
        db.add(product)
    if product.id_tienda != store.id_tienda:
        raise RuntimeError(f"Colisión de identificador en producto {item['key']}")
    product.id_categoria = category.id_categoria
    product.id_categoria_principal = category.id_categoria
    product.nombre = item["name"]
    product.descripcion = item["description"]
    product.precio_venta = Decimal(item["price"])
    product.costo_adquisicion = Decimal(item["cost"])
    product.stock_actual = 0
    product.imagen_url = item["image"]
    product.activo = True
    mark(stats, "products", created)
    db.flush()

    image_id = seed_uuid("product-image", f"{item['key']}:main")
    image = db.get(ProductoImagen, image_id)
    image_created = image is None
    if image is None:
        image = ProductoImagen(id_imagen=image_id, id_producto=product.id_producto)
        db.add(image)
    image.imagen_url = item["image"]
    image.orden = 0
    mark(stats, "images", image_created)
    return product


def ensure_product_attribute(
    db,
    product: Producto,
    attribute: Atributo,
    raw_value: Any,
    option: AtributoOpcion | None,
    value_key: str,
    stats: Counter,
) -> None:
    entity_id = seed_uuid("product-attribute", f"{product.id_producto}:{attribute.codigo}:{value_key}")
    relation = db.get(ProductoAtributo, entity_id)
    created = relation is None
    if relation is None:
        relation = ProductoAtributo(
            id_producto_atributo=entity_id,
            id_producto=product.id_producto,
            id_atributo=attribute.id_atributo,
        )
        db.add(relation)
    relation.id_opcion = option.id_opcion if option else None
    relation.valor_texto = raw_value if attribute.tipo_dato == "TEXT" else None
    relation.valor_numero = Decimal(str(raw_value)) if attribute.tipo_dato == "NUMBER" else None
    relation.valor_booleano = bool(raw_value) if attribute.tipo_dato == "BOOLEAN" else None
    mark(stats, "product_attributes", created)


def ensure_variant(
    db,
    store: Tienda,
    product: Producto,
    data: tuple[str, str, int, dict[str, str]],
    attributes: dict[str, Atributo],
    options: dict[tuple[str, str], AtributoOpcion],
    default: bool,
    stats: Counter,
) -> None:
    sku, price, stock, values = data
    entity_id = seed_uuid("variant", sku)
    variant = db.get(VarianteProducto, entity_id)
    if variant is None:
        variant = db.execute(
            select(VarianteProducto).where(
                VarianteProducto.id_tienda == store.id_tienda,
                VarianteProducto.sku == sku,
            )
        ).scalar_one_or_none()
    created = variant is None
    if variant is None:
        variant = VarianteProducto(id_variante=entity_id, id_tienda=store.id_tienda)
        db.add(variant)
    if variant.id_tienda != store.id_tienda:
        raise RuntimeError(f"El SKU {sku} pertenece a otra tienda")
    variant.id_producto = product.id_producto
    variant.sku = sku
    variant.precio_venta = Decimal(price)
    variant.costo_adquisicion = product.costo_adquisicion
    variant.stock_actual = stock
    variant.imagen_url = product.imagen_url
    variant.activa = True
    variant.es_predeterminada = default
    mark(stats, "variants", created)
    db.flush()

    for code, value in values.items():
        attribute = attributes[code]
        relation = db.get(VarianteAtributo, (variant.id_variante, attribute.id_atributo))
        relation_created = relation is None
        if relation is None:
            relation = VarianteAtributo(id_variante=variant.id_variante, id_atributo=attribute.id_atributo)
            db.add(relation)
        relation.id_opcion = options[(code, value)].id_opcion
        mark(stats, "variant_attributes", relation_created)


def ensure_offer(db, store: Tienda, categories: dict[str, Categoria], stats: Counter) -> None:
    entity_id = seed_uuid("offer", "lanzamiento-15")
    offer = db.get(Oferta, entity_id)
    created = offer is None
    if offer is None:
        offer = Oferta(id_oferta=entity_id, id_tienda=store.id_tienda)
        db.add(offer)
    offer.nombre = "Lanzamiento Luna"
    offer.tipo = "PERCENT"
    offer.porcentaje = Decimal("15.00")
    offer.prioridad = 100
    offer.activa = True
    offer.banner_url = IMAGES["hero"]
    offer.badge_text = "-15% lanzamiento"
    mark(stats, "offers", created)
    db.flush()

    for category_key in ("aros", "collares"):
        category = categories[category_key]
        relation = db.get(OfertaCategoria, (offer.id_oferta, category.id_categoria))
        relation_created = relation is None
        if relation is None:
            relation = OfertaCategoria(id_oferta=offer.id_oferta, id_categoria=category.id_categoria)
            db.add(relation)
        relation.activo = True
        mark(stats, "offer_categories", relation_created)


def ensure_admin(db, store: Tienda, reset_password: bool, stats: Counter) -> str:
    password = os.getenv(ADMIN_PASSWORD_ENV)
    if reset_password and not password:
        raise RuntimeError(
            f"--reset-admin-password requiere definir primero {ADMIN_PASSWORD_ENV}"
        )
    user = db.execute(select(Usuario).where(Usuario.email == ADMIN_EMAIL)).scalar_one_or_none()
    if user is not None and user.id_tienda != store.id_tienda:
        raise RuntimeError(f"El correo {ADMIN_EMAIL} ya pertenece a otra tienda")
    if user is None and not password:
        return f"omitido (define {ADMIN_PASSWORD_ENV} para crearlo)"
    if password and len(password) < 8:
        raise RuntimeError(f"{ADMIN_PASSWORD_ENV} debe tener al menos 8 caracteres")

    created = user is None
    if user is None:
        user = Usuario(
            id_usuario=seed_uuid("user", ADMIN_EMAIL),
            id_tienda=store.id_tienda,
            email=ADMIN_EMAIL,
            password_hash=hash_password(password),
            rol="admin",
            activo=True,
        )
        db.add(user)
    else:
        user.rol = "admin"
        user.activo = True
        if password and reset_password:
            user.password_hash = hash_password(password)
    mark(stats, "admins", created)
    if created:
        return "creado"
    return "actualizado; contraseña conservada" if not reset_password else "actualizado; contraseña reemplazada"


def apply_seed(reset_admin_password: bool) -> tuple[Counter, str]:
    stats: Counter = Counter()
    db = SessionLocal()
    try:
        assert_database_at_head(db)
        db.execute(text("SELECT pg_advisory_xact_lock(:lock_key)"), {"lock_key": LOCK_KEY})
        store = ensure_store(db, stats)

        categories: dict[str, Categoria] = {}
        for item in CATEGORIES:
            parent = categories.get(item["parent"])
            categories[item["key"]] = ensure_category(db, store, item, parent, stats)

        attributes: dict[str, Atributo] = {}
        options: dict[tuple[str, str], AtributoOpcion] = {}
        for item in ATTRIBUTES:
            attribute = ensure_attribute(db, store, item, stats)
            attributes[item["code"]] = attribute
            for order, value in enumerate(item.get("options", []), start=1):
                options[(item["code"], value)] = ensure_option(db, attribute, value, order, stats)

        for category_key, definitions in CATEGORY_ATTRIBUTES.items():
            for order, (code, required, filterable, used_in_variants) in enumerate(definitions, start=1):
                ensure_category_attribute(
                    db, categories[category_key], attributes[code], order,
                    required, filterable, used_in_variants, stats,
                )

        for item in PRODUCTS:
            product = ensure_product(db, store, categories[item["category"]], item, stats)
            for code, raw_values in item["attributes"].items():
                attribute = attributes[code]
                values = raw_values if isinstance(raw_values, list) else [raw_values]
                for raw_value in values:
                    option = options.get((code, raw_value))
                    value_key = normalize(str(raw_value))
                    ensure_product_attribute(db, product, attribute, raw_value, option, value_key, stats)
            db.execute(
                update(VarianteProducto)
                .where(VarianteProducto.id_producto == product.id_producto)
                .values(es_predeterminada=False)
            )
            for index, variant in enumerate(item["variants"]):
                ensure_variant(
                    db, store, product, variant,
                    attributes, options, index == 0, stats,
                )

        ensure_offer(db, store, categories, stats)
        store.theme_config = {
            **(store.theme_config or {}),
            "seed_key": SEED_KEY,
            "primary": "#8F3D56",
            "secondary": "#EBC8D1",
            "background": "#FFF9F7",
            "text": "#2E2025",
            "muted": "#77666C",
            "radius": 18,
            "hero_title": "Detalles que cuentan tu historia",
            "hero_subtitle": "Aros, manillas, collares y anillos para combinar a tu manera.",
            "hero_image_url": IMAGES["hero"],
            "category_images": {
                str(categories[key].id_categoria): IMAGES[key]
                for key in ("aros", "manillas", "collares", "anillos")
            },
            "show_offers": True,
            "show_featured": True,
            "category_style": "round_icons",
            "font_scale": "md",
        }
        admin_status = ensure_admin(db, store, reset_admin_password, stats)
        db.commit()
        return stats, admin_status
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def print_plan(counts: dict[str, int]) -> None:
    print("Seed de accesorios validado (modo simulación; base de datos sin cambios)")
    print(f"Tienda destino: Demo Accesorios (slug={STORE_SLUG})")
    print(f"Categorías: {counts['categories']} (Joyería + Aros, Manillas, Collares y Anillos)")
    print(f"Atributos: {counts['attributes']} | opciones: {counts['attribute_options']}")
    print(f"Productos: {counts['products']} | variantes/SKU: {counts['variants']}")
    print("Oferta: 15% de lanzamiento en Aros y Collares")
    print("Para escribir los datos ejecuta: python scripts/seed_accessories_store.py --apply")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed no destructivo para la tienda Demo Accesorios")
    parser.add_argument("--apply", action="store_true", help="Confirma la escritura en la base configurada")
    parser.add_argument(
        "--reset-admin-password",
        action="store_true",
        help=f"Reemplaza la contraseña del admin usando {ADMIN_PASSWORD_ENV}",
    )
    args = parser.parse_args()
    counts = validate_spec()
    if not args.apply:
        print_plan(counts)
        return

    stats, admin_status = apply_seed(args.reset_admin_password)
    print("Seed de accesorios completado en una transacción")
    print(f"Tienda pública: ?slug={STORE_SLUG}")
    print(f"Admin {ADMIN_EMAIL}: {admin_status}")
    for key in sorted(stats):
        print(f"{key}: {stats[key]}")


if __name__ == "__main__":
    main()
