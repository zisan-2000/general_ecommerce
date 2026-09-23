#!/usr/bin/env python3
"""
Download ALL Star Tech Security Camera / Security product primary images into
category folders.

Source:
    https://www.startech.com.bd/Security-Camera

Default output:
    public/images/products/security-camera/...

Live direct categories currently shown on Star Tech:
    Portable WiFi Camera
    IP Camera
    CC Camera
    PTZ Camera
    CC Camera Package
    IP Camera Package
    DVR
    NVR
    XVR
    CC Camera Accessories
    Door Lock
    Smart Door Bell
    Access Control
    Entrance Control
    Digital Locker & Vault
    KVM Switch

Examples:
    python -m pip install requests beautifulsoup4

    # Mapping only
    python download_startech_security_images.py --project-root . --dry-run

    # Test first 10 products
    python download_startech_security_images.py --project-root . --limit 10

    # Download every product currently under /Security-Camera
    python download_startech_security_images.py --project-root .

    # Download only one category
    python download_startech_security_images.py --project-root . --category ip-camera
    python download_startech_security_images.py --project-root . --category cc-camera
    python download_startech_security_images.py --project-root . --category access-control

    # Re-download existing images
    python download_startech_security_images.py --project-root . --overwrite

Notes:
- Product count is NOT hardcoded.
- The script reads the current live pagination from Star Tech.
- Existing images are skipped unless --overwrite is used.
- Each product is stored once in the first matching Security category.
- A manifest is continuously written to startech_security_image_manifest.json.
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
SECURITY_URL = f"{BASE}/Security-Camera"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Referer": BASE + "/",
}

CATEGORY_LABELS = OrderedDict([
    ("portable-wifi-camera", "Portable WiFi Camera"),
    ("ip-camera", "IP Camera"),
    ("cc-camera", "CC Camera"),
    ("ptz-camera", "PTZ Camera"),
    ("cc-camera-package", "CC Camera Package"),
    ("ip-camera-package", "IP Camera Package"),
    ("dvr", "DVR"),
    ("nvr", "NVR"),
    ("xvr", "XVR"),
    ("cc-camera-accessories", "CC Camera Accessories"),
    ("door-lock", "Door Lock"),
    ("smart-door-bell", "Smart Door Bell"),
    ("access-control", "Access Control"),
    ("entrance-control", "Entrance Control"),
    ("digital-locker-vault", "Digital Locker & Vault"),
    ("kvm-switch", "KVM Switch"),
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
            total=4,
            connect=4,
            read=4,
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
            response = self.session.get(full, timeout=40)
            response.raise_for_status()
            self.cache[full] = response.text

            if self.delay:
                time.sleep(self.delay)

        return BeautifulSoup(self.cache[full], "html.parser")

    def image_response(self, url: str) -> requests.Response:
        response = self.session.get(
            urljoin(BASE, url),
            timeout=60,
            stream=True,
        )
        response.raise_for_status()

        ctype = (
            response.headers.get("content-type") or ""
        ).split(";")[0].strip().lower()

        if ctype and not ctype.startswith("image/"):
            response.close()
            raise ValueError(f"Expected image response, got {ctype}")

        return response


def parse_count(soup: BeautifulSoup):
    match = re.search(
        r"Showing\s+\d+\s+to\s+\d+\s+of\s+([\d,]+)"
        r"\s+\(([\d,]+)\s+Pages?\)",
        soup.get_text(" ", strip=True),
        re.I,
    )

    if not match:
        return None, None

    return (
        int(match.group(1).replace(",", "")),
        int(match.group(2).replace(",", "")),
    )


def product_links(soup: BeautifulSoup) -> OrderedDict[str, str]:
    products: OrderedDict[str, str] = OrderedDict()

    selectors = [
        ".p-item .p-item-name a",
        ".p-item-name a",
        ".product-layout h4 a",
        ".product-thumb h4 a",
        ".product-name a",
    ]

    for selector in selectors:
        for anchor in soup.select(selector):
            href = anchor.get("href")
            name = anchor.get_text(" ", strip=True)

            if href and name:
                products.setdefault(canonical(href), name)

        if products:
            return products

    return products


def crawl(client: Client, url: str, verbose: bool = False):
    products: OrderedDict[str, str] = OrderedDict()
    page = 1
    total = pages = None

    while True:
        soup = client.soup(with_page(url, page))

        if page == 1:
            total, pages = parse_count(soup)

        batch = product_links(soup)
        before = len(products)

        for product_url, name in batch.items():
            products.setdefault(product_url, name)

        added = len(products) - before

        if verbose:
            suffix = f"/{total}" if total is not None else ""
            print(
                f"  page {page}: {len(batch)} cards, "
                f"{added} new, collected {len(products)}{suffix}"
            )

        if pages is not None:
            if page >= pages:
                break
        else:
            if not batch or added == 0:
                break

            if page >= 100:
                raise RuntimeError(
                    f"Pagination safety limit reached: {url}"
                )

        page += 1

    return products, total


def find_category_url(client: Client, label: str) -> str | None:
    soup = client.soup(SECURITY_URL)
    wanted = norm_text(label)
    candidates: list[str] = []

    for anchor in soup.find_all("a", href=True):
        if norm_text(anchor.get_text(" ", strip=True)) != wanted:
            continue

        candidates.append(canonical(anchor["href"]))

    return candidates[0] if candidates else None


def primary_image(
    soup: BeautifulSoup,
    product_url: str,
) -> str | None:
    for selector, attribute in [
        ('meta[property="og:image"]', "content"),
        ('meta[name="twitter:image"]', "content"),
    ]:
        tag = soup.select_one(selector)

        if tag and tag.get(attribute):
            return urljoin(
                product_url,
                str(tag.get(attribute)),
            )

    for selector in [
        ".product-img-holder img",
        ".product-image img",
        ".gallery img",
        ".thumbnail img",
        "img[itemprop='image']",
    ]:
        for image in soup.select(selector):
            for attribute in (
                "data-zoom-image",
                "data-large-image",
                "data-src",
                "data-original",
                "src",
            ):
                source = image.get(attribute)

                if not source:
                    continue

                full = urljoin(
                    product_url,
                    str(source),
                )

                if not any(
                    part in full.lower()
                    for part in (
                        "logo",
                        "placeholder",
                        "loading",
                        "icon",
                    )
                ):
                    return full

    return None


def image_extension(
    url: str,
    content_type: str = "",
) -> str:
    suffix = Path(
        urlparse(url).path
    ).suffix.lower()

    if suffix in {
        ".webp",
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".avif",
    }:
        return ".jpg" if suffix == ".jpeg" else suffix

    ctype = (
        content_type or ""
    ).split(";")[0].strip().lower()

    extension = (
        mimetypes.guess_extension(ctype)
        if ctype
        else None
    ) or ".jpg"

    return ".jpg" if extension in {".jpe", ".jpeg"} else extension


def file_stem(
    product_url: str,
    product_name: str,
) -> str:
    leaf = Path(
        urlparse(product_url).path.rstrip("/")
    ).name

    stem = slugify(leaf or product_name)

    return stem or hashlib.sha256(
        product_url.encode("utf-8")
    ).hexdigest()[:12]


def existing_file(
    folder: Path,
    stem: str,
) -> Path | None:
    for extension in (
        ".webp",
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".avif",
    ):
        path = folder / f"{stem}{extension}"

        if path.is_file() and path.stat().st_size > 0:
            return path

    return None


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(
        description="Download all Star Tech Security Camera/Security product images."
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
        default="startech_security_image_manifest.json",
    )
    parser.add_argument(
        "--category",
        default="",
        choices=[""] + list(CATEGORY_LABELS.keys()),
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.30,
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
    )

    args = parser.parse_args()

    if args.limit < 0 or args.delay < 0:
        parser.error("--limit and --delay must be non-negative")

    root = Path(
        args.project_root
    ).resolve()

    output_root = (
        root / args.output_root
    ).resolve()

    manifest_path = (
        root / args.manifest
    ).resolve()

    client = Client(args.delay)

    print(
        f"Reading Security master catalog: {SECURITY_URL}"
    )

    master, reported_total = crawl(
        client,
        SECURITY_URL,
        verbose=True,
    )

    print("\nMASTER CATALOG")
    print(
        "  Site reported: "
        + (
            str(reported_total)
            if reported_total is not None
            else "unknown"
        )
    )
    print(
        f"  Unique product URLs found: {len(master)}"
    )

    master_urls = set(master.keys())

    print("\nDiscovering Security category URLs...")

    nodes = []

    for order, (
        slug,
        label,
    ) in enumerate(
        CATEGORY_LABELS.items(),
        start=1,
    ):
        category_url = find_category_url(
            client,
            label,
        )

        matched: set[str] = set()

        if category_url:
            try:
                branch, _ = crawl(
                    client,
                    category_url,
                    verbose=False,
                )
                matched = set(
                    branch.keys()
                ) & master_urls
            except Exception as exc:
                print(
                    f"WARN {label}: {exc}",
                    file=sys.stderr,
                )

        print(
            f"  Security > {label}: "
            f"{category_url or 'NOT FOUND'} "
            f"({len(matched)} matched)"
        )

        nodes.append(
            {
                "slug": slug,
                "name": label,
                "url": category_url,
                "order": order,
                "products": matched,
            }
        )

    selected = []

    for product_url, product_name in master.items():
        matches = [
            node
            for node in nodes
            if product_url
            in node["products"]
        ]

        matches.sort(
            key=lambda node: node["order"]
        )

        category = (
            matches[0]["slug"]
            if matches
            else "_uncategorized"
        )

        if (
            args.category
            and category != args.category
        ):
            continue

        selected.append(
            (
                product_url,
                product_name,
                category,
                matches,
            )
        )

    if args.limit:
        selected = selected[: args.limit]

    manifest = {
        "sourceCategoryUrl": SECURITY_URL,
        "siteReportedProductCount": reported_total,
        "uniqueMasterProductsFound": len(master),
        "selectedCategory": args.category or None,
        "requestedForThisRun": len(selected),
        "outputRoot": str(
            output_root.relative_to(root)
        ).replace("\\", "/"),
        "categories": [
            {
                "name": node["name"],
                "slug": node["slug"],
                "url": node["url"],
                "matchedProductCount": len(
                    node["products"]
                ),
            }
            for node in nodes
        ],
        "products": [],
        "summary": {
            "downloaded": 0,
            "skippedExisting": 0,
            "failed": 0,
            "dryRun": bool(args.dry_run),
        },
    }

    downloaded = 0
    skipped = 0
    failed = 0

    print("\nProcessing Security products...")

    for index, (
        product_url,
        product_name,
        category,
        matches,
    ) in enumerate(
        selected,
        start=1,
    ):
        category_path = [
            "security-camera",
            category,
        ]

        folder = output_root.joinpath(
            *category_path
        )

        progress = (
            f"[{index}/{len(selected)}]"
        )

        record = {
            "name": product_name,
            "sourceProductUrl": product_url,
            "categoryPath": category_path,
            "matchedCategories": [
                {
                    "name": node["name"],
                    "slug": node["slug"],
                    "url": node["url"],
                }
                for node in matches
            ],
            "sourceImageUrl": None,
            "localImageFile": None,
            "status": None,
        }

        if args.dry_run:
            record["status"] = "dry-run"

            print(
                f"{progress} MAP "
                f"{'/'.join(category_path)} "
                f"<- {product_name}"
            )

            manifest["products"].append(
                record
            )
            continue

        try:
            folder.mkdir(
                parents=True,
                exist_ok=True,
            )

            stem = file_stem(
                product_url,
                product_name,
            )

            previous = existing_file(
                folder,
                stem,
            )

            if (
                previous
                and not args.overwrite
            ):
                record["status"] = (
                    "skipped-existing"
                )
                record["localImageFile"] = str(
                    previous.relative_to(root)
                ).replace("\\", "/")

                skipped += 1

                print(
                    f"{progress} SKIP exists: "
                    f"{record['localImageFile']}"
                )

            else:
                soup = client.soup(
                    product_url
                )

                image_url = primary_image(
                    soup,
                    product_url,
                )

                if not image_url:
                    raise RuntimeError(
                        "Primary image not found"
                    )

                image_response = (
                    client.image_response(
                        image_url
                    )
                )

                try:
                    extension = image_extension(
                        image_url,
                        image_response.headers.get(
                            "content-type",
                            "",
                        ),
                    )

                    target = folder / (
                        f"{stem}{extension}"
                    )

                    partial = target.with_name(
                        target.name + ".part"
                    )

                    try:
                        with partial.open(
                            "wb"
                        ) as output:
                            for chunk in (
                                image_response.iter_content(
                                    64 * 1024
                                )
                            ):
                                if chunk:
                                    output.write(
                                        chunk
                                    )

                        if (
                            not partial.exists()
                            or partial.stat().st_size
                            == 0
                        ):
                            raise RuntimeError(
                                "Empty image response"
                            )

                        partial.replace(
                            target
                        )

                    finally:
                        partial.unlink(
                            missing_ok=True
                        )

                finally:
                    image_response.close()

                record["status"] = (
                    "downloaded"
                )
                record["sourceImageUrl"] = (
                    image_url
                )
                record["localImageFile"] = str(
                    target.relative_to(root)
                ).replace("\\", "/")

                downloaded += 1

                print(
                    f"{progress} OK   "
                    f"{product_name}"
                )
                print(
                    "         -> "
                    f"{record['localImageFile']}"
                )

        except Exception as exc:
            failed += 1

            record["status"] = "failed"
            record["error"] = str(exc)

            print(
                f"{progress} ERR  "
                f"{product_name}: {exc}",
                file=sys.stderr,
            )

        manifest["products"].append(
            record
        )

        manifest["summary"].update(
            {
                "downloaded": downloaded,
                "skippedExisting": skipped,
                "failed": failed,
            }
        )

        manifest_path.write_text(
            json.dumps(
                manifest,
                indent=2,
                ensure_ascii=False,
            )
            + "\n",
            encoding="utf-8",
        )

    manifest["summary"].update(
        {
            "downloaded": downloaded,
            "skippedExisting": skipped,
            "failed": failed,
        }
    )

    manifest_path.write_text(
        json.dumps(
            manifest,
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    print("\nDONE")
    print(
        f"Master products found: {len(master)}"
    )

    if reported_total is not None:
        print(
            f"Site reported count:   "
            f"{reported_total}"
        )

    print(
        f"Processed this run:    "
        f"{len(selected)}"
    )
    print(
        f"Downloaded:            "
        f"{downloaded}"
    )
    print(
        f"Skipped existing:      "
        f"{skipped}"
    )
    print(
        f"Failed:                "
        f"{failed}"
    )
    print(
        f"Manifest:              "
        f"{manifest_path}"
    )
    print(
        f"Image root:            "
        f"{output_root}"
    )

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
