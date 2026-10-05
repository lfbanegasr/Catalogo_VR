import unittest
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from uuid import uuid4

from PIL import Image

from core.config import settings
from schemas.catalog_pdf_schema import CatalogPdfRequest
from services.catalog_pdf import build_catalog_pdf
from services.catalog_pdf.cover_storage import delete_catalog_cover


class TestCatalogPdfCover(unittest.TestCase):
    def setUp(self):
        self.original_uploads_dir = settings.UPLOADS_DIR

    def tearDown(self):
        settings.UPLOADS_DIR = self.original_uploads_dir

    def test_custom_cover_is_rendered_and_can_be_deleted_safely(self):
        with TemporaryDirectory() as temp_dir:
            settings.UPLOADS_DIR = temp_dir
            cover_dir = Path(temp_dir) / "catalog-covers"
            cover_dir.mkdir(parents=True)
            cover_path = cover_dir / "cover.png"
            Image.new("RGB", (700, 990), "#7A405C").save(cover_path)

            category_id = uuid4()
            category = SimpleNamespace(
                id_categoria=category_id,
                id_categoria_padre=None,
                nombre="Anillos",
                orden=1,
                imagen_fondo_default="#F7F1F4",
                imagen_fit_default="contain",
                imagen_posicion_x_default=50,
                imagen_posicion_y_default=50,
                imagen_zoom_default=100,
            )
            product = SimpleNamespace(
                id_producto=uuid4(),
                id_categoria=category_id,
                id_categoria_principal=category_id,
                nombre="Anillo editorial",
                descripcion="Producto de prueba",
                precio_venta=Decimal("120.00"),
                imagen_url=None,
                imagen_fit=None,
                imagen_fondo=None,
                imagen_posicion_x=None,
                imagen_posicion_y=None,
                imagen_zoom=None,
            )
            store = SimpleNamespace(
                nombre_tienda="Tienda Demo",
                currency_symbol="Bs",
                theme_config={},
            )
            options = CatalogPdfRequest(
                template="editorial",
                cover_url="/uploads/catalog-covers/cover.png",
                cover_fit="cover",
                cover_text_overlay=False,
            )

            result = build_catalog_pdf(
                store=store,
                categories=[category],
                products=[product],
                options=options,
            )

            self.assertTrue(result.startswith(b"%PDF"))
            self.assertGreater(len(result), 2000)
            delete_catalog_cover("/uploads/catalog-covers/cover.png")
            self.assertFalse(cover_path.exists())

    def test_deletion_ignores_files_outside_catalog_covers(self):
        with TemporaryDirectory() as temp_dir:
            settings.UPLOADS_DIR = temp_dir
            unrelated = Path(temp_dir) / "products" / "keep.png"
            unrelated.parent.mkdir(parents=True)
            unrelated.write_bytes(b"keep")

            delete_catalog_cover("/uploads/products/keep.png")

            self.assertTrue(unrelated.exists())


if __name__ == "__main__":
    unittest.main()
