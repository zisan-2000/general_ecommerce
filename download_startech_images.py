#!/usr/bin/env python3
"""
Download ALL product primary images from Star Tech Desktop category and save
them in a Desktop -> Subcategory -> Child-category folder hierarchy.

Default output (Next.js):
    public/images/products/desktop/...

Examples:
    pip install requests beautifulsoup4

    # First test only 10 products
    python download_startech_desktop_images.py --project-root . --limit 10

    # Download every product currently listed under /desktops
    python download_startech_desktop_images.py --project-root .

    # If your real image root is images/products (not public/images/products)
    python download_startech_desktop_images.py --project-root . --output-root images/products

    # Re-download existing files
    python download_startech_desktop_images.py --project-root . --overwrite

Notes:
- The script does NOT hardcode "180". It reads the current /desktops listing and
  crawls all pagination pages, so it keeps working if Star Tech adds/removes products.
- All products from /desktops are included, including out-of-stock products.
- Each product image is stored once in the deepest matching menu category.
- All category matches are retained in the generated manifest.
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
DESKTOP_URL = f"{BASE}/desktops"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/153.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Referer": BASE + "/",
}

# Menu hierarchy supplied/verified from the Star Tech Desktop menu.
# URL values are discovered live from Star Tech rather than hardcoded.
CATEGORY_TREE = OrderedDict(
    [
        ("AI PC", OrderedDict()),
        ("Desktop Offer", OrderedDict()),
        (
            "Star PC",
            OrderedDict(
                [
                    ("Intel PC", OrderedDict()),
                    ("Ryzen PC", OrderedDict()),
                ]
            ),
        ),
        (
            "Gaming PC",
            OrderedDict(
                [
                    ("Intel PC", OrderedDict()),
                    ("RYZEN PC", OrderedDict()),
                ]
            ),
        ),
        (
            "Brand PC",
            OrderedDict(
                [
                    ("Acer", OrderedDict()),
                    ("ASUS", OrderedDict()),
                    ("Dell", OrderedDict()),
                    ("HP", OrderedDict()),
                    ("Lenovo", OrderedDict()),
                    ("MSI", OrderedDict()),
                    ("Gigabyte", OrderedDict()),
                ]
            ),
        ),
        (
            "All-in-One PC",
            OrderedDict(
                [
                    ("Dell", OrderedDict()),
                    ("HP", OrderedDict()),
                    ("ASUS", OrderedDict()),
                    ("LENOVO", OrderedDict()),
                    ("Walton", OrderedDict()),
                    ("Teclast", OrderedDict()),
                    ("AOC", OrderedDict()),
                    ("Value-Top", OrderedDict()),
                    ("Smart", OrderedDict()),
                ]
            ),
        ),
        (
            "Portable Mini PC",
            OrderedDict(
                [
                    ("Asus", OrderedDict()),
                ]
            ),
        ),
        ("Apple Mac Mini", OrderedDict()),
        ("Apple iMac", OrderedDict()),
        ("Apple Mac Studio", OrderedDict()),
        ("Apple Mac Pro", OrderedDict()),
    ]
)


def norm_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip().casefold()


def slugify(value: str) -> str:
    s = (value or "").strip().lower()
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "unknown"


def canonical_url(url: str) -> str:
    p = urlparse(urljoin(BASE, url))
    # Product/category identity should not depend on tracking query parameters.
    return urlunparse((p.scheme or "https", p.netloc, p.path.rstrip("/"), "", "", ""))


def same_site(url: str) -> bool:
    host = urlparse(url).netloc.lower()
    return host in {"www.startech.com.bd", "startech.com.bd"}


def with_page(url: str, page: int) -> str:
    p = urlparse(url)
    query = dict(parse_qsl(p.query, keep_blank_values=True))
    if page <= 1:
        query.pop("page", None)
    else:
        query["page"] = str(page)
    return urlunparse((p.scheme, p.netloc, p.path, p.params, urlencode(query), p.fragment))


class StarTechClient:
    def __init__(self, delay: float = 0.35):
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

    def get_html(self, url: str, use_cache: bool = True) -> str:
        url = urljoin(BASE, url)
        if use_cache and url in self.html_cache:
            return self.html_cache[url]

        r = self.session.get(url, timeout=35)
        r.raise_for_status()
        html = r.text
        self.html_cache[url] = html
        if self.delay:
            time.sleep(self.delay)
        return html

    def get_soup(self, url: str, use_cache: bool = True) -> BeautifulSoup:
        return BeautifulSoup(self.get_html(url, use_cache=use_cache), "html.parser")

    def get_image_response(self, url: str) -> requests.Response:
        r = self.session.get(urljoin(BASE, url), timeout=60, stream=True)
        r.raise_for_status()
        ctype = (r.headers.get("content-type") or "").split(";")[0].strip().lower()
        if ctype and not ctype.startswith("image/"):
            r.close()
            raise ValueError(f"Expected image content, got {ctype}")
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
    """
    Return {canonical_product_url: product_name}.

    Star Tech has used several product-card class names over time, so multiple
    selectors are supported.
    """
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
            full = canonical_url(urljoin(BASE, href))
            if not same_site(full):
                continue
            if full == canonical_url(DESKTOP_URL):
                continue
            found.setdefault(full, name)

        if found:
            # A reliable product-card selector worked; don't fall back to broad selectors.
            return found

    # Conservative fallback for layout changes:
    # h4 headings in Star Tech listing pages are normally product titles.
    for h4 in soup.find_all("h4"):
        a = h4.find("a", href=True)
        if not a:
            continue
        name = a.get_text(" ", strip=True)
        href = a.get("href")
        if not name or not href:
            continue
        full = canonical_url(urljoin(BASE, href))
        if same_site(full):
            found.setdefault(full, name)

    return found


def crawl_listing(
    client: StarTechClient,
    base_url: str,
    *,
    verbose: bool = False,
) -> tuple[OrderedDict[str, str], int | None]:
    """
    Crawl a category across every pagination page.

    Stops using the site's own "(N Pages)" value when available. If that text is
    absent, keeps going until a page produces no new products.
    """
    products: OrderedDict[str, str] = OrderedDict()
    page = 1
    known_total_pages: int | None = None
    reported_total: int | None = None

    while True:
        url = with_page(base_url, page)
        soup = client.get_soup(url)

        if page == 1:
            reported_total, known_total_pages = parse_listing_count(soup)

        batch = extract_product_links(soup)
        before = len(products)
        for purl, name in batch.items():
            products.setdefault(purl, name)
        new_count = len(products) - before

        if verbose:
            total_txt = f"/{reported_total}" if reported_total is not None else ""
            print(
                f"    page {page}: {len(batch)} cards, "
                f"{new_count} new, collected {len(products)}{total_txt}"
            )

        if known_total_pages is not None:
            if page >= known_total_pages:
                break
        else:
            if not batch or new_count == 0:
                break
            if page >= 100:
                raise RuntimeError(f"Pagination safety limit reached for {base_url}")

        page += 1

    return products, reported_total


def find_named_category_link(
    client: StarTechClient,
    page_url: str,
    label: str,
    parent_label: str | None = None,
) -> str | None:
    """
    Find the live Star Tech category URL for a visible menu/category label.

    Exact anchor text is preferred. Candidate URLs are scored to avoid unrelated
    footer/search/filter links with the same text.
    """
    soup = client.get_soup(page_url)
    wanted = norm_text(label)
    parent_path = urlparse(canonical_url(page_url)).path.rstrip("/")
    label_slug = slugify(label)
    label_tokens = [t for t in label_slug.split("-") if len(t) >= 3]

    candidates: list[tuple[int, int, str]] = []

    for a in soup.find_all("a", href=True):
        text = norm_text(a.get_text(" ", strip=True))
        if text != wanted:
            continue

        full = canonical_url(urljoin(page_url, str(a.get("href"))))
        if not same_site(full):
            continue
        if full == canonical_url(page_url):
            continue

        path = urlparse(full).path.rstrip("/").lower()
        score = 0

        if "/desktops" in path:
            score += 35
        if parent_path and path.startswith(parent_path.lower() + "/"):
            score += 50
        if any(token in path for token in label_tokens):
            score += 20
        if "product" not in path:
            score += 5

        # Category URLs tend to be shorter than product URLs.
        candidates.append((score, -len(path), full))

    if not candidates:
        return None

    candidates.sort(reverse=True)
    return candidates[0][2]


def flatten_tree(
    client: StarTechClient,
) -> list[dict]:
    """
    Discover URLs for each Desktop menu category/child category.
    """
    nodes: list[dict] = []

    for top_index, (top_name, children) in enumerate(CATEGORY_TREE.items(), start=1):
        top_url = find_named_category_link(client, DESKTOP_URL, top_name)
        if not top_url:
            print(f"WARN: category URL not discovered: Desktop > {top_name}", file=sys.stderr)
        else:
            print(f"  Desktop > {top_name}: {top_url}")

        top_node = {
            "name": top_name,
            "slug": slugify(top_name),
            "path": ["desktop", slugify(top_name)],
            "labels": ["Desktop", top_name],
            "url": top_url,
            "depth": 2,
            "order": top_index,
        }
        nodes.append(top_node)

        if not children or not top_url:
            continue

        for child_index, child_name in enumerate(children.keys(), start=1):
            child_url = find_named_category_link(
                client, top_url, child_name, parent_label=top_name
            )
            if not child_url:
                # Some Star Tech child links are only present in the global mega menu.
                child_url = find_named_category_link(
                    client, DESKTOP_URL, child_name, parent_label=top_name
                )

            if not child_url:
                print(
                    f"WARN: child category URL not discovered: "
                    f"Desktop > {top_name} > {child_name}",
                    file=sys.stderr,
                )
            else:
                print(f"    > {child_name}: {child_url}")

            nodes.append(
                {
                    "name": child_name,
                    "slug": slugify(child_name),
                    "path": ["desktop", slugify(top_name), slugify(child_name)],
                    "labels": ["Desktop", top_name, child_name],
                    "url": child_url,
                    "depth": 3,
                    "order": top_index * 100 + child_index,
                }
            )

    return nodes


def build_category_membership(
    client: StarTechClient,
    nodes: list[dict],
    master_urls: set[str],
) -> None:
    print("\nCrawling Desktop subcategories to classify the products...")

    for node in nodes:
        node["products"] = set()
        if not node.get("url"):
            continue

        print("  " + " > ".join(node["labels"]))
        try:
            products, _ = crawl_listing(client, node["url"], verbose=False)
            node["products"] = set(products.keys()) & master_urls
            print(f"    matched master products: {len(node['products'])}")
        except Exception as exc:
            print(f"    WARN: category crawl failed: {exc}", file=sys.stderr)


def category_priority(node: dict) -> tuple[int, int, int]:
    """
    Deepest category wins. "Desktop Offer" is intentionally a lower-priority
    marketing bucket when another structural category also matches.
    """
    is_offer = 1 if node["slug"] == "desktop-offer" else 0
    return (-node["depth"], is_offer, node["order"])


def classify_product(product_url: str, nodes: list[dict]) -> tuple[list[str], list[dict]]:
    matches = [node for node in nodes if product_url in node.get("products", set())]
    matches.sort(key=category_priority)

    if matches:
        return matches[0]["path"], matches

    return ["desktop", "_uncategorized"], []


def parse_primary_image(soup: BeautifulSoup, product_url: str) -> str | None:
    # Best source: OpenGraph usually points to the main product image.
    for selector, attr in (
        ('meta[property="og:image"]', "content"),
        ('meta[name="twitter:image"]', "content"),
        ('meta[itemprop="image"]', "content"),
    ):
        tag = soup.select_one(selector)
        if tag and tag.get(attr):
            return urljoin(product_url, str(tag.get(attr)))

    # JSON-LD fallback.
    for tag in soup.select('script[type="application/ld+json"]'):
        raw = tag.string or tag.get_text()
        if not raw.strip():
            continue
        try:
            obj = json.loads(raw)
        except Exception:
            continue

        objects = obj if isinstance(obj, list) else [obj]
        for item in objects:
            if not isinstance(item, dict):
                continue
            image = item.get("image")
            if isinstance(image, str) and image:
                return urljoin(product_url, image)
            if isinstance(image, list) and image:
                first = image[0]
                if isinstance(first, str):
                    return urljoin(product_url, first)

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


def ext_from_image_url(url: str) -> str | None:
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif"}:
        return ".jpg" if suffix == ".jpeg" else suffix
    return None


def ext_from_content_type(content_type: str) -> str:
    ctype = (content_type or "").split(";")[0].strip().lower()
    ext = mimetypes.guess_extension(ctype) if ctype else None
    if ext == ".jpe":
        ext = ".jpg"
    if ext in {".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif"}:
        return ".jpg" if ext == ".jpeg" else ext
    return ".jpg"


def product_file_stem(product_url: str, name: str) -> str:
    path_slug = Path(urlparse(product_url).path.rstrip("/")).name
    stem = slugify(path_slug or name)
    if not stem:
        stem = slugify(name)
    if not stem:
        stem = hashlib.sha256(product_url.encode("utf-8")).hexdigest()[:12]
    return stem


def existing_image(folder: Path, stem: str) -> Path | None:
    for ext in (".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif"):
        p = folder / f"{stem}{ext}"
        if p.is_file() and p.stat().st_size > 0:
            return p
    return None


def download_primary_image(
    client: StarTechClient,
    product_url: str,
    product_name: str,
    folder: Path,
    *,
    overwrite: bool,
) -> tuple[Path, str]:
    folder.mkdir(parents=True, exist_ok=True)
    stem = product_file_stem(product_url, product_name)

    if not overwrite:
        found = existing_image(folder, stem)
        if found:
            return found, ""

    soup = client.get_soup(product_url)
    image_url = parse_primary_image(soup, product_url)
    if not image_url:
        raise RuntimeError("Primary image not found on product page")

    guessed_ext = ext_from_image_url(image_url)

    response = client.get_image_response(image_url)
    try:
        ext = guessed_ext or ext_from_content_type(response.headers.get("content-type", ""))
        target = folder / f"{stem}{ext}"
        partial = target.with_name(target.name + ".part")

        if target.exists() and target.stat().st_size > 0 and not overwrite:
            return target, image_url

        try:
            with partial.open("wb") as f:
                for chunk in response.iter_content(64 * 1024):
                    if chunk:
                        f.write(chunk)
            if not partial.exists() or partial.stat().st_size == 0:
                raise RuntimeError("Downloaded image is empty")
            partial.replace(target)
        finally:
            partial.unlink(missing_ok=True)

        if client.delay:
            time.sleep(client.delay)
        return target, image_url
    finally:
        response.close()


def json_safe_node(node: dict) -> dict:
    return {
        "labels": node["labels"],
        "path": node["path"],
        "url": node.get("url"),
        "matchedProductCount": len(node.get("products", set())),
    }


def save_manifest(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    ap = argparse.ArgumentParser(
        description="Download all Star Tech /desktops primary images into hierarchy folders."
    )
    ap.add_argument("--project-root", default=".", help="Repository root")
    ap.add_argument(
        "--output-root",
        default="public/images/products",
        help="Image root relative to project root (default: public/images/products)",
    )
    ap.add_argument(
        "--manifest",
        default="startech_desktop_image_manifest.json",
        help="Manifest path relative to project root",
    )
    ap.add_argument("--limit", type=int, default=0, help="Process first N master products; 0 = all")
    ap.add_argument("--delay", type=float, default=0.35, help="Delay between HTTP requests")
    ap.add_argument("--overwrite", action="store_true", help="Overwrite existing images")
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Crawl and classify only; do not download product images",
    )
    args = ap.parse_args()

    if args.limit < 0 or args.delay < 0:
        ap.error("--limit and --delay must be non-negative")

    project_root = Path(args.project_root).resolve()
    output_root = (project_root / args.output_root).resolve()
    manifest_path = (project_root / args.manifest).resolve()

    client = StarTechClient(delay=args.delay)

    print(f"Reading master Desktop catalog: {DESKTOP_URL}")
    master, reported_total = crawl_listing(client, DESKTOP_URL, verbose=True)
    if not master:
        print("ERROR: No Desktop products were discovered.", file=sys.stderr)
        return 2

    print("\nMASTER CATALOG")
    print(f"  Site reported: {reported_total if reported_total is not None else 'unknown'}")
    print(f"  Unique product URLs found: {len(master)}")

    if reported_total is not None and len(master) != reported_total:
        print(
            f"WARN: site reported {reported_total}, but scraper collected {len(master)} unique URLs.",
            file=sys.stderr,
        )

    print("\nDiscovering live Desktop menu/category URLs...")
    nodes = flatten_tree(client)

    master_urls = set(master.keys())
    build_category_membership(client, nodes, master_urls)

    chosen = list(master.items())
    if args.limit:
        chosen = chosen[: args.limit]

    manifest = {
        "sourceCategoryUrl": DESKTOP_URL,
        "siteReportedProductCount": reported_total,
        "uniqueMasterProductsFound": len(master),
        "requestedForThisRun": len(chosen),
        "outputRoot": str(output_root.relative_to(project_root)),
        "categories": [json_safe_node(node) for node in nodes],
        "products": [],
        "summary": {
            "downloaded": 0,
            "skippedExisting": 0,
            "failed": 0,
            "dryRun": bool(args.dry_run),
        },
    }

    print("\nProcessing Desktop products...")
    downloaded = skipped = failed = 0

    for idx, (product_url, product_name) in enumerate(chosen, start=1):
        category_path, matches = classify_product(product_url, nodes)
        folder = output_root.joinpath(*category_path)
        prefix = f"[{idx}/{len(chosen)}]"

        record = {
            "name": product_name,
            "sourceProductUrl": product_url,
            "categoryPath": category_path,
            "matchedCategories": [
                {
                    "labels": node["labels"],
                    "path": node["path"],
                    "url": node.get("url"),
                }
                for node in matches
            ],
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
            before = existing_image(folder, product_file_stem(product_url, product_name))
            target, image_url = download_primary_image(
                client,
                product_url,
                product_name,
                folder,
                overwrite=args.overwrite,
            )

            record["sourceImageUrl"] = image_url or None
            record["localImageFile"] = str(target.relative_to(project_root)).replace("\\", "/")

            if before is not None and not args.overwrite:
                record["status"] = "skipped-existing"
                skipped += 1
                print(f"{prefix} SKIP exists -> {record['localImageFile']}")
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
        # Save after every item, so an interrupted run still has a useful manifest.
        save_manifest(manifest_path, manifest)

    manifest["summary"].update(
        {
            "downloaded": downloaded,
            "skippedExisting": skipped,
            "failed": failed,
        }
    )
    save_manifest(manifest_path, manifest)

    print("\nDONE")
    print(f"Master products found: {len(master)}")
    if reported_total is not None:
        print(f"Site reported count:   {reported_total}")
    print(f"Processed this run:    {len(chosen)}")
    print(f"Downloaded:            {downloaded}")
    print(f"Skipped existing:      {skipped}")
    print(f"Failed:                {failed}")
    print(f"Manifest:              {manifest_path}")
    print(f"Image root:            {output_root}")

    # Non-zero only for actual download failures.
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
