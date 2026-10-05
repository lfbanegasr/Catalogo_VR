from reportlab.lib.colors import HexColor

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
        gap=14,
    )
    for product, (x, y, width, height) in zip(products, positions):
        pdf.setFillColor(HexColor("#FFFFFF"))
        pdf.roundRect(x, y, width, height, 12, fill=1, stroke=0)
        padding = 11
        details_height = 92 if options.products_per_page >= 3 else 116
        image_height = height - details_height - padding * 2
        draw_product_image(
            pdf,
            product,
            category,
            options,
            x=x + padding,
            y=y + height - padding - image_height,
            width=width - padding * 2,
            height=image_height,
            default_shape="rounded",
        )
        price = draw_product_copy(
            pdf,
            product,
            attributes_by_product.get(product.id_producto, []),
            options,
            store.currency_symbol,
            x=x + padding,
            y=y + details_height - 20,
            width=width - padding * 2,
            name_size=11 if options.products_per_page >= 3 else 13,
        )
        badge_width = 74 if options.price_style != "circle" else 60
        draw_price_badge(
            pdf,
            price,
            options,
            x=x + width - badge_width - 7,
            y=y + height - padding - image_height - (16 if options.price_style == "circle" else 11),
            width=badge_width,
        )
