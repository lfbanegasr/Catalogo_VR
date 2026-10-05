import io
import os
import shutil
import unittest
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

# Set environment variables for tests before importing config
os.environ["UPLOADS_DIR"] = "./test_uploads_tmp"
os.environ["PUBLIC_ASSET_BASE_URL"] = "https://test.catalogovr.app"
os.environ["STORAGE_BACKEND"] = "local"

from core.config import settings
from core.storage import build_public_asset_url, save_upload_file, delete_asset_file


class TestStorageLogic(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Ensure test directory is clean
        cls.test_uploads_dir = Path("./test_uploads_tmp").resolve()
        if cls.test_uploads_dir.exists():
            shutil.rmtree(cls.test_uploads_dir)
        cls.test_uploads_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        # Cleanup test directory after all tests
        if cls.test_uploads_dir.exists():
            shutil.rmtree(cls.test_uploads_dir)

    def setUp(self):
        # Reset UPLOADS_PATH settings
        settings.UPLOADS_DIR = "./test_uploads_tmp"
        settings.PUBLIC_ASSET_BASE_URL = "https://test.catalogovr.app"
        settings.STORAGE_BACKEND = "local"
        settings.IMAGE_OPTIMIZE_ENABLED = False

    def test_build_public_asset_url(self):
        # 1. Null or empty path returns None
        self.assertIsNone(build_public_asset_url(None))
        self.assertIsNone(build_public_asset_url(""))
        self.assertIsNone(build_public_asset_url("   "))

        # 2. Absolute/external URLs return unchanged
        self.assertEqual(
            build_public_asset_url("http://example.com/img.jpg"),
            "http://example.com/img.jpg"
        )
        self.assertEqual(
            build_public_asset_url("https://example.com/img.jpg"),
            "https://example.com/img.jpg"
        )
        self.assertEqual(
            build_public_asset_url("data:image/png;base64,xxxx"),
            "data:image/png;base64,xxxx"
        )

        # 3. Relative path resolution and double slash avoidance
        self.assertEqual(
            build_public_asset_url("uploads/products/image.jpg"),
            "https://test.catalogovr.app/uploads/products/image.jpg"
        )
        self.assertEqual(
            build_public_asset_url("/uploads/products/image.jpg"),
            "https://test.catalogovr.app/uploads/products/image.jpg"
        )

    def test_save_upload_file_valid(self):
        # Test saving a valid image
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGB", (10, 10), color="red").save(buf, format="JPEG")
        file_content = buf.getvalue()
        file = UploadFile(
            file=io.BytesIO(file_content),
            filename="my_photo.jpg",
            headers=Headers({"content-type": "image/jpeg"}),
        )

        entity_id = uuid4()
        public_path = save_upload_file(file, "products", entity_id)

        # Path should be relative and correctly formatted for DB
        self.assertTrue(public_path.startswith("/uploads/products/"))
        self.assertTrue(public_path.endswith(".jpg"))
        self.assertIn(str(entity_id), public_path)

        # File should exist physically in the resolved directory
        physical_file = settings.UPLOADS_PATH / "products" / public_path.split("/")[-1]
        self.assertTrue(physical_file.exists())
        self.assertEqual(physical_file.read_bytes(), file_content)

    def test_save_upload_file_empty(self):
        # Empty file should fail validation
        file = UploadFile(
            file=io.BytesIO(b""),
            filename="empty.jpg",
            headers=Headers({"content-type": "image/jpeg"}),
        )

        with self.assertRaises(HTTPException) as context:
            save_upload_file(file, "products", uuid4())
        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("vacío", context.exception.detail.lower())

    def test_save_upload_file_invalid_type(self):
        # Non-image files should be rejected
        file = UploadFile(
            file=io.BytesIO(b"some text content"),
            filename="document.txt",
            headers=Headers({"content-type": "text/plain"}),
        )

        with self.assertRaises(HTTPException) as context:
            save_upload_file(file, "products", uuid4())
        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("formato no permitido", context.exception.detail.lower())

    def test_save_upload_file_size_limit(self):
        # Exceeding size limit (configured to 5MB for test) should fail with 413
        settings.IMAGE_MAX_INPUT_BYTES = 5 * 1024 * 1024
        large_content = b"x" * (settings.IMAGE_MAX_INPUT_BYTES + 1)
        file = UploadFile(
            file=io.BytesIO(large_content),
            filename="huge.jpg",
            headers=Headers({"content-type": "image/jpeg"}),
        )

        with self.assertRaises(HTTPException) as context:
            save_upload_file(file, "products", uuid4())
        self.assertEqual(context.exception.status_code, 413)

    def test_delete_asset_file_local_success(self):
        # Crear archivo temporal en subfolder local
        products_dir = settings.UPLOADS_PATH / "products"
        products_dir.mkdir(parents=True, exist_ok=True)
        test_file = products_dir / "temp_delete_test.jpg"
        test_file.write_bytes(b"dummy")
        self.assertTrue(test_file.exists())

        # Eliminarlo por ruta relativa
        deleted = delete_asset_file("/uploads/products/temp_delete_test.jpg")
        self.assertTrue(deleted)
        self.assertFalse(test_file.exists())

    def test_delete_asset_file_local_non_existent(self):
        deleted = delete_asset_file("/uploads/products/non_existent_file_xyz.jpg")
        self.assertFalse(deleted)

    def test_delete_asset_file_path_traversal_rejected(self):
        deleted = delete_asset_file("/uploads/../../evil.txt")
        self.assertFalse(deleted)

    def test_delete_asset_file_empty_returns_false(self):
        self.assertFalse(delete_asset_file(None))
        self.assertFalse(delete_asset_file(""))

    def test_delete_asset_file_r2_mock(self):
        from unittest.mock import MagicMock, patch

        settings.STORAGE_BACKEND = "r2"
        settings.R2_PUBLIC_BASE_URL = "https://cdn.example.com"
        settings.R2_BUCKET_NAME = "test-bucket"
        settings.R2_ENDPOINT_URL = "https://r2.cloudflarestorage.com"
        settings.R2_ACCESS_KEY_ID = "key"
        settings.R2_SECRET_ACCESS_KEY = "secret"

        mock_s3 = MagicMock()
        with patch("boto3.client", return_value=mock_s3):
            # Eliminar URL de R2
            url = "https://cdn.example.com/products/item_123.webp"
            deleted = delete_asset_file(url)
            self.assertTrue(deleted)
            mock_s3.delete_object.assert_called_once_with(
                Bucket="test-bucket",
                Key="products/item_123.webp",
            )

    def test_save_upload_file_r2_mock(self):
        from unittest.mock import MagicMock, patch
        from PIL import Image

        settings.STORAGE_BACKEND = "r2"
        settings.R2_PUBLIC_BASE_URL = "https://cdn.example.com"
        settings.R2_BUCKET_NAME = "test-bucket"
        settings.R2_ENDPOINT_URL = "https://r2.cloudflarestorage.com"
        settings.R2_ACCESS_KEY_ID = "key"
        settings.R2_SECRET_ACCESS_KEY = "secret"
        settings.IMAGE_OPTIMIZE_ENABLED = True

        buf = io.BytesIO()
        Image.new("RGB", (20, 20), color="blue").save(buf, format="JPEG")
        file = UploadFile(
            file=io.BytesIO(buf.getvalue()),
            filename="foto_r2.jpg",
            headers=Headers({"content-type": "image/jpeg"}),
        )

        mock_s3 = MagicMock()
        entity_id = uuid4()
        with patch("boto3.client", return_value=mock_s3):
            result_url = save_upload_file(file, "products", entity_id)
            self.assertTrue(result_url.startswith("https://cdn.example.com/products/"))
            self.assertTrue(result_url.endswith(".webp"))
            self.assertIn(str(entity_id), result_url)
            mock_s3.upload_fileobj.assert_called_once()
            call_kwargs = mock_s3.upload_fileobj.call_args[1]
            self.assertEqual(call_kwargs["ExtraArgs"]["ContentType"], "image/webp")

    def test_config_validation_storage_and_images(self):
        # Probar validaciones de Settings
        settings.IMAGE_MAX_INPUT_BYTES = -10
        with self.assertRaises(ValueError):
            settings.validate_image_and_storage_config()
        settings.IMAGE_MAX_INPUT_BYTES = 10 * 1024 * 1024

        settings.IMAGE_WEBP_QUALITY = 150
        with self.assertRaises(ValueError):
            settings.validate_image_and_storage_config()
        settings.IMAGE_WEBP_QUALITY = 82

        settings.STORAGE_BACKEND = "invalid_storage_backend"
        with self.assertRaises(ValueError):
            settings.validate_image_and_storage_config()
        settings.STORAGE_BACKEND = "local"

    def test_path_traversal_sibling_directory_uploads_evil(self):
        """
        Verifica que una carpeta hermana llamada 'test_uploads_tmp_evil', que comparte
        el prefijo textual con 'test_uploads_tmp' pero está fuera del directorio permitido,
        sea rechazada en guardado y borrado.
        """
        uploads_base = settings.UPLOADS_PATH.resolve()
        sibling_evil_dir = uploads_base.parent / (uploads_base.name + "_evil")
        sibling_evil_dir.mkdir(parents=True, exist_ok=True)
        try:
            evil_file = sibling_evil_dir / "evil.txt"
            evil_file.write_bytes(b"malicious payload")

            # 1. Intento de borrado hacia la carpeta hermana
            rel_path_to_evil = f"/uploads/../{sibling_evil_dir.name}/evil.txt"
            deleted = delete_asset_file(rel_path_to_evil)
            self.assertFalse(deleted)
            self.assertTrue(evil_file.exists())

            # 2. Intento de guardado en la carpeta hermana
            from PIL import Image
            buf = io.BytesIO()
            Image.new("RGB", (10, 10), color="red").save(buf, format="JPEG")
            file = UploadFile(
                file=io.BytesIO(buf.getvalue()),
                filename="evil.jpg",
                headers=Headers({"content-type": "image/jpeg"}),
            )
            with self.assertRaises(HTTPException) as ctx:
                save_upload_file(file, f"../{sibling_evil_dir.name}", uuid4())
            self.assertEqual(ctx.exception.status_code, 400)
        finally:
            if sibling_evil_dir.exists():
                shutil.rmtree(sibling_evil_dir)

    def test_delete_asset_file_r2_strict_domain_validation(self):
        """
        Verifica que solo URLs que coincidan exactamente en esquema, host y prefijo con
        R2_PUBLIC_BASE_URL sean eliminadas. Rechaza dominios engañosos y URLs externas.
        """
        from unittest.mock import MagicMock, patch

        settings.STORAGE_BACKEND = "r2"
        settings.R2_PUBLIC_BASE_URL = "https://cdn.example.com"
        settings.R2_BUCKET_NAME = "test-bucket"
        settings.R2_ENDPOINT_URL = "https://r2.cloudflarestorage.com"
        settings.R2_ACCESS_KEY_ID = "key"
        settings.R2_SECRET_ACCESS_KEY = "secret"

        mock_s3 = MagicMock()
        with patch("boto3.client", return_value=mock_s3):
            # 1. Dominio engañoso con sufijo malicioso
            deceptive_url = "https://cdn.example.com.malicioso.com/products/img.webp"
            self.assertFalse(delete_asset_file(deceptive_url))
            mock_s3.delete_object.assert_not_called()

            # 2. Dominio completamente ajeno
            external_url = "https://attacker.org/products/img.webp"
            self.assertFalse(delete_asset_file(external_url))
            mock_s3.delete_object.assert_not_called()

            # 3. Path traversal dentro de la clave R2
            traversal_url = "https://cdn.example.com/../../etc/passwd"
            self.assertFalse(delete_asset_file(traversal_url))
            mock_s3.delete_object.assert_not_called()

            # 4. Cuando STORAGE_BACKEND no es R2, ninguna URL externa llama a delete_object
            settings.STORAGE_BACKEND = "local"
            valid_r2_url = "https://cdn.example.com/products/valid.webp"
            self.assertFalse(delete_asset_file(valid_r2_url))
            mock_s3.delete_object.assert_not_called()

    def test_config_validation_r2_urls(self):
        """Verifica que R2_ENDPOINT_URL y R2_PUBLIC_BASE_URL sean URLs HTTP/HTTPS válidas."""
        settings.STORAGE_BACKEND = "r2"
        settings.R2_BUCKET_NAME = "bucket"
        settings.R2_ACCESS_KEY_ID = "key"
        settings.R2_SECRET_ACCESS_KEY = "secret"

        # Endpoint sin http/https
        settings.R2_ENDPOINT_URL = "invalid-endpoint"
        settings.R2_PUBLIC_BASE_URL = "https://cdn.example.com"
        with self.assertRaises(ValueError):
            settings.validate_image_and_storage_config()

        # Public base URL sin http/https
        settings.R2_ENDPOINT_URL = "https://r2.cloudflarestorage.com"
        settings.R2_PUBLIC_BASE_URL = "not-a-url"
        with self.assertRaises(ValueError):
            settings.validate_image_and_storage_config()

        # URLs válidas
        settings.R2_ENDPOINT_URL = "https://r2.cloudflarestorage.com"
        settings.R2_PUBLIC_BASE_URL = "https://cdn.example.com"
        settings.validate_image_and_storage_config()

        settings.STORAGE_BACKEND = "local"


if __name__ == "__main__":
    unittest.main()
