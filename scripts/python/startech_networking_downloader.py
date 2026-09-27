#!/usr/bin/env python3
"""
Star Tech Networking Image Downloader
======================================

Downloads ONE primary/high-quality image per product as PNG.

Folder structure:
    public/images/products/networking/<category>/<child>/<product>.png

Examples:
    networking/access-point/tp-link/<product>.png
    networking/access-point/cisco/<product>.png
    networking/wifi-adapter/tenda/<product>.png
    networking/router/_direct/<product>.png

Behavior:
- All first-level Networking menu items are included.
- Known child/brand URLs for Access Point and WiFi Adapter are included.
- Other child/brand links are discovered live from Star Tech navigation.
- Parent category is crawled too, so unmatched products are not lost.
- Only ONE primary product image is saved per product.
- Image is converted to PNG without resizing.
- Existing PNG files are skipped unless --overwrite is used.
- Pagination is crawled until products stop appearing.
- JSON manifest is continuously written for audit/retry.

Install:
    python -m pip install requests beautifulsoup4 pillow

Examples:
    python startech_networking_downloader.py --project-root .
    python startech_networking_downloader.py --project-root . --category access-point
    python startech_networking_downloader.py --project-root . --category wifi-adapter
    python startech_networking_downloader.py --project-root . --category access-point --child tp-link
    python startech_networking_downloader.py --project-root . --limit 20
    python startech_networking_downloader.py --project-root . --dry-run --show-tree
    python startech_networking_downloader.py --project-root . --overwrite
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
NETWORKING_URL = f"{BASE}/networking"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/154.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Referer": BASE + "/",
}


# First-level Networking menu supplied by the user.
CATEGORY_URLS = OrderedDict([
    ("starlink", ("Starlink", f"{BASE}/starlink")),
    ("router", ("Router", f"{BASE}/networking/router")),
    ("pocket-router", ("Pocket Router", f"{BASE}/pocket-router")),
    ("wifi-range-extender", ("WiFi Range Extender", f"{BASE}/wifi-extender")),
    ("access-point", ("Access Point", f"{BASE}/access-point")),
    ("wifi-adapter", ("WiFi Adapter", f"{BASE}/wifi-adapter")),
    ("network-switch", ("Network Switch", f"{BASE}/networking/network-switch")),
    ("firewall", ("Firewall", f"{BASE}/firewall")),
    ("onu", ("ONU", f"{BASE}/onu")),
    ("olt", ("OLT", f"{BASE}/olt")),
    ("media-converter", ("Media Converter", f"{BASE}/media-converter")),
    ("network-transceivers", ("Network Transceivers", f"{BASE}/network-transceivers")),
    ("networking-cable", ("Networking Cable", f"{BASE}/networking-cable")),
    ("patch-cord", ("Patch Cord", f"{BASE}/patch-cord")),
    ("connector", ("Connector", f"{BASE}/cable-connector")),
    ("modular-jack", ("Modular Jack", f"{BASE}/modular-jack")),
    ("faceplate", ("Faceplate", f"{BASE}/faceplate")),
    ("patch-panel", ("Patch Panel", f"{BASE}/patch-panel")),
    ("lan-card", ("LAN Card", f"{BASE}/lan-card")),
    ("poe-injector", ("PoE Injector", f"{BASE}/poe-injector")),
    ("crimping-tool", ("Crimping Tool", f"{BASE}/crimping-tool")),
    ("splicer-machine", ("Splicer Machine", f"{BASE}/splicer-machine")),
    ("cable-tester", ("Cable Tester", f"{BASE}/cable-tester")),
])


# Known child/brand links explicitly supplied by the user.
# Live menu discovery is merged with these.
KNOWN_CHILDREN = {
    "access-point": OrderedDict([
        ("zyxel", ("Zyxel", f"{BASE}/zyxel-network-extender")),
        ("tp-link", ("TP-Link", f"{BASE}/tp-link-access-point")),
        ("tenda", ("Tenda", f"{BASE}/tenda-access-point")),
        ("totolink", ("TOTOLINK", f"{BASE}/totolink-access-point")),
        ("netgear", ("NETGEAR", f"{BASE}/netgear-access-point")),
        ("mikrotik", ("MikroTik", f"{BASE}/mikrotik-access-point")),
        ("grandstream", ("Grandstream", f"{BASE}/grandstream-wifi-range-extender")),
        ("ubiquiti", ("Ubiquiti", f"{BASE}/ubiquiti-access-point")),
        ("cambium", ("Cambium", f"{BASE}/cambium-access-point")),
        ("cudy", ("Cudy", f"{BASE}/cudy-range-extender")),
        ("edgecore", ("Edgecore", f"{BASE}/edgecore-access-point")),
        ("ruijie", ("Ruijie", f"{BASE}/ruijie-access-point")),
        ("trendnet", ("TRENDnet", f"{BASE}/trendnet-access-point")),
        ("ip-com", ("IP-COM", f"{BASE}/ip-com-access-point")),
        ("huawei", ("Huawei", f"{BASE}/huawei-access-point")),
        ("bdcom", ("BDCOM", f"{BASE}/bdcom-access-point")),
        ("cisco", ("Cisco", f"{BASE}/cisco-access-point")),
    ]),
    "wifi-adapter": OrderedDict([
        ("tp-link", ("TP-Link", f"{BASE}/tp-link-wifi-adapter")),
        ("tenda", ("Tenda", f"{BASE}/tenda-wifi-adapter")),
        ("cudy", ("Cudy", f"{BASE}/cudy-wifi-adapter")),
        ("vention", ("Vention", f"{BASE}/vention-wifi-adapter")),
        ("mercusys", ("Mercusys", f"{BASE}/mercusys-wifi-adapter")),
        ("trendnet", ("TRENDnet", f"{BASE}/trendnet-wifi-adapter")),
        ("yuanxin", ("Yuanxin", f"{BASE}/yuanxin-wifi-adapter")),
        ("d-link", ("D-Link", f"{BASE}/d-link-wifi-adapter")),
        ("ugreen", ("UGREEN", f"{BASE}/ugreen-wifi-adapter")),
        ("dtech", ("Dtech", f"{BASE}/dtech-wifi-adapter")),
        ("xtreme", ("Xtreme", f"{BASE}/xtreme-wifi-adapter")),
    ]),
}


BAD_NAV_TEXT = {
    "networking",
    "show all networking",
    "view all",
    "show all",
    "shop now",
    "buy now",
}

PRODUCT_CARD_SELECTORS = [
    ".p-item-name a",
    ".p-item h4 a",
    ".product-layout h4 a",
    ".product-thumb h4 a",
    ".product-name a",
]


def norm_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip().casefold()


def slugify(value: str) -> str:
    value = (value or "").strip().lower()
    value = value.replace("&", " and ").replace("/", " ")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "unknown"


def canonical(url: str) -> str:
    p = urlparse(urljoin(BASE, url))
    path = p.path.rstrip("/") or "/"
    return urlunparse((
        p.scheme or "https",
        p.netloc.lower(),
        path,
        "",
        "",
        "",
    ))


def with_page(url: str, page: int) -> str:
    p = urlparse(url)
    q = dict(parse_qsl(p.query, keep_blank_values=True))
    if page <= 1:
        q.pop("page", None)
    else:
        q["page"] = str(page)
    return urlunparse((
        p.scheme,
        p.netloc,
        p.path,
        p.params,
        urlencode(q),
        p.fragment,
    ))


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

        self.session.mount(
            "https://",
            HTTPAdapter(max_retries=retry),
        )

        self.cache: dict[str, str] = {}

    def soup(self, url: str) -> BeautifulSoup:
        full = urljoin(BASE, url)

        if full not in self.cache:
            response = self.session.get(
                full,
                timeout=45,
            )
            response.raise_for_status()

            self.cache[full] = response.text

            if self.delay:
                time.sleep(self.delay)

        return BeautifulSoup(
            self.cache[full],
            "html.parser",
        )

    def image_bytes(self, url: str) -> tuple[bytes, str]:
        response = self.session.get(
            urljoin(BASE, url),
            timeout=90,
        )
        response.raise_for_status()

        ctype = (
            response.headers.get("content-type") or ""
        ).split(";")[0].strip().lower()

        if ctype and not ctype.startswith("image/"):
            raise ValueError(
                f"Expected image response, received {ctype}"
            )

        if self.delay:
            time.sleep(self.delay)

        return response.content, ctype


def parse_count(soup: BeautifulSoup):
    text = soup.get_text(" ", strip=True)

    m = re.search(
        r"Showing\s+\d+\s+to\s+\d+\s+of\s+([\d,]+)\s*"
        r"\(\s*([\d,]+)\s+Pages?\s*\)",
        text,
        re.I,
    )

    if not m:
        return None, None

    total = int(m.group(1).replace(",", ""))
    pages = int(m.group(2).replace(",", ""))

    return total, pages


def product_links(soup: BeautifulSoup) -> OrderedDict[str, str]:
    output: OrderedDict[str, str] = OrderedDict()

    for selector in PRODUCT_CARD_SELECTORS:
        for a in soup.select(selector):
            href = a.get("href")
            name = a.get_text(" ", strip=True)

            if href and name:
                output.setdefault(
                    canonical(href),
                    name,
                )

        if output:
            break

    return output


def crawl(
    client: Client,
    url: str,
    verbose: bool = False,
):
    products: OrderedDict[str, str] = OrderedDict()

    page = 1
    total = None
    pages = None

    while True:
        page_url = with_page(url, page)
        doc = client.soup(page_url)

        if page == 1:
            total, pages = parse_count(doc)

        batch = product_links(doc)
        before = len(products)

        for product_url, product_name in batch.items():
            products.setdefault(
                product_url,
                product_name,
            )

        if verbose:
            suffix = (
                f"/{total}"
                if total is not None
                else ""
            )

            print(
                f"    page {page}: "
                f"{len(batch)} cards, "
                f"{len(products) - before} new, "
                f"collected {len(products)}{suffix}"
            )

        if pages is not None:
            if page >= pages:
                break
        else:
            # Safe fallback if site count text changes.
            if not batch:
                break

            if len(products) == before:
                break

        if page >= 250:
            raise RuntimeError(
                f"Pagination safety limit reached: {url}"
            )

        page += 1

    return products, total


def is_same_site(url: str) -> bool:
    try:
        p = urlparse(url)

        return p.netloc.lower() in {
            "startech.com.bd",
            "www.startech.com.bd",
        }

    except Exception:
        return False


def find_matching_anchor(
    soup: BeautifulSoup,
    target_url: str,
    label: str,
):
    target = canonical(target_url)
    expected_label = norm_text(label)

    # Prefer exact URL.
    for a in soup.find_all("a", href=True):
        try:
            if canonical(a["href"]) == target:
                return a
        except Exception:
            pass

    # Fallback exact visible text.
    for a in soup.find_all("a", href=True):
        if norm_text(
            a.get_text(" ", strip=True)
        ) == expected_label:
            return a

    return None


def nearest_menu_container(anchor):
    """
    Find the closest menu node that appears to own child links.
    """
    node = anchor

    for _ in range(9):
        if node is None:
            break

        parent = getattr(node, "parent", None)

        if parent is None:
            break

        node = parent

        classes = (
            " ".join(node.get("class", []))
            if hasattr(node, "get")
            else ""
        )

        name = getattr(node, "name", "")

        if name == "li":
            links = node.find_all(
                "a",
                href=True,
            )

            if len(links) > 1:
                return node

        if any(
            token in classes.lower()
            for token in (
                "submenu",
                "sub-menu",
                "drop-menu",
                "dropdown-menu",
                "mega-menu",
            )
        ):
            links = node.find_all(
                "a",
                href=True,
            )

            if len(links) > 1:
                return node

    return getattr(
        anchor,
        "parent",
        None,
    )


def discover_children_from_nav(
    client: Client,
    category_slug: str,
    label: str,
    url: str,
):
    """
    Discover child / brand links from live Star Tech menu.

    Then merge KNOWN_CHILDREN so supplied brand URLs are never lost.
    """
    found: OrderedDict[
        str,
        tuple[str, str],
    ] = OrderedDict()

    parent_c = canonical(url)

    for source in (
        BASE + "/",
        NETWORKING_URL,
    ):
        try:
            doc = client.soup(source)
        except Exception:
            continue

        anchor = find_matching_anchor(
            doc,
            url,
            label,
        )

        if anchor is None:
            continue

        container = nearest_menu_container(
            anchor
        )

        if container is None:
            continue

        for a in container.find_all(
            "a",
            href=True,
        ):
            text = re.sub(
                r"\s+",
                " ",
                a.get_text(
                    " ",
                    strip=True,
                ),
            ).strip()

            if not text:
                continue

            ntext = norm_text(text)

            if (
                ntext in BAD_NAV_TEXT
                or ntext == norm_text(label)
            ):
                continue

            child_url = canonical(
                a["href"]
            )

            if (
                child_url == parent_c
                or not is_same_site(child_url)
            ):
                continue

            path = urlparse(
                child_url
            ).path.lower()

            if any(
                x in path
                for x in (
                    "/account",
                    "/login",
                    "/register",
                    "/cart",
                    "/checkout",
                    "/compare",
                    "/wishlist",
                    "/blog",
                    "/contact",
                    "/information/",
                    "/search",
                )
            ):
                continue

            child_slug = slugify(text)

            # Reject sibling first-level Networking categories.
            if (
                child_slug in CATEGORY_URLS
                and child_slug != category_slug
            ):
                continue

            found.setdefault(
                child_slug,
                (
                    text,
                    child_url,
                ),
            )

        if found:
            break

    # Merge verified/supplied child links.
    for child_slug, pair in KNOWN_CHILDREN.get(
        category_slug,
        {},
    ).items():
        found.setdefault(
            child_slug,
            pair,
        )

    return found


def primary_image(
    soup: BeautifulSoup,
    product_url: str,
) -> str | None:
    """
    Return ONE main/high-quality image only.

    Preference:
    1. data-zoom-image / data-large-image
    2. main product image src/data-src
    3. og:image / twitter:image fallback
    """

    # Main image element first because its zoom attribute often points
    # to a larger source than OpenGraph.
    for selector in [
        ".product-img-holder img",
        ".product-image img",
        ".image img",
        ".gallery img",
        ".thumbnail img",
        "img[itemprop='image']",
    ]:
        img = soup.select_one(selector)

        if not img:
            continue

        for attr in (
            "data-zoom-image",
            "data-large-image",
            "data-original",
            "data-src",
            "src",
        ):
            src = img.get(attr)

            if not src:
                continue

            full = urljoin(
                product_url,
                str(src),
            )

            low = full.lower()

            if any(
                x in low
                for x in (
                    "logo",
                    "placeholder",
                    "loading",
                    "icon",
                )
            ):
                continue

            return full

    # Fallback metadata image.
    for selector, attr in [
        ('meta[property="og:image"]', "content"),
        ('meta[name="twitter:image"]', "content"),
    ]:
        tag = soup.select_one(selector)

        if tag and tag.get(attr):
            return urljoin(
                product_url,
                str(tag.get(attr)),
            )

    return None


def file_stem(
    url: str,
    name: str,
) -> str:
    leaf = Path(
        urlparse(url).path.rstrip("/")
    ).name

    stem = slugify(
        leaf or name
    )

    return (
        stem
        or hashlib.sha256(
            url.encode()
        ).hexdigest()[:12]
    )


def save_as_png(
    image_bytes: bytes,
    target: Path,
) -> tuple[int, int]:
    target.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    part = target.with_name(
        target.name + ".part"
    )

    part.unlink(
        missing_ok=True
    )

    with Image.open(
        io.BytesIO(image_bytes)
    ) as image:

        # Correct EXIF rotation without resizing.
        image = ImageOps.exif_transpose(
            image
        )

        width, height = image.size

        # Keep transparency when available.
        has_alpha = (
            image.mode in ("RGBA", "LA")
            or (
                image.mode == "P"
                and "transparency" in image.info
            )
        )

        if has_alpha:
            output = image.convert("RGBA")
        else:
            output = image.convert("RGB")

        # PNG is lossless.
        # No resize, no artificial upscaling.
        output.save(
            part,
            format="PNG",
            optimize=True,
        )

    if (
        not part.exists()
        or part.stat().st_size == 0
    ):
        part.unlink(
            missing_ok=True
        )

        raise RuntimeError(
            "PNG conversion produced an empty file"
        )

    part.replace(
        target
    )

    return width, height


def write_manifest(
    path: Path,
    payload: dict,
) -> None:
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    path.write_text(
        json.dumps(
            payload,
            indent=2,
            ensure_ascii=False,
        ) + "\n",
        encoding="utf-8",
    )


def build_tree(
    client: Client,
    only_category: str = "",
    verbose: bool = False,
):
    tree = []

    for order, (
        slug,
        (
            label,
            url,
        ),
    ) in enumerate(
        CATEGORY_URLS.items(),
        start=1,
    ):

        if (
            only_category
            and slug != only_category
        ):
            continue

        print(
            f"\n[{order}] {label}"
        )
        print(
            f"  URL: {url}"
        )

        branch_products, reported_total = crawl(
            client,
            url,
            verbose=verbose,
        )

        msg = (
            f"  Products found: "
            f"{len(branch_products)}"
        )

        if reported_total is not None:
            msg += (
                f" "
                f"(site reports {reported_total})"
            )

        print(msg)

        children = discover_children_from_nav(
            client,
            slug,
            label,
            url,
        )

        child_nodes = []

        for child_order, (
            child_slug,
            (
                child_label,
                child_url,
            ),
        ) in enumerate(
            children.items(),
            start=1,
        ):

            try:
                child_products, child_total = crawl(
                    client,
                    child_url,
                    verbose=False,
                )

            except Exception as exc:
                print(
                    f"  WARN child "
                    f"{child_label}: {exc}",
                    file=sys.stderr,
                )

                child_products = OrderedDict()
                child_total = None

            matched = (
                set(child_products.keys())
                & set(branch_products.keys())
            )

            # Keep known child even if the parent listing changes/filtering differs.
            if (
                matched
                or child_slug in KNOWN_CHILDREN.get(slug, {})
            ):
                child_nodes.append({
                    "slug": child_slug,
                    "name": child_label,
                    "url": child_url,
                    "order": child_order,
                    "products": matched,
                    "siteReportedProductCount": child_total,
                })

                print(
                    f"    -> {child_label}: "
                    f"{len(matched)} matched | "
                    f"{child_url}"
                )

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
    print(
        "\nDISCOVERED NETWORKING TREE"
    )

    print(
        "Networking"
    )

    for node in tree:
        print(
            f"|- {node['name']} "
            f"[{len(node['products'])} products]"
        )

        if node["children"]:
            for child in node["children"]:
                print(
                    f"|  |- {child['name']} "
                    f"[{len(child['products'])} matched]"
                )
        else:
            print(
                "|  `- _direct "
                "(no child menu discovered)"
            )


def main() -> int:
    for stream in (
        sys.stdout,
        sys.stderr,
    ):
        if hasattr(
            stream,
            "reconfigure",
        ):
            stream.reconfigure(
                encoding="utf-8"
            )

    parser = argparse.ArgumentParser(
        description=(
            "Download ONE primary Star Tech Networking "
            "product image as PNG in category/child folders."
        )
    )

    parser.add_argument(
        "--project-root",
        default=".",
    )

    parser.add_argument(
        "--output-root",
        default="public/images/products",
    )

    parser.add_argument(
        "--manifest",
        default="startech_networking_image_manifest.json",
    )

    parser.add_argument(
        "--category",
        default="",
        choices=[""] + list(
            CATEGORY_URLS.keys()
        ),
    )

    parser.add_argument(
        "--child",
        default="",
        help=(
            "Optional child/brand slug, "
            "e.g. tp-link. "
            "Use with --category."
        ),
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help=(
            "Limit total selected products "
            "for testing; 0 means all."
        ),
    )

    parser.add_argument(
        "--delay",
        type=float,
        default=0.35,
    )

    parser.add_argument(
        "--overwrite",
        action="store_true",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Build/map folder hierarchy "
            "without downloading images."
        ),
    )

    parser.add_argument(
        "--show-tree",
        action="store_true",
    )

    parser.add_argument(
        "--verbose",
        action="store_true",
    )

    args = parser.parse_args()

    if (
        args.child
        and not args.category
    ):
        parser.error(
            "--child requires --category"
        )

    root = Path(
        args.project_root
    ).resolve()

    output_root = (
        root
        / args.output_root
    ).resolve()

    manifest_path = (
        root
        / args.manifest
    ).resolve()

    client = Client(
        args.delay
    )

    print(
        "=" * 72
    )
    print(
        "STAR TECH NETWORKING IMAGE DOWNLOADER"
    )
    print(
        "ONE PRIMARY IMAGE PER PRODUCT"
    )
    print(
        "=" * 72
    )
    print(
        f"Source : {NETWORKING_URL}"
    )
    print(
        "Format : PNG"
    )
    print(
        "Resize : NO"
    )
    print(
        "Images : ONE per product"
    )
    print(
        "=" * 72
    )

    print(
        "\nBuilding Networking tree "
        "and reading pagination..."
    )

    tree = build_tree(
        client,
        only_category=args.category,
        verbose=args.verbose,
    )

    if args.show_tree:
        print_tree(tree)

    selected = []

    for node in tree:
        children = sorted(
            node["children"],
            key=lambda item: item["order"],
        )

        for product_url, product_name in node[
            "products"
        ].items():

            matches = [
                child
                for child in children
                if product_url in child["products"]
            ]

            if matches:
                child_slug = matches[0]["slug"]
                child_name = matches[0]["name"]
            else:
                child_slug = "_direct"
                child_name = "_direct"

            if (
                args.child
                and child_slug != args.child
            ):
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
                    {
                        "slug": child["slug"],
                        "name": child["name"],
                        "url": child["url"],
                    }
                    for child in matches
                ],
            })

    if args.limit:
        selected = selected[
            :args.limit
        ]

    manifest = {
        "sourceCategoryUrl": NETWORKING_URL,
        "selectedCategory": (
            args.category or None
        ),
        "selectedChild": (
            args.child or None
        ),
        "requestedForThisRun": len(selected),
        "outputRoot": str(
            output_root.relative_to(root)
        ).replace("\\", "/"),
        "imageFormat": "png",
        "imagesPerProduct": 1,
        "resize": False,
        "categories": [],
        "products": [],
        "summary": {
            "downloaded": 0,
            "skippedExisting": 0,
            "failed": 0,
            "dryRun": bool(
                args.dry_run
            ),
        },
    }

    for node in tree:
        manifest["categories"].append({
            "name": node["name"],
            "slug": node["slug"],
            "url": node["url"],
            "siteReportedProductCount": (
                node["siteReportedProductCount"]
            ),
            "productsFound": len(
                node["products"]
            ),
            "children": [
                {
                    "name": child["name"],
                    "slug": child["slug"],
                    "url": child["url"],
                    "matchedProductCount": len(
                        child["products"]
                    ),
                    "siteReportedProductCount": (
                        child[
                            "siteReportedProductCount"
                        ]
                    ),
                }
                for child in node["children"]
            ],
        })

    downloaded = 0
    skipped = 0
    failed = 0

    print(
        f"\nProcessing "
        f"{len(selected)} products..."
    )

    for index, rec0 in enumerate(
        selected,
        start=1,
    ):
        path_parts = [
            "networking",
            rec0["categorySlug"],
            rec0["childSlug"],
        ]

        folder = output_root.joinpath(
            *path_parts
        )

        stem = file_stem(
            rec0["productUrl"],
            rec0["productName"],
        )

        target = (
            folder
            / f"{stem}.png"
        )

        progress = (
            f"[{index}/{len(selected)}]"
        )

        rec = {
            "name": rec0["productName"],
            "sourceProductUrl": rec0["productUrl"],
            "categoryPath": path_parts,
            "category": {
                "name": rec0["categoryName"],
                "slug": rec0["categorySlug"],
                "url": rec0["categoryUrl"],
            },
            "primaryChild": {
                "name": rec0["childName"],
                "slug": rec0["childSlug"],
            },
            "matchedChildren": rec0[
                "childMatches"
            ],
            "sourceImageUrl": None,
            "localImageFile": str(
                target.relative_to(root)
            ).replace("\\", "/"),
            "width": None,
            "height": None,
            "status": None,
        }

        if args.dry_run:
            rec["status"] = "dry-run"

            print(
                f"{progress} MAP "
                f"{'/'.join(path_parts)} "
                f"<- {rec0['productName']}"
            )

            manifest["products"].append(
                rec
            )

            continue

        try:
            folder.mkdir(
                parents=True,
                exist_ok=True,
            )

            if (
                target.is_file()
                and target.stat().st_size > 0
                and not args.overwrite
            ):
                rec["status"] = (
                    "skipped-existing"
                )

                skipped += 1

                print(
                    f"{progress} SKIP exists: "
                    f"{rec['localImageFile']}"
                )

            else:
                product_doc = client.soup(
                    rec0["productUrl"]
                )

                image_url = primary_image(
                    product_doc,
                    rec0["productUrl"],
                )

                if not image_url:
                    raise RuntimeError(
                        "Primary image not found"
                    )

                raw, _ctype = client.image_bytes(
                    image_url
                )

                width, height = save_as_png(
                    raw,
                    target,
                )

                rec["status"] = "downloaded"
                rec["sourceImageUrl"] = image_url
                rec["width"] = width
                rec["height"] = height

                downloaded += 1

                print(
                    f"{progress} OK   "
                    f"{rec0['productName']}"
                )

                print(
                    f"         -> "
                    f"{rec['localImageFile']} "
                    f"({width}x{height})"
                )

        except Exception as exc:
            failed += 1

            rec["status"] = "failed"
            rec["error"] = str(exc)

            print(
                f"{progress} ERR  "
                f"{rec0['productName']}: "
                f"{exc}",
                file=sys.stderr,
            )

        manifest["products"].append(
            rec
        )

        manifest["summary"].update({
            "downloaded": downloaded,
            "skippedExisting": skipped,
            "failed": failed,
        })

        # Continuously save so interrupted downloads can be audited.
        write_manifest(
            manifest_path,
            manifest,
        )

    manifest["summary"].update({
        "downloaded": downloaded,
        "skippedExisting": skipped,
        "failed": failed,
    })

    write_manifest(
        manifest_path,
        manifest,
    )

    print(
        "\n" + "=" * 72
    )
    print(
        "DONE"
    )
    print(
        "=" * 72
    )
    print(
        f"Processed this run : "
        f"{len(selected)}"
    )
    print(
        f"Downloaded         : "
        f"{downloaded}"
    )
    print(
        f"Skipped existing   : "
        f"{skipped}"
    )
    print(
        f"Failed             : "
        f"{failed}"
    )
    print(
        f"Manifest           : "
        f"{manifest_path}"
    )
    print(
        f"Image root         : "
        f"{output_root / 'networking'}"
    )

    return (
        1
        if failed
        else 0
    )


if __name__ == "__main__":
    raise SystemExit(
        main()
    )
