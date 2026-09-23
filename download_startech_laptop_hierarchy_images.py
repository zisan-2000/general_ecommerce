#!/usr/bin/env python3
"""
Star Tech Laptop image downloader with full hierarchy.

Source:
    https://www.startech.com.bd/laptop-notebook

Hierarchy preserved as:

Laptop
├── All Laptop
│   ├── Lenovo
│   ├── MSI
│   ├── HP
│   ├── Asus
│   ├── Tecno
│   ├── Chuwi
│   ├── MacBook
│   ├── Gigabyte
│   ├── Acer
│   ├── Dell
│   ├── Microsoft
│   ├── Smart
│   ├── Thunderobot
│   └── Walton
├── Gaming Laptop
│   ├── MSI
│   ├── Asus
│   ├── Lenovo
│   ├── Gigabyte
│   ├── HP
│   └── Acer
├── Premium Ultrabook
│   ├── HP
│   ├── Acer
│   ├── Lenovo
│   ├── Asus
│   ├── Dell
│   ├── Microsoft
│   └── MSI
├── Laptop Bag
│   ├── Asus
│   ├── Dell
│   ├── Fantech
│   ├── Lenovo
│   ├── MaxGreen
│   ├── Targus
│   ├── BWOO
│   ├── Tucano
│   ├── UGREEN
│   ├── WiWU
│   ├── Xiaomi
│   ├── Arctic Hunter
│   └── Honor
└── Laptop Accessories
    ├── Laptop Cooler
    ├── Laptop Desk
    ├── Laptop RAM
    ├── Laptop Stand
    ├── Laptop Battery
    ├── Laptop Charger / Adapter
    ├── Display
    ├── Laptop Keyboard
    └── Caddy

Laptop Finder and Show All Laptop are navigation/action links, not separate
product leaf categories, so they are not used as image folders.

Default output:
    public/images/products/laptop/<subcategory>/<child>/<product>.<ext>

Examples:
    python -m pip install requests beautifulsoup4

    # Preview mapping only
    python download_startech_laptop_hierarchy_images.py --project-root . --dry-run

    # Test 10 products
    python download_startech_laptop_hierarchy_images.py --project-root . --limit 10

    # Download all
    python download_startech_laptop_hierarchy_images.py --project-root .

    # Only one top branch
    python download_startech_laptop_hierarchy_images.py --project-root . --category gaming-laptop

    # Only one exact hierarchy path
    python download_startech_laptop_hierarchy_images.py --project-root . --category all-laptop --child lenovo

    # Re-download existing images
    python download_startech_laptop_hierarchy_images.py --project-root . --overwrite

Manifest:
    startech_laptop_hierarchy_image_manifest.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import re
import sys
import time
from collections import OrderedDict
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


BASE = "https://www.startech.com.bd"
ROOT_URL = f"{BASE}/laptop-notebook"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Referer": BASE + "/",
}

# More-specific branches are intentionally processed before All Laptop.
# This prevents a gaming/premium laptop from being classified only as
# All Laptop > Brand when it belongs to a more specific branch.
HIERARCHY = OrderedDict([
    ("gaming-laptop", {
        "label": "Gaming Laptop",
        "children": OrderedDict([
            ("msi", "MSI"),
            ("asus", "Asus"),
            ("lenovo", "Lenovo"),
            ("gigabyte", "Gigabyte"),
            ("hp", "HP"),
            ("acer", "Acer"),
        ]),
    }),
    ("premium-ultrabook", {
        "label": "Premium Ultrabook",
        "children": OrderedDict([
            ("hp", "HP"),
            ("acer", "Acer"),
            ("lenovo", "Lenovo"),
            ("asus", "Asus"),
            ("dell", "Dell"),
            ("microsoft", "Microsoft"),
            ("msi", "MSI"),
        ]),
    }),
    ("laptop-bag", {
        "label": "Laptop Bag",
        "children": OrderedDict([
            ("asus", "Asus"),
            ("dell", "Dell"),
            ("fantech", "Fantech"),
            ("lenovo", "Lenovo"),
            ("maxgreen", "MaxGreen"),
            ("targus", "Targus"),
            ("bwoo", "BWOO"),
            ("tucano", "Tucano"),
            ("ugreen", "UGREEN"),
            ("wiwu", "WiWU"),
            ("xiaomi", "Xiaomi"),
            ("arctic-hunter", "Arctic Hunter"),
            ("honor", "Honor"),
        ]),
    }),
    ("laptop-accessories", {
        "label": "Laptop Accessories",
        "children": OrderedDict([
            ("laptop-cooler", "Laptop Cooler"),
            ("laptop-desk", "Laptop Desk"),
            ("laptop-ram", "Laptop RAM"),
            ("laptop-stand", "Laptop Stand"),
            ("laptop-battery", "Laptop Battery"),
            ("laptop-charger-adapter", "Laptop Charger / Adapter"),
            ("display", "Display"),
            ("laptop-keyboard", "Laptop Keyboard"),
            ("caddy", "Caddy"),
        ]),
    }),
    ("all-laptop", {
        "label": "All Laptop",
        "children": OrderedDict([
            ("lenovo", "Lenovo"),
            ("msi", "MSI"),
            ("hp", "HP"),
            ("asus", "Asus"),
            ("tecno", "Tecno"),
            ("chuwi", "Chuwi"),
            ("macbook", "MacBook"),
            ("gigabyte", "Gigabyte"),
            ("acer", "Acer"),
            ("dell", "Dell"),
            ("microsoft", "Microsoft"),
            ("smart", "Smart"),
            ("thunderobot", "Thunderobot"),
            ("walton", "Walton"),
        ]),
    }),
])


def norm_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip().casefold()


def slugify(value: str) -> str:
    value = (value or "").strip().lower().replace("&", " and ").replace("/", " ")
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-") or "unknown"


def canonical(url: str) -> str:
    p = urlparse(urljoin(BASE, url))
    return urlunparse((p.scheme or "https", p.netloc, p.path.rstrip("/"), "", "", ""))


def with_page(url: str, page: int) -> str:
    p = urlparse(url)
    q = dict(parse_qsl(p.query, keep_blank_values=True))
    if page <= 1:
        q.pop("page", None)
    else:
        q["page"] = str(page)
    return urlunparse((p.scheme, p.netloc, p.path, p.params, urlencode(q), p.fragment))


class Client:
    def __init__(self, delay: float):
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        retry = Retry(
            total=4, connect=4, read=4, backoff_factor=0.8,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=frozenset({"GET"}),
            respect_retry_after_header=True,
        )
        self.session.mount("https://", HTTPAdapter(max_retries=retry))
        self.cache: dict[str, str] = {}

    def soup(self, url: str) -> BeautifulSoup:
        full = urljoin(BASE, url)
        if full not in self.cache:
            r = self.session.get(full, timeout=40)
            r.raise_for_status()
            self.cache[full] = r.text
            if self.delay:
                time.sleep(self.delay)
        return BeautifulSoup(self.cache[full], "html.parser")

    def image_response(self, url: str) -> requests.Response:
        r = self.session.get(urljoin(BASE, url), timeout=60, stream=True)
        r.raise_for_status()
        ctype = (r.headers.get("content-type") or "").split(";")[0].strip().lower()
        if ctype and not ctype.startswith("image/"):
            r.close()
            raise ValueError(f"Expected image response, received {ctype}")
        return r


def parse_count(soup: BeautifulSoup):
    m = re.search(
        r"Showing\s+\d+\s+to\s+\d+\s+of\s+([\d,]+)\s+\(([\d,]+)\s+Pages?\)",
        soup.get_text(" ", strip=True),
        re.I,
    )
    if not m:
        return None, None
    return int(m.group(1).replace(",", "")), int(m.group(2).replace(",", ""))


def product_links(soup: BeautifulSoup) -> OrderedDict[str, str]:
    out = OrderedDict()
    for sel in [
        ".p-item .p-item-name a",
        ".p-item-name a",
        ".product-layout h4 a",
        ".product-thumb h4 a",
        ".product-name a",
    ]:
        for a in soup.select(sel):
            href = a.get("href")
            name = a.get_text(" ", strip=True)
            if href and name:
                out.setdefault(canonical(href), name)
        if out:
            break
    return out


def crawl(client: Client, url: str, verbose: bool = False):
    products = OrderedDict()
    page = 1
    total = pages = None

    while True:
        soup = client.soup(with_page(url, page))
        if page == 1:
            total, pages = parse_count(soup)

        batch = product_links(soup)
        before = len(products)
        for u, n in batch.items():
            products.setdefault(u, n)

        added = len(products) - before
        if verbose:
            suffix = f"/{total}" if total is not None else ""
            print(f"    page {page}: {len(batch)} cards, {added} new, collected {len(products)}{suffix}")

        if pages is not None:
            if page >= pages:
                break
        else:
            if not batch or added == 0:
                break
            if page >= 100:
                raise RuntimeError(f"Pagination safety limit reached: {url}")
        page += 1

    return products, total


def exact_link_on_page(client: Client, page_url: str, label: str) -> str | None:
    soup = client.soup(page_url)
    wanted = norm_text(label)
    candidates = []

    for a in soup.find_all("a", href=True):
        if norm_text(a.get_text(" ", strip=True)) != wanted:
            continue
        u = canonical(a["href"])
        path = urlparse(u).path.lower()
        score = 0
        if "laptop" in path or "notebook" in path:
            score += 20
        for token in slugify(label).split("-"):
            if len(token) >= 3 and token in path:
                score += 5
        candidates.append((score, -len(path), u))

    if not candidates:
        return None
    candidates.sort(reverse=True)
    return candidates[0][2]


def discover_parent_url(client: Client, parent_slug: str, label: str) -> str | None:
    # First try exact menu text on the root page.
    found = exact_link_on_page(client, ROOT_URL, label)
    if found:
        return found

    # Known safe fallbacks for Star Tech's current laptop URL structure.
    fallbacks = {
        "all-laptop": f"{BASE}/laptop-notebook/laptop",
        "gaming-laptop": f"{BASE}/gaming-laptop",
        "premium-ultrabook": f"{BASE}/laptop-notebook/ultrabook",
        "laptop-bag": f"{BASE}/laptop-bag-backpack",
        "laptop-accessories": f"{BASE}/laptop-accessories",
    }
    return fallbacks.get(parent_slug)


def discover_child_url(client: Client, parent_url: str, child_label: str) -> str | None:
    return exact_link_on_page(client, parent_url, child_label)


def primary_image(soup: BeautifulSoup, product_url: str) -> str | None:
    for sel, attr in [
        ('meta[property="og:image"]', "content"),
        ('meta[name="twitter:image"]', "content"),
    ]:
        tag = soup.select_one(sel)
        if tag and tag.get(attr):
            return urljoin(product_url, str(tag.get(attr)))

    for sel in [
        ".product-img-holder img",
        ".product-image img",
        ".gallery img",
        ".thumbnail img",
        "img[itemprop='image']",
    ]:
        for img in soup.select(sel):
            for attr in ("data-zoom-image", "data-large-image", "data-src", "data-original", "src"):
                src = img.get(attr)
                if src:
                    full = urljoin(product_url, str(src))
                    if not any(x in full.lower() for x in ("logo", "placeholder", "loading", "icon")):
                        return full
    return None


def image_ext(url: str, ctype: str = "") -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif"}:
        return ".jpg" if suffix == ".jpeg" else suffix
    ext = mimetypes.guess_extension((ctype or "").split(";")[0].strip().lower()) or ".jpg"
    return ".jpg" if ext in {".jpe", ".jpeg"} else ext


def file_stem(url: str, name: str) -> str:
    leaf = Path(urlparse(url).path.rstrip("/")).name
    stem = slugify(leaf or name)
    return stem or hashlib.sha256(url.encode()).hexdigest()[:12]


def existing(folder: Path, stem: str) -> Path | None:
    for ext in (".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif"):
        p = folder / f"{stem}{ext}"
        if p.is_file() and p.stat().st_size > 0:
            return p
    return None


def save_manifest(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    ap = argparse.ArgumentParser()
    ap.add_argument("--project-root", default=".")
    ap.add_argument("--output-root", default="public/images/products")
    ap.add_argument("--manifest", default="startech_laptop_hierarchy_image_manifest.json")
    ap.add_argument("--category", default="", choices=[""] + list(HIERARCHY.keys()))
    ap.add_argument("--child", default="")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--delay", type=float, default=0.30)
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    root = Path(args.project_root).resolve()
    output_root = (root / args.output_root).resolve()
    manifest_path = (root / args.manifest).resolve()
    client = Client(args.delay)

    print("Discovering Star Tech Laptop hierarchy...")

    hierarchy_records = []
    product_candidates = OrderedDict()

    # Process specific branches first; All Laptop is fallback.
    for parent_order, (parent_slug, node) in enumerate(HIERARCHY.items(), start=1):
        if args.category and parent_slug != args.category:
            continue

        parent_label = node["label"]
        parent_url = discover_parent_url(client, parent_slug, parent_label)

        print(f"\nLaptop > {parent_label}")
        print(f"  Parent URL: {parent_url or 'NOT FOUND'}")

        if not parent_url:
            continue

        parent_products, parent_total = crawl(client, parent_url, verbose=False)
        parent_product_urls = set(parent_products.keys())

        parent_record = {
            "name": parent_label,
            "slug": parent_slug,
            "url": parent_url,
            "siteReportedProductCount": parent_total,
            "productsFound": len(parent_products),
            "children": [],
        }

        assigned_in_parent = set()

        for child_order, (child_slug, child_label) in enumerate(node["children"].items(), start=1):
            if args.child and child_slug != args.child:
                continue

            child_url = discover_child_url(client, parent_url, child_label)
            child_products = OrderedDict()
            child_total = None

            if child_url:
                try:
                    child_products, child_total = crawl(client, child_url, verbose=False)
                except Exception as exc:
                    print(f"  WARN {child_label}: {exc}", file=sys.stderr)

            # Keep only products that belong to the parent branch too.
            if parent_product_urls:
                child_products = OrderedDict(
                    (u, n) for u, n in child_products.items() if u in parent_product_urls
                )

            print(
                f"  └─ {child_label}: {child_url or 'NOT FOUND'} "
                f"({len(child_products)} products)"
            )

            parent_record["children"].append({
                "name": child_label,
                "slug": child_slug,
                "url": child_url,
                "siteReportedProductCount": child_total,
                "productsFound": len(child_products),
            })

            for product_url, product_name in child_products.items():
                assigned_in_parent.add(product_url)

                candidate = {
                    "name": product_name,
                    "sourceProductUrl": product_url,
                    "parentSlug": parent_slug,
                    "parentName": parent_label,
                    "parentUrl": parent_url,
                    "childSlug": child_slug,
                    "childName": child_label,
                    "childUrl": child_url,
                    "priority": parent_order,
                }

                # First branch wins because HIERARCHY order is specific -> fallback.
                product_candidates.setdefault(product_url, candidate)

        # Products not discoverable through a child are still preserved under _other.
        if not args.child:
            for product_url, product_name in parent_products.items():
                if product_url in assigned_in_parent:
                    continue

                candidate = {
                    "name": product_name,
                    "sourceProductUrl": product_url,
                    "parentSlug": parent_slug,
                    "parentName": parent_label,
                    "parentUrl": parent_url,
                    "childSlug": "_other",
                    "childName": "_Other",
                    "childUrl": None,
                    "priority": parent_order,
                }
                product_candidates.setdefault(product_url, candidate)

        hierarchy_records.append(parent_record)

    selected = list(product_candidates.values())

    if args.limit:
        selected = selected[:args.limit]

    manifest = {
        "sourceRootCategoryUrl": ROOT_URL,
        "hierarchy": hierarchy_records,
        "selectedCategory": args.category or None,
        "selectedChild": args.child or None,
        "uniqueProductsFound": len(product_candidates),
        "requestedForThisRun": len(selected),
        "outputRoot": str(output_root.relative_to(root)).replace("\\", "/"),
        "products": [],
        "summary": {
            "downloaded": 0,
            "skippedExisting": 0,
            "failed": 0,
            "dryRun": bool(args.dry_run),
        },
    }

    downloaded = skipped = failed = 0

    print("\nProcessing Laptop products...")

    for idx, item in enumerate(selected, start=1):
        path_parts = ["laptop", item["parentSlug"], item["childSlug"]]
        folder = output_root.joinpath(*path_parts)
        progress = f"[{idx}/{len(selected)}]"

        rec = dict(item)
        rec["categoryPath"] = path_parts
        rec["sourceImageUrl"] = None
        rec["localImageFile"] = None
        rec["status"] = None

        if args.dry_run:
            rec["status"] = "dry-run"
            print(
                f"{progress} MAP {'/'.join(path_parts)} "
                f"<- {item['name']}"
            )
            manifest["products"].append(rec)
            continue

        try:
            folder.mkdir(parents=True, exist_ok=True)
            stem = file_stem(item["sourceProductUrl"], item["name"])
            old = existing(folder, stem)

            if old and not args.overwrite:
                rec["status"] = "skipped-existing"
                rec["localImageFile"] = str(old.relative_to(root)).replace("\\", "/")
                skipped += 1
                print(f"{progress} SKIP exists: {rec['localImageFile']}")
            else:
                soup = client.soup(item["sourceProductUrl"])
                image_url = primary_image(soup, item["sourceProductUrl"])

                if not image_url:
                    raise RuntimeError("Primary image not found")

                ir = client.image_response(image_url)

                try:
                    ext = image_ext(image_url, ir.headers.get("content-type", ""))
                    target = folder / f"{stem}{ext}"
                    part = target.with_name(target.name + ".part")

                    try:
                        with part.open("wb") as f:
                            for chunk in ir.iter_content(64 * 1024):
                                if chunk:
                                    f.write(chunk)

                        if not part.exists() or part.stat().st_size == 0:
                            raise RuntimeError("Empty image response")

                        part.replace(target)
                    finally:
                        part.unlink(missing_ok=True)
                finally:
                    ir.close()

                rec["status"] = "downloaded"
                rec["sourceImageUrl"] = image_url
                rec["localImageFile"] = str(target.relative_to(root)).replace("\\", "/")
                downloaded += 1

                print(f"{progress} OK   {item['name']}")
                print(f"         -> {rec['localImageFile']}")

        except Exception as exc:
            failed += 1
            rec["status"] = "failed"
            rec["error"] = str(exc)
            print(f"{progress} ERR  {item['name']}: {exc}", file=sys.stderr)

        manifest["products"].append(rec)
        manifest["summary"].update({
            "downloaded": downloaded,
            "skippedExisting": skipped,
            "failed": failed,
        })
        save_manifest(manifest_path, manifest)

    manifest["summary"].update({
        "downloaded": downloaded,
        "skippedExisting": skipped,
        "failed": failed,
    })
    save_manifest(manifest_path, manifest)

    print("\nDONE")
    print(f"Unique products found: {len(product_candidates)}")
    print(f"Processed this run:    {len(selected)}")
    print(f"Downloaded:            {downloaded}")
    print(f"Skipped existing:      {skipped}")
    print(f"Failed:                {failed}")
    print(f"Manifest:              {manifest_path}")
    print(f"Image root:            {output_root}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
