import unittest

from scripts.seed_accessories_store import (
    CATEGORY_ATTRIBUTES,
    PRODUCTS,
    seed_uuid,
    validate_spec,
)


class AccessoriesSeedTests(unittest.TestCase):
    def test_accessories_seed_spec_is_complete(self) -> None:
        counts = validate_spec()

        self.assertEqual(
            counts,
            {
                "categories": 5,
                "attributes": 10,
                "attribute_options": 27,
                "products": 12,
                "variants": 54,
            },
        )
        for category in ("aros", "manillas", "collares", "anillos"):
            self.assertEqual(sum(product["category"] == category for product in PRODUCTS), 3)

    def test_every_variant_matches_its_category_configuration(self) -> None:
        for product in PRODUCTS:
            expected = {
                code
                for code, _required, _filterable, used_in_variants in CATEGORY_ATTRIBUTES[product["category"]]
                if used_in_variants
            }
            for _sku, _price, _stock, values in product["variants"]:
                self.assertEqual(set(values), expected)

    def test_seed_identifiers_are_stable_and_namespaced(self) -> None:
        self.assertEqual(
            seed_uuid("product", "aros-luna-minimal"),
            seed_uuid("product", "aros-luna-minimal"),
        )
        self.assertNotEqual(
            seed_uuid("product", "aros-luna-minimal"),
            seed_uuid("variant", "aros-luna-minimal"),
        )


if __name__ == "__main__":
    unittest.main()
