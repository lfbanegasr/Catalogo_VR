import unittest
from uuid import uuid4

from pydantic import ValidationError

from schemas.public_event_schema import PublicEventIn
from api.routes_public_catalog import (
    _catalog_cache,
    _catalog_cache_lock,
    invalidate_public_catalog_cache,
)


class TestPublicAnalytics(unittest.TestCase):
    def test_allowed_public_event(self):
        event = PublicEventIn(evento="product_view", id_producto=uuid4())
        self.assertEqual(event.evento, "product_view")

    def test_unknown_public_event_is_rejected(self):
        with self.assertRaises(ValidationError):
            PublicEventIn(evento="arbitrary_event")

    def test_search_event_does_not_require_product(self):
        event = PublicEventIn(evento="search")
        self.assertIsNone(event.id_producto)

    def test_catalog_cache_can_be_invalidated_after_checkout(self):
        with _catalog_cache_lock:
            _catalog_cache["demo"] = (0.0, {"productos": []})
        invalidate_public_catalog_cache("demo")
        with _catalog_cache_lock:
            self.assertNotIn("demo", _catalog_cache)


if __name__ == "__main__":
    unittest.main()
