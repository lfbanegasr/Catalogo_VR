import unittest
from decimal import Decimal
from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4

from PIL import Image

from schemas.catalog_pdf_schema import CatalogPdfRequest
from services.catalog_pdf import build_catalog_pdf, extract_palette_suggestions


def category(name, order):
    return SimpleNamespace(
        id_categoria=uuid4(),
        id_categoria_padre=None,
        nombre=name,
        orden=order,
        imagen_fondo_default="#F4ECEF",
        imagen_fit_default="contain",
        imagen_posicion_x_default=50,
        imagen_posicion_y_default=50,
        imagen_zoom_default=100,
    )


def product(name, category_id, price):
    return SimpleNamespace(
        id_producto=uuid4(),
        id_categoria=category_id,
        id_categoria_principal=category_id,
        nombre=name,
        descripcion="Descripcion editorial del producto.",
        precio_venta=Decimal(price),
        imagen_url=None,
        imagen_fit=None,
        imagen_fondo=None,
        imagen_posicion_x=None,
        imagen_posicion_y=None,
        imagen_zoom=None,
    )


class TestCatalogPdfTemplates(unittest.TestCase):
    def setUp(self):
        self.rings = category("Anillos", 1)
        self.products = [
            product(f"Anillo {index}", self.rings.id_categoria, f"{90 + index}.00")
            for index in range(1, 5)
        ]
        self.store = SimpleNamespace(
            nombre_tienda="Tienda Demo",
            currency_symbol="Bs",
            theme_config={},
        )

    def test_every_template_generates_a_pdf(self):
        for template in ("minimal", "organic", "editorial", "photographic"):
            with self.subTest(template=template):
                options = CatalogPdfRequest(
                    template=template,
                    products_per_page=3 if template in {"organic", "editorial"} else 4,
                    background_style="organic" if template == "organic" else "gradient",
                    image_shape="circle" if template == "organic" else "auto",
                    price_style="circle" if template == "organic" else "pill",
                    show_description=True,
                )
                result = build_catalog_pdf(
                    store=self.store,
                    categories=[self.rings],
                    products=self.products,
                    options=options,
                )
                self.assertTrue(result.startswith(b"%PDF"))
                self.assertGreater(len(result), 1800)

    def test_palette_returns_editable_suggestions(self):
        image = Image.new("RGB", (120, 80), "#D8B18A")
        for x in range(60):
            for y in range(80):
                image.putpixel((x, y), (82, 40, 66))
        output = BytesIO()
        image.save(output, format="PNG")
        palette = extract_palette_suggestions(output.getvalue())
        self.assertGreaterEqual(len(palette["colors"]), 2)
        self.assertEqual(len(palette["suggestions"]), 3)
        self.assertRegex(palette["suggestions"][0]["primary_color"], r"^#[0-9A-F]{6}$")


if __name__ == "__main__":
    unittest.main()
