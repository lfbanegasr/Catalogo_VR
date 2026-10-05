from __future__ import annotations

import logging

from core.storage import delete_asset_file

logger = logging.getLogger("catalog_pdf")


def delete_catalog_cover(path_or_url: str | None) -> None:
    value = str(path_or_url or "").strip()
    if not value:
        return
    norm = value.replace("\\", "/").lower()
    if "catalog-covers" not in norm:
        return
    try:
        delete_asset_file(value)
    except Exception:
        logger.exception("No se pudo eliminar una portada de catalogo")
