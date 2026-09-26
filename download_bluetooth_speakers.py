#!/usr/bin/env python3

import io
import re
import time
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from PIL import Image

BASE_DIR = Path(
    "public/images/products/accessories/bluetooth-speaker"
)

BRANDS = {
    "aula": "https://www.startech.com.bd/aula-bluetooth-speaker",
    "foneng": "https://www.startech.com.bd/foneng-bluetooth-speaker",
    "anker": "https://www.startech.com.bd/anker-bluetooth-speakers",
    "xtrike-me": "https://www.startech.com.bd/xtrike-me-bluetooth-speaker",
    "baseus": "https://www.startech.com.bd/baseus-bluetooth-speaker",
    "earfun": "https://www.startech.com.bd/earfun-bluetooth-speaker",
    "fantech": "https://www.startech.com.bd/fantech-bluetooth-speaker",
    "oraimo": "https://www.startech.com.bd/oraimo-bluetooth-speaker",
    "hifuture": "https://www.startech.com.bd/hifuture-bluetooth-speaker",
    "hoco": "https://www.startech.com.bd/hoco-bluetooth-speaker",
    "jbl": "https://www.startech.com.bd/jbl-bluetooth-speaker",
    "joyroom": "https://www.startech.com.bd/joyroom-bluetooth-speaker",
    "havit": "https://www.startech.com.bd/havit-bluetooth-speaker",
    "lenovo": "https://www.startech.com.bd/lenovo-bluetooth-speaker",
    "marshall": "https://www.startech.com.bd/marshall-bluetooth-speaker",
    "thunderobot": "https://www.startech.com.bd/thunderobot-bluetooth-speaker",
    "logitech": "https://www.startech.com.bd/logitech-bluetooth-speaker",
    "honor": "https://www.startech.com.bd/honor-bluetooth-speaker",
    "f-and-d": "https://www.startech.com.bd/f-and-d-bluetooth-speaker",
    "edifier": "https://www.startech.com.bd/edifier-bluetooth-speaker",
    "microlab": "https://www.startech.com.bd/microlab-bluetooth-speaker",
    "recci": "https://www.startech.com.bd/recci-bluetooth-speaker",
    "samsung": "https://www.startech.com.bd/samsung-bluetooth-speaker",
    "sony": "https://www.startech.com.bd/sony-bluetooth-speaker",
    "tribit": "https://www.startech.com.bd/tribit-bluetooth-speaker",
    "wiwu": "https://www.startech.com.bd/wiwu-bluetooth-speaker",
    "xpert": "https://www.startech.com.bd/xpert-bluetooth-speaker",
    "yison": "https://www.startech.com.bd/yison-bluetooth-speaker",
    "ldnio": "https://www.startech.com.bd/ldnio-bluetooth-speaker",
    "ikarao": "https://www.startech.com.bd/ikarao-bluetooth-speaker",
    "steelseries": "https://www.startech.com.bd/steelseries-bluetooth-speaker",
    "thonet-vander": "https://www.startech.com.bd/thonet-and-vander-bluetooth-speaker",
    "qcy": "https://www.startech.com.bd/qcy-bluetooth-speaker",
    "onikuma": "https://www.startech.com.bd/onikuma-bluetooth-speaker",
    "harman-kardon": "https://www.startech.com.bd/harman-kardon-bluetooth-speaker",
    "bwoo": "https://www.startech.com.bd/bwoo-bluetooth-speaker",
    "xtreme": "https://www.startech.com.bd/xtreme-bluetooth-speaker",
    "micropack": "https://www.startech.com.bd/micropack-bluetooth-speaker",
    "tozo": "https://www.startech.com.bd/tozo-bluetooth-speaker",
    "monster": "https://www.startech.com.bd/monster-bluetooth-speaker",
    "weofly": "https://www.startech.com.bd/weofly-bluetooth-speaker",
    "jiayou": "https://www.startech.com.bd/jiayou-bluetooth-speaker",
    "unikyy": "https://www.startech.com.bd/unikyy-bluetooth-speaker",
    "xtra": "https://www.startech.com.bd/xtra-bluetooth-speaker",
    "tecno": "https://www.startech.com.bd/tecno-bluetooth-speaker",
    "xo": "https://www.startech.com.bd/xo-bluetooth-speaker",
    "acefast": "https://www.startech.com.bd/acefast-bluetooth-speaker",
    "remax": "https://www.startech.com.bd/remax-bluetooth-speaker",
    "rapoo": "https://www.startech.com.bd/rapoo-bluetooth-speaker",
}

HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/153.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}

TIMEOUT = 30
DELAY = 0.4

session = requests.Session()
session.headers.update(HEADERS)


def slugify(text):
    text = text.lower().strip()
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def soup(url):
    r = session.get(url, timeout=TIMEOUT)
    r.raise_for_status()
    return BeautifulSoup(r.text, "html.parser")


