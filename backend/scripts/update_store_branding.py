from __future__ import annotations

import sys
from pathlib import Path
from sqlalchemy import select

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from core.database import SessionLocal
from models.tenant import Tienda

STORE_SLUG = "loriglow-cosmetics"

def update_branding():
    db = SessionLocal()
    try:
        store = db.execute(select(Tienda).where(Tienda.slug == STORE_SLUG)).scalar_one_or_none()
        if not store:
            raise RuntimeError(f"No se encontró la tienda {STORE_SLUG}")

        cfg = dict(store.theme_config or {})
        cfg["hero_logo_url"] = "/uploads/theme/loriglow_logo.jpg"
        cfg["hero_image_url"] = "/uploads/theme/loriglow_banner.jpg"
        cfg["hero_title"] = "Tu dosis diaria de ternura y brillo ✨"
        cfg["hero_subtitle"] = "Cosméticos virales, labiales hidratantes, pestañas de ensueño y regalitos cute en Santa Cruz de la Sierra."
        cfg["hero_kicker"] = "Boutique de Belleza & Cuidado Femenino"
        cfg["primary"] = "#E85D75"
        cfg["secondary"] = "#FCE7F0"
        cfg["background"] = "#FFF9FA"
        cfg["radius"] = 18
        cfg["show_offers"] = True
        cfg["show_featured"] = True
        cfg["category_style"] = "round_icons"
        cfg["contact_whatsapp"] = "59178000000"
        cfg["contact_phone"] = "+591 78000000"
        cfg["social_instagram"] = "loriglow.bo"
        cfg["social_tiktok"] = "@loriglow.bo"
        cfg["side_menu_title"] = "LoriGlow Cosmetics"
        cfg["side_menu_text"] = "Boutique de cosméticos cute en Santa Cruz de la Sierra, Bolivia. Envíos express en moto y a nivel nacional."

        store.theme_config = cfg
        db.commit()
        print(f"[OK] Branding y opciones visuales actualizadas para {store.nombre_tienda}")
    finally:
        db.close()

if __name__ == "__main__":
    update_branding()
