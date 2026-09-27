#!/usr/bin/env python3
"""
Download Star Tech Office Equipment product images into a 3-level folder hierarchy.

Root:
    public/images/products/office-equipment/

Structure:
    office-equipment/<submenu>/<child>/<product>.png

Examples:
    office-equipment/projector/optoma/<product>.png
    office-equipment/projector/acer/<product>.png
    office-equipment/projector/projection-screen/<product>.png
    office-equipment/printer/_direct/<product>.png

Key behavior:
- First-level Office Equipment submenu URLs are hardcoded from the supplied Star Tech menu.
- Child menu URLs are discovered live from Star Tech's Office Equipment navigation.
- Projector child URLs are also included as a verified fallback list.
- Product counts are NOT hardcoded; pagination is crawled live.
- Every first-level branch is crawled directly, so products are not lost even if child discovery fails.
- Primary product images are always converted and saved as PNG.
- Existing PNG files are skipped unless --overwrite is used.
- A JSON manifest is continuously written for audit/retry.

Install:
    python -m pip install requests beautifulsoup4 pillow

Examples:
    # Inspect discovered hierarchy only
    python download_startech_office_equipment_images.py --project-root . --dry-run --show-tree

    # Download everything
    python download_startech_office_equipment_images.py --project-root .

    # Download only Projector
    python download_startech_office_equipment_images.py --project-root . --category projector

    # Download only Projector > Optoma
    python download_startech_office_equipment_images.py --project-root . --category projector --child optoma

    # Test first 20 products after filtering
    python download_startech_office_equipment_images.py --project-root . --category projector --limit 20

    # Re-download existing files
    python download_startech_office_equipment_images.py --project-root . --overwrite
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import time
from collections import OrderedDict
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageOps
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


BASE = "https://www.startech.com.bd"
OFFICE_URL = f"{BASE}/office-equipment"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Referer": BASE + "/",
}

# First-level Office Equipment submenu URLs supplied by the user.
CATEGORY_URLS = OrderedDict([
    ("projector", ("Projector", f"{BASE}/projector")),
    ("conference-system", ("Conference System", f"{BASE}/office-equipment/conference-systems")),
    ("pa-system", ("PA System", f"{BASE}/pa-system")),
    ("interactive-flat-panel", ("Interactive Flat Panel", f"{BASE}/interactive-flat-panel")),
    ("video-wall", ("Video Wall", f"{BASE}/video-wall")),
    ("signage", ("Signage", f"{BASE}/office-equipment/signage")),
    ("kiosk", ("Kiosk", f"{BASE}/kiosk")),
    ("printer", ("Printer", f"{BASE}/printer")),
    ("laser-printer", ("Laser Printer", f"{BASE}/laser-printer")),
    ("large-format-printer", ("Large Format Printer", f"{BASE}/large-format-printer")),
    ("id-card-printer", ("ID Card Printer", f"{BASE}/id-card-printer")),
    ("pos-printer", ("POS Printer", f"{BASE}/pos-printer")),
    ("label-printer", ("Label Printer", f"{BASE}/label-printer")),
    ("digital-weight-machine", ("Digital Weight Machine", f"{BASE}/digital-weight-machine")),
    ("photocopier", ("Photocopier", f"{BASE}/photocopier")),
    ("toner", ("Toner", f"{BASE}/office-equipment/toner")),
    ("cartridge", ("Cartridge", f"{BASE}/cartridge")),
    ("ink-bottle", ("Ink Bottle", f"{BASE}/ink-bottle")),
    ("ribbon", ("Ribbon", f"{BASE}/ribbon")),
    ("printer-paper", ("Printer Paper", f"{BASE}/printer-paper")),
    ("printer-drum", ("Printer Drum", f"{BASE}/printer-drum")),
    ("scanner", ("Scanner", f"{BASE}/office-equipment/Scanner")),
    ("barcode-scanner", ("Barcode Scanner", f"{BASE}/office-equipment/Barcode-Scanner")),
    ("cash-drawer", ("Cash Drawer", f"{BASE}/cash-drawer")),
    ("telephone-set", ("Telephone Set", f"{BASE}/office-equipment/telephone-set")),
    ("ip-phone", ("IP Phone", f"{BASE}/office-equipment/ip-phone")),
    ("pabx-system", ("PABX System", f"{BASE}/ip-pabx-system")),
    ("money-counting-machine", ("Money Counting Machine", f"{BASE}/office-equipment/money-counting-machine")),
    ("paper-shredder", ("Paper Shredder", f"{BASE}/office-equipment/paper-shredder")),
    ("laminating-machine", ("Laminating Machine", f"{BASE}/office-equipment/laminating-machine")),
    ("binding-machine", ("Binding Machine", f"{BASE}/binding-machine")),
])

# Verified Projector child links supplied by the user. These are used as a fallback
# even if Star Tech changes its navigation markup.
KNOWN_CHILDREN = {
    "projector": OrderedDict([
        ("optoma", ("Optoma", f"{BASE}/optoma-projector")),
        ("acer", ("Acer", f"{BASE}/acer-projector")),
        ("benq", ("BenQ", f"{BASE}/benq-projector")),
        ("epson", ("Epson", f"{BASE}/epson-projector")),
        ("viewsonic", ("ViewSonic", f"{BASE}/viewsonic-projector")),
        ("vivitek", ("VIVItek", f"{BASE}/vivitek-projector")),
        ("boxlight", ("Boxlight", f"{BASE}/boxlight-projector")),
        ("xiaomi", ("Xiaomi", f"{BASE}/xiaomi-projector")),
        ("aun", ("AUN", f"{BASE}/aun-projector")),
        ("philips", ("Philips", f"{BASE}/philips-projector")),
        ("havit", ("Havit", f"{BASE}/havit-projector")),
        ("xinji", ("XINJI", f"{BASE}/xinji-projector")),
        ("blisbond", ("Blisbond", f"{BASE}/blisbond-projector")),
        ("cheerlux", ("Cheerlux", f"{BASE}/cheerlux-projector")),
        ("infocus", ("InFocus", f"{BASE}/infocus-projector")),
        ("magcubic", ("Magcubic", f"{BASE}/magcubic-projector")),
        ("projection-screen", ("Projection Screen", f"{BASE}/projection-screen")),
        ("projector-mount", ("Projector Mount", f"{BASE}/projector-mount")),
    ])
}

BAD_NAV_TEXT = {
    "show all office equipment",
    "office equipment",
    "view all",
    "show all",
}

PRODUCT_CARD_SELECTORS = [
    ".p-item-name a",
    ".product-layout h4 a",
    ".product-thumb h4 a",
    ".product-name a",
]


def norm_text(v: str) -> str:
    return re.sub(r"\s+", " ", v or "").strip().casefold()


def slugify(v: str) -> str:
    v = (v or "").strip().lower().replace("&", " and ").replace("/", " ")
    return re.sub(r"[^a-z0-9]+", "-", v).strip("-") or "unknown"


def canonical(url: str) -> str:
    p = urlparse(urljoin(BASE, url))
    path = p.path.rstrip("/") or "/"
    return urlunparse((p.scheme or "https", p.netloc.lower(), path, "", "", ""))


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
            total=5,
            connect=5,
            read=5,
            backoff_factor=0.8,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=frozenset({"GET"}),
            respect_retry_after_header=True,
        )
        self.session.mount("https://", HTTPAdapter(max_retries=retry))
        self.cache: dict[str, str] = {}

    def soup(self, url: str) -> BeautifulSoup:
        full = urljoin(BASE, url)
        if full not in self.cache:
            r = self.session.get(full, timeout=45)
            r.raise_for_status()
            self.cache[full] = r.text
            if self.delay:
                time.sleep(self.delay)
        return BeautifulSoup(self.cache[full], "html.parser")

    def image_bytes(self, url: str) -> tuple[bytes, str]:
        r = self.session.get(urljoin(BASE, url), timeout=90)
        r.raise_for_status()
        ctype = (r.headers.get("content-type") or "").split(";")[0].strip().lower()
        if ctype and not ctype.startswith("image/"):
            raise ValueError(f"Expected image response, received {ctype}")
        return r.content, ctype


def parse_count(soup: BeautifulSoup):
    text = soup.get_text(" ", strip=True)
    m = re.search(
        r"Showing\s+\d+\s+to\s+\d+\s+of\s+([\d,]+)\s*\(([\d,]+)\s+Pages?\)",
        text,
        re.I,
    )
    if not m:
        return None, None
    return int(m.group(1).replace(",", "")), int(m.group(2).replace(",", ""))


def product_links(soup: BeautifulSoup) -> OrderedDict[str, str]:
    out: OrderedDict[str, str] = OrderedDict()
    for sel in PRODUCT_CARD_SELECTORS:
        for a in soup.select(sel):
            href = a.get("href")
            name = a.get_text(" ", strip=True)
            if href and name:
                out.setdefault(canonical(href), name)
        if out:
            break
    return out


def crawl(client: Client, url: str, verbose: bool = False):
    products: OrderedDict[str, str] = OrderedDict()
    page = 1
    total = pages = None

    while True:
        page_url = with_page(url, page)
        soup = client.soup(page_url)
        if page == 1:
            total, pages = parse_count(soup)

        batch = product_links(soup)
        before = len(products)
        for u, n in batch.items():
            products.setdefault(u, n)

        if verbose:
            suffix = f"/{total}" if total is not None else ""
            print(f"    page {page}: {len(batch)} cards, {len(products)-before} new, collected {len(products)}{suffix}")

        if pages is not None:
            if page >= pages:
                break
        else:
            if not batch or len(products) == before:
                break
            if page >= 200:
                raise RuntimeError(f"Pagination safety limit reached: {url}")
        page += 1

    return products, total


def is_same_site(url: str) -> bool:
    try:
        p = urlparse(url)
        return p.netloc.lower() in {"startech.com.bd", "www.startech.com.bd"}
    except Exception:
        return False


def find_matching_anchor(soup: BeautifulSoup, target_url: str, label: str):
    target = canonical(target_url)
    exact_label = norm_text(label)

    # Prefer exact URL match.
    for a in soup.find_all("a", href=True):
        try:
            if canonical(a["href"]) == target:
                return a
        except Exception:
            pass

    # Fallback to exact visible label.
    for a in soup.find_all("a", href=True):
        if norm_text(a.get_text(" ", strip=True)) == exact_label:
            return a
    return None


def nearest_menu_container(anchor):
    """Return the smallest useful ancestor likely to own the submenu."""
    node = anchor
    for _ in range(8):
        if node is None:
            break
        parent = getattr(node, "parent", None)
        if parent is None:
            break
        node = parent
        # Common navigation containers on ecommerce mega menus.
        classes = " ".join(node.get("class", [])) if hasattr(node, "get") else ""
        name = getattr(node, "name", "")
        if name == "li":
            links = node.find_all("a", href=True)
            if len(links) > 1:
                return node
        if any(tok in classes.lower() for tok in ("submenu", "sub-menu", "drop-menu", "dropdown-menu")):
            links = node.find_all("a", href=True)
            if len(links) > 1:
                return node
    return getattr(anchor, "parent", None)


def discover_children_from_nav(client: Client, category_slug: str, label: str, url: str):
    """
    Discover second-level child links from Star Tech navigation.

    Strategy:
    1) Read both homepage and Office Equipment page because the menu HTML may differ.
    2) Find the first-level category anchor by exact URL/label.
    3) Inspect the nearest owning submenu container.
    4) Keep same-site category-looking links; reject the parent and obvious utility links.
    """
    found: OrderedDict[str, tuple[str, str]] = OrderedDict()
    parent_c = canonical(url)

    for source in (BASE + "/", OFFICE_URL):
        try:
            soup = client.soup(source)
        except Exception:
            continue

        anchor = find_matching_anchor(soup, url, label)
        if anchor is None:
            continue
        container = nearest_menu_container(anchor)
        if container is None:
            continue

        for a in container.find_all("a", href=True):
            text = re.sub(r"\s+", " ", a.get_text(" ", strip=True)).strip()
            if not text:
                continue
            ntext = norm_text(text)
            if ntext in BAD_NAV_TEXT or ntext == norm_text(label):
                continue

            child_url = canonical(a["href"])
            if child_url == parent_c or not is_same_site(child_url):
                continue

            # Reject links that clearly look like account/cart/blog/support utilities.
            path = urlparse(child_url).path.lower()
            if any(x in path for x in (
                "/account", "/login", "/register", "/cart", "/checkout", "/compare",
                "/wishlist", "/blog", "/contact", "/information/", "/search",
            )):
                continue

            cslug = slugify(text)
            if cslug in CATEGORY_URLS and cslug != category_slug:
                # This is likely a sibling first-level Office Equipment item.
                continue
            found.setdefault(cslug, (text, child_url))

        if found:
            break

    # Merge supplied verified children without replacing live discoveries.
    for cslug, pair in KNOWN_CHILDREN.get(category_slug, {}).items():
        found.setdefault(cslug, pair)

    return found


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
                if not src:
                    continue
                full = urljoin(product_url, str(src))
                if not any(x in full.lower() for x in ("logo", "placeholder", "loading", "icon")):
                    return full
    return None


def file_stem(url: str, name: str) -> str:
    leaf = Path(urlparse(url).path.rstrip("/")).name
    stem = slugify(leaf or name)
    return stem or hashlib.sha256(url.encode()).hexdigest()[:12]


def save_as_png(image_bytes: bytes, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    part = target.with_name(target.name + ".part")
    part.unlink(missing_ok=True)

    with Image.open(io.BytesIO(image_bytes)) as im:
        # Respect EXIF orientation before saving.
        im = ImageOps.exif_transpose(im)

        # Preserve transparency if the source has alpha, otherwise save RGB.
        has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
        if has_alpha:
            out = im.convert("RGBA")
        else:
            out = im.convert("RGB")

        out.save(part, format="PNG", optimize=True)

    if not part.exists() or part.stat().st_size == 0:
        part.unlink(missing_ok=True)
        raise RuntimeError("PNG conversion produced an empty file")
    part.replace(target)


def write_manifest(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def build_tree(client: Client, only_category: str = "", verbose: bool = False):
    tree = []

    for order, (slug, (label, url)) in enumerate(CATEGORY_URLS.items(), start=1):
        if only_category and slug != only_category:
            continue

        print(f"\n[{order}] {label}")
        print(f"  URL: {url}")
        branch_products, reported_total = crawl(client, url, verbose=verbose)
        print(f"  Products found: {len(branch_products)}" + (f" (site reports {reported_total})" if reported_total is not None else ""))

        children = discover_children_from_nav(client, slug, label, url)
        child_nodes = []

        for corder, (cslug, (clabel, curl)) in enumerate(children.items(), start=1):
            try:
                child_products, child_total = crawl(client, curl, verbose=False)
            except Exception as exc:
                print(f"  WARN child {clabel}: {exc}", file=sys.stderr)
                child_products, child_total = OrderedDict(), None

            matched = set(child_products.keys()) & set(branch_products.keys())
            # Keep a discovered child if it maps to at least one product, or if it is a known verified child.
            if matched or cslug in KNOWN_CHILDREN.get(slug, {}):
                child_nodes.append({
                    "slug": cslug,
                    "name": clabel,
                    "url": curl,
                    "order": corder,
                    "products": matched,
                    "siteReportedProductCount": child_total,
                })
                print(f"    -> {clabel}: {len(matched)} matched | {curl}")

        tree.append({
            "slug": slug,
            "name": label,
            "url": url,
            "order": order,
            "products": branch_products,
            "siteReportedProductCount": reported_total,
            "children": child_nodes,
        })

    return tree


def print_tree(tree) -> None:
    print("\nDISCOVERED OFFICE EQUIPMENT TREE")
    print("Office Equipment")
    for node in tree:
        print(f"|- {node['name']} [{len(node['products'])} products]")
        if node["children"]:
            for child in node["children"]:
                print(f"|  |- {child['name']} [{len(child['products'])} matched]")
        else:
            print("|  `- _direct (no child menu discovered)")


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    ap = argparse.ArgumentParser(description="Download Star Tech Office Equipment product images as PNG in menu hierarchy folders.")
    ap.add_argument("--project-root", default=".")
    ap.add_argument("--output-root", default="public/images/products")
    ap.add_argument("--manifest", default="startech_office_equipment_image_manifest.json")
    ap.add_argument("--category", default="", choices=[""] + list(CATEGORY_URLS.keys()))
    ap.add_argument("--child", default="", help="Optional child slug, e.g. optoma. Usually use together with --category.")
    ap.add_argument("--limit", type=int, default=0, help="Limit total selected products for testing; 0 means all.")
    ap.add_argument("--delay", type=float, default=0.30)
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--dry-run", action="store_true", help="Map products/folders but do not download images.")
    ap.add_argument("--show-tree", action="store_true", help="Print discovered submenu/child hierarchy.")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    if args.child and not args.category:
        ap.error("--child requires --category so the child is unambiguous")

    root = Path(args.project_root).resolve()
    output_root = (root / args.output_root).resolve()
    manifest_path = (root / args.manifest).resolve()
    client = Client(args.delay)

    print(f"Office Equipment source: {OFFICE_URL}")
    print("Building category tree and reading live pagination...")
    tree = build_tree(client, only_category=args.category, verbose=args.verbose)

    if args.show_tree:
        print_tree(tree)

    # Build selected product records. Every branch product is kept, even if it does
    # not match a discovered child. Unmatched items go under _direct.
    selected = []
    for node in tree:
        branch_children = sorted(node["children"], key=lambda x: x["order"])

        for product_url, product_name in node["products"].items():
            matches = [c for c in branch_children if product_url in c["products"]]
            child_slug = matches[0]["slug"] if matches else "_direct"
            child_name = matches[0]["name"] if matches else "_direct"

            if args.child and child_slug != args.child:
                continue

            selected.append({
                "productUrl": product_url,
                "productName": product_name,
                "categorySlug": node["slug"],
                "categoryName": node["name"],
                "categoryUrl": node["url"],
                "childSlug": child_slug,
                "childName": child_name,
                "childMatches": [
                    {"slug": c["slug"], "name": c["name"], "url": c["url"]}
                    for c in matches
                ],
            })

    if args.limit:
        selected = selected[: args.limit]

    manifest = {
        "sourceCategoryUrl": OFFICE_URL,
        "selectedCategory": args.category or None,
        "selectedChild": args.child or None,
        "requestedForThisRun": len(selected),
        "outputRoot": str(output_root.relative_to(root)).replace("\\", "/"),
        "imageFormat": "png",
        "categories": [],
        "products": [],
        "summary": {"downloaded": 0, "skippedExisting": 0, "failed": 0, "dryRun": bool(args.dry_run)},
    }

    for node in tree:
        manifest["categories"].append({
            "name": node["name"],
            "slug": node["slug"],
            "url": node["url"],
            "siteReportedProductCount": node["siteReportedProductCount"],
            "productsFound": len(node["products"]),
            "children": [
                {
                    "name": c["name"],
                    "slug": c["slug"],
                    "url": c["url"],
                    "matchedProductCount": len(c["products"]),
                    "siteReportedProductCount": c["siteReportedProductCount"],
                }
                for c in node["children"]
            ],
        })

    downloaded = skipped = failed = 0
    print(f"\nProcessing {len(selected)} selected products...")

    for idx, rec0 in enumerate(selected, start=1):
        path = ["office-equipment", rec0["categorySlug"], rec0["childSlug"]]
        folder = output_root.joinpath(*path)
        stem = file_stem(rec0["productUrl"], rec0["productName"])
        target = folder / f"{stem}.png"
        progress = f"[{idx}/{len(selected)}]"

        rec = {
            "name": rec0["productName"],
            "sourceProductUrl": rec0["productUrl"],
            "categoryPath": path,
            "category": {
                "name": rec0["categoryName"],
                "slug": rec0["categorySlug"],
                "url": rec0["categoryUrl"],
            },
            "primaryChild": {"name": rec0["childName"], "slug": rec0["childSlug"]},
            "matchedChildren": rec0["childMatches"],
            "sourceImageUrl": None,
            "localImageFile": str(target.relative_to(root)).replace("\\", "/"),
            "status": None,
        }

        if args.dry_run:
            rec["status"] = "dry-run"
            print(f"{progress} MAP {'/'.join(path)} <- {rec0['productName']}")
            manifest["products"].append(rec)
            continue

        try:
            folder.mkdir(parents=True, exist_ok=True)

            if target.is_file() and target.stat().st_size > 0 and not args.overwrite:
                rec["status"] = "skipped-existing"
                skipped += 1
                print(f"{progress} SKIP exists: {rec['localImageFile']}")
            else:
                soup = client.soup(rec0["productUrl"])
                image_url = primary_image(soup, rec0["productUrl"])
                if not image_url:
                    raise RuntimeError("Primary image not found")

                raw, _ctype = client.image_bytes(image_url)
                save_as_png(raw, target)

                rec["status"] = "downloaded"
                rec["sourceImageUrl"] = image_url
                downloaded += 1
                print(f"{progress} OK   {rec0['productName']}")
                print(f"         -> {rec['localImageFile']}")

        except Exception as exc:
            failed += 1
            rec["status"] = "failed"
            rec["error"] = str(exc)
            print(f"{progress} ERR  {rec0['productName']}: {exc}", file=sys.stderr)

        manifest["products"].append(rec)
        manifest["summary"].update({
            "downloaded": downloaded,
            "skippedExisting": skipped,
            "failed": failed,
        })
        write_manifest(manifest_path, manifest)

    manifest["summary"].update({
        "downloaded": downloaded,
        "skippedExisting": skipped,
        "failed": failed,
    })
    write_manifest(manifest_path, manifest)

    print("\nDONE")
    print(f"Processed this run: {len(selected)}")
    print(f"Downloaded:          {downloaded}")
    print(f"Skipped existing:    {skipped}")
    print(f"Failed:              {failed}")
    print(f"Manifest:            {manifest_path}")
    print(f"Image root:          {output_root / 'office-equipment'}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
