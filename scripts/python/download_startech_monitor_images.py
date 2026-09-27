#!/usr/bin/env python3
"""
Download ALL Star Tech Monitor primary product images into hierarchy folders.

Source:
    https://www.startech.com.bd/monitor

Default output:
    public/images/products/monitor/...

Hierarchy used:
    monitor/
      gaming-monitor/
      curved-monitor/
      touch-monitor/
      portable-monitor/
      standard-monitor/
        <brand>/

Examples:
    python -m pip install requests beautifulsoup4

    # Mapping only
    python download_startech_monitor_images.py --project-root . --dry-run

    # Test first 10
    python download_startech_monitor_images.py --project-root . --limit 10

    # Download all current /monitor products
    python download_startech_monitor_images.py --project-root .

    # Download only one monitor branch
    python download_startech_monitor_images.py --project-root . --category gaming-monitor
    python download_startech_monitor_images.py --project-root . --category portable-monitor

    # Re-download existing images
    python download_startech_monitor_images.py --project-root . --overwrite

Notes:
- Product count is NOT hardcoded.
- It reads the live /monitor pagination, so it adapts if Star Tech adds/removes products.
- Existing images are skipped by default.
- Product folders are assigned by dedicated Star Tech monitor category pages first.
- Remaining normal monitors are placed under standard-monitor/<brand>/.
- Manifest is continuously written to startech_monitor_image_manifest.json.
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
MONITOR_URL = f"{BASE}/monitor"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/153.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Referer": BASE + "/",
}

SPECIAL_CATEGORIES = OrderedDict(
    [
        ("gaming-monitor", ("Gaming Monitor", f"{BASE}/gaming-monitor")),
        ("curved-monitor", ("Curved Monitor", f"{BASE}/curved-monitor")),
        ("touch-monitor", ("Touch Monitor", f"{BASE}/touch-screen-monitor")),
        ("portable-monitor", ("Portable Monitor", f"{BASE}/portable-monitor")),
    ]
)

MONITOR_BRANDS = [
    "MSI", "AOC", "BenQ", "Asus", "Acer", "XIAOMI", "Dell", "HP",
    "GIGABYTE", "LG", "Samsung", "Walton", "PHILIPS", "Viewsonic",
    "Hikvision", "Huawei", "Lenovo", "Dahua", "TrendSonic", "Value-Top",
    "Corsair", "PC Power", "Gigasonic", "AIWA", "Uniview", "ThundeRobot",
    "Smart", "Titan Army", "Arzopa", "KOORUI", "FeuVision", "Fopo",
    "GEESUU", "Eurovision", "Thermaltake",
]


def norm_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip().casefold()


def slugify(value: str) -> str:
    s = (value or "").strip().lower()
    s = s.replace("&", " and ").replace("/", " ")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "unknown"


def canonical_url(url: str) -> str:
    p = urlparse(urljoin(BASE, url))
    return urlunparse((p.scheme or "https", p.netloc, p.path.rstrip("/"), "", "", ""))


def same_site(url: str) -> bool:
    return urlparse(url).netloc.lower() in {"www.startech.com.bd", "startech.com.bd"}


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
            total=4,
            connect=4,
            read=4,
            backoff_factor=0.8,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=frozenset({"GET"}),
            respect_retry_after_header=True,
        )
        self.session.mount("https://", HTTPAdapter(max_retries=retry))
        self.html_cache: dict[str, str] = {}

    def html(self, url: str, cache: bool = True) -> str:
        full = urljoin(BASE, url)
        if cache and full in self.html_cache:
            return self.html_cache[full]

        r = self.session.get(full, timeout=40)
        r.raise_for_status()
        self.html_cache[full] = r.text

        if self.delay:
            time.sleep(self.delay)

        return r.text

    def soup(self, url: str, cache: bool = True) -> BeautifulSoup:
        return BeautifulSoup(self.html(url, cache), "html.parser")

    def image_response(self, url: str) -> requests.Response:
        r = self.session.get(urljoin(BASE, url), timeout=60, stream=True)
        r.raise_for_status()
        ctype = (r.headers.get("content-type") or "").split(";")[0].strip().lower()
        if ctype and not ctype.startswith("image/"):
            r.close()
            raise ValueError(f"Expected image response, got {ctype}")
        return r


def parse_listing_count(soup: BeautifulSoup) -> tuple[int | None, int | None]:
    text = soup.get_text(" ", strip=True)
    m = re.search(
        r"Showing\s+\d+\s+to\s+\d+\s+of\s+([\d,]+)\s+\(([\d,]+)\s+Pages?\)",
        text,
        re.I,
    )
    if not m:
        return None, None
    return int(m.group(1).replace(",", "")), int(m.group(2).replace(",", ""))


def extract_product_links(soup: BeautifulSoup) -> OrderedDict[str, str]:
    selectors = [
        ".p-item .p-item-name a",
        ".p-item-name a",
        ".product-layout .name a",
        ".product-layout h4 a",
        ".product-thumb h4 a",
        ".product-thumb .caption h4 a",
        ".product-name a",
    ]

    found: OrderedDict[str, str] = OrderedDict()

    for selector in selectors:
        for a in soup.select(selector):
            href = a.get("href")
            name = a.get_text(" ", strip=True)
            if not href or not name:
                continue
            full = canonical_url(href)
            if same_site(full):
                found.setdefault(full, name)
        if found:
            return found

    for h4 in soup.find_all("h4"):
        a = h4.find("a", href=True)
        if not a:
            continue
        name = a.get_text(" ", strip=True)
        if not name:
            continue
        full = canonical_url(a["href"])
        if same_site(full):
            found.setdefault(full, name)

    return found


def crawl_listing(
    client: Client,
    base_url: str,
    *,
    verbose: bool = False,
) -> tuple[OrderedDict[str, str], int | None]:
    products: OrderedDict[str, str] = OrderedDict()
    page = 1
    total_pages = None
    reported_total = None

    while True:
        url = with_page(base_url, page)
        soup = client.soup(url)

        if page == 1:
            reported_total, total_pages = parse_listing_count(soup)

        batch = extract_product_links(soup)
        before = len(products)

        for purl, name in batch.items():
            products.setdefault(purl, name)

        new_count = len(products) - before

        if verbose:
            suffix = f"/{reported_total}" if reported_total is not None else ""
            print(
                f"  page {page}: {len(batch)} cards, "
                f"{new_count} new, collected {len(products)}{suffix}"
            )

        if total_pages is not None:
            if page >= total_pages:
                break
        else:
            if not batch or new_count == 0:
                break
            if page >= 150:
                raise RuntimeError(f"Pagination safety limit reached: {base_url}")

        page += 1

    return products, reported_total


def build_special_membership(
    client: Client,
    master_urls: set[str],
) -> dict[str, set[str]]:
    mapping: dict[str, set[str]] = {}

    print("\nCrawling dedicated Monitor categories...")

    for slug, (label, url) in SPECIAL_CATEGORIES.items():
        print(f"  Monitor > {label}: {url}")
        try:
            products, _ = crawl_listing(client, url, verbose=False)
            mapping[slug] = set(products.keys()) & master_urls
            print(f"    matched master products: {len(mapping[slug])}")
        except Exception as exc:
            mapping[slug] = set()
            print(f"    WARN failed: {exc}", file=sys.stderr)

    return mapping


def detect_brand(name: str) -> str:
    normalized = norm_text(name)

    # Longer/multi-word brands first.
    ordered = sorted(MONITOR_BRANDS, key=lambda b: len(b), reverse=True)

    for brand in ordered:
        bnorm = norm_text(brand)
        if normalized.startswith(bnorm + " ") or normalized == bnorm:
            return slugify(brand)

    # Reasonable fallback: first token.
    first = re.split(r"\s+", name.strip())[0] if name.strip() else "unknown"
    return slugify(first)


def classify_product(
    url: str,
    name: str,
    special: dict[str, set[str]],
) -> list[str]:
    # Most specific/structural bucket priority.
    priority = [
        "portable-monitor",
        "touch-monitor",
        "curved-monitor",
        "gaming-monitor",
    ]

    for slug in priority:
        if url in special.get(slug, set()):
            return ["monitor", slug]

    return ["monitor", "standard-monitor", detect_brand(name)]


def primary_image(soup: BeautifulSoup, product_url: str) -> str | None:
    for selector, attr in (
        ('meta[property="og:image"]', "content"),
        ('meta[name="twitter:image"]', "content"),
        ('meta[itemprop="image"]', "content"),
    ):
        tag = soup.select_one(selector)
        if tag and tag.get(attr):
            return urljoin(product_url, str(tag.get(attr)))

    for tag in soup.select('script[type="application/ld+json"]'):
        raw = tag.string or tag.get_text()
        if not raw.strip():
            continue
        try:
            obj = json.loads(raw)
        except Exception:
            continue

        entries = obj if isinstance(obj, list) else [obj]
        for item in entries:
            if not isinstance(item, dict):
                continue
            image = item.get("image")
            if isinstance(image, str) and image:
                return urljoin(product_url, image)
            if isinstance(image, list) and image and isinstance(image[0], str):
                return urljoin(product_url, image[0])

    selectors = [
        ".product-img-holder img",
        ".product-image img",
        ".main-img img",
        ".gallery img",
        ".thumbnail img",
        "img[itemprop='image']",
    ]

    for selector in selectors:
        for img in soup.select(selector):
            for attr in ("data-zoom-image", "data-large-image", "data-src", "data-original", "src"):
                src = img.get(attr)
                if not src:
                    continue
                full = urljoin(product_url, str(src))
                low = full.lower()
                if any(x in low for x in ("logo", "placeholder", "loading", "icon")):
                    continue
                return full

    return None


def image_ext(url: str, content_type: str = "") -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif"}:
        return ".jpg" if suffix == ".jpeg" else suffix

    ctype = (content_type or "").split(";")[0].strip().lower()
    ext = mimetypes.guess_extension(ctype) if ctype else None

    if ext == ".jpe":
        ext = ".jpg"

    if ext in {".webp", ".jpg", ".png", ".gif", ".avif"}:
        return ext

    return ".jpg"


def file_stem(product_url: str, product_name: str) -> str:
    path_name = Path(urlparse(product_url).path.rstrip("/")).name
    stem = slugify(path_name or product_name)
    if stem:
        return stem
    return hashlib.sha256(product_url.encode("utf-8")).hexdigest()[:12]


def existing_file(folder: Path, stem: str) -> Path | None:
    for ext in (".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif"):
        p = folder / f"{stem}{ext}"
        if p.is_file() and p.stat().st_size > 0:
            return p
    return None


def download_product_image(
    client: Client,
    product_url: str,
    product_name: str,
    folder: Path,
    *,
    overwrite: bool,
) -> tuple[Path, str, bool]:
    folder.mkdir(parents=True, exist_ok=True)
    stem = file_stem(product_url, product_name)

    old = existing_file(folder, stem)
    if old and not overwrite:
        return old, "", True

    soup = client.soup(product_url)
    image_url = primary_image(soup, product_url)

    if not image_url:
        raise RuntimeError("Primary image not found")

    response = client.image_response(image_url)

    try:
        ext = image_ext(image_url, response.headers.get("content-type", ""))
        target = folder / f"{stem}{ext}"
        partial = target.with_name(target.name + ".part")

        try:
            with partial.open("wb") as f:
                for chunk in response.iter_content(64 * 1024):
                    if chunk:
                        f.write(chunk)

            if not partial.is_file() or partial.stat().st_size == 0:
                raise RuntimeError("Empty image response")

            partial.replace(target)
        finally:
            partial.unlink(missing_ok=True)

        if client.delay:
            time.sleep(client.delay)

        return target, image_url, False

    finally:
        response.close()


def write_manifest(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(
        description="Download all Star Tech Monitor product images."
    )
    parser.add_argument("--project-root", default=".", help="Repository root")
    parser.add_argument(
        "--output-root",
        default="public/images/products",
        help="Output image root relative to project root",
    )
    parser.add_argument(
        "--manifest",
        default="startech_monitor_image_manifest.json",
        help="Manifest path relative to project root",
    )
    parser.add_argument(
        "--category",
        default="",
        choices=[
            "",
            "gaming-monitor",
            "curved-monitor",
            "touch-monitor",
            "portable-monitor",
            "standard-monitor",
        ],
        help="Optional monitor branch to process",
    )
    parser.add_argument("--limit", type=int, default=0, help="Process first N selected products")
    parser.add_argument("--delay", type=float, default=0.30, help="Delay between requests")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.limit < 0 or args.delay < 0:
        parser.error("--limit and --delay must be non-negative")

    root = Path(args.project_root).resolve()
    output_root = (root / args.output_root).resolve()
    manifest_path = (root / args.manifest).resolve()

    client = Client(args.delay)

    print(f"Reading Monitor master catalog: {MONITOR_URL}")
    master, reported_total = crawl_listing(client, MONITOR_URL, verbose=True)

    if not master:
        print("ERROR: No Monitor products found.", file=sys.stderr)
        return 2

    print("\nMASTER CATALOG")
    print(f"  Site reported: {reported_total if reported_total is not None else 'unknown'}")
    print(f"  Unique product URLs found: {len(master)}")

    if reported_total is not None and reported_total != len(master):
        print(
            f"WARN site reported {reported_total}, scraper found {len(master)} unique URLs.",
            file=sys.stderr,
        )

    master_urls = set(master.keys())
    special = build_special_membership(client, master_urls)

    selected = []
    for url, name in master.items():
        path = classify_product(url, name, special)
        branch = path[1] if len(path) > 1 else ""

        if args.category and branch != args.category:
            continue

        selected.append((url, name, path))

    if args.limit:
        selected = selected[: args.limit]

    manifest = {
        "sourceCategoryUrl": MONITOR_URL,
        "siteReportedProductCount": reported_total,
        "uniqueMasterProductsFound": len(master),
        "selectedCategory": args.category or None,
        "requestedForThisRun": len(selected),
        "outputRoot": str(output_root.relative_to(root)).replace("\\", "/"),
        "specialCategories": {
            slug: {
                "name": SPECIAL_CATEGORIES[slug][0],
                "url": SPECIAL_CATEGORIES[slug][1],
                "matchedProductCount": len(special.get(slug, set())),
            }
            for slug in SPECIAL_CATEGORIES
        },
        "products": [],
        "summary": {
            "downloaded": 0,
            "skippedExisting": 0,
            "failed": 0,
            "dryRun": bool(args.dry_run),
        },
    }

    downloaded = skipped = failed = 0

    print("\nProcessing Monitor products...")

    for idx, (product_url, product_name, category_path) in enumerate(selected, start=1):
        prefix = f"[{idx}/{len(selected)}]"
        folder = output_root.joinpath(*category_path)

        record = {
            "name": product_name,
            "sourceProductUrl": product_url,
            "categoryPath": category_path,
            "sourceImageUrl": None,
            "localImageFile": None,
            "status": None,
        }

        if args.dry_run:
            record["status"] = "dry-run"
            print(f"{prefix} MAP {'/'.join(category_path)} <- {product_name}")
            manifest["products"].append(record)
            continue

        try:
            target, image_url, was_existing = download_product_image(
                client,
                product_url,
                product_name,
                folder,
                overwrite=args.overwrite,
            )

            record["sourceImageUrl"] = image_url or None
            record["localImageFile"] = str(target.relative_to(root)).replace("\\", "/")

            if was_existing:
                record["status"] = "skipped-existing"
                skipped += 1
                print(f"{prefix} SKIP exists: {record['localImageFile']}")
            else:
                record["status"] = "downloaded"
                downloaded += 1
                print(f"{prefix} OK   {product_name}")
                print(f"         -> {record['localImageFile']}")

        except Exception as exc:
            failed += 1
            record["status"] = "failed"
            record["error"] = str(exc)
            print(f"{prefix} ERR  {product_name}: {exc}", file=sys.stderr)

        manifest["products"].append(record)
        manifest["summary"].update(
            {
                "downloaded": downloaded,
                "skippedExisting": skipped,
                "failed": failed,
            }
        )
        write_manifest(manifest_path, manifest)

    manifest["summary"].update(
        {
            "downloaded": downloaded,
            "skippedExisting": skipped,
            "failed": failed,
        }
    )
    write_manifest(manifest_path, manifest)

    print("\nDONE")
    print(f"Master products found: {len(master)}")
    if reported_total is not None:
        print(f"Site reported count:   {reported_total}")
    print(f"Processed this run:    {len(selected)}")
    print(f"Downloaded:            {downloaded}")
    print(f"Skipped existing:      {skipped}")
    print(f"Failed:                {failed}")
    print(f"Manifest:              {manifest_path}")
    print(f"Image root:            {output_root}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
