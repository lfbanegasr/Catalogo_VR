from __future__ import annotations

from io import BytesIO

from PIL import Image, ImageOps

from .common import asset_bytes
from .florence2 import florence_status
from .background_removal import background_removal_status
from .image_analysis import classify_product_image
from .palette import extract_palette_suggestions


def _catalog_montage(products) -> bytes | None:
    tiles = []
    for product in products[:36]:
        data = asset_bytes(getattr(product, "imagen_url", None))
        if not data:
            continue
        try:
            image = Image.open(BytesIO(data)).convert("RGB")
            tiles.append(ImageOps.fit(image, (120, 120), Image.Resampling.LANCZOS))
        except (OSError, ValueError):
            continue
    if not tiles:
        return None
    columns = 6
    rows = (len(tiles) + columns - 1) // columns
    montage = Image.new("RGB", (columns * 120, rows * 120), "white")
    for index, tile in enumerate(tiles):
        montage.paste(tile, ((index % columns) * 120, (index // columns) * 120))
    output = BytesIO()
    montage.save(output, format="JPEG", quality=88)
    return output.getvalue()


def analyze_catalog_products(products, *, use_florence: bool = False) -> dict:
    florence = florence_status()
    use_florence = bool(use_florence and florence["available"])
    analyses = []
    for product in products:
        result = classify_product_image(product, use_florence=use_florence)
        analyses.append({"product_id": str(product.id_producto), "name": product.nombre, **result})

    montage = _catalog_montage(products)
    palette = extract_palette_suggestions(montage) if montage else None
    kinds = {kind: sum(item["kind"] == kind for item in analyses) for kind in ("product", "lifestyle", "promotional", "missing", "invalid")}
    image_count = max(1, len(analyses) - kinds["missing"] - kinds["invalid"])
    promotional_ratio = kinds["promotional"] / image_count
    portrait_ratio = sum(item.get("aspect") == "portrait" for item in analyses) / image_count
    recommended_template = "editorial" if promotional_ratio >= 0.35 else "photographic" if portrait_ratio >= 0.45 else "minimal"
    recommended_fit = "contain" if promotional_ratio >= 0.25 else "cover"
    warnings = [warning for item in analyses for warning in item.get("warnings", [])]
    return {
        "products": analyses,
        "summary": {
            "total": len(analyses),
            "kinds": kinds,
            "recommended_template": recommended_template,
            "recommended_image_fit": recommended_fit,
            "warnings": list(dict.fromkeys(warnings))[:8],
        },
        "palette": palette,
        "ai": {
            "florence": florence,
            "florence_used": any(bool((item.get("florence") or {}).get("available")) for item in analyses),
            "background_removal": background_removal_status(),
        },
    }
