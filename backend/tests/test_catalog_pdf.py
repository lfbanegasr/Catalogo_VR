import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from schemas.catalog_pdf_schema import CatalogPdfRequest
from services.catalog_pdf_service import build_catalog_pdf


def make_category(name, order=0, parent_id=None):
    return SimpleNamespace(
        id_categoria=uuid4(),
        id_categoria_padre=parent_id,
        nombre=name,
        orden=order,
        imagen_fondo_default="#F5F0F2",
        imagen_fit_default="contain",
        imagen_posicion_x_default=50,
        imagen_posicion_y_default=50,
        imagen_zoom_default=100,
    )


def make_product(name, category_id, price):
    return SimpleNamespace(
        id_producto=uuid4(),
        id_categoria=category_id,
        id_categoria_principal=category_id,
        nombre=name,
        descripcion="Descripcion breve para comprobar la composicion.",
        precio_venta=Decimal(price),
        imagen_url=None,
        imagen_fit=None,
        imagen_fondo=None,
        imagen_posicion_x=None,
        imagen_posicion_y=None,
        imagen_zoom=None,
    )


class TestCatalogPdf(unittest.TestCase):
    def test_request_accepts_supported_page_densities(self):
        self.assertEqual(CatalogPdfRequest(products_per_page=2).products_per_page, 2)
        self.assertEqual(CatalogPdfRequest(products_per_page=4).products_per_page, 4)

    def test_generates_pdf_grouped_by_category(self):
        rings = make_category("Anillos", order=1)
        earrings = make_category("Aretes", order=2)
        products = [
            make_product("Anillo Aura", rings.id_categoria, "120.00"),
            make_product("Anillo Luz", rings.id_categoria, "145.50"),
            make_product("Aretes Cielo", earrings.id_categoria, "89.00"),
        ]
        store = SimpleNamespace(
            nombre_tienda="Joyería Demo",
            currency_symbol="Bs",
            theme_config={},
        )
        result = build_catalog_pdf(
            store=store,
            categories=[rings, earrings],
            products=products,
            options=CatalogPdfRequest(show_cover=True, show_description=True),
        )
        self.assertTrue(result.startswith(b"%PDF"))
        self.assertGreater(len(result), 1500)


if __name__ == "__main__":
    unittest.main()
