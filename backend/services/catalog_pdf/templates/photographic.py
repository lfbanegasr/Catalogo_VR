from reportlab.lib.colors import Color, HexColor, white

from ..common import (
    PAGE_HEIGHT,
    PAGE_MARGIN,
    PAGE_WIDTH,
    draw_header,
    draw_price_badge,
    draw_product_image,
)
from .shared import draw_product_copy, grid_positions


def page_capacity(options) -> int:
    return options.products_per_page


def draw_page(pdf, *, store, category_name, category, products, attributes_by_product, options, page_number, page_index):
    draw_header(pdf, store.nombre_tienda, category_name, options, page_number)
    positions = grid_positions(
        len(products),
        top=PAGE_HEIGHT - 86,
        bottom=42,
        left=PAGE_MARGIN,
        right=PAGE_WIDTH - PAGE_MARGIN,
        gap=12,
    )
    for product, (x, y, width, height) in zip(products, positions):
        draw_product_image(
            pdf,
            product,
            category,
            options,
            x=x,
            y=y,
            width=width,
            height=height,
            default_shape="rounded",
            default_fit="contain",
        )
        panel_height = 82 if options.products_per_page >= 3 else 104
        pdf.saveState()
        pdf.setFillColor(Color(1, 1, 1, alpha=0.94))
        pdf.roundRect(x + 8, y + 8, width - 16, panel_height, 9, fill=1, stroke=0)
        pdf.restoreState()
        price = draw_product_copy(
            pdf,
            product,
            attributes_by_product.get(product.id_producto, []),
            options,
            store.currency_symbol,
            x=x + 17,
            y=y + panel_height - 12,
            width=width - 34,
            name_size=11 if options.products_per_page >= 3 else 13,
        )
        draw_price_badge(
            pdf,
            price,
            options,
            x=x + width - 86,
            y=y + panel_height - 2,
            width=76,
        )
