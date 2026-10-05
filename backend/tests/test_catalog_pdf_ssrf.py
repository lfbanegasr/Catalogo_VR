"""
test_catalog_pdf_ssrf.py
-------------------------
Pruebas exhaustivas de protección contra SSRF, límites de tamaño,
decompression bombs y path traversal en la obtención de imágenes para PDF
(backend/services/catalog_pdf/common.py::asset_bytes).

Todas las pruebas se ejecutan SIN acceso real a internet mediante mocks.
"""

import io
import socket
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock, patch

from PIL import Image

from core.config import settings
from services.catalog_pdf.common import (
    MAX_REMOTE_IMAGE_BYTES,
    SafeRedirectHandler,
    asset_bytes,
    is_safe_remote_url,
    validate_image_pixels,
)


def _make_test_image_bytes(width: int = 100, height: int = 100, fmt: str = "JPEG") -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (width, height), color=(200, 100, 50))
    img.save(buf, format=fmt)
    return buf.getvalue()


class TestCatalogPdfSsrf(unittest.TestCase):
    def setUp(self):
        self.original_r2_url = settings.R2_PUBLIC_BASE_URL
        self.original_public_asset_url = settings.PUBLIC_ASSET_BASE_URL
        self.original_product_image_url = settings.PRODUCT_IMAGE_BASE_URL
        self.original_max_pixels = settings.IMAGE_MAX_PIXELS
        self.original_uploads_dir = settings.UPLOADS_DIR

        # Configuramos un origen R2 confiable de prueba
        settings.R2_PUBLIC_BASE_URL = "https://images.mycatalog.com"
        settings.PUBLIC_ASSET_BASE_URL = ""
        settings.PRODUCT_IMAGE_BASE_URL = ""
        settings.IMAGE_MAX_PIXELS = 25_000_000

    def tearDown(self):
        settings.R2_PUBLIC_BASE_URL = self.original_r2_url
        settings.PUBLIC_ASSET_BASE_URL = self.original_public_asset_url
        settings.PRODUCT_IMAGE_BASE_URL = self.original_product_image_url
        settings.IMAGE_MAX_PIXELS = self.original_max_pixels
        settings.UPLOADS_DIR = self.original_uploads_dir

    # 1. URL válida del dominio configurado en R2_PUBLIC_BASE_URL
    @patch("urllib.request.OpenerDirector.open")
    @patch("socket.getaddrinfo")
    def test_valid_url_from_r2_public_base_url(self, mock_dns, mock_open):
        mock_dns.return_value = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]
        valid_img_bytes = _make_test_image_bytes(50, 50)

        mock_resp = MagicMock()
        mock_resp.headers = {"Content-Type": "image/jpeg"}
        mock_resp.read.return_value = valid_img_bytes
        mock_resp.__enter__.return_value = mock_resp
        mock_open.return_value = mock_resp

        result = asset_bytes("https://images.mycatalog.com/products/ring.jpg")
        self.assertIsNotNone(result)
        self.assertEqual(result, valid_img_bytes)

    # 2. Dominio no autorizado
    def test_unauthorized_domain_rejected(self):
        result = asset_bytes("https://attacker-domain.com/evil.jpg")
        self.assertIsNone(result)

    # 3. http://127.0.0.1
    def test_ipv4_loopback_rejected(self):
        result = asset_bytes("http://127.0.0.1/secret.jpg")
        self.assertIsNone(result)

    # 4. http://localhost
    def test_localhost_rejected(self):
        result = asset_bytes("http://localhost:8000/internal.png")
        self.assertIsNone(result)

    # 5. http://169.254.169.254 (link-local / AWS metadata)
    def test_link_local_metadata_rejected(self):
        result = asset_bytes("http://169.254.169.254/latest/meta-data/")
        self.assertIsNone(result)

    # 6. IPv6 ::1
    def test_ipv6_loopback_rejected(self):
        result = asset_bytes("http://[::1]/admin.jpg")
        self.assertIsNone(result)

    # 7. URL con credenciales
    def test_url_with_credentials_rejected(self):
        result = asset_bytes("https://admin:secret@images.mycatalog.com/photo.jpg")
        self.assertIsNone(result)

    # 8. Redirección desde un dominio permitido hacia una dirección privada
    @patch("socket.getaddrinfo")
    def test_redirect_from_allowed_domain_to_private_address_blocked(self, mock_dns):
        # El dominio inicial resuelve a IP pública
        mock_dns.return_value = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]

        handler = SafeRedirectHandler(allowed_base_urls=["https://images.mycatalog.com"])
        req = MagicMock()
        req.full_url = "https://images.mycatalog.com/redirect-to-internal"

        # Intento de redirección hacia IP privada o localhost
        redirect_res = handler.redirect_request(
            req, fp=None, code=302, msg="Found", headers={}, newurl="http://192.168.1.1/secret.jpg"
        )
        self.assertIsNone(redirect_res)

        # Intento de redirección hacia link-local metadata
        redirect_res_meta = handler.redirect_request(
            req, fp=None, code=302, msg="Found", headers={}, newurl="http://169.254.169.254/meta-data"
        )
        self.assertIsNone(redirect_res_meta)

    # 9. Archivo remoto demasiado grande (> MAX_REMOTE_IMAGE_BYTES)
    @patch("urllib.request.OpenerDirector.open")
    @patch("socket.getaddrinfo")
    def test_remote_file_too_large_rejected(self, mock_dns, mock_open):
        mock_dns.return_value = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]

        mock_resp = MagicMock()
        mock_resp.headers = {"Content-Type": "image/jpeg"}
        # Simula leer más bytes del límite
        mock_resp.read.return_value = b"X" * (MAX_REMOTE_IMAGE_BYTES + 10)
        mock_resp.__enter__.return_value = mock_resp
        mock_open.return_value = mock_resp

        result = asset_bytes("https://images.mycatalog.com/huge.jpg")
        self.assertIsNone(result)

    # 10. Imagen con exceso de píxeles (pixel bomb / decompression bomb)
    def test_image_with_excess_pixels_rejected(self):
        # 6000 x 5000 = 30,000,000 píxeles > límite de 25,000,000
        settings.IMAGE_MAX_PIXELS = 100_000  # Límite bajo para la prueba
        bomb_bytes = _make_test_image_bytes(400, 400)  # 160,000 píxeles > 100,000
        self.assertFalse(validate_image_pixels(bomb_bytes))

        with patch("urllib.request.OpenerDirector.open") as mock_open, patch("socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]
            mock_resp = MagicMock()
            mock_resp.headers = {"Content-Type": "image/jpeg"}
            mock_resp.read.return_value = bomb_bytes
            mock_resp.__enter__.return_value = mock_resp
            mock_open.return_value = mock_resp

            result = asset_bytes("https://images.mycatalog.com/bomb.jpg")
            self.assertIsNone(result)

    # 11. Ruta local válida
    def test_valid_local_path_success(self):
        with TemporaryDirectory() as tmpdir:
            settings.UPLOADS_DIR = tmpdir
            products_dir = Path(tmpdir) / "products"
            products_dir.mkdir(parents=True, exist_ok=True)
            img_file = products_dir / "valid.jpg"
            img_data = _make_test_image_bytes(50, 50)
            img_file.write_bytes(img_data)

            result = asset_bytes("/uploads/products/valid.jpg")
            self.assertIsNotNone(result)
            self.assertEqual(result, img_data)

    # 12. Path traversal local
    def test_local_path_traversal_rejected(self):
        with TemporaryDirectory() as tmpdir:
            settings.UPLOADS_DIR = tmpdir
            # Intentar acceder a un archivo fuera de UPLOADS_PATH
            result = asset_bytes("/uploads/../../etc/passwd")
            self.assertIsNone(result)

            result_sibling = asset_bytes("/uploads/../sibling/evil.jpg")
            self.assertIsNone(result_sibling)


if __name__ == "__main__":
    unittest.main()
