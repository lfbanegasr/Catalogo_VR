from __future__ import annotations

import copy
import hashlib

from reportlab.lib.colors import Color, HexColor

from core.config import settings

from ..background_removal import remove_background_cached
from ..common import (
    asset_bytes,
    contrast_text,
    draw_lines,
    draw_price_badge,
    draw_product_image,
    money,
    safe_text,
    wrap_lines,
)
from ..image_analysis import classify_product_image
from ..layout import product_override


def _resolved_product(product, options):
    override = product_override(options, product)
    if override is None:
        return product, None
    rendered = copy.copy(product)
    if override.image_fit != "auto":
        rendered.imagen_fit = override.image_fit
    rendered.imagen_posicion_x = override.image_position_x
    rendered.imagen_posicion_y = override.image_position_y
    rendered.imagen_zoom = override.image_zoom
    if override.remove_background or getattr(options, "enable_background_removal", False):
        data = asset_bytes(getattr(product, "imagen_url", None))
        if data:
            digest = hashlib.sha256(data).hexdigest()
            relative = f"catalog-ai-cache/backgrounds/{digest}.png"
            destination = settings.UPLOADS_PATH / relative
            result = remove_background_cached(data)
            if result != data or destination.is_file():
                try:
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    if not destination.is_file():
                        destination.write_bytes(result)
                    rendered.imagen_url = f"/uploads/{relative}"
                    rendered.imagen_fit = "contain"
                except OSError:
                    pass
    return rendered, override


def _draw_plain_price(pdf, price, options, *, x, y):
    pdf.setFillColor(HexColor(options.price_color))
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(x, y, price)


def draw_adaptive_card(
    pdf,
    *,
    product,
    category,
    attributes,
    options,
    currency_symbol,
    x,
    y,
    width,
    height,
    variant="minimal",
    featured=False,
):
    rendered, override = _resolved_product(product, options)
    analysis = classify_product_image(
        product,
        use_florence=bool(getattr(options, "use_florence", False)),
    ) if getattr(options, "smart_image_analysis", True) else {"kind": "product", "has_text": False}
    kind = analysis.get("kind", "product")
    has_image = kind not in {"missing", "invalid"}
    promotional = kind == "promotional"
    padding = 10 if not featured else 12

    if variant in {"minimal", "photographic", "editorial"}:
        pdf.saveState()
        if variant == "photographic":
            pdf.setFillColor(Color(1, 1, 1, alpha=0.96))
        else:
            pdf.setFillColor(HexColor("#FFFFFF"))
        pdf.roundRect(x, y, width, height, 12 if variant != "editorial" else 7, fill=1, stroke=0)
        pdf.restoreState()

    if not has_image:
        image_height = min(78, height * 0.24)
    elif promotional:
        image_height = height * (0.79 if featured else 0.72)
    elif featured:
        image_height = height * 0.70
    else:
        image_height = height * (0.62 if height < 360 else 0.67)
    image_height = max(52, min(height - 75, image_height))
    image_x = x + padding
    image_y = y + height - padding - image_height
    image_width = width - padding * 2

    if has_image:
        default_shape = "circle" if variant == "organic" else "rounded" if variant != "editorial" else "square"
        default_fit = "contain" if promotional or variant == "photographic" else "cover"
        if analysis.get("focal_x") is not None and override is None:
            rendered.imagen_posicion_x = analysis["focal_x"]
            rendered.imagen_posicion_y = analysis["focal_y"]
        draw_product_image(
            pdf,
            rendered,
            category,
            options,
            x=image_x,
            y=image_y,
            width=image_width,
            height=image_height,
            default_shape=default_shape,
            default_fit=default_fit,
        )
    else:
        pdf.saveState()
        pdf.setFillColor(HexColor(options.gradient_end_color))
        pdf.roundRect(image_x, image_y, image_width, image_height, 8, fill=1, stroke=0)
        pdf.setFillColor(HexColor(options.muted_color))
        pdf.setFont("Helvetica-Bold", 8)
        pdf.drawCentredString(x + width / 2, image_y + image_height / 2 + 2, "PRODUCTO SIN IMAGEN")
        pdf.restoreState()

    show_name = override.show_name if override is not None else True
    show_description = (
        override.show_description if override is not None and override.show_description is not None
        else options.show_description and not promotional
    )
    show_attributes = (
        override.show_attributes if override is not None and override.show_attributes is not None
        else options.show_attributes and not promotional
    )
    price_display = override.price_display if override is not None else "badge"
    price = money(product.precio_venta, currency_symbol)
    price_reserve = 35 if price_display != "hidden" else 5
    copy_top = image_y - 12
    copy_bottom = y + padding + price_reserve
    cursor = copy_top
    name_size = 12.5 if featured else 10.5 if height < 360 else 11.5
    if show_name and cursor > copy_bottom:
        lines = wrap_lines(product.nombre, "Helvetica-Bold", name_size, image_width, 2)
        cursor = draw_lines(
            pdf,
            lines,
            x=image_x,
            y=cursor,
            font="Helvetica-Bold",
            size=name_size,
            color=HexColor(options.text_color),
            leading=name_size + 2,
        )
    if show_description and product.descripcion and cursor - 8 > copy_bottom:
        size = max(6.8, name_size - 3.8)
        available_lines = max(1, min(3 if featured else 2, int((cursor - copy_bottom) / (size + 2))))
        cursor = draw_lines(
            pdf,
            wrap_lines(product.descripcion, "Helvetica", size, image_width, available_lines),
            x=image_x,
            y=cursor - 2,
            font="Helvetica",
            size=size,
            color=HexColor(options.muted_color),
            leading=size + 2,
        )
    if show_attributes and attributes and cursor - 8 > copy_bottom:
        size = 6.5
        available_lines = max(1, min(2, int((cursor - copy_bottom) / (size + 2))))
        draw_lines(
            pdf,
            wrap_lines(" | ".join(attributes[:4]), "Helvetica", size, image_width, available_lines),
            x=image_x,
            y=cursor - 2,
            font="Helvetica",
            size=size,
            color=HexColor(options.muted_color),
            leading=size + 2,
        )

    if price_display == "plain":
        _draw_plain_price(pdf, price, options, x=image_x, y=y + padding + 3)
    elif price_display == "badge":
        badge_width = 74 if options.price_style != "circle" else 58
        badge_height = 58 if options.price_style == "circle" else 28
        draw_price_badge(
            pdf,
            price,
            options,
            x=x + width - padding - badge_width,
            y=y + padding,
            width=badge_width,
        )
        if not show_name and promotional:
            pdf.setFillColor(contrast_text(options.price_color))
    return analysis
