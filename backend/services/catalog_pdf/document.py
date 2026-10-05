from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from io import BytesIO

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from .common import (
    PAGE_HEIGHT,
    PAGE_MARGIN,
    PAGE_WIDTH,
    category_label,
    contrast_text,
    draw_background,
    draw_decorative_spark,
    prepared_image,
    safe_text,
    wrap_lines,
)
from .templates import TEMPLATE_RENDERERS


def _draw_cover(pdf, store, options, product_count: int) -> None:
    custom = prepared_image(
        options.cover_url,
        width_px=1400,
        height_px=1980,
        background=options.background_color,
        fit=options.cover_fit,
    ) if options.cover_url else None
    if custom:
        pdf.drawImage(ImageReader(custom), 0, 0, width=PAGE_WIDTH, height=PAGE_HEIGHT, mask="auto")
        if not options.cover_text_overlay:
            pdf.showPage()
            return
        pdf.saveState()
        pdf.setFillColor(Color(0, 0, 0, alpha=0.48))
        pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT * 0.34, fill=1, stroke=0)
        pdf.restoreState()
        title_color = white
        title_y = PAGE_HEIGHT * 0.27
    else:
        draw_background(pdf, options)
        title_color = HexColor(options.text_color)
        title_y = PAGE_HEIGHT * 0.58
        pdf.saveState()
        pdf.setFillAlpha(0.18)
        pdf.setFillColor(HexColor(options.secondary_color))
        pdf.circle(PAGE_WIDTH * 0.72, PAGE_HEIGHT * 0.7, 130, fill=1, stroke=0)
        pdf.setFillColor(HexColor(options.primary_color))
        pdf.circle(PAGE_WIDTH * 0.68, PAGE_HEIGHT * 0.69, 84, fill=1, stroke=0)
        pdf.restoreState()
        draw_decorative_spark(pdf, PAGE_WIDTH - 90, PAGE_HEIGHT - 95, 15, options.primary_color)
        logo = prepared_image(
            (store.theme_config or {}).get("hero_logo_url"),
            width_px=520,
            height_px=170,
            background=options.background_color,
            fit="contain",
        )
        if logo:
            pdf.drawImage(ImageReader(logo), PAGE_MARGIN, PAGE_HEIGHT - 92, width=145, height=48, mask="auto")
        else:
            pdf.setFillColor(title_color)
            pdf.setFont("Helvetica-Bold", 10)
            pdf.drawString(PAGE_MARGIN, PAGE_HEIGHT - 60, safe_text(store.nombre_tienda).upper())

    title = safe_text(options.title or "CATALOGO DE PRODUCTOS")
    subtitle = safe_text(options.subtitle or store.nombre_tienda)
    pdf.setFillColor(title_color)
    pdf.setFont("Helvetica-Bold", 31)
    cursor = title_y
    for line in wrap_lines(title, "Helvetica-Bold", 31, PAGE_WIDTH - PAGE_MARGIN * 2, 3):
        pdf.drawString(PAGE_MARGIN, cursor, line)
        cursor -= 36
    pdf.setStrokeColor(HexColor(options.primary_color))
    pdf.setLineWidth(4)
    pdf.line(PAGE_MARGIN, cursor - 1, PAGE_MARGIN + 78, cursor - 1)
    pdf.setFillColor(title_color)
    pdf.setFont("Helvetica", 13)
    pdf.drawString(PAGE_MARGIN, cursor - 31, subtitle)
    pdf.setFont("Helvetica", 8.5)
    pdf.drawString(PAGE_MARGIN, 34, f"{product_count} productos")
    pdf.drawRightString(PAGE_WIDTH - PAGE_MARGIN, 34, datetime.now().strftime("%Y"))
    pdf.showPage()


def build_catalog_pdf(*, store, categories, products, options, attributes_by_product=None) -> bytes:
    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=(PAGE_WIDTH, PAGE_HEIGHT), pageCompression=1)
    pdf.setTitle(safe_text(options.title or f"Catalogo - {store.nombre_tienda}"))
    pdf.setAuthor(safe_text(store.nombre_tienda))
    attributes_by_product = attributes_by_product or {}
    renderer = TEMPLATE_RENDERERS[options.template]

    if options.show_cover:
        _draw_cover(pdf, store, options, len(products))

    by_id = {category.id_categoria: category for category in categories}
    grouped = defaultdict(list)
    for product in products:
        grouped[product.id_categoria_principal or product.id_categoria].append(product)
    ordered_categories = sorted(
        [category for category in categories if grouped.get(category.id_categoria)],
        key=lambda item: (item.orden, category_label(item, by_id).lower()),
    )
    sections = [
        (category_label(category, by_id), category, grouped[category.id_categoria])
        for category in ordered_categories
    ]
    if grouped.get(None):
        sections.append(("Sin categoria", None, grouped[None]))

    page_number = 1 if options.show_cover else 0
    page_index = 0
    capacity = renderer.page_capacity(options)
    for category_name, category, section_products in sections:
        for offset in range(0, len(section_products), capacity):
            page_number += 1
            page_index += 1
            draw_background(pdf, options, page_index)
            renderer.draw_page(
                pdf,
                store=store,
                category_name=category_name,
                category=category,
                products=section_products[offset:offset + capacity],
                attributes_by_product=attributes_by_product,
                options=options,
                page_number=page_number,
                page_index=page_index,
            )
            pdf.showPage()
    pdf.save()
    return output.getvalue()
