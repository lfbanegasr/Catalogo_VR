from __future__ import annotations

import colorsys
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError


def _hex(rgb: tuple[int, int, int]) -> str:
    return "#%02X%02X%02X" % rgb


def _luminance(rgb: tuple[int, int, int]) -> float:
    return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255


def _saturation(rgb: tuple[int, int, int]) -> float:
    return colorsys.rgb_to_hsv(*(channel / 255 for channel in rgb))[1]


def _mix(first: tuple[int, int, int], second: tuple[int, int, int], ratio: float) -> tuple[int, int, int]:
    return tuple(round(a * (1 - ratio) + b * ratio) for a, b in zip(first, second))


def extract_palette_suggestions(data: bytes) -> dict:
    try:
        source = Image.open(BytesIO(data)).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ValueError("No se pudo analizar la imagen de referencia") from exc
    source = ImageOps.fit(source, (320, 320), Image.Resampling.LANCZOS)
    quantized = source.quantize(colors=10, method=Image.Quantize.MEDIANCUT)
    raw_palette = quantized.getpalette() or []
    counts = quantized.getcolors() or []
    colors: list[tuple[int, int, int]] = []
    for _, index in sorted(counts, reverse=True):
        offset = index * 3
        rgb = tuple(raw_palette[offset:offset + 3])
        if len(rgb) != 3:
            continue
        if any(sum(abs(a - b) for a, b in zip(rgb, existing)) < 48 for existing in colors):
            continue
        colors.append(rgb)
        if len(colors) == 6:
            break
    if not colors:
        colors = [(158, 75, 99), (248, 245, 242), (45, 38, 48)]

    darkest = min(colors, key=_luminance)
    lightest = max(colors, key=_luminance)
    accent = max(colors, key=lambda item: _saturation(item) * 0.65 + (1 - abs(_luminance(item) - 0.48)) * 0.35)
    secondary = next((color for color in colors if color != accent and color != darkest), _mix(accent, (255, 255, 255), 0.55))
    soft_background = _mix(lightest, (255, 255, 255), 0.72)
    soft_end = _mix(accent, (255, 255, 255), 0.88)
    contrast_background = darkest
    contrast_text = (255, 255, 255)
    return {
        "colors": [_hex(color) for color in colors],
        "suggestions": [
            {
                "name": "Equilibrada",
                "primary_color": _hex(accent),
                "secondary_color": _hex(secondary),
                "background_color": _hex(soft_background),
                "gradient_end_color": _hex(soft_end),
                "text_color": _hex(darkest),
                "price_color": _hex(accent),
            },
            {
                "name": "Suave",
                "primary_color": _hex(_mix(accent, darkest, 0.15)),
                "secondary_color": _hex(_mix(secondary, (255, 255, 255), 0.4)),
                "background_color": "#FFFFFF",
                "gradient_end_color": _hex(_mix(lightest, (255, 255, 255), 0.55)),
                "text_color": _hex(darkest),
                "price_color": _hex(accent),
            },
            {
                "name": "Contraste",
                "primary_color": _hex(accent),
                "secondary_color": _hex(secondary),
                "background_color": _hex(contrast_background),
                "gradient_end_color": _hex(_mix(darkest, accent, 0.28)),
                "text_color": _hex(contrast_text),
                "price_color": _hex(accent if _luminance(accent) > 0.28 else secondary),
            },
        ],
    }
