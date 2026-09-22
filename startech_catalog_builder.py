#!/usr/bin/env python3
"""Refresh the existing Star Tech seed from live listings (no images or DB writes).

python startech_catalog_builder.py
python startech_catalog_builder.py --validate-only
Dependencies: python -m pip install requests beautifulsoup4
"""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import copy
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import tempfile
import time
from urllib.parse import quote, unquote, urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from download_startech_images import HEADERS

BASE = "https://www.startech.com.bd"
DEFAULT_JSON = "prisma/startech_productseed.json"
DEFAULT_STATS = "prisma/startech_productseed.stats.json"


def canonical(url: str) -> str:
    parsed = urlsplit(urljoin(BASE, url))
    if parsed.hostname != "www.startech.com.bd" or parsed.scheme not in ("http", "https"):
        raise ValueError(f"Unexpected source URL: {url}")
    return urlunsplit(("https", parsed.netloc, quote(unquote(parsed.path).strip().rstrip("/"), safe="/"), "", ""))


def fetch(url: str, delay: float) -> BeautifulSoup:
    # Brief cache allows interrupted runs to resume without re-fetching every page.
    cache = Path(tempfile.gettempdir()) / "general-ecommerce-startech-pages"
    cache.mkdir(exist_ok=True)
    cached = cache / (hashlib.sha256(url.encode()).hexdigest() + ".html")
    if cached.exists() and time.time() - cached.stat().st_mtime < 3600:
        return BeautifulSoup(cached.read_text(encoding="utf-8"), "html.parser")
    time.sleep(delay)
    with requests.Session() as session:
        session.headers.update(HEADERS)
        session.mount("https://", HTTPAdapter(max_retries=Retry(
            total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504],
        )))
        response = session.get(url, timeout=40)
        response.raise_for_status()
        cached.write_text(response.text, encoding="utf-8")
        return BeautifulSoup(response.text, "html.parser")


def money(text: str) -> float | None:
    match = re.search(r"\d[\d,]*(?:\.\d+)?", text)
    return float(match.group().replace(",", "")) if match else None


def text_at(soup, selector: str) -> str:
    node = soup.select_one(selector)
    return node.get_text(" ", strip=True) if node else ""


def parse_product(soup: BeautifulSoup, url: str, category: str, existing: dict | None) -> dict | None:
    # A price alone is not availability: pre-order / discontinued items are excluded.
    status = text_at(soup, ".product-status").lower()
    offer = soup.select_one('.short-description [itemprop="availability"]')
    availability = (offer.get("href", "") or offer.get("content", "")) if offer else ""
    if not status and not availability:
        raise ValueError(f"Missing availability markup: {url}")
    if status not in ("in stock", "available") and (status or not availability.endswith("/InStock")):
        return None
    price_node = soup.select_one(".product-info-table .product-price")
    if not price_node:
        raise ValueError(f"Missing price markup: {url}")
    current = price_node.select_one("ins")
    if current:
        price = money(current.get_text())
    else:
        clean_price = BeautifulSoup(str(price_node), "html.parser")
        for old in clean_price.select("del"):
            old.decompose()
        price = money(clean_price.get_text())
    if price is None or price <= 0:
        return None
    old_price = price_node.select_one("del")
    original = money(old_price.get_text()) if old_price else None
    image_node = soup.select_one(".product-img-holder img")
    src = (image_node.get("src") or image_node.get("data-src")) if image_node else None
    name = text_at(soup, "h1")
    if not src or not name:
        raise ValueError(f"Missing product name/image: {url}")
    src = urljoin(url, src)
    ext = Path(urlsplit(src).path).suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"):
        raise ValueError(f"Unexpected image extension: {src}")
    features = [li.get_text(" ", strip=True) for li in soup.select(".short-description li:not(.view-more)")]
    model = next((line.split(":", 1)[1].strip() for line in features if line.lower().startswith("model:")), None)
    warranty = None
    for row in soup.select("#specification tr"):
        cells = row.select("td")
        if len(cells) == 2 and "warranty" in cells[0].get_text().lower():
            warranty = cells[1].get_text(" ", strip=True) or None
    if existing:
        slug = existing["slug"]
        sku = existing["sku"]
    else:
        slug_base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        slug = f"{slug_base}-{hashlib.sha256(url.encode()).hexdigest()[:8]}"
        sku = "ST-" + hashlib.sha256(url.encode()).hexdigest()[:12].upper()
    image = f"/images/products/startech/{category}/{slug}{ext}"
    # Keep already-downloaded paths if the format is unchanged.
    if existing and Path(existing["image"]).suffix.lower() == ext:
        image = existing["image"]
    product = copy.deepcopy(existing) if existing else {
        "featured": False, "stock": 10, "weight": None, "dimensions": None, "variants": [],
    }
    product.update({
        "name": name, "slug": slug, "sku": sku, "categorySlug": category,
        "brandName": text_at(soup, ".product-brand") or None,
        "model": model, "warranty": warranty,
        "basePrice": price, "originalPrice": original if original and original > price else None,
        "currency": "BDT", "available": True, "image": image, "gallery": [image],
        "shortDesc": "; ".join(features) or None,
        "description": "; ".join(features) or name,
        "sourceProductUrl": url, "sourceImageUrl": src, "sourceGalleryUrls": [src],
        "localImageFile": "public" + image,
    })
    return product


def stats_for(data: dict) -> dict:
    counts = Counter(p["categorySlug"] for p in data["products"])
    targets = [c["slug"] for c in data["categories"] if c.get("sourceCategoryUrl")]
    return {"categoryRecords": len(data["categories"]), "targetProductCategories": len(targets),
            "products": len(data["products"]), "productsPerCategory": {slug: counts[slug] for slug in targets}}


def validate(data: dict, limit: int = 50) -> dict:
    categories = data["categories"]
    products = data["products"]
    category_slugs = {c["slug"] for c in categories}
    if len(category_slugs) != len(categories):
        raise ValueError("Duplicate category slugs")
    seen_categories = set()
    for category in categories:
        parent = category.get("parentSlug")
        if parent is not None and parent not in seen_categories:
            raise ValueError(f"Missing parent or parent ordered after child: {category['slug']}")
        seen_categories.add(category["slug"])
    for key in ("slug", "sku", "sourceProductUrl"):
        values = [canonical(p[key]) if key == "sourceProductUrl" else p[key] for p in products]
        if len(values) != len(set(values)) or not all(values):
            raise ValueError(f"Empty or duplicate {key}")
    for product in products:
        if product["categorySlug"] not in category_slugs:
            raise ValueError(f"Unknown category: {product['slug']}")
        price = product["basePrice"]
        if isinstance(price, bool) or not isinstance(price, (int, float)) or not math.isfinite(price) or not 0 < price < 100000000:
            raise ValueError(f"Invalid price: {product['slug']}")
        image = product["image"]
        if not image.startswith(f"/images/products/startech/{product['categorySlug']}/") or ".." in Path(image).parts or product["localImageFile"] != "public" + image:
            raise ValueError(f"Inconsistent image path: {product['slug']}")
        if not product["sourceImageUrl"] or urlsplit(product["sourceImageUrl"]).scheme not in ("http", "https"):
            raise ValueError(f"Missing source image: {product['slug']}")
        if product["gallery"] != [image] or not isinstance(product["variants"], list):
            raise ValueError(f"Invalid gallery/variants: {product['slug']}")
    stats = stats_for(data)
    if any(count > limit for count in stats["productsPerCategory"].values()):
        raise ValueError("Category exceeds requested limit")
    return stats


def build(data: dict, limit: int, workers: int, delay: float) -> dict:
    result = copy.deepcopy(data)
    result["products"] = []
    existing = {canonical(p["sourceProductUrl"]): p for p in data["products"]}
    assigned = set()
    for category in data["categories"]:
        source = category.get("sourceCategoryUrl")
        if not source:
            continue
        slug = category["slug"]
        collected = []
        checked = set()
        failures = []

        def read_product(url):
            old = existing.get(url)
            try:
                return parse_product(fetch(url, delay), url, slug, old)
            except (requests.RequestException, ValueError) as exc:
                failures.append(url)
                print(f"SKIP detail {url}: {exc}", flush=True)
                return None

        def collect(urls):
            # Reserve old category assignments to avoid moving existing products.
            urls = list(dict.fromkeys(url for url in urls if url not in checked and url not in assigned
                                     and (url not in existing or existing[url]["categorySlug"] == slug)))
            checked.update(urls)
            with ThreadPoolExecutor(max_workers=workers) as pool:
                for product in pool.map(read_product, urls):
                    if product and len(collected) < limit:
                        collected.append(product)
                        assigned.add(product["sourceProductUrl"])

        # Refresh existing items first, retaining their identities if still available.
        collect([url for url, p in existing.items() if p["categorySlug"] == slug][:limit])
        page = 1
        fingerprints = set()
        while len(collected) < limit:
            soup = fetch(f"{source}?limit=90&page={page}", delay)
            cards = soup.select(".p-item")
            if not cards:
                raise ValueError(f"No listing cards found at {source}, page {page}; refusing partial output")
            urls = []
            for card in cards:
                anchor = card.select_one(".p-item-name a")
                offer = card.select_one('[itemprop="availability"]')
                availability = (offer.get("content", "") or offer.get("href", "")) if offer else ""
                if anchor and availability.endswith("/InStock"):
                    urls.append(canonical(anchor["href"]))
            fingerprint = tuple(a["href"] for a in soup.select(".p-item-name a"))
            if fingerprint in fingerprints:
                raise ValueError(f"Repeated listing page at {source}, page {page}")
            fingerprints.add(fingerprint)
            # Small batches avoid requesting dozens of unused detail pages.
            for offset in range(0, len(urls), workers):
                if len(collected) >= limit:
                    break
                collect(urls[offset:offset + workers])
            next_link = next((a for a in soup.select(".pagination a") if a.get_text(strip=True).upper() == "NEXT"), None)
            if not next_link:
                break
            page += 1
        if failures and len(collected) < limit:
            raise ValueError(f"{slug}: failed to verify {len(failures)} pages; retry before accepting a short category")
        result["products"].extend(collected)
        print(f"{slug}: {len(collected)}/{limit} available products ({len(checked)} checked)", flush=True)
        # Category thumbnails must reference an included product after refresh.
        updated_category = next(c for c in result["categories"] if c["slug"] == slug)
        if collected and updated_category.get("image") not in {p["image"] for p in collected}:
            updated_category["image"] = collected[0]["image"]
    return result


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", default=DEFAULT_JSON)
    parser.add_argument("--stats", default=DEFAULT_STATS)
    parser.add_argument("--limit", type=int, default=50, help="Available products per category")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--delay", type=float, default=0.2)
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    if args.limit < 1 or args.workers < 1 or args.delay < 0:
        parser.error("limit/workers must be positive and delay nonnegative")
    path, stats_path = Path(args.json), Path(args.stats)
    data = json.loads(path.read_text(encoding="utf-8"))
    if not args.validate_only:
        data = build(data, args.limit, args.workers, args.delay)
    stats = validate(data, args.limit)
    if args.validate_only:
        if json.loads(stats_path.read_text(encoding="utf-8")) != stats:
            raise ValueError("Stats do not match the actual seed")
    else:
        # No seed is overwritten until every category has been fetched and validated.
        for target, value in ((path, data), (stats_path, stats)):
            temporary = target.with_suffix(target.suffix + ".tmp")
            temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            temporary.replace(target)
    print(json.dumps(stats, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
