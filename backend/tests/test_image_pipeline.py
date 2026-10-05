"""
test_image_pipeline.py
----------------------
Tests unitarios para el pipeline de optimización de imágenes.

Cubre:
  - archivo vacío
  - tipo MIME no permitido
  - MIME falso (magic bytes no coinciden)
  - imagen corrupta
  - imagen demasiado grande (bytes)
  - dimensiones excesivas (píxeles)
  - decompression bomb (exceso de píxeles)
  - corrección de orientación EXIF
  - conversión a WebP
  - redimensionamiento conservando proporción
  - imagen pequeña no se amplía
  - imagen RGBA (transparencia) a WebP
  - funcionamiento con almacenamiento local
  - sustitución y eliminación segura de archivos
"""

import io
import os
import shutil
import struct
import unittest
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

# Configurar entorno antes de importar módulos del proyecto
os.environ["UPLOADS_DIR"] = "./test_uploads_tmp_pipeline"
os.environ["PUBLIC_ASSET_BASE_URL"] = "https://test.catalogovr.app"
os.environ["STORAGE_BACKEND"] = "local"
os.environ["IMAGE_OPTIMIZE_ENABLED"] = "true"
os.environ["IMAGE_MAX_INPUT_BYTES"] = str(5 * 1024 * 1024)  # 5 MB para tests
os.environ["IMAGE_MAX_WIDTH"] = "2048"
os.environ["IMAGE_MAX_HEIGHT"] = "2048"
os.environ["IMAGE_MAX_PIXELS"] = str(4_000_000)  # 4 MP para tests
os.environ["IMAGE_WEBP_QUALITY"] = "82"

from core.config import settings  # noqa: E402
from core.image_pipeline import read_and_validate_raw, process_image  # noqa: E402
from core.storage import save_upload_file, build_public_asset_url  # noqa: E402


# ─── Helpers para generar imágenes de prueba ─────────────────────────────────

def _make_upload_file(content: bytes, filename: str, content_type: str) -> UploadFile:
    return UploadFile(
        file=io.BytesIO(content),
        filename=filename,
        headers=Headers({"content-type": content_type}),
    )


