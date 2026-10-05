"""
test_image_migrator.py
----------------------
Pruebas exhaustivas para backend/scripts/optimize_existing_images.py.

Verifica:
  - Sin argumentos (o apply=False), el migrador es DRY-RUN real y no escribe, renombra ni borra.
  - --apply es obligatorio para modificar archivos o base de datos.
  - Si la base de datos falla: rollback, se conserva el original y se elimina el nuevo WebP creado.
  - Actualización atómica de referencias en productos, galería, ofertas, variantes y theme_config (JSON).
  - Comportamiento ante destinos WebP ya existentes (validez, consistencia y preservación de originales).
  - Cálculo de ahorro real en memoria (no porcentajes estimados).
  - Aislamiento absoluto: ninguna prueba toca backend/uploads real.
"""

import io
import os
import shutil
import unittest
from pathlib import Path
from unittest.mock import MagicMock
from uuid import uuid4

from PIL import Image

# Configurar uploads temporal antes de imports
TEST_TMP_MIGRATOR_DIR = Path("./test_uploads_tmp_migrator").resolve()

from scripts.optimize_existing_images import (
    MigrationStats,
    _replace_in_json_tree,
    find_local_images,
    run_migration,
    update_database_references,
)


def _make_test_jpeg(path: Path, width: int = 50, height: int = 50) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (width, height), color=(200, 100, 50))
    img.save(path, format="JPEG", quality=85)
    return path.stat().st_size


def _make_test_webp(path: Path, width: int = 50, height: int = 50) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (width, height), color=(100, 150, 200))
    img.save(path, format="WEBP", quality=80)
    return path.stat().st_size


