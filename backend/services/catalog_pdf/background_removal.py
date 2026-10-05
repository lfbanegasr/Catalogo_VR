from __future__ import annotations

import hashlib
import importlib.util
import logging
from pathlib import Path

from core.config import settings


logger = logging.getLogger("catalog_pdf.ai")
_SESSION = None


def background_removal_status() -> dict:
    installed = importlib.util.find_spec("rembg") is not None
    return {"available": installed, "provider": "rembg", "cached": True}


def remove_background_cached(data: bytes) -> bytes:
    global _SESSION
    if not data or not background_removal_status()["available"]:
        return data
    cache_dir = settings.UPLOADS_PATH / "catalog-ai-cache" / "backgrounds"
    digest = hashlib.sha256(data).hexdigest()
    cached = cache_dir / f"{digest}.png"
    try:
        if cached.is_file():
            return cached.read_bytes()
        from rembg import new_session, remove

        if _SESSION is None:
            _SESSION = new_session("isnet-general-use")
        result = remove(data, session=_SESSION)
        cache_dir.mkdir(parents=True, exist_ok=True)
        cached.write_bytes(result)
        return result
    except Exception as exc:
        logger.warning("No se pudo quitar el fondo de una imagen: %s", exc)
        return data
