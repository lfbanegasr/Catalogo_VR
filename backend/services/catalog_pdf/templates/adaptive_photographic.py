from ..common import PAGE_HEIGHT, PAGE_MARGIN, PAGE_WIDTH, draw_header
from .adaptive_shared import draw_adaptive_card
from .shared import grid_positions


def page_capacity(options):
    return options.products_per_page


def draw_page(pdf, *, store, category_name, category, products, attributes_by_product, options, page_number, page_index):
    draw_header(pdf, store.nombre_tienda, category_name, options, page_number)
    positions = grid_positions(len(products), top=PAGE_HEIGHT - 86, bottom=42, left=PAGE_MARGIN, right=PAGE_WIDTH - PAGE_MARGIN, gap=12)
    for product, (x, y, width, height) in zip(products, positions):
        draw_adaptive_card(
            pdf, product=product, category=category,
            attributes=attributes_by_product.get(product.id_producto, []),
            options=options, currency_symbol=store.currency_symbol,
            x=x, y=y, width=width, height=height, variant="photographic",
        )
