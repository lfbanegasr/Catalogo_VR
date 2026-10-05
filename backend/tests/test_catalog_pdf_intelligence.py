import unittest
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from uuid import uuid4

from PIL import Image, ImageDraw

from core.config import settings
from schemas.catalog_pdf_schema import CatalogPdfRequest
from services.catalog_pdf import analyze_catalog_products, build_catalog_pdf
from services.catalog_pdf.background_removal import remove_background_cached
from services.catalog_pdf.image_analysis import analyze_image_bytes
from services.catalog_pdf.layout import options_for_page, order_products


def _category():
    return SimpleNamespace(
        id_categoria=uuid4(),
        id_categoria_padre=None,
        nombre="Coleccion editorial",
        orden=1,
        imagen_fondo_default="#F7F1F4",
        imagen_fit_default="contain",
        imagen_posicion_x_default=50,
        imagen_posicion_y_default=50,
        imagen_zoom_default=100,
    )


def _product(category_id, name, image_url=None):
    return SimpleNamespace(
        id_producto=uuid4(),
        id_categoria=category_id,
        id_categoria_principal=category_id,
        nombre=name,
        descripcion="Descripcion extensa para comprobar que la composicion reserva espacio.",
        precio_venta=Decimal("129.90"),
        imagen_url=image_url,
        imagen_fit=None,
        imagen_fondo=None,
        imagen_posicion_x=None,
        imagen_posicion_y=None,
        imagen_zoom=None,
    )


class TestCatalogPdfIntelligence(unittest.TestCase):
    def setUp(self):
        self.original_uploads_dir = settings.UPLOADS_DIR

    def tearDown(self):
        settings.UPLOADS_DIR = self.original_uploads_dir

    def test_detects_promotional_artwork_without_cloud_ai(self):
        image = Image.new("RGB", (800, 1000), "#F5E6D2")
        drawing = ImageDraw.Draw(image)
        for y in range(80, 800, 34):
            drawing.rectangle((50, y, 650, y + 16), fill="black")
        output = BytesIO()
        image.save(output, format="PNG")

        result = analyze_image_bytes(output.getvalue())

        self.assertEqual(result["kind"], "promotional")
        self.assertTrue(result["has_text"])
        self.assertTrue(result["warnings"])

    def test_manual_order_and_page_colors_are_applied(self):
        category = _category()
        first = _product(category.id_categoria, "Primero")
        second = _product(category.id_categoria, "Segundo")
        options = CatalogPdfRequest(
            product_overrides=[
                {"product_id": first.id_producto, "order": 2},
                {"product_id": second.id_producto, "order": 1},
            ],
            page_overrides=[{
                "category_id": category.id_categoria,
                "page_index": 0,
                "background_color": "#112233",
            }],
        )

        ordered = order_products([first, second], options)
        page_options = options_for_page(options, category, 0)

        self.assertEqual(ordered[0].id_producto, second.id_producto)
        self.assertEqual(page_options.background_color, "#112233")

    def test_two_item_editorial_page_and_long_names_generate_safely(self):
        category = _category()
        products = [
            _product(category.id_categoria, "Broche para el cabello corazon dorado con detalles elegantes"),
            _product(category.id_categoria, "Aretes argolla con dije de corazon dorado coleccion especial"),
        ]
        options = CatalogPdfRequest(
            template="editorial",
            show_cover=False,
            show_description=True,
            price_style="block",
            smart_layout=True,
        )
        store = SimpleNamespace(nombre_tienda="YR Accesorios", currency_symbol="Bs", theme_config={})

        result = build_catalog_pdf(store=store, categories=[category], products=products, options=options)

        self.assertTrue(result.startswith(b"%PDF"))
        self.assertGreater(len(result), 1800)

    def test_catalog_analysis_and_background_fallback(self):
        with TemporaryDirectory() as temp_dir:
            settings.UPLOADS_DIR = temp_dir
            image_dir = Path(temp_dir) / "products"
            image_dir.mkdir(parents=True)
            Image.new("RGB", (900, 900), "#D8B18A").save(image_dir / "product.png")
            category = _category()
            product = _product(category.id_categoria, "Producto", "/uploads/products/product.png")

            result = analyze_catalog_products([product], use_florence=False)
            original = b"not-an-image"

            self.assertEqual(result["summary"]["total"], 1)
            self.assertTrue(result["palette"]["suggestions"])
            self.assertEqual(remove_background_cached(original), original)


if __name__ == "__main__":
    unittest.main()
