#!/usr/bin/env python3
"""
Download ALL Star Tech Component product primary images into hierarchy folders.

Source:
    https://www.startech.com.bd/component

Default output:
    public/images/products/component/...

Examples:
    python -m pip install requests beautifulsoup4

    # Inspect mapping only, no image download
    python download_startech_component_images.py --project-root . --dry-run

    # Test first 10 products
    python download_startech_component_images.py --project-root . --limit 10

    # Download all Component product images
    python download_startech_component_images.py --project-root .

    # Download only one top-level component group
    python download_startech_component_images.py --project-root . --category processor
    python download_startech_component_images.py --project-root . --category graphics-card

    # Replace existing images
    python download_startech_component_images.py --project-root . --overwrite

Notes:
- Product count is NOT hardcoded. The script reads the live /component pagination.
- It includes all products shown by Star Tech, including In Stock / Out Of Stock /
  Pre Order / Up Coming listings.
- Existing images are skipped by default, so interrupted runs can be resumed.
- Every product is saved once in the deepest matching hierarchy folder.
- A JSON manifest is continuously updated while the script runs.
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
COMPONENT_URL = f"{BASE}/component"

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


# Star Tech Component hierarchy supplied by the user and matching the current
# Component menu. URLs are discovered live rather than hardcoded.
CATEGORY_TREE = OrderedDict(
    [
        ("Processor", ["AMD", "Intel"]),
        (
            "CPU Cooler",
            [
                "MSI", "Antec", "Gamdias", "ARCTIC", "Corsair", "Ocypus",
                "DeepCool", "Asus", "1STPLAYER", "NZXT", "Cooler Master",
                "Cougar", "Gigabyte", "Xigmatek", "Xtreme", "TEAM", "upHere",
                "Yeston", "Value-Top",
            ],
        ),
        (
            "Motherboard",
            [
                "MSI (Intel)", "MSI (AMD)", "ASRock (Intel)", "ASRock (AMD)",
                "ASUS (Intel)", "ASUS (AMD)", "GIGABYTE (Intel)",
                "GIGABYTE (AMD)", "Colorful (Intel)", "Colorful (AMD)",
            ],
        ),
        (
            "Graphics Card",
            [
                "Colorful", "INNO3D", "MSI", "ASUS", "PNY", "GIGABYTE",
                "ZOTAC", "Manli", "NVIDIA", "Sapphire", "PowerColor", "GUNNIR",
                "Yeston", "ARKTEK", "AFOX", "OCPC", "PELADN", "Abit",
                "MAXSUN", "Unika",
            ],
        ),
        (
            "RAM (Desktop)",
            [
                "TEAM", "Colorful", "Corsair", "Kingston", "PNY", "TwinMOS",
                "G.Skill", "AITC", "Lexar", "Netac", "OCPC", "OSCOO",
                "KingBank", "V-Color",
            ],
        ),
        (
            "RAM (Laptop)",
            [
                "TEAM", "Colorful", "Adata", "Transcend", "G.Skill", "Kingston",
                "Lexar", "Corsair", "PNY", "TwinMOS", "OCPC", "Netac",
            ],
        ),
        (
            "Power Supply",
            [
                "MSI", "Antec", "Gamdias", "MaxGreen", "1STPLAYER", "Corsair",
                "Cooler Master", "Gigabyte", "Asus", "DeepCool", "NZXT",
                "Value-Top", "Ocypus", "Xtreme", "Acer", "Xigmatek", "Cougar",
                "OCPC", "T-WOLF", "Solitine", "Golden Field", "Huntkey",
            ],
        ),
        ("Hard Disk Drive", ["Toshiba", "Western Digital", "Seagate", "Hikvision"]),
        (
            "Portable Hard Disk Drive",
            ["Transcend", "Western Digital", "Seagate", "SanDisk", "Netac", "LaCie"],
        ),
        (
            "SSD",
            [
                "TEAM", "Colorful", "MiPhi", "Corsair", "Kingston",
                "Western Digital", "Lexar", "Transcend", "Seagate", "AITC",
                "Netac", "OCPC", "OSCOO", "Addlink", "KingBank", "Biostar",
            ],
        ),
        (
            "Portable SSD",
            [
                "TEAM", "SanDisk", "Samsung", "Transcend", "Seagate", "Lexar",
                "Crucial", "Netac", "Corsair", "Kingston", "Patriot", "OSCOO",
                "UGREEN",
            ],
        ),
        (
            "Casing",
            [
                "MSI", "Antec", "Gamdias", "MaxGreen", "Corsair", "Asus",
                "NZXT", "1STPLAYER", "Gigabyte", "Xtreme", "Xigmatek",
                "DeepCool", "Value-Top", "Cougar", "PC Power", "Monarch",
                "Acer", "Carbono", "T-Wolf", "Arctic",
            ],
        ),
        (
            "Casing Cooler",
            [
                "Antec", "Xtreme", "MaxGreen", "Gamdias", "Corsair",
                "1STPLAYER", "Fantech", "NZXT", "Cooler Master", "Deepcool",
                "Redragon", "ORICO", "Xigmatek", "ARCTIC", "Yeston", "upHere",
            ],
        ),
        (
            "Optical Disk Drive",
            ["Internal Optical Disk Drive", "External Optical Disk Drive"],
        ),
        ("Vertical GPU Holder", []),
        ("Water / Liquid Cooling", []),
    ]
)


def norm_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip().casefold()


def slugify(value: str) -> str:
    s = (value or "").strip().lower()
    s = s.replace("&", " and ").replace("/", " ")
    s = re.sub(r"\(([^)]+)\)", r" \1 ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "unknown"


def canonical_url(url: str) -> str:
    p = urlparse(urljoin(BASE, url))
    return urlunparse((p.scheme or "https", p.netloc, p.path.rstrip("/"), "", "", ""))


def same_site(url: str) -> bool:
    return urlparse(url).netloc.lower() in {"www.startech.com.bd", "startech.com.bd"}


def with_page(url: str, page: int) -> str:
    p = urlparse(url)
    query = dict(parse_qsl(p.query, keep_blank_values=True))
    if page <= 1:
        query.pop("page", None)
    else:
        query["page"] = str(page)
    return urlunparse((p.scheme, p.netloc, p.path, p.params, urlencode(query), p.fragment))


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


def listing_count(soup: BeautifulSoup) -> tuple[int | None, int | None]:
    text = soup.get_text(" ", strip=True)
    m = re.search(
        r"Showing\s+\d+\s+to\s+\d+\s+of\s+([\d,]+)\s+\(([\d,]+)\s+Pages?\)",
        text,
        re.I,
    )
    if not m:
        return None, None
    return int(m.group(1).replace(",", "")), int(m.group(2).replace(",", ""))


def product_links(soup: BeautifulSoup) -> OrderedDict[str, str]:
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
            url = canonical_url(href)
            if same_site(url):
                found.setdefault(url, name)
        if found:
            return found

    for h4 in soup.find_all("h4"):
        a = h4.find("a", href=True)
        if not a:
            continue
        name = a.get_text(" ", strip=True)
        if not name:
            continue
        url = canonical_url(a["href"])
        if same_site(url):
            found.setdefault(url, name)

    return found


def crawl_listing(
    client: Client,
    url: str,
    verbose: bool = False,
) -> tuple[OrderedDict[str, str], int | None]:
    products: OrderedDict[str, str] = OrderedDict()
    page = 1
    total_pages = None
    reported_total = None

    while True:
        page_url = with_page(url, page)
        soup = client.soup(page_url)

        if page == 1:
            reported_total, total_pages = listing_count(soup)

        batch = product_links(soup)
        before = len(products)
        for purl, name in batch.items():
            products.setdefault(purl, name)
        new_count = len(products) - before

        if verbose:
            tail = f"/{reported_total}" if reported_total is not None else ""
            print(
                f"  page {page}: {len(batch)} cards, "
                f"{new_count} new, collected {len(products)}{tail}"
            )

        if total_pages is not None:
            if page >= total_pages:
                break
        else:
            if not batch or new_count == 0:
                break
            if page >= 300:
                raise RuntimeError(f"Pagination safety limit reached: {url}")

        page += 1

    return products, reported_total


def find_exact_link(client: Client, page_url: str, label: str) -> str | None:
    soup = client.soup(page_url)
    wanted = norm_text(label)
    parent_path = urlparse(canonical_url(page_url)).path.rstrip("/").lower()
    tokens = [x for x in slugify(label).split("-") if len(x) >= 3]

    candidates: list[tuple[int, int, str]] = []

    for a in soup.find_all("a", href=True):
        if norm_text(a.get_text(" ", strip=True)) != wanted:
            continue

        full = canonical_url(urljoin(page_url, str(a.get("href"))))
        if not same_site(full) or full == canonical_url(page_url):
            continue

        path = urlparse(full).path.rstrip("/").lower()
        score = 0
        if "/component" in path:
            score += 35
        if parent_path and path.startswith(parent_path + "/"):
            score += 60
        if any(t in path for t in tokens):
            score += 20
        candidates.append((score, -len(path), full))

    if not candidates:
        return None

    candidates.sort(reverse=True)
    return candidates[0][2]


def discover_nodes(client: Client) -> list[dict]:
    nodes = []

    for top_order, (top_name, child_names) in enumerate(CATEGORY_TREE.items(), start=1):
        top_slug = slugify(top_name)
        top_url = find_exact_link(client, COMPONENT_URL, top_name)

        if top_url:
            print(f"  Component > {top_name}: {top_url}")
        else:
            print(
                f"WARN no category URL found: Component > {top_name}",
                file=sys.stderr,
            )

        top = {
            "name": top_name,
            "slug": top_slug,
            "labels": ["Component", top_name],
            "path": ["component", top_slug],
            "url": top_url,
            "depth": 2,
            "order": top_order,
            "products": set(),
        }
        nodes.append(top)

        if not top_url:
            continue

        for child_order, child_name in enumerate(child_names, start=1):
            child_url = find_exact_link(client, top_url, child_name)
            if not child_url:
                # Some mega-menu child links are only visible on the root page.
                child_url = find_exact_link(client, COMPONENT_URL, child_name)

            child_slug = slugify(child_name)
            if child_url:
                print(f"      > {child_name}: {child_url}")
            else:
                print(
                    f"WARN no child URL found: Component > {top_name} > {child_name}",
                    file=sys.stderr,
                )

            nodes.append(
                {
                    "name": child_name,
                    "slug": child_slug,
                    "labels": ["Component", top_name, child_name],
                    "path": ["component", top_slug, child_slug],
                    "url": child_url,
                    "depth": 3,
                    "order": top_order * 100 + child_order,
                    "products": set(),
                }
            )

    return nodes


def build_membership(
    client: Client,
    nodes: list[dict],
    master_urls: set[str],
    only_category: str = "",
) -> None:
    print("\nCrawling Component hierarchy for product mapping...")

    for node in nodes:
        # If a category filter is requested, only crawl nodes belonging to it.
        if only_category and len(node["path"]) >= 2 and node["path"][1] != only_category:
            continue

        if not node.get("url"):
            continue

        print("  " + " > ".join(node["labels"]))
        try:
            products, _ = crawl_listing(client, node["url"], verbose=False)
            node["products"] = set(products.keys()) & master_urls
            print(f"    matched master products: {len(node['products'])}")
        except Exception as exc:
            print(f"    WARN mapping crawl failed: {exc}", file=sys.stderr)


def classify(product_url: str, nodes: list[dict]) -> tuple[list[str], list[dict]]:
    matches = [n for n in nodes if product_url in n.get("products", set())]
    matches.sort(key=lambda n: (-n["depth"], n["order"]))

    if matches:
        return matches[0]["path"], matches
    return ["component", "_uncategorized"], []


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
        values = obj if isinstance(obj, list) else [obj]
        for item in values:
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
            for attr in (
                "data-zoom-image",
                "data-large-image",
                "data-src",
                "data-original",
                "src",
            ):
                src = img.get(attr)
                if not src:
                    continue
                full = urljoin(product_url, str(src))
                low = full.lower()
                if any(x in low for x in ("logo", "placeholder", "loading", "icon")):
                    continue
                return full

    return None


def image_extension(url: str, content_type: str = "") -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif"}:
        return ".jpg" if suffix == ".jpeg" else suffix

    ctype = (content_type or "").split(";")[0].strip().lower()
    ext = mimetypes.guess_extension(ctype) if ctype else None
    if ext == ".jpe":
        ext = ".jpg"
    return ext if ext in {".webp", ".jpg", ".png", ".gif", ".avif"} else ".jpg"


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
        ext = image_extension(image_url, response.headers.get("content-type", ""))
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


def serializable_node(node: dict) -> dict:
    return {
        "labels": node["labels"],
        "path": node["path"],
        "url": node.get("url"),
        "matchedProductCount": len(node.get("products", set())),
    }


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
        description="Download Star Tech Component images into hierarchy folders."
    )
    parser.add_argument("--project-root", default=".", help="Repository root")
    parser.add_argument(
        "--output-root",
        default="public/images/products",
        help="Output root relative to project root",
    )
    parser.add_argument(
        "--manifest",
        default="startech_component_image_manifest.json",
        help="Manifest JSON path relative to project root",
    )
    parser.add_argument(
        "--category",
        default="",
        help=(
            "Optional top category slug, e.g. processor, cpu-cooler, "
            "graphics-card, ssd, casing"
        ),
    )
    parser.add_argument("--limit", type=int, default=0, help="Process first N products")
    parser.add_argument("--delay", type=float, default=0.30, help="Request delay")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.limit < 0 or args.delay < 0:
        parser.error("--limit and --delay must be non-negative")

    valid_top_slugs = {slugify(name) for name in CATEGORY_TREE}
    if args.category and args.category not in valid_top_slugs:
        parser.error(
            "--category must be one of: " + ", ".join(sorted(valid_top_slugs))
        )

    root = Path(args.project_root).resolve()
    output_root = (root / args.output_root).resolve()
    manifest_path = (root / args.manifest).resolve()

    client = Client(args.delay)

    print(f"Reading Component master catalog: {COMPONENT_URL}")
    master, reported_total = crawl_listing(client, COMPONENT_URL, verbose=True)

    if not master:
        print("ERROR: No Component products found.", file=sys.stderr)
        return 2

    print("\nMASTER CATALOG")
    print(f"  Site reported: {reported_total if reported_total is not None else 'unknown'}")
    print(f"  Unique product URLs found: {len(master)}")

    if reported_total is not None and len(master) != reported_total:
        print(
            f"WARN site reported {reported_total}, scraper found {len(master)} unique URLs.",
            file=sys.stderr,
        )

    print("\nDiscovering Component menu URLs...")
    nodes = discover_nodes(client)

    master_urls = set(master.keys())
    build_membership(client, nodes, master_urls, args.category)

    # If user selected a top-level component category, keep only products that
    # matched that branch.
    selected_items = list(master.items())
    if args.category:
        branch_urls = set()
        for node in nodes:
            if len(node["path"]) >= 2 and node["path"][1] == args.category:
                branch_urls |= node.get("products", set())
        selected_items = [(u, n) for u, n in selected_items if u in branch_urls]

    if args.limit:
        selected_items = selected_items[: args.limit]

    manifest = {
        "sourceCategoryUrl": COMPONENT_URL,
        "siteReportedProductCount": reported_total,
        "uniqueMasterProductsFound": len(master),
        "selectedTopCategory": args.category or None,
        "requestedForThisRun": len(selected_items),
        "outputRoot": str(output_root.relative_to(root)).replace("\\", "/"),
        "categories": [serializable_node(n) for n in nodes],
        "products": [],
        "summary": {
            "downloaded": 0,
            "skippedExisting": 0,
            "failed": 0,
            "dryRun": bool(args.dry_run),
        },
    }

    downloaded = skipped = failed = 0

    print("\nProcessing Component products...")

    for idx, (product_url, product_name) in enumerate(selected_items, start=1):
        category_path, matches = classify(product_url, nodes)

        # When filtering a category, ensure an unmatched product never escapes
        # into another top-level hierarchy.
        if args.category and (
            len(category_path) < 2 or category_path[1] != args.category
        ):
            category_path = ["component", args.category, "_uncategorized"]

        folder = output_root.joinpath(*category_path)
        prefix = f"[{idx}/{len(selected_items)}]"

        record = {
            "name": product_name,
            "sourceProductUrl": product_url,
            "categoryPath": category_path,
            "matchedCategories": [
                {
                    "labels": n["labels"],
                    "path": n["path"],
                    "url": n.get("url"),
                }
                for n in matches
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
            target, image_url, was_existing = download_product_image(
                client,
                product_url,
                product_name,
                folder,
                args.overwrite,
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
    print(f"Processed this run:    {len(selected_items)}")
    print(f"Downloaded:            {downloaded}")
    print(f"Skipped existing:      {skipped}")
    print(f"Failed:                {failed}")
    print(f"Manifest:              {manifest_path}")
    print(f"Image root:            {output_root}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
