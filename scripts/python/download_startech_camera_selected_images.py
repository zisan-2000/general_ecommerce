#!/usr/bin/env python3
"""
Download ONLY these Star Tech Camera categories:

- Camera Lenses
- Dash Cam
- Body Camera
- Instant Camera

Source:
    https://www.startech.com.bd/camera

Default output:
    public/images/products/camera/
      camera-lenses/
      dash-cam/
      body-camera/
      instant-camera/

Examples:
    python -m pip install requests beautifulsoup4

    # Mapping only
    python download_startech_camera_selected_images.py --project-root . --dry-run

    # Test first 10 products across the selected categories
    python download_startech_camera_selected_images.py --project-root . --limit 10

    # Download all products from ONLY the four selected categories
    python download_startech_camera_selected_images.py --project-root .

    # Download one selected category only
    python download_startech_camera_selected_images.py --project-root . --category camera-lenses
    python download_startech_camera_selected_images.py --project-root . --category dash-cam
    python download_startech_camera_selected_images.py --project-root . --category body-camera
    python download_startech_camera_selected_images.py --project-root . --category instant-camera

    # Re-download existing images
    python download_startech_camera_selected_images.py --project-root . --overwrite

Notes:
- The script DOES NOT download DSLR, Mirrorless, Action Camera, Tripod, etc.
- It crawls the selected category pages directly, so it is faster than crawling
  the entire Camera catalog.
- Product counts are NOT hardcoded.
- Existing images are skipped unless --overwrite is supplied.
- Manifest:
      startech_camera_selected_image_manifest.json
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
CAMERA_URL = f"{BASE}/camera"

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

SELECTED_CATEGORIES = OrderedDict([
    ("camera-lenses", "Camera Lenses"),
    ("dash-cam", "Dash Cam"),
    ("body-camera", "Body Camera"),
    ("instant-camera", "Instant Camera"),
])


def norm_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip().casefold()


def slugify(value: str) -> str:
    value = (value or "").strip().lower().replace("&", " and ").replace("/", " ")
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-") or "unknown"


def canonical(url: str) -> str:
    parsed = urlparse(urljoin(BASE, url))
    return urlunparse(
        (
            parsed.scheme or "https",
            parsed.netloc,
            parsed.path.rstrip("/"),
            "",
            "",
            "",
        )
    )


def with_page(url: str, page: int) -> str:
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))

    if page <= 1:
        query.pop("page", None)
    else:
        query["page"] = str(page)

    return urlunparse(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            urlencode(query),
            parsed.fragment,
        )
    )


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

        content_type = (
            response.headers.get("content-type") or ""
        ).split(";")[0].strip().lower()

        if content_type and not content_type.startswith("image/"):
            response.close()
            raise ValueError(
                f"Expected image response, received {content_type}"
            )

        return response


def parse_listing_count(
    soup: BeautifulSoup,
) -> tuple[int | None, int | None]:
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


def product_links(
    soup: BeautifulSoup,
) -> OrderedDict[str, str]:
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
                products.setdefault(
                    canonical(href),
                    name,
                )

        if products:
            return products

    return products


def crawl_category(
    client: Client,
    category_url: str,
    verbose: bool = False,
) -> tuple[OrderedDict[str, str], int | None]:
    products: OrderedDict[str, str] = OrderedDict()
    page = 1
    total = pages = None

    while True:
        soup = client.soup(
            with_page(category_url, page)
        )

        if page == 1:
            total, pages = parse_listing_count(
                soup
            )

        batch = product_links(soup)
        before = len(products)

        for product_url, name in batch.items():
            products.setdefault(
                product_url,
                name,
            )

        newly_added = len(products) - before

        if verbose:
            suffix = (
                f"/{total}"
                if total is not None
                else ""
            )

            print(
                f"    page {page}: "
                f"{len(batch)} cards, "
                f"{newly_added} new, "
                f"collected {len(products)}"
                f"{suffix}"
            )

        if pages is not None:
            if page >= pages:
                break
        else:
            if not batch or newly_added == 0:
                break

            if page >= 100:
                raise RuntimeError(
                    f"Pagination safety limit reached: "
                    f"{category_url}"
                )

        page += 1

    return products, total


def find_category_url(
    client: Client,
    label: str,
) -> str | None:
    soup = client.soup(CAMERA_URL)
    wanted = norm_text(label)
    candidates: list[tuple[int, int, str]] = []

    for anchor in soup.find_all(
        "a",
        href=True,
    ):
        if norm_text(
            anchor.get_text(" ", strip=True)
        ) != wanted:
            continue

        url = canonical(
            anchor["href"]
        )

        path = urlparse(url).path.lower()

        score = 0

        if "/camera" in path:
            score += 30

        for token in slugify(
            label
        ).split("-"):
            if (
                len(token) >= 3
                and token in path
            ):
                score += 10

        candidates.append(
            (
                score,
                -len(path),
                url,
            )
        )

    if not candidates:
        return None

    candidates.sort(
        reverse=True
    )

    return candidates[0][2]


def primary_image(
    soup: BeautifulSoup,
    product_url: str,
) -> str | None:
    for selector, attribute in (
        ('meta[property="og:image"]', "content"),
        ('meta[name="twitter:image"]', "content"),
    ):
        tag = soup.select_one(
            selector
        )

        if tag and tag.get(
            attribute
        ):
            return urljoin(
                product_url,
                str(tag.get(attribute)),
            )

    selectors = [
        ".product-img-holder img",
        ".product-image img",
        ".gallery img",
        ".thumbnail img",
        "img[itemprop='image']",
    ]

    for selector in selectors:
        for image in soup.select(
            selector
        ):
            for attribute in (
                "data-zoom-image",
                "data-large-image",
                "data-src",
                "data-original",
                "src",
            ):
                source = image.get(
                    attribute
                )

                if not source:
                    continue

                full = urljoin(
                    product_url,
                    str(source),
                )

                if any(
                    part in full.lower()
                    for part in (
                        "logo",
                        "placeholder",
                        "loading",
                        "icon",
                    )
                ):
                    continue

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
        return (
            ".jpg"
            if suffix == ".jpeg"
            else suffix
        )

    extension = mimetypes.guess_extension(
        (content_type or "")
        .split(";")[0]
        .strip()
        .lower()
    ) or ".jpg"

    if extension in {
        ".jpe",
        ".jpeg",
    }:
        extension = ".jpg"

    return extension


def file_stem(
    product_url: str,
    product_name: str,
) -> str:
    leaf = Path(
        urlparse(
            product_url
        ).path.rstrip("/")
    ).name

    stem = slugify(
        leaf or product_name
    )

    if stem:
        return stem

    return hashlib.sha256(
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
        path = folder / (
            f"{stem}{extension}"
        )

        if (
            path.is_file()
            and path.stat().st_size > 0
        ):
            return path

    return None


def save_manifest(
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
        )
        + "\n",
        encoding="utf-8",
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
            "Download only Camera Lenses, "
            "Dash Cam, Body Camera and "
            "Instant Camera images from "
            "Star Tech."
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
        default=(
            "startech_camera_selected_"
            "image_manifest.json"
        ),
    )

    parser.add_argument(
        "--category",
        default="",
        choices=[
            ""
        ] + list(
            SELECTED_CATEGORIES.keys()
        ),
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

    if (
        args.limit < 0
        or args.delay < 0
    ):
        parser.error(
            "--limit and --delay "
            "must be non-negative"
        )

    root = Path(
        args.project_root
    ).resolve()

    output_root = (
        root / args.output_root
    ).resolve()

    manifest_path = (
        root / args.manifest
    ).resolve()

    client = Client(
        args.delay
    )

    selected_category_defs = (
        OrderedDict([
            (
                args.category,
                SELECTED_CATEGORIES[
                    args.category
                ],
            )
        ])
        if args.category
        else SELECTED_CATEGORIES
    )

    category_records = []
    combined_products = []

    print(
        "Reading ONLY selected "
        "Camera categories..."
    )

    for order, (
        slug,
        label,
    ) in enumerate(
        selected_category_defs.items(),
        start=1,
    ):
        category_url = (
            find_category_url(
                client,
                label,
            )
        )

        if not category_url:
            print(
                f"ERROR: Could not locate "
                f"Camera > {label}",
                file=sys.stderr,
            )

            category_records.append({
                "name": label,
                "slug": slug,
                "url": None,
                "siteReportedProductCount": None,
                "productsFound": 0,
            })
            continue

        print(
            f"\nCamera > {label}: "
            f"{category_url}"
        )

        try:
            products, reported_total = (
                crawl_category(
                    client,
                    category_url,
                    verbose=True,
                )
            )
        except Exception as exc:
            print(
                f"ERROR crawling {label}: "
                f"{exc}",
                file=sys.stderr,
            )

            category_records.append({
                "name": label,
                "slug": slug,
                "url": category_url,
                "siteReportedProductCount": None,
                "productsFound": 0,
            })
            continue

        category_records.append({
            "name": label,
            "slug": slug,
            "url": category_url,
            "siteReportedProductCount": (
                reported_total
            ),
            "productsFound": len(
                products
            ),
        })

        for product_url, product_name in (
            products.items()
        ):
            combined_products.append(
                (
                    product_url,
                    product_name,
                    slug,
                    label,
                    category_url,
                )
            )

    # De-duplicate by product URL while preserving
    # the first matching selected category.
    unique = OrderedDict()

    for record in combined_products:
        unique.setdefault(
            record[0],
            record,
        )

    selected_products = list(
        unique.values()
    )

    if args.limit:
        selected_products = (
            selected_products[: args.limit]
        )

    manifest = {
        "sourceRootCategoryUrl": CAMERA_URL,
        "selectedCategories": category_records,
        "uniqueSelectedProductsFound": len(
            unique
        ),
        "requestedForThisRun": len(
            selected_products
        ),
        "outputRoot": str(
            output_root.relative_to(root)
        ).replace("\\", "/"),
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

    downloaded = 0
    skipped = 0
    failed = 0

    print(
        "\nProcessing selected "
        "Camera products..."
    )

    for index, (
        product_url,
        product_name,
        category_slug,
        category_name,
        category_url,
    ) in enumerate(
        selected_products,
        start=1,
    ):
        category_path = [
            "camera",
            category_slug,
        ]

        folder = (
            output_root.joinpath(
                *category_path
            )
        )

        progress = (
            f"[{index}/"
            f"{len(selected_products)}]"
        )

        record = {
            "name": product_name,
            "sourceProductUrl": (
                product_url
            ),
            "sourceCategoryUrl": (
                category_url
            ),
            "categoryName": (
                category_name
            ),
            "categorySlug": (
                category_slug
            ),
            "categoryPath": (
                category_path
            ),
            "sourceImageUrl": None,
            "localImageFile": None,
            "status": None,
        }

        if args.dry_run:
            record[
                "status"
            ] = "dry-run"

            print(
                f"{progress} MAP "
                f"{'/'.join(category_path)} "
                f"<- {product_name}"
            )

            manifest[
                "products"
            ].append(record)

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
                record[
                    "status"
                ] = "skipped-existing"

                record[
                    "localImageFile"
                ] = str(
                    previous.relative_to(
                        root
                    )
                ).replace(
                    "\\",
                    "/",
                )

                skipped += 1

                print(
                    f"{progress} SKIP exists: "
                    f"{record['localImageFile']}"
                )

            else:
                soup = client.soup(
                    product_url
                )

                image_url = (
                    primary_image(
                        soup,
                        product_url,
                    )
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
                    extension = (
                        image_extension(
                            image_url,
                            image_response
                            .headers
                            .get(
                                "content-type",
                                "",
                            ),
                        )
                    )

                    target = (
                        folder
                        / f"{stem}{extension}"
                    )

                    partial = (
                        target.with_name(
                            target.name
                            + ".part"
                        )
                    )

                    try:
                        with partial.open(
                            "wb"
                        ) as output:
                            for chunk in (
                                image_response
                                .iter_content(
                                    64 * 1024
                                )
                            ):
                                if chunk:
                                    output.write(
                                        chunk
                                    )

                        if (
                            not partial.exists()
                            or partial.stat()
                            .st_size == 0
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

                record[
                    "status"
                ] = "downloaded"

                record[
                    "sourceImageUrl"
                ] = image_url

                record[
                    "localImageFile"
                ] = str(
                    target.relative_to(
                        root
                    )
                ).replace(
                    "\\",
                    "/",
                )

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

            record[
                "status"
            ] = "failed"

            record[
                "error"
            ] = str(exc)

            print(
                f"{progress} ERR  "
                f"{product_name}: "
                f"{exc}",
                file=sys.stderr,
            )

        manifest[
            "products"
        ].append(record)

        manifest[
            "summary"
        ].update({
            "downloaded": (
                downloaded
            ),
            "skippedExisting": (
                skipped
            ),
            "failed": failed,
        })

        save_manifest(
            manifest_path,
            manifest,
        )

    manifest[
        "summary"
    ].update({
        "downloaded": downloaded,
        "skippedExisting": skipped,
        "failed": failed,
    })

    save_manifest(
        manifest_path,
        manifest,
    )

    print("\nDONE")

    for category in (
        category_records
    ):
        print(
            f"{category['name']}: "
            f"{category['productsFound']}"
            + (
                " products"
                if category[
                    "productsFound"
                ] != 1
                else " product"
            )
        )

    print(
        "Unique selected products: "
        f"{len(unique)}"
    )

    print(
        "Processed this run:       "
        f"{len(selected_products)}"
    )

    print(
        "Downloaded:               "
        f"{downloaded}"
    )

    print(
        "Skipped existing:         "
        f"{skipped}"
    )

    print(
        "Failed:                   "
        f"{failed}"
    )

    print(
        f"Manifest:                 "
        f"{manifest_path}"
    )

    print(
        f"Image root:               "
        f"{output_root}"
    )

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
