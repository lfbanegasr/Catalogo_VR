from reportlab.lib.colors import HexColor

from ..common import (
    PAGE_HEIGHT,
    PAGE_MARGIN,
    PAGE_WIDTH,
    draw_decorative_spark,
    draw_header,
    draw_price_badge,
    draw_product_image,
)
from .shared import draw_product_copy, grid_positions


def page_capacity(options) -> int:
    return options.products_per_page


def draw_page(pdf, *, store, category_name, category, products, attributes_by_product, options, page_number, page_index):
    draw_header(pdf, store.nombre_tienda, category_name, options, page_number, align="center")
    draw_decorative_spark(pdf, PAGE_WIDTH - 62, PAGE_HEIGHT - 64, 10, options.primary_color)
    positions = grid_positions(
        len(products),
        top=PAGE_HEIGHT - 92,
        bottom=44,
        left=PAGE_MARGIN + 8,
        right=PAGE_WIDTH - PAGE_MARGIN - 8,
        gap=16,
    )
    for index, (product, (x, y, width, height)) in enumerate(zip(products, positions)):
        image_size = min(width - 12, height * 0.64)
        image_x = x + (width - image_size) / 2
        image_y = y + height - image_size - 8
        pdf.saveState()
        pdf.setFillAlpha(0.18)
        pdf.setFillColor(HexColor(options.secondary_color))
        pdf.circle(image_x + image_size / 2 + 8, image_y + image_size / 2 - 8, image_size / 2 + 8, fill=1, stroke=0)
        pdf.restoreState()
        draw_product_image(
            pdf,
            product,
            category,
            options,
            x=image_x,
            y=image_y,
            width=image_size,
            height=image_size,
            default_shape="circle",
            default_fit="contain",
        )
        price = draw_product_copy(
            pdf,
            product,
            attributes_by_product.get(product.id_producto, []),
            options,
            store.currency_symbol,
            x=x + 8,
            y=image_y - 18,
            width=width - 16,
            name_size=11.5,
        )
        draw_price_badge(
            pdf,
            price,
            options,
            x=image_x + image_size - 54,
            y=image_y - 7,
            width=58,
            style="circle" if options.price_style == "circle" else options.price_style,
        )
        if index % 2 == 0:
            draw_decorative_spark(pdf, x + 10, image_y + image_size * 0.88, 7, options.secondary_color)
