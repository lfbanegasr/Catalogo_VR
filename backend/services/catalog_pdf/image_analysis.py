from __future__ import annotations

import hashlib
import json
from io import BytesIO

from PIL import Image, ImageFilter, ImageOps, ImageStat, UnidentifiedImageError

from core.config import settings

from .common import asset_bytes
from .florence2 import analyze_with_florence


def _rgb_hex(rgb) -> str:
    values = tuple(max(0, min(255, round(value))) for value in rgb[:3])
    return "#%02X%02X%02X" % values


def _ocr_text(result: dict) -> str:
    ocr = result.get("ocr")
    if not isinstance(ocr, dict):
        return ""
    for value in ocr.values():
        if isinstance(value, dict):
            labels = value.get("labels") or []
            if isinstance(labels, list):
                return " ".join(str(item) for item in labels)
        if isinstance(value, str):
            return value
    return ""


def analyze_image_bytes(data: bytes | None, *, use_florence: bool = False) -> dict:
    if not data:
        return {
            "kind": "missing",
            "aspect": "missing",
            "has_text": False,
            "text_score": 0,
            "focal_x": 50,
            "focal_y": 50,
            "warnings": ["Producto sin imagen"],
        }
    try:
        source = Image.open(BytesIO(data)).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError):
        return {
            "kind": "invalid",
            "aspect": "missing",
            "has_text": False,
            "text_score": 0,
            "focal_x": 50,
            "focal_y": 50,
            "warnings": ["La imagen no se pudo leer"],
        }

    width, height = source.size
    ratio = width / max(1, height)
    aspect = "portrait" if ratio < 0.78 else "landscape" if ratio > 1.28 else "square"
    thumb = ImageOps.contain(source, (320, 320), Image.Resampling.LANCZOS)
    gray = thumb.convert("L")
    edges = gray.filter(ImageFilter.FIND_EDGES)
    edge_values = list(edges.getdata())
    edge_density = sum(value > 55 for value in edge_values) / max(1, len(edge_values))
    high_contrast = sum(value > 105 for value in edge_values) / max(1, len(edge_values))

    # Approximate the visual center using edge energy. It provides a useful
    # focal point without requiring a heavyweight model.
    weighted_x = weighted_y = total = 0.0
    sample = edges.resize((64, 64), Image.Resampling.BILINEAR)
    for y in range(64):
        for x in range(64):
            weight = max(0, sample.getpixel((x, y)) - 24)
            weighted_x += x * weight
            weighted_y += y * weight
            total += weight
    focal_x = round((weighted_x / total) / 63 * 100) if total else 50
    focal_y = round(100 - (weighted_y / total) / 63 * 100) if total else 50

    stats = ImageStat.Stat(thumb)
    mean = stats.mean[:3]
    luminance = round((0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2]) / 255, 3)
    extrema = gray.getextrema()
    contrast = round((extrema[1] - extrema[0]) / 255, 3)

    # Dense, high-contrast structures are a useful preliminary signal for
    # marketing artwork containing typography. Florence can confirm it.
    text_score = round(min(1.0, high_contrast * 2.1 + edge_density * 0.35), 3)
    florence = analyze_with_florence(source) if use_florence else None
    detected_text = _ocr_text(florence or {})
    has_text = len(detected_text.strip()) >= 8 or text_score >= 0.36
    kind = "promotional" if has_text else "lifestyle" if aspect == "portrait" and edge_density > 0.18 else "product"
    warnings = []
    if has_text:
        warnings.append("La imagen parece contener texto; se recomienda no superponer informacion")
    if min(width, height) < 600:
        warnings.append("Resolucion baja para impresion")
    return {
        "kind": kind,
        "aspect": aspect,
        "width": width,
        "height": height,
        "has_text": has_text,
        "text_score": text_score,
        "focal_x": max(10, min(90, focal_x)),
        "focal_y": max(10, min(90, focal_y)),
        "luminance": luminance,
        "contrast": contrast,
        "average_color": _rgb_hex(mean),
        "ocr_text": detected_text[:500],
        "florence": florence,
        "warnings": warnings,
    }


def classify_product_image(product, *, use_florence: bool = False) -> dict:
    data = asset_bytes(getattr(product, "imagen_url", None))
    if not data:
        return analyze_image_bytes(None, use_florence=False)
    key = hashlib.sha256(data + (b":florence" if use_florence else b":basic")).hexdigest()
    cache_dir = settings.UPLOADS_PATH / "catalog-ai-cache" / "analysis"
    cache_file = cache_dir / f"{key}.json"
    try:
        if cache_file.is_file():
            return json.loads(cache_file.read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError):
        pass
    result = analyze_image_bytes(data, use_florence=use_florence)
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(json.dumps(result, ensure_ascii=True), encoding="utf-8")
    except OSError:
        pass
    return result
