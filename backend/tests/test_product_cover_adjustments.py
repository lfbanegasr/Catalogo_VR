import unittest
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from pydantic import ValidationError

from api.routes_public_catalog import _public_product_out
from schemas.catalog_schema import CategoriaCreate, ProductoCreate, ProductoUpdate


class TestProductCoverAdjustments(unittest.TestCase):
    def test_category_defaults_are_safe_for_existing_catalogs(self):
        category = CategoriaCreate(nombre="Collares")

        self.assertEqual(category.imagen_fit_default, "cover")
        self.assertEqual(category.imagen_posicion_x_default, 50)
        self.assertEqual(category.imagen_posicion_y_default, 30)
        self.assertEqual(category.imagen_zoom_default, 100)
        self.assertIsNone(category.imagen_fondo_default)

    def test_product_accepts_complete_portrait_adjustment(self):
        product = ProductoCreate(
            nombre="Collar largo",
            precio_venta=Decimal("60.00"),
            imagen_fit="contain",
            imagen_posicion_x=45,
            imagen_posicion_y=60,
            imagen_zoom=115,
            imagen_fondo="#F8F5F2",
        )

        self.assertEqual(product.imagen_fit, "contain")
        self.assertEqual(product.imagen_zoom, 115)

    def test_adjustment_limits_are_validated(self):
        with self.assertRaises(ValidationError):
            ProductoUpdate(imagen_posicion_x=101, imagen_zoom=250)

    def test_null_product_values_restore_category_inheritance(self):
        update = ProductoUpdate(
            imagen_fit=None,
            imagen_posicion_x=None,
            imagen_posicion_y=None,
            imagen_zoom=None,
            imagen_fondo=None,
        )

        self.assertEqual(
            update.model_dump(exclude_unset=True),
            {
                "imagen_fit": None,
                "imagen_posicion_x": None,
                "imagen_posicion_y": None,
                "imagen_zoom": None,
                "imagen_fondo": None,
            },
        )

    def test_public_product_inherits_category_adjustment(self):
        category = SimpleNamespace(
            imagen_fit_default="contain",
            imagen_posicion_x_default=50,
            imagen_posicion_y_default=55,
            imagen_zoom_default=90,
            imagen_fondo_default="#F4EEE8",
        )
        product = SimpleNamespace(
            id_producto=uuid4(),
            id_categoria=uuid4(),
            id_categoria_principal=None,
            categoria=category,
            categoria_principal=None,
            nombre="Collar de corazón",
            descripcion="Collar largo",
            precio_venta=Decimal("60.00"),
            imagen_url="/uploads/collar.webp",
            imagenes=["/uploads/collar.webp"],
            imagen_fit=None,
            imagen_posicion_x=None,
            imagen_posicion_y=None,
            imagen_zoom=None,
            imagen_fondo=None,
            fecha_agregado=datetime(2026, 8, 10),
        )

        public_product = _public_product_out(product)

        self.assertEqual(public_product.imagen_fit, "contain")
        self.assertEqual(public_product.imagen_posicion_y, 55)
        self.assertEqual(public_product.imagen_zoom, 90)
        self.assertEqual(public_product.imagen_fondo, "#F4EEE8")


if __name__ == "__main__":
    unittest.main()