import copy
import sys
import unittest
from argparse import Namespace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.python import build_startech_full_seed as seed


class FinalizeTests(unittest.TestCase):
    def setUp(self):
        self.hints = seed.HierarchyHints()
        self.args = Namespace(category_json=Path("categories.json"), image_json=Path("images.json"), stock=200, cost_ratio=0.96)

    def result(self, stem="adapter", category="accessories", sub="bluetooth-adapter", brand="baseus"):
        image = f"/images/products/{category}/{sub}/{brand}/{stem}.png"
        record = seed.ImageRecord(image, category, category.title(), [category, sub, brand], stem,
                                  sub, sub.title(), brand, brand.title(), "brand")
        product = {
            "name": "Adapter", "slug": "adapter", "sku": "SKU", "brandName": brand.title(),
            "sourceProductUrl": f"https://www.startech.com.bd/{stem}", "image": image,
            "localImageFile": "public" + image, "sourceImages": [image],
            "sourceHierarchy": [record.audit_dict()], "variants": [{"sku": "SKU", "options": {"Color": "Black"}}],
            "description": "Full description", "specificationGroups": [{"name": "General", "items": []}],
            "taxonomy": seed.resolve_taxonomy(record, brand.title(), self.hints),
        }
        return {"ok": True, "stem": stem, "product": product}

    def finalize(self, results):
        output = seed.finalize_output(results, self.args, self.hints)
        output["source"].pop("generatedAtUnix")
        return output

    def test_checkpoints_are_repeatable_and_do_not_mutate_details(self):
        results = [self.result(), self.result("second")]
        original = copy.deepcopy(results)
        first = self.finalize(results)
        self.assertEqual(first, self.finalize(results))
        self.assertEqual(results, original)
        self.assertEqual(first, self.finalize(list(reversed(results))))
        for product, result in zip(first["products"], original):
            for key in ("image", "description", "specificationGroups"):
                self.assertEqual(product[key], result["product"][key])
            self.assertEqual(product["categorySlug"], "bluetooth-adapter")
            self.assertEqual(product["brandSlugHint"], "baseus")
        self.assertEqual(first["products"][1]["variants"][0]["sku"], "SKU-2")

    def test_missing_or_malformed_taxonomy_is_identified(self):
        for key in (None, "topCategorySlug", "subcategorySlug", "brandSlug"):
            with self.subTest(key=key):
                result = self.result()
                if key is None:
                    del result["product"]["taxonomy"]
                else:
                    del result["product"]["taxonomy"][key]
                with self.assertRaisesRegex(ValueError, "Invalid product taxonomy.*Adapter.*adapter.png"):
                    self.finalize([result])

    def test_duplicate_url_uses_taxonomy_of_selected_image(self):
        first = self.result("a", category="accessories")
        second = self.result("z", category="networking", sub="adapter")
        second["product"]["sourceProductUrl"] = first["product"]["sourceProductUrl"]
        original = copy.deepcopy([first, second])
        output = self.finalize([first, second])
        product = output["products"][0]
        self.assertEqual(product["image"], second["product"]["image"])
        self.assertEqual(product["categorySlug"], "adapter")
        category = next(c for c in output["categories"] if c["slug"] == product["categorySlug"])
        self.assertEqual(category["parentSlug"], "networking")
        self.assertEqual(len(product["sourceImages"]), 2)
        self.assertEqual([first, second], original)
        self.assertEqual(output, self.finalize([second, first]))

    def test_multiple_parents_and_brands_preserve_mapping(self):
        results = [self.result("one", category="accessories", sub="adapter"),
                   self.result("two", category="networking", sub="adapter", brand="tp-link")]
        output = self.finalize(results)
        self.assertEqual([p["categorySlug"] for p in output["products"]], ["accessories-adapter", "networking-adapter"])
        self.assertEqual([p["brandSlugHint"] for p in output["products"]], ["baseus", "tp-link"])

    def test_category_direct_allows_explicit_null_subcategory_and_brand(self):
        result = self.result()
        tax = result["product"]["taxonomy"]
        for key in ("subcategorySlug", "subcategoryName", "brandSlug", "brandName"):
            tax[key] = None
        result["product"]["brandName"] = None
        self.assertEqual(self.finalize([result])["products"][0]["categorySlug"], "accessories")


if __name__ == "__main__":
    unittest.main()
