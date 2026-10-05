from reportlab.lib.colors import HexColor

from ..common import PAGE_HEIGHT, PAGE_MARGIN, PAGE_WIDTH, draw_decorative_spark, draw_header
from .adaptive_shared import draw_adaptive_card
from .shared import grid_positions


def page_capacity(options):
    return options.products_per_page


def draw_page(pdf, *, store, category_name, category, products, attributes_by_product, options, page_number, page_index):
    draw_header(pdf, store.nombre_tienda, category_name, options, page_number, align="center")
    draw_decorative_spark(pdf, PAGE_WIDTH - 62, PAGE_HEIGHT - 64, 10, options.primary_color)
    positions = grid_positions(len(products), top=PAGE_HEIGHT - 94, bottom=44, left=PAGE_MARGIN + 8, right=PAGE_WIDTH - PAGE_MARGIN - 8, gap=18)
    for index, (product, position) in enumerate(zip(products, positions)):
        x, y, width, height = position
        pdf.saveState()
        pdf.setFillAlpha(0.12)
        pdf.setFillColor(HexColor(options.secondary_color))
        pdf.circle(x + width / 2 + 9, y + height * 0.68, min(width, height) * 0.42, fill=1, stroke=0)
        pdf.restoreState()
        draw_adaptive_card(
            pdf, product=product, category=category,
            attributes=attributes_by_product.get(product.id_producto, []),
            options=options, currency_symbol=store.currency_symbol,
            x=x, y=y, width=width, height=height, variant="organic",
        )
        if index % 2 == 0:
            draw_decorative_spark(pdf, x + 8, y + height - 15, 7, options.secondary_color)
