import unittest
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from crud.crud_catalog import _slugify_category_name, _validate_category_parent
from schemas.catalog_schema import CategoriaCreate, ProductoCreate


class TestCatalogHierarchy(unittest.TestCase):
    def test_slug_normalizes_accents_and_spaces(self):
        self.assertEqual(
            _slugify_category_name("  Joyer\u00eda Fina  "),
            "joyeria-fina",
        )

    def test_category_schema_remains_compatible(self):
        category = CategoriaCreate(nombre="Anillos")
        self.assertIsNone(category.id_categoria_padre)
        self.assertEqual(category.orden, 0)

    def test_product_schema_accepts_legacy_category(self):
        category_id = uuid4()
        product = ProductoCreate(
            id_categoria=category_id,
            nombre="Anillo",
            precio_venta="120.00",
        )
        self.assertEqual(product.id_categoria, category_id)
        self.assertIsNone(product.id_categoria_principal)

    def test_parent_must_belong_to_same_store(self):
        store_id = uuid4()
        parent_id = uuid4()
        parent = SimpleNamespace(
            id_categoria=parent_id,
            id_tienda=uuid4(),
            id_categoria_padre=None,
        )
        with patch("crud.crud_catalog.get_categoria_by_id", return_value=parent):
            with self.assertRaisesRegex(ValueError, "no pertenece a la tienda"):
                _validate_category_parent(
                    object(),
                    id_tienda=store_id,
                    parent_id=parent_id,
                )

    def test_category_cannot_be_moved_under_descendant(self):
        store_id = uuid4()
        category_id = uuid4()
        child_id = uuid4()
        child = SimpleNamespace(
            id_categoria=child_id,
            id_tienda=store_id,
            id_categoria_padre=category_id,
        )
        category = SimpleNamespace(
            id_categoria=category_id,
            id_tienda=store_id,
            id_categoria_padre=None,
        )
        categories = {child_id: child, category_id: category}

        with patch(
            "crud.crud_catalog.get_categoria_by_id",
            side_effect=lambda db, id_categoria: categories.get(id_categoria),
        ):
            with self.assertRaisesRegex(ValueError, "dentro de sus descendientes"):
                _validate_category_parent(
                    object(),
                    id_tienda=store_id,
                    parent_id=child_id,
                    category_id=category_id,
                )


if __name__ == "__main__":
    unittest.main()