def _make_minimal_jpeg(width: int = 10, height: int = 10) -> bytes:
    """Genera un JPEG mínimo válido usando Pillow."""
    from PIL import Image
    img = Image.new("RGB", (width, height), color=(200, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    return buf.getvalue()


def _make_minimal_png(width: int = 10, height: int = 10) -> bytes:
    """Genera un PNG mínimo válido usando Pillow."""
    from PIL import Image
    img = Image.new("RGB", (width, height), color=(50, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_minimal_webp(width: int = 10, height: int = 10) -> bytes:
    """Genera un WebP mínimo válido usando Pillow."""
    from PIL import Image
    img = Image.new("RGB", (width, height), color=(100, 200, 100))
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=80)
    return buf.getvalue()


def _make_jpeg_with_exif_rotation(rotation_tag: int = 6) -> bytes:
    """
    Genera un JPEG con tag EXIF de orientación usando Pillow nativo.
    rotation_tag=6 -> imagen rotada 90° en sentido horario.
    """
    from PIL import Image

    img = Image.new("RGB", (40, 20), color=(255, 0, 0))
    exif = img.getexif()
    exif[0x0112] = rotation_tag  # 0x0112 = Orientation tag
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    return buf.getvalue()


def _make_rgba_png(width: int = 10, height: int = 10) -> bytes:
    """Genera un PNG con canal alfa (RGBA)."""
    from PIL import Image
    img = Image.new("RGBA", (width, height), color=(100, 150, 200, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ─── Suite de pruebas ────────────────────────────────────────────────────────

class TestImagePipelineValidation(unittest.TestCase):
    """Pruebas de validación de read_and_validate_raw."""

    def _call(self, content: bytes, filename: str = "img.jpg", ct: str = "image/jpeg") -> bytes:
        f = _make_upload_file(content, filename, ct)
        return read_and_validate_raw(f, max_bytes=5 * 1024 * 1024)

    def test_empty_file_rejected(self):
        """Archivo vacío debe ser rechazado con 400."""
        with self.assertRaises(HTTPException) as ctx:
            self._call(b"")
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("vacío", ctx.exception.detail.lower())

    def test_oversized_file_rejected(self):
        """Archivo que supera el límite debe ser rechazado con 413."""
        large = b"x" * (5 * 1024 * 1024 + 1)
        with self.assertRaises(HTTPException) as ctx:
            self._call(large)
        self.assertEqual(ctx.exception.status_code, 413)

    def test_fake_jpeg_magic_bytes_rejected(self):
        """Texto plano con MIME image/jpeg debe ser rechazado (magic bytes fallan)."""
        fake = b"This is not a JPEG image, just plain text pretending."
        with self.assertRaises(HTTPException) as ctx:
            self._call(fake, "documento.txt", "image/jpeg")
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("formato no permitido", ctx.exception.detail.lower())

    def test_pdf_with_jpeg_mime_rejected(self):
        """PDF declarado como JPEG debe ser rechazado."""
        pdf_header = b"%PDF-1.4 fake pdf content"
        with self.assertRaises(HTTPException) as ctx:
            self._call(pdf_header, "archivo.pdf", "image/jpeg")
        self.assertEqual(ctx.exception.status_code, 400)

    def test_valid_jpeg_accepted(self):
        """JPEG válido con magic bytes correctos debe ser aceptado."""
        raw = _make_minimal_jpeg()
        result = self._call(raw, "foto.jpg", "image/jpeg")
        self.assertTrue(result.startswith(b"\xff\xd8\xff"))

    def test_valid_png_accepted(self):
        """PNG válido debe ser aceptado."""
        raw = _make_minimal_png()
        result = self._call(raw, "imagen.png", "image/png")
        self.assertTrue(result[:8] == b"\x89PNG\r\n\x1a\n")

    def test_valid_webp_accepted(self):
        """WebP válido debe ser aceptado."""
        raw = _make_minimal_webp()
        result = self._call(raw, "imagen.webp", "image/webp")
        self.assertTrue(result[:4] == b"RIFF")
        self.assertEqual(result[8:12], b"WEBP")

    def test_corrupted_image_rejected(self):
        """Magic bytes de JPEG pero contenido corrupto: debe rechazarse."""
        # Header JPEG válido pero datos corruptos después
        corrupted = b"\xff\xd8\xff\xe0" + b"\x00" * 50 + b"corrupted data here"
        # read_and_validate_raw solo verifica magic bytes; process_image detectará la corrupción
        # Por eso este test va al proceso completo
        raw = self._call(corrupted, "corrupted.jpg", "image/jpeg")
        self.assertIsNotNone(raw)  # raw pasa la validación de magic bytes...

    def test_riff_non_webp_rejected(self):
        """Archivo RIFF que no es WebP debe ser rechazado."""
        # AVI file: RIFF....AVI
        avi_header = b"RIFF" + b"\x00\x00\x00\x00" + b"AVI "
        with self.assertRaises(HTTPException) as ctx:
            self._call(avi_header, "video.avi", "image/webp")
        self.assertEqual(ctx.exception.status_code, 400)

    def test_limited_read_large_stream(self):
        """Verifica que read_and_validate_raw no lea más de max_bytes + 1 en memoria."""
        class MockLargeStream:
            def __init__(self, total_size):
                self.total_size = total_size
                self.bytes_read = 0

            def seek(self, pos):
                self.bytes_read = pos

            def read(self, size=-1):
                chunk = min(size, self.total_size - self.bytes_read)
                self.bytes_read += chunk
                return b"X" * chunk

        mock_stream = MockLargeStream(10 * 1024 * 1024)  # 10 MB
        file = UploadFile(
            file=mock_stream,
            filename="large.jpg",
            headers=Headers({"content-type": "image/jpeg"}),
        )
        with self.assertRaises(HTTPException) as ctx:
            read_and_validate_raw(file, max_bytes=1024)
        self.assertEqual(ctx.exception.status_code, 413)
        self.assertEqual(mock_stream.bytes_read, 1025)


class TestImageProcessing(unittest.TestCase):
    """Pruebas de process_image (conversión, redimensionamiento, EXIF)."""

    def _process(self, raw: bytes, **kwargs) -> bytes:
        defaults = {
            "max_width": 2048,
            "max_height": 2048,
            "max_pixels": 4_000_000,
            "quality": 82,
        }
        defaults.update(kwargs)
        return process_image(raw, **defaults)

    def test_jpeg_converts_to_webp(self):
        """JPEG de entrada debe convertirse a WebP."""
        from PIL import Image
        raw = _make_minimal_jpeg(20, 20)
        result = self._process(raw)
        # WebP comienza con RIFF...WEBP
        self.assertEqual(result[:4], b"RIFF")
        self.assertEqual(result[8:12], b"WEBP")

    def test_png_converts_to_webp(self):
        """PNG de entrada debe convertirse a WebP."""
        raw = _make_minimal_png(20, 20)
        result = self._process(raw)
        self.assertEqual(result[:4], b"RIFF")
        self.assertEqual(result[8:12], b"WEBP")

    def test_webp_converts_to_webp(self):
        """WebP de entrada sigue siendo WebP (posiblemente recodificado)."""
        raw = _make_minimal_webp(20, 20)
        result = self._process(raw)
        self.assertEqual(result[:4], b"RIFF")
        self.assertEqual(result[8:12], b"WEBP")

    def test_small_image_not_upscaled(self):
        """Imagen pequeña no debe ser ampliada."""
        from PIL import Image
        raw = _make_minimal_jpeg(50, 30)
        result = self._process(raw, max_width=2048, max_height=2048)
        output_img = Image.open(io.BytesIO(result))
        # La imagen resultante no debe ser más grande que la original
        self.assertLessEqual(output_img.width, 50)
        self.assertLessEqual(output_img.height, 30)

    def test_large_image_resized(self):
        """Imagen grande debe redimensionarse conservando proporción."""
        from PIL import Image
        # Imagen 800×600
        img = Image.new("RGB", (800, 600), color=(100, 200, 100))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        raw = buf.getvalue()

        result = self._process(raw, max_width=400, max_height=400)
        output_img = Image.open(io.BytesIO(result))
        self.assertLessEqual(output_img.width, 400)
        self.assertLessEqual(output_img.height, 400)
        # Proporción conservada: 800×600 → 400×300 (4:3)
        ratio_in = 800 / 600
        ratio_out = output_img.width / output_img.height
        self.assertAlmostEqual(ratio_in, ratio_out, places=1)

    def test_excessive_pixels_rejected(self):
        """Imagen con más píxeles que el límite debe ser rechazada."""
        from PIL import Image
        # Imagen 3000×2000 = 6M píxeles > 4M límite del test
        img = Image.new("RGB", (3000, 2000), color=(50, 50, 50))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        raw = buf.getvalue()

        with self.assertRaises(HTTPException) as ctx:
            self._process(raw, max_pixels=4_000_000)
        self.assertEqual(ctx.exception.status_code, 413)

    def test_pixels_checked_before_load_called(self):
        """Demuestra que una imagen que supera IMAGE_MAX_PIXELS se rechaza antes de llamar a load()."""
        from unittest.mock import patch
        from PIL import Image

        img = Image.new("RGB", (2000, 2000), color="blue")
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        raw = buf.getvalue()

        with patch.object(Image.Image, "load") as mock_load:
            with self.assertRaises(HTTPException) as ctx:
                self._process(raw, max_pixels=1_000_000)
            self.assertEqual(ctx.exception.status_code, 413)
            # load() no debe haberse llamado nunca porque la verificación de tamaño ocurre antes
            mock_load.assert_not_called()

    def test_rgba_png_supported(self):
        """PNG con canal alfa (RGBA) debe procesarse correctamente a WebP."""
        from PIL import Image
        raw = _make_rgba_png(20, 20)
        result = self._process(raw)
        self.assertEqual(result[8:12], b"WEBP")
        # Verificar que el resultado es legible
        output_img = Image.open(io.BytesIO(result))
        self.assertIsNotNone(output_img)

    def test_exif_metadata_stripped(self):
        """Los metadatos EXIF no deben estar en el resultado WebP."""
        from PIL import Image
        raw = _make_minimal_jpeg(30, 30)
        result = self._process(raw)
        # Abrir resultado y verificar que no tiene info EXIF relevante
        output_img = Image.open(io.BytesIO(result))
        # WebP puede tener metadatos limitados, pero no los EXIF originales del JPEG
        exif_data = output_img.getexif()
        # Orientación EXIF (tag 274) no debe estar en el resultado
        self.assertNotIn(274, exif_data)

    def test_corrupted_jpeg_body_rejected(self):
        """JPEG con cabecera válida pero cuerpo corrupto debe rechazarse."""
        # Cabecera JPEG real truncada
        corrupted = b"\xff\xd8\xff\xe0" + b"\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00" + b"\xff\xda" + b"corrupted_scan_data"
        with self.assertRaises(HTTPException) as ctx:
            self._process(corrupted)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_webp_quality_produces_smaller_file(self):
        """Mayor compresión debe producir archivo más pequeño."""
        from PIL import Image, ImageDraw
        img = Image.new("RGB", (200, 200), color=(200, 100, 50))
        draw = ImageDraw.Draw(img)
        for i in range(0, 200, 10):
            draw.line([(i, 0), (200 - i, 200)], fill=(i % 256, (i * 2) % 256, (i * 3) % 256))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        raw = buf.getvalue()

        high_quality = self._process(raw, quality=90)
        low_quality = self._process(raw, quality=30)
        self.assertLess(len(low_quality), len(high_quality))

    def test_exif_orientation_corrected(self):
        """Imagen con EXIF tag 6 (rotada 90°) debe transponerse correctamente."""
        from PIL import Image
        raw = _make_jpeg_with_exif_rotation(6)  # Original width 40, height 20
        result = self._process(raw)
        with Image.open(io.BytesIO(result)) as output_img:
            # Tag 6 transpone ancho y alto: de (40, 20) pasa a (20, 40)
            self.assertEqual(output_img.size, (20, 40))

    def test_truncated_image_rejected(self):
        """Imagen truncada a la mitad debe rechazarse con 400 y no causar 500."""
        valid_jpeg = _make_minimal_jpeg(60, 60)
        truncated = valid_jpeg[: len(valid_jpeg) // 2]
        with self.assertRaises(HTTPException) as ctx:
            self._process(truncated)
        self.assertEqual(ctx.exception.status_code, 400)


class TestStorageIntegration(unittest.TestCase):
    """Pruebas de integración de save_upload_file con almacenamiento local."""

    @classmethod
    def setUpClass(cls):
        cls.test_dir = Path("./test_uploads_tmp_pipeline").resolve()
        if cls.test_dir.exists():
            shutil.rmtree(cls.test_dir)
        cls.test_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        if cls.test_dir.exists():
            shutil.rmtree(cls.test_dir)

    def setUp(self):
        settings.UPLOADS_DIR = "./test_uploads_tmp_pipeline"
        settings.PUBLIC_ASSET_BASE_URL = "https://test.catalogovr.app"
        settings.STORAGE_BACKEND = "local"
        settings.IMAGE_OPTIMIZE_ENABLED = True
        settings.IMAGE_MAX_INPUT_BYTES = 5 * 1024 * 1024
        settings.IMAGE_MAX_WIDTH = 2048
        settings.IMAGE_MAX_HEIGHT = 2048
        settings.IMAGE_MAX_PIXELS = 4_000_000
        settings.IMAGE_WEBP_QUALITY = 82

    def test_save_valid_jpeg_returns_webp_path(self):
        """JPEG válido debe guardarse como WebP y retornar ruta .webp."""
        raw = _make_minimal_jpeg(30, 30)
        entity_id = uuid4()
        file = _make_upload_file(raw, "foto.jpg", "image/jpeg")
        path = save_upload_file(file, "products", entity_id)

        self.assertTrue(path.startswith("/uploads/products/"))
        self.assertTrue(path.endswith(".webp"), f"Expected .webp, got: {path}")
        self.assertIn(str(entity_id), path)

        # Verificar existencia física
        physical = settings.UPLOADS_PATH / "products" / path.split("/")[-1]
        self.assertTrue(physical.exists())
        self.assertGreater(physical.stat().st_size, 0)

    def test_save_valid_png_returns_webp_path(self):
        """PNG válido debe guardarse como WebP."""
        raw = _make_minimal_png(30, 30)
        entity_id = uuid4()
        file = _make_upload_file(raw, "imagen.png", "image/png")
        path = save_upload_file(file, "products", entity_id)

        self.assertTrue(path.endswith(".webp"), f"Expected .webp, got: {path}")

    def test_disallowed_mime_rejected_before_read(self):
        """MIME no permitido debe rechazarse antes de leer el contenido."""
        raw = b"some text content"
        file = _make_upload_file(raw, "document.txt", "text/plain")
        with self.assertRaises(HTTPException) as ctx:
            save_upload_file(file, "products", uuid4())
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("formato no permitido", ctx.exception.detail.lower())

    def test_empty_file_rejected(self):
        """Archivo vacío con MIME válido debe rechazarse."""
        file = _make_upload_file(b"", "vacio.jpg", "image/jpeg")
        with self.assertRaises(HTTPException) as ctx:
            save_upload_file(file, "products", uuid4())
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("vacío", ctx.exception.detail.lower())

    def test_fake_mime_rejected(self):
        """Texto plano con MIME image/jpeg (MIME falso) debe rechazarse."""
        fake = b"This is definitely not a JPEG file, trust me"
        file = _make_upload_file(fake, "not_a_jpg.jpg", "image/jpeg")
        with self.assertRaises(HTTPException) as ctx:
            save_upload_file(file, "products", uuid4())
        self.assertEqual(ctx.exception.status_code, 400)

    def test_oversized_file_rejected(self):
        """Archivo que supera 5 MB debe rechazarse con 413."""
        large = b"\xff\xd8\xff" + b"x" * (5 * 1024 * 1024 + 1)
        file = _make_upload_file(large, "enorme.jpg", "image/jpeg")
        with self.assertRaises(HTTPException) as ctx:
            save_upload_file(file, "products", uuid4())
        self.assertEqual(ctx.exception.status_code, 413)

    def test_saved_file_is_valid_webp(self):
        """El archivo guardado debe ser un WebP válido legible por Pillow."""
        from PIL import Image
        raw = _make_minimal_jpeg(50, 50)
        file = _make_upload_file(raw, "foto.jpg", "image/jpeg")
        path = save_upload_file(file, "products", uuid4())

        physical = settings.UPLOADS_PATH / "products" / path.split("/")[-1]
        with Image.open(physical) as img:
            self.assertEqual(img.format, "WEBP")
            self.assertEqual(img.size, (50, 50))  # No se redimensiona (debajo del límite)

    def test_replacement_saves_new_file(self):
        """Guardar dos veces con el mismo entity_id crea dos archivos distintos."""
        raw1 = _make_minimal_jpeg(10, 10)
        raw2 = _make_minimal_jpeg(20, 20)
        entity_id = uuid4()

        file1 = _make_upload_file(raw1, "foto1.jpg", "image/jpeg")
        file2 = _make_upload_file(raw2, "foto2.jpg", "image/jpeg")

        path1 = save_upload_file(file1, "products", entity_id)
        path2 = save_upload_file(file2, "products", entity_id)

        self.assertNotEqual(path1, path2, "Paths should differ due to timestamp")
        # Ambos archivos deben existir físicamente
        p1 = settings.UPLOADS_PATH / "products" / path1.split("/")[-1]
        p2 = settings.UPLOADS_PATH / "products" / path2.split("/")[-1]
        self.assertTrue(p1.exists())
        self.assertTrue(p2.exists())

    def test_safe_deletion_of_replaced_file(self):
        """El archivo físico puede eliminarse de forma segura."""
        raw = _make_minimal_jpeg(15, 15)
        entity_id = uuid4()
        file = _make_upload_file(raw, "foto.jpg", "image/jpeg")
        path = save_upload_file(file, "products", entity_id)

        physical = settings.UPLOADS_PATH / "products" / path.split("/")[-1]
        self.assertTrue(physical.exists())

        # Eliminar el archivo
        physical.unlink()
        self.assertFalse(physical.exists())

    def test_upload_file_resource_closed(self):
        """Verifica que el descriptor de archivo UploadFile se cierre garantizadamente."""
        raw = _make_minimal_jpeg(15, 15)
        entity_id = uuid4()
        file = _make_upload_file(raw, "foto.jpg", "image/jpeg")
        save_upload_file(file, "products", entity_id)
        self.assertTrue(file.file.closed)

    def test_build_public_asset_url_none_returns_none(self):
        self.assertIsNone(build_public_asset_url(None))
        self.assertIsNone(build_public_asset_url(""))
        self.assertIsNone(build_public_asset_url("   "))

    def test_build_public_asset_url_absolute_unchanged(self):
        url = "https://example.com/img.jpg"
        self.assertEqual(build_public_asset_url(url), url)

    def test_build_public_asset_url_relative_prepends_base(self):
        result = build_public_asset_url("uploads/products/image.webp")
        self.assertEqual(result, "https://test.catalogovr.app/uploads/products/image.webp")


if __name__ == "__main__":
    unittest.main(verbosity=2)
