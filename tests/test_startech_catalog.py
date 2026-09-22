import copy
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from bs4 import BeautifulSoup
from startech_catalog_builder import canonical, parse_product, validate
from download_startech_images import download, infer_dest, main as download_main


class CatalogTests(unittest.TestCase):
    def product(self, status="In Stock", existing=None):
        html = f'''<h1>Example Laptop</h1><table class="product-info-table">
        <td class="product-status">{status}</td><td class="product-brand">Example</td>
        <td class="product-price"><ins>28,500</ins><del>33,900</del></td></table>
        <span class="mark">Save: 5,400</span>
        <div class="product-img-holder"><img src="/image/example.webp"></div>
        <div class="short-description"><li>Model: N41</li></div>
        <table id="specification"><tr><td>Warranty Details</td><td>1 year</td></tr></table>'''
        return parse_product(BeautifulSoup(html, "html.parser"), canonical("/example"), "laptop", existing)

    def test_real_price_not_savings_and_metadata(self):
        p = self.product()
        self.assertEqual((p["basePrice"], p["originalPrice"]), (28500, 33900))
        self.assertEqual((p["model"], p["warranty"]), ("N41", "1 year"))
        self.assertEqual(p["localImageFile"], "public" + p["image"])
        self.assertIsNone(self.product("Pre Order"))

    def test_refresh_keeps_existing_identity_and_image_path(self):
        existing = self.product()
        existing.update(slug="previous-slug", sku="PREVIOUS-SKU", image="/images/products/startech/laptop/previous.webp")
        refreshed = self.product(existing=existing)
        self.assertEqual(refreshed["slug"], "previous-slug")
        self.assertEqual(refreshed["sku"], "PREVIOUS-SKU")
        self.assertEqual(refreshed["image"], existing["image"])

    def test_duplicates_and_paths_rejected(self):
        p = self.product()
        data = {"categories": [{"slug": "laptop", "parentSlug": None, "sourceCategoryUrl": "/laptop"}], "products": [p]}
        self.assertEqual(validate(data)["products"], 1)
        duplicate = copy.deepcopy(data)
        duplicate["products"].append(p)
        with self.assertRaisesRegex(ValueError, "duplicate"):
            validate(duplicate)
        p["localImageFile"] = "wrong.webp"
        with self.assertRaisesRegex(ValueError, "image path"):
            validate(data)

    def test_downloader_limit_skip_overwrite_and_failure_continuation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            products = []
            for index in range(12):
                p = self.product()
                p["localImageFile"] = f"public/images/{index}.webp"
                products.append(p)
            seed = root / "seed.json"
            seed.write_text(json.dumps({"products": products}), encoding="utf-8")
            existing = root / products[0]["localImageFile"]
            existing.parent.mkdir(parents=True)
            existing.write_bytes(b"existing")
            args = ["download_startech_images.py", "--json", str(seed), "--project-root", str(root), "--limit", "10", "--delay", "0"]
            output = io.StringIO()
            # One failed image must not stop processing the remaining selected items.
            with patch("sys.argv", args), patch("download_startech_images.download", side_effect=[OSError("failed")] + [None] * 8) as mocked, contextlib.redirect_stdout(output), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(download_main(), 1)
                self.assertEqual(mocked.call_count, 9)
            self.assertIn("Downloaded: 8", output.getvalue())
            self.assertIn("Skipped:    1", output.getvalue())
            self.assertIn("Failed:     1", output.getvalue())
            with patch("sys.argv", args + ["--overwrite"]), patch("download_startech_images.download") as mocked, contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(download_main(), 0)
                self.assertEqual(mocked.call_count, 10)

    def test_failed_download_preserves_existing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dest = infer_dest(self.product(), root)
            dest.parent.mkdir(parents=True)
            dest.write_bytes(b"existing-image")
            response = Mock()
            response.headers = {"content-type": "image/webp"}
            def chunks(*args):
                yield b"incomplete"
                raise OSError("interrupted")
            response.iter_content = chunks
            response.__enter__ = Mock(return_value=response)
            response.__exit__ = Mock(return_value=False)
            session = Mock()
            session.get.return_value = response
            with self.assertRaises(OSError):
                download(session, "https://example.com/image", dest)
            self.assertEqual(dest.read_bytes(), b"existing-image")
            self.assertFalse(dest.with_name(dest.name + ".part").exists())


if __name__ == "__main__":
    unittest.main()