def product_links(category_url):

    found = []
    seen = set()
    page = 1

    while True:

        url = (
            category_url
            if page == 1
            else f"{category_url}?page={page}"
        )

        print(f"      Page {page}")

        try:
            doc = soup(url)
        except Exception as e:
            print(f"      PAGE ERROR: {e}")
            break

        links = []

        for card in doc.select(".p-item"):

            a = (
                card.select_one(".p-item-name a")
                or card.select_one("h4 a")
            )

            if not a:
                continue

            href = a.get("href")

            if not href:
                continue

            href = urljoin(category_url, href)

            if href not in seen:
                links.append(href)

        if not links:
            break

        for link in links:
            seen.add(link)
            found.append(link)

        page += 1
        time.sleep(DELAY)

    return found


def product_info(url):

    doc = soup(url)

    h1 = doc.select_one("h1")

    if not h1:
        return None, None

    name = h1.get_text(" ", strip=True)

    image_url = None

    # Prefer high resolution image where available
    for selector in [
        ".product-img-holder img",
        ".product-image img",
        ".image img",
    ]:

        img = doc.select_one(selector)

        if not img:
            continue

        image_url = (
            img.get("data-zoom-image")
            or img.get("data-large-image")
            or img.get("data-src")
            or img.get("src")
        )

        if image_url:
            break

    # High-quality OpenGraph fallback
    if not image_url:

        og = doc.select_one(
            'meta[property="og:image"]'
        )

        if og:
            image_url = og.get("content")

    if image_url:
        image_url = urljoin(url, image_url)

    return name, image_url


def save_as_png(image_url, destination):

    # Existing valid PNG = skip
    if destination.exists() and destination.stat().st_size > 0:
        print(f"         SKIP: {destination.name}")
        return "skip"

    r = session.get(
        image_url,
        timeout=TIMEOUT
    )

    r.raise_for_status()

    image = Image.open(io.BytesIO(r.content))

    # Do NOT resize.
    # Keep original pixel dimensions.
    image.load()

    # Preserve alpha/transparency when present
    if image.mode in ("RGBA", "LA"):
        output = image

    elif image.mode == "P" and "transparency" in image.info:
        output = image.convert("RGBA")

    else:
        output = image.convert("RGB")

    destination.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    # PNG compression is LOSSLESS.
    # compress_level changes file size/speed,
    # not visual quality.
    output.save(
        destination,
        format="PNG",
        optimize=False,
        compress_level=6
    )

    print(
        f"         OK: {destination.name} "
        f"({output.width}x{output.height})"
    )

    return "download"


def main():

    BASE_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    total_downloaded = 0
    total_skipped = 0
    total_failed = 0

    print("=" * 70)
    print("STAR TECH BLUETOOTH SPEAKER DOWNLOADER")
    print("=" * 70)

    print(f"Brands : {len(BRANDS)}")
    print(f"Output : {BASE_DIR.resolve()}")
    print("Format : PNG (lossless)")
    print("Resize : NO")
    print("=" * 70)

    for brand_number, (brand, url) in enumerate(
        BRANDS.items(), 1
    ):

        brand_dir = BASE_DIR / brand

        brand_dir.mkdir(
            parents=True,
            exist_ok=True
        )

        print()
        print(
            f"[{brand_number}/{len(BRANDS)}] "
            f"{brand.upper()}"
        )

        print(f"   URL: {url}")

        try:
            products = product_links(url)

        except Exception as e:
            print(f"   ERROR: {e}")
            total_failed += 1
            continue

        print(
            f"   Products found: {len(products)}"
        )

        for i, product_url in enumerate(
            products, 1
        ):

            try:

                name, image_url = product_info(
                    product_url
                )

                if not name or not image_url:
                    print(
                        f"      [{i}] IMAGE NOT FOUND"
                    )

                    total_failed += 1
                    continue

                filename = (
                    slugify(name) + ".png"
                )

                destination = (
                    brand_dir / filename
                )

                print(
                    f"      [{i}/{len(products)}] "
                    f"{name}"
                )

                result = save_as_png(
                    image_url,
                    destination
                )

                if result == "download":
                    total_downloaded += 1
                else:
                    total_skipped += 1

            except Exception as e:

                print(
                    f"         ERROR: {e}"
                )

                total_failed += 1

            time.sleep(DELAY)

    print()
    print("=" * 70)
    print("COMPLETE")
    print("=" * 70)

    print(
        f"Downloaded : {total_downloaded}"
    )

    print(
        f"Skipped    : {total_skipped}"
    )

    print(
        f"Failed     : {total_failed}"
    )

    print(
        f"Folder     : {BASE_DIR.resolve()}"
    )


if __name__ == "__main__":
    main()