from __future__ import annotations

from reportlab.lib.colors import HexColor

from ..common import draw_lines, money, safe_text, wrap_lines


def grid_positions(count: int, *, top: float, bottom: float, left: float, right: float, gap: float = 12):
    columns = 2 if count > 1 else 1
    rows = 1 if count <= 2 else 2
    width = (right - left - gap * (columns - 1)) / columns
    height = (top - bottom - gap * (rows - 1)) / rows
    positions = []
    for index in range(count):
        row = index // columns
        column = index % columns
        x = left + column * (width + gap)
        y = top - (row + 1) * height - row * gap
        if count == 3 and index == 2:
            x = left + (right - left - width) / 2
        positions.append((x, y, width, height))
    return positions


def draw_product_copy(
    pdf,
    product,
    attributes,
    options,
    currency_symbol,
    *,
    x,
    y,
    width,
    name_size=11,
    description_lines=2,
    show_price=False,
):
    text = HexColor(options.text_color)
    cursor = draw_lines(
        pdf,
        wrap_lines(product.nombre, "Helvetica-Bold", name_size, width, 2),
        x=x,
        y=y,
        font="Helvetica-Bold",
        size=name_size,
        color=text,
        leading=name_size + 2,
    )
    price = money(product.precio_venta, currency_symbol)
    if show_price:
        pdf.setFillColor(HexColor(options.price_color))
        pdf.setFont("Helvetica-Bold", name_size + 1)
        pdf.drawString(x, cursor - 2, price)
        cursor -= name_size + 11
    if options.show_description and product.descripcion:
        size = max(7, name_size - 3.5)
        cursor = draw_lines(
            pdf,
            wrap_lines(product.descripcion, "Helvetica", size, width, description_lines),
            x=x,
            y=cursor,
            font="Helvetica",
            size=size,
            color=HexColor(options.muted_color),
            leading=size + 2,
        )
    if options.show_attributes and attributes:
        size = max(6.5, name_size - 4)
        draw_lines(
            pdf,
            wrap_lines("  |  ".join(attributes[:4]), "Helvetica", size, width, 2),
            x=x,
            y=cursor - 1,
            font="Helvetica",
            size=size,
            color=HexColor(options.muted_color),
            leading=size + 2,
        )
    return price
