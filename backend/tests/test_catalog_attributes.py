import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError

from api.routes_catalog_attributes import _ensure_tenant_access
from crud.crud_attributes import _serialize_product_attribute
from schemas.catalog_attribute_schema import AttributeCreate, ProductAttributeValueIn


class TestCatalogAttributes(unittest.TestCase):
    def test_attribute_type_is_restricted(self):
        with self.assertRaises(ValidationError):
            AttributeCreate(nombre="Material", tipo_dato="INVALID")

    def test_boolean_false_is_a_valid_value(self):
        value = ProductAttributeValueIn(
            id_atributo=uuid4(),
            valor_booleano=False,
        )
        self.assertIs(value.valor_booleano, False)

    def test_numeric_zero_is_a_valid_value(self):
        value = ProductAttributeValueIn(
            id_atributo=uuid4(),
            valor_numero=Decimal("0"),
        )
        self.assertEqual(value.valor_numero, Decimal("0"))

    def test_other_store_is_rejected(self):
        user = SimpleNamespace(rol="admin", id_tienda=uuid4())
        with self.assertRaises(HTTPException) as context:
            _ensure_tenant_access(user, uuid4())
        self.assertEqual(context.exception.status_code, 403)

    def test_false_value_is_serialized_without_becoming_empty(self):
        row = SimpleNamespace(
            id_producto_atributo=uuid4(),
            id_producto=uuid4(),
            id_atributo=uuid4(),
            id_opcion=None,
            opcion=None,
            valor_texto=None,
            valor_numero=None,
            valor_booleano=False,
            atributo=SimpleNamespace(
                nombre="Resistente al agua",
                codigo="resistente-al-agua",
                tipo_dato="BOOLEAN",
                unidad=None,
            ),
        )
        serialized = _serialize_product_attribute(row)
        self.assertIs(serialized["valor"], False)


if __name__ == "__main__":
    unittest.main()