class TestImageMigrator(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if TEST_TMP_MIGRATOR_DIR.exists():
            shutil.rmtree(TEST_TMP_MIGRATOR_DIR)
        TEST_TMP_MIGRATOR_DIR.mkdir(parents=True, exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        if TEST_TMP_MIGRATOR_DIR.exists():
            shutil.rmtree(TEST_TMP_MIGRATOR_DIR)

    def setUp(self):
        # Limpiar directorio de pruebas antes de cada test
        if TEST_TMP_MIGRATOR_DIR.exists():
            shutil.rmtree(TEST_TMP_MIGRATOR_DIR)
        TEST_TMP_MIGRATOR_DIR.mkdir(parents=True, exist_ok=True)

    def test_dry_run_does_not_modify_any_files(self):
        """Verifica que sin apply no se escribe, renombra ni elimina nada en disco."""
        products_dir = TEST_TMP_MIGRATOR_DIR / "products"
        jpg_file = products_dir / "anillo.jpg"
        orig_size = _make_test_jpeg(jpg_file, 80, 80)
        orig_mtime = jpg_file.stat().st_mtime_ns

        dest_webp = products_dir / "anillo.webp"
        self.assertFalse(dest_webp.exists())

        stats = run_migration(
            TEST_TMP_MIGRATOR_DIR,
            apply=False,
            db_session_factory=lambda: MagicMock(),
        )

        # 1. El original sigue existiendo intacto
        self.assertTrue(jpg_file.exists())
        self.assertEqual(jpg_file.stat().st_size, orig_size)
        self.assertEqual(jpg_file.stat().st_mtime_ns, orig_mtime)

        # 2. No se creó ningún archivo .webp en disco
        self.assertFalse(dest_webp.exists())

        # 3. Estadísticas reflejan simulación en memoria
        self.assertEqual(stats.encontradas, 1)
        self.assertEqual(stats.convertibles, 1)
        self.assertEqual(stats.convertidas, 0)
        self.assertEqual(stats.originales_conservados, 1)
        self.assertEqual(stats.referencias_bd_actualizadas, 0)
        self.assertEqual(stats.errores, 0)
        self.assertGreater(stats.bytes_despues, 0)
        self.assertNotEqual(stats.bytes_despues, int(stats.bytes_antes * 0.55))

    def test_apply_is_mandatory_to_make_changes(self):
        """Con apply=True y BD exitosa, el WebP se crea y el original se elimina."""
        products_dir = TEST_TMP_MIGRATOR_DIR / "products"
        jpg_file = products_dir / "collar.jpg"
        _make_test_jpeg(jpg_file, 60, 60)
        dest_webp = products_dir / "collar.webp"

        mock_db = MagicMock()
        mock_result = MagicMock()
        mock_result.rowcount = 1
        mock_db.execute.return_value = mock_result
        mock_db.query.return_value.filter.return_value.all.return_value = []

        stats = run_migration(
            TEST_TMP_MIGRATOR_DIR,
            apply=True,
            db_session_factory=lambda: mock_db,
        )

        self.assertEqual(stats.errores, 0)
        self.assertEqual(stats.convertidas, 1)
        self.assertTrue(dest_webp.exists())
        self.assertFalse(jpg_file.exists())
        mock_db.commit.assert_called()

        # Verificar que el WebP generado es válido
        with Image.open(dest_webp) as img:
            self.assertEqual(img.format, "WEBP")

    def test_database_failure_rolls_back_preserves_original_and_removes_new_webp(self):
        """Si la BD falla: rollback, original conservado y WebP nuevo eliminado."""
        offers_dir = TEST_TMP_MIGRATOR_DIR / "offers"
        jpg_file = offers_dir / "banner.png"
        orig_size = _make_test_jpeg(jpg_file, 70, 70)
        dest_webp = offers_dir / "banner.webp"

        mock_db = MagicMock()
        mock_db.execute.side_effect = RuntimeError("Conexión perdida a PostgreSQL")

        stats = run_migration(
            TEST_TMP_MIGRATOR_DIR,
            apply=True,
            db_session_factory=lambda: mock_db,
        )

        # 1. Rollback ejecutado
        mock_db.rollback.assert_called_once()

        # 2. El archivo original se conservó intacto
        self.assertTrue(jpg_file.exists())
        self.assertEqual(jpg_file.stat().st_size, orig_size)

        # 3. El nuevo archivo WebP creado en el intento fallido fue eliminado
        self.assertFalse(dest_webp.exists())

        # 4. Error registrado en estadísticas
        self.assertEqual(stats.errores, 1)
        self.assertEqual(stats.originales_conservados, 1)
        self.assertIn("Fallo en transacción de BD", stats.detalle_errores[0])

    def test_replace_in_json_tree_recursive(self):
        """Verifica el reemplazo seguro en estructuras JSON arbitrariamente anidadas."""
        old_url = "/uploads/theme/hero.jpg"
        new_url = "/uploads/theme/hero.webp"

        data = {
            "hero_image_url": old_url,
            "title": "Mi Tienda",
            "category_images": {
                "cat_1": old_url,
                "cat_2": "/uploads/theme/other.jpg",
            },
            "banners": [
                {"img": old_url},
                {"img": "/uploads/theme/safe.png"},
            ],
        }

        updated, count = _replace_in_json_tree(data, old_url, new_url)

        self.assertEqual(count, 3)
        self.assertEqual(updated["hero_image_url"], new_url)
        self.assertEqual(updated["category_images"]["cat_1"], new_url)
        self.assertEqual(updated["category_images"]["cat_2"], "/uploads/theme/other.jpg")
        self.assertEqual(updated["banners"][0]["img"], new_url)
        self.assertEqual(updated["banners"][1]["img"], "/uploads/theme/safe.png")

    def test_database_references_updated_across_all_tables(self):
        """Verifica que update_database_references actualice todas las tablas y JSON."""
        mock_db = MagicMock()
        mock_result = MagicMock()
        mock_result.rowcount = 2  # simula 2 filas actualizadas por execute
        mock_db.execute.return_value = mock_result

        # Mock de Tienda con theme_config
        mock_tienda = MagicMock()
        mock_tienda.theme_config = {
            "hero_image_url": "/uploads/theme/banner.jpg",
            "category_images": {"1": "/uploads/theme/banner.jpg"},
        }
        mock_db.query.return_value.filter.return_value.all.return_value = [mock_tienda]

        total = update_database_references(
            mock_db,
            old_url="/uploads/theme/banner.jpg",
            new_url="/uploads/theme/banner.webp",
        )

        # 4 llamadas a execute (productos, producto_imagenes, ofertas, variantes) * 2 filas = 8
        # + 2 reemplazos en theme_config = 10
        self.assertEqual(total, 8 + 2)
        self.assertEqual(
            mock_tienda.theme_config["hero_image_url"],
            "/uploads/theme/banner.webp",
        )

    def test_collision_jpg_and_png_same_name_preserved(self):
        """
        Conflicto: foto.jpg y foto.png con el mismo nombre base.
        No deben convertirse a WebP, no deben actualizar la BD,
        ambos originales deben preservarse intactos y reportar revisión manual.
        """
        products_dir = TEST_TMP_MIGRATOR_DIR / "products"
        jpg_file = products_dir / "foto.jpg"
        png_file = products_dir / "foto.png"
        dest_webp = products_dir / "foto.webp"

        jpg_size = _make_test_jpeg(jpg_file, 40, 40)
        png_size = _make_test_jpeg(png_file, 40, 40)  # make valid image bytes

        mock_db = MagicMock()
        stats = run_migration(
            TEST_TMP_MIGRATOR_DIR,
            apply=True,
            db_session_factory=lambda: mock_db,
        )

        # 1. Ambos archivos originales deben existir intactos
        self.assertTrue(jpg_file.exists())
        self.assertTrue(png_file.exists())
        self.assertEqual(jpg_file.stat().st_size, jpg_size)
        self.assertEqual(png_file.stat().st_size, png_size)

        # 2. No debe haberse generado foto.webp
        self.assertFalse(dest_webp.exists())

        # 3. No se cuenta como convertida
        self.assertEqual(stats.convertidas, 0)
        self.assertEqual(stats.originales_conservados, 2)
        self.assertEqual(stats.conflictos, 2)
        self.assertTrue(any("Colisión múltiple" in e or "Conflicto" in e for e in stats.detalle_errores))

        # 4. No debe actualizar referencias en la base de datos
        mock_db.commit.assert_not_called()
        self.assertEqual(stats.referencias_bd_actualizadas, 0)

    def test_collision_jpg_and_preexisting_webp_different(self):
        """
        Conflicto: reloj.jpg y un reloj.webp preexistente.
        No se asume que el WebP corresponde al original, no se convierte,
        el WebP existente no se cuenta como convertido y el original se preserva.
        """
        products_dir = TEST_TMP_MIGRATOR_DIR / "products"
        jpg_file = products_dir / "reloj.jpg"
        webp_file = products_dir / "reloj.webp"

        _make_test_jpeg(jpg_file, 40, 40)
        _make_test_webp(webp_file, 30, 30)

        mock_db = MagicMock()
        stats = run_migration(
            TEST_TMP_MIGRATOR_DIR,
            apply=True,
            db_session_factory=lambda: mock_db,
        )

        # 1. Original preservado
        self.assertTrue(jpg_file.exists())
        self.assertTrue(webp_file.exists())

        # 2. WebP existente NO debe contarse como convertido
        self.assertEqual(stats.convertidas, 0)
        self.assertEqual(stats.conflictos, 1)
        self.assertEqual(stats.originales_conservados, 1)
        self.assertTrue(any("ya existe previamente en disco" in e for e in stats.detalle_errores))

        # 3. No se toca la BD
        mock_db.commit.assert_not_called()
        self.assertEqual(stats.referencias_bd_actualizadas, 0)

    def test_collision_different_database_references_preserved(self):
        """
        Si foto.jpg y foto.png tienen referencias distintas en BD, ante una colisión
        ninguna referencia se actualiza y la BD permanece intacta.
        """
        products_dir = TEST_TMP_MIGRATOR_DIR / "products"
        _make_test_jpeg(products_dir / "item.jpg", 30, 30)
        _make_test_jpeg(products_dir / "item.png", 30, 30)

        mock_db = MagicMock()
        stats = run_migration(
            TEST_TMP_MIGRATOR_DIR,
            apply=True,
            db_session_factory=lambda: mock_db,
        )

        self.assertEqual(stats.convertidas, 0)
        self.assertEqual(stats.referencias_bd_actualizadas, 0)
        mock_db.commit.assert_not_called()

    def test_subfolder_path_traversal_and_sibling_uploads_evil_rejected(self):
        """Rechaza subfolder traversal como '../otra-carpeta' o 'uploads_evil'."""
        sibling_evil = TEST_TMP_MIGRATOR_DIR.parent / (TEST_TMP_MIGRATOR_DIR.name + "_evil")
        sibling_evil.mkdir(parents=True, exist_ok=True)
        try:
            # 1. Subfolder traversal
            with self.assertRaises(ValueError) as ctx:
                find_local_images(TEST_TMP_MIGRATOR_DIR, subfolder="../otra-carpeta")
            self.assertIn("Path traversal", str(ctx.exception))

            # 2. Subfolder hacia carpeta hermana
            with self.assertRaises(ValueError) as ctx:
                find_local_images(TEST_TMP_MIGRATOR_DIR, subfolder=f"../{sibling_evil.name}")
            self.assertIn("Path traversal", str(ctx.exception))

            # 3. run_migration captura y registra el error de forma segura
            stats = run_migration(TEST_TMP_MIGRATOR_DIR, subfolder="../otra-carpeta")
            self.assertGreater(stats.errores, 0)
            self.assertTrue(any("Path traversal" in err for err in stats.detalle_errores))
        finally:
            if sibling_evil.exists():
                shutil.rmtree(sibling_evil)


if __name__ == "__main__":
    unittest.main()
