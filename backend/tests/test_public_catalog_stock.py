import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from crud.crud_offers import apply_offer_pricing_context, load_offer_pricing_context
from crud.crud_public import _filter_products_with_public_stock


class TestPublicCatalogStock(unittest.TestCase):
    def test_products_with_zero_or_missing_stock_are_hidden(self):
        products = [
            {"id": "available", "stock": 3},
            {"id": "sold-out", "stock": 0},
            {"id": "missing", "stock": None},
        ]

        visible = _filter_products_with_public_stock(products)

        self.assertEqual([product["id"] for product in visible], ["available"])

    def test_offer_context_prices_variants_without_database_queries(self):
        product_id = uuid4()
        offer_id = uuid4()
        products = [
            {"id": str(product_id), "precio": Decimal("100.00"), "categoria_id": None},
            {"id": str(product_id), "precio": Decimal("200.00"), "categoria_id": None},
        ]
        context = {
            "active_offers": [SimpleNamespace(id_oferta=offer_id)],
            "product_rows": [
                (
                    product_id,
                    offer_id,
                    "Oferta",
                    "PERCENT",
                    Decimal("10"),
                    1,
                    None,
                    "-10%",
                    None,
                    None,
                    None,
                ),
            ],
            "category_rows": [],
        }

        priced = apply_offer_pricing_context(products=products, context=context)

        self.assertEqual(priced[0]["precio_final"], 90.0)
        self.assertEqual(priced[1]["precio_final"], 180.0)

    def test_offer_targets_are_loaded_with_one_query(self):
        store_id = uuid4()
        product_id = uuid4()
        offer_id = uuid4()
        offer = SimpleNamespace(
            id_oferta=offer_id,
            nombre="Oferta",
            tipo="PERCENT",
            porcentaje=Decimal("10"),
            prioridad=1,
            banner_url=None,
            badge_text="-10%",
            fecha_inicio=None,
            fecha_fin=None,
        )
        db = MagicMock()
        db.execute.return_value.all.return_value = [
            (offer, product_id, None, None),
        ]

        context = load_offer_pricing_context(
            db,
            id_tienda=store_id,
            products=[{"id": str(product_id), "precio": 100, "categoria_id": None}],
        )

        db.execute.assert_called_once()
        self.assertEqual(context["active_offers"], [offer])
        self.assertEqual(context["product_rows"][0][0], product_id)


if __name__ == "__main__":
    unittest.main()
