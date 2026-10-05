from reportlab.lib.colors import HexColor

from ..common import PAGE_HEIGHT, PAGE_MARGIN, PAGE_WIDTH, contrast_text, draw_header, safe_text
from ..image_analysis import classify_product_image
from .adaptive_shared import draw_adaptive_card


def page_capacity(options):
    return 3


def _card(pdf, product, category, attributes_by_product, options, store, box, featured=False):
    x, y, width, height = box
    draw_adaptive_card(
        pdf, product=product, category=category,
        attributes=attributes_by_product.get(product.id_producto, []),
        options=options, currency_symbol=store.currency_symbol,
        x=x, y=y, width=width, height=height, variant="editorial", featured=featured,
    )


def draw_page(pdf, *, store, category_name, category, products, attributes_by_product, options, page_number, page_index):
    draw_header(pdf, store.nombre_tienda, category_name, options, page_number)
    top, bottom, gap = PAGE_HEIGHT - 90, 45, 15
    total_height = top - bottom
    available_width = PAGE_WIDTH - PAGE_MARGIN * 2
    missing = [
        product for product in products
        if classify_product_image(product).get("kind") in {"missing", "invalid"}
    ]
    present = [product for product in products if product not in missing]
    if options.smart_layout and missing and present:
        compact_height = min(175, total_height * 0.25)
        visual_height = total_height - compact_height - gap
        visual_width = (available_width - gap * (len(present) - 1)) / len(present)
        for index, product in enumerate(present):
            box = (PAGE_MARGIN + index * (visual_width + gap), bottom + compact_height + gap, visual_width, visual_height)
            _card(pdf, product, category, attributes_by_product, options, store, box, featured=True)
        compact_width = (available_width - gap * (len(missing) - 1)) / len(missing)
        for index, product in enumerate(missing):
            box = (PAGE_MARGIN + index * (compact_width + gap), bottom, compact_width, compact_height)
            _card(pdf, product, category, attributes_by_product, options, store, box)
    elif len(products) == 1:
        box = (PAGE_MARGIN + 34, bottom, available_width - 68, total_height)
        _card(pdf, products[0], category, attributes_by_product, options, store, box, featured=True)
    elif len(products) == 2:
        width = (available_width - gap) / 2
        for index, product in enumerate(products):
            box = (PAGE_MARGIN + index * (width + gap), bottom, width, total_height)
            _card(pdf, product, category, attributes_by_product, options, store, box, featured=True)
    else:
        left_width = 315
        right_x = PAGE_MARGIN + left_width + gap
        right_width = PAGE_WIDTH - PAGE_MARGIN - right_x
        _card(pdf, products[0], category, attributes_by_product, options, store, (PAGE_MARGIN, bottom, left_width, total_height), featured=True)
        small_height = (total_height - gap) / 2
        for index, product in enumerate(products[1:3]):
            y = top - (index + 1) * small_height - index * gap
            _card(pdf, product, category, attributes_by_product, options, store, (right_x, y, right_width, small_height))
    pdf.saveState()
    pdf.setFillColor(HexColor(options.primary_color))
    pdf.rect(18, PAGE_HEIGHT * 0.36, 13, 158, fill=1, stroke=0)
    pdf.setFillColor(contrast_text(options.primary_color))
    pdf.setFont("Helvetica-Bold", 7)
    pdf.translate(27, PAGE_HEIGHT * 0.38)
    pdf.rotate(90)
    pdf.drawString(0, 0, safe_text(category_name).upper())
    pdf.restoreState()
