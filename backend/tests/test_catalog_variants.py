import unittest
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from pydantic import ValidationError

from crud.crud_variants import serialize_variant
from schemas.catalog_variant_schema import VariantAttributeIn, VariantCreate
from schemas.sales_schema import DetalleVentaCreate


class TestCatalogVariants(unittest.TestCase):
    def test_variant_requires_at_least_one_attribute(self):
        with self.assertRaises(ValidationError):
            VariantCreate(stock_actual=1, atributos=[])

    def test_variant_accepts_inherited_product_price(self):
        payload = VariantCreate(
            stock_actual=3,
            atributos=[
                VariantAttributeIn(
                    id_atributo=uuid4(),
                    id_opcion=uuid4(),
                ),
            ],
        )
        self.assertIsNone(payload.precio_venta)
        self.assertEqual(payload.stock_actual, 3)

    def test_variant_rejects_negative_stock(self):
        with self.assertRaises(ValidationError):
            VariantCreate(
                stock_actual=-1,
                atributos=[
                    VariantAttributeIn(
                        id_atributo=uuid4(),
                        id_opcion=uuid4(),
                    ),
                ],
            )

    def test_sale_detail_keeps_variant_identity(self):
        variant_id = uuid4()
        detail = DetalleVentaCreate(
            id_producto=uuid4(),
            id_variante=variant_id,
            cantidad=2,
            precio_unitario=Decimal("15.50"),
        )
        self.assertEqual(detail.id_variante, variant_id)

    def test_variant_serializer_includes_readable_combination(self):
        attribute_id = uuid4()
        option_id = uuid4()
        variant = SimpleNamespace(
            id_variante=uuid4(),
            id_tienda=uuid4(),
            id_producto=uuid4(),
            sku="CAM-AZ-M",
            precio_venta=Decimal("99.90"),
            costo_adquisicion=Decimal("60.00"),
            stock_actual=5,
            imagen_url=None,
            imagen_fit="contain",
            imagen_posicion_x=42,
            imagen_posicion_y=58,
            imagen_zoom=125,
            imagen_fondo="#ffffff",
            activa=True,
            es_predeterminada=True,
            created_at=datetime(2026, 8, 2),
            updated_at=datetime(2026, 8, 2),
            atributos=[
                SimpleNamespace(
                    id_atributo=attribute_id,
                    id_opcion=option_id,
                    atributo=SimpleNamespace(nombre="Color", codigo="color"),
                    opcion=SimpleNamespace(valor="Azul"),
                ),
            ],
        )
        result = serialize_variant(variant)
        self.assertEqual(result["sku"], "CAM-AZ-M")
        self.assertEqual(result["atributos"][0]["valor"], "Azul")
        self.assertEqual(result["stock_actual"], 5)
        self.assertEqual(result["imagen_fit"], "contain")
        self.assertEqual(result["imagen_zoom"], 125)
        self.assertEqual(result["imagen_fondo"], "#ffffff")


if __name__ == "__main__":
    unittest.main()
