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

from core.config import settings
from core.storage import build_public_asset_url, save_upload_file


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
        file_content = b"fake image data"
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
        # Exceeding size limit (5MB) should fail
        large_content = b"x" * (5 * 1024 * 1024 + 1)
        file = UploadFile(
            file=io.BytesIO(large_content),
            filename="huge.jpg",
            headers=Headers({"content-type": "image/jpeg"}),
        )

        with self.assertRaises(HTTPException) as context:
            save_upload_file(file, "products", uuid4())
        self.assertEqual(context.exception.status_code, 413)


if __name__ == "__main__":
    unittest.main()
