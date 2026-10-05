from __future__ import annotations


def product_overrides(options) -> dict[str, object]:
    return {
        str(item.product_id): item
        for item in getattr(options, "product_overrides", [])
    }


def product_override(options, product) -> object | None:
    return product_overrides(options).get(str(product.id_producto))


def page_override(options, category, page_index: int) -> object | None:
    category_id = str(category.id_categoria) if category is not None else None
    for item in getattr(options, "page_overrides", []):
        item_category_id = str(item.category_id) if item.category_id is not None else None
        if item_category_id == category_id and item.page_index == page_index:
            return item
    return None


def options_for_page(options, category, page_index: int):
    override = page_override(options, category, page_index)
    if override is None:
        return options
    changes = {
        key: value
        for key, value in override.model_dump(exclude={"category_id", "page_index"}).items()
        if value is not None
    }
    return options.model_copy(update=changes) if changes else options


def order_products(products, options):
    by_id = product_overrides(options)
    original = {str(product.id_producto): index for index, product in enumerate(products)}
    return sorted(
        products,
        key=lambda product: (
            getattr(by_id.get(str(product.id_producto)), "order", original[str(product.id_producto)]),
            original[str(product.id_producto)],
        ),
    )
