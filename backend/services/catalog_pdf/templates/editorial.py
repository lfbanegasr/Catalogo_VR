from reportlab.lib.colors import HexColor, white

from ..common import (
    PAGE_HEIGHT,
    PAGE_MARGIN,
    PAGE_WIDTH,
    contrast_text,
    draw_header,
    draw_price_badge,
    draw_product_image,
    safe_text,
)
from .shared import draw_product_copy


def page_capacity(options) -> int:
    return 3


def _draw_editorial_product(pdf, product, category, attributes, options, store, *, x, y, width, height, featured=False):
    image_height = height * (0.68 if featured else 0.62)
    draw_product_image(
        pdf,
        product,
        category,
        options,
        x=x,
        y=y + height - image_height,
        width=width,
        height=image_height,
        default_shape="square",
        default_fit="cover",
    )
    price = draw_product_copy(
        pdf,
        product,
        attributes,
        options,
        store.currency_symbol,
        x=x,
        y=y + height - image_height - 18,
        width=width,
        name_size=14 if featured else 10.5,
        description_lines=3 if featured else 1,
    )
    draw_price_badge(
        pdf,
        price,
        options,
        x=x + width - (82 if featured else 68),
        y=y + height - image_height - 13,
        width=78 if featured else 65,
    )


def draw_page(pdf, *, store, category_name, category, products, attributes_by_product, options, page_number, page_index):
    draw_header(pdf, store.nombre_tienda, category_name, options, page_number)
    top = PAGE_HEIGHT - 90
    bottom = 45
    gap = 15
    left_width = 315
    right_x = PAGE_MARGIN + left_width + gap
    right_width = PAGE_WIDTH - PAGE_MARGIN - right_x
    total_height = top - bottom
    first = products[0]
    _draw_editorial_product(
        pdf,
        first,
        category,
        attributes_by_product.get(first.id_producto, []),
        options,
        store,
        x=PAGE_MARGIN,
        y=bottom,
        width=left_width,
        height=total_height,
        featured=True,
    )
    if len(products) > 1:
        small_height = (total_height - gap) / 2
        for index, product in enumerate(products[1:3]):
            y = top - (index + 1) * small_height - index * gap
            _draw_editorial_product(
                pdf,
                product,
                category,
                attributes_by_product.get(product.id_producto, []),
                options,
                store,
                x=right_x,
                y=y,
                width=right_width,
                height=small_height,
            )
    pdf.saveState()
    pdf.setFillColor(HexColor(options.primary_color))
    pdf.rect(18, PAGE_HEIGHT * 0.36, 13, 158, fill=1, stroke=0)
    pdf.setFillColor(contrast_text(options.primary_color))
    pdf.setFont("Helvetica-Bold", 7)
    pdf.translate(27, PAGE_HEIGHT * 0.38)
    pdf.rotate(90)
    pdf.drawString(0, 0, safe_text(category_name).upper())
    pdf.restoreState()
