#!/usr/bin/env python3
"""Download Star Tech product images referenced by generated productseed.json.

Install:
    pip install requests beautifulsoup4

From the general_ecommerce repository root:
    python download_startech_images.py \
      --json prisma/seed-data/productseed.json \
      --project-root .

Selective examples:
    python download_startech_images.py --json prisma/seed-data/productseed.json --project-root . --category laptop-notebook
    python download_startech_images.py --json prisma/seed-data/productseed.json --project-root . --limit 50
    python download_startech_images.py --json prisma/seed-data/productseed.json --project-root . --overwrite
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://www.startech.com.bd"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def normalize_url(url: str) -> str:
    return urljoin(BASE, url)


def find_primary_image(session: requests.Session, product_url: str) -> str | None:
    r = session.get(product_url, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    og = soup.select_one('meta[property="og:image"]')
    if og and og.get("content"):
        return normalize_url(str(og.get("content")))

    selectors = [
        ".product-img-holder img",
        ".product-image img",
        ".gallery img",
        ".thumbnail img",
        "img[itemprop='image']",
    ]
    for sel in selectors:
        for img in soup.select(sel):
            for attr in ("data-zoom-image", "data-src", "data-original", "src"):
                src = img.get(attr)
                if src:
                    full = normalize_url(str(src))
                    low = full.lower()
                    if not any(x in low for x in ["logo", "placeholder", "loading", "icon"]):
                        return full
    return None


def infer_dest(product: dict, project_root: Path) -> Path | None:
    local = product.get("localImageFile")
    if isinstance(local, str) and local.strip():
        return project_root / Path(local)

    image = product.get("image")
    if isinstance(image, str) and image.startswith("/"):
        return project_root / "public" / image.lstrip("/")
    return None


def download(session: requests.Session, url: str, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    r = session.get(url, timeout=45, stream=True)
    r.raise_for_status()
    ctype = r.headers.get("content-type", "").lower()
    if ctype and not ctype.startswith("image/"):
        raise ValueError(f"URL did not return an image: {ctype}")
    with dest.open("wb") as f:
        for chunk in r.iter_content(64 * 1024):
            if chunk:
                f.write(chunk)


def main() -> int:
    ap = argparse.ArgumentParser(description="Download images from Star Tech seed JSON into Next.js public/.")
    ap.add_argument("--json", required=True, help="Generated productseed.json")
    ap.add_argument("--project-root", default=".", help="general_ecommerce repository root")
    ap.add_argument("--category", default="", help="Only this categorySlug")
    ap.add_argument("--limit", type=int, default=0, help="Max images to process (0 = all)")
    ap.add_argument("--delay", type=float, default=0.35, help="Delay between downloads")
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--update-json", action="store_true", help="Persist discovered sourceImageUrl values")
    args = ap.parse_args()

    json_path = Path(args.json)
    data = json.loads(json_path.read_text(encoding="utf-8"))
    products = data.get("products", [])
    if not isinstance(products, list):
        print("Invalid JSON: products must be an array", file=sys.stderr)
        return 2

    root = Path(args.project_root).resolve()
    session = requests.Session()
    session.headers.update(HEADERS)

    selected = []
    for p in products:
        if not isinstance(p, dict):
            continue
        if args.category and p.get("categorySlug") != args.category:
            continue
        selected.append(p)
    if args.limit:
        selected = selected[: args.limit]

    ok = skipped = failed = 0
    changed = False

    for idx, p in enumerate(selected, start=1):
        name = str(p.get("name") or f"product-{idx}")
        dest = infer_dest(p, root)
        if not dest:
            print(f"SKIP no local image path: {name}")
            skipped += 1
            continue

        if dest.exists() and not args.overwrite:
            print(f"SKIP exists: {dest}")
            skipped += 1
            continue

        src = p.get("sourceImageUrl")
        if not isinstance(src, str) or not src.strip():
            product_url = p.get("sourceProductUrl")
            if isinstance(product_url, str) and product_url.strip():
                try:
                    src = find_primary_image(session, product_url)
                    if src:
                        p["sourceImageUrl"] = src
                        changed = True
                except Exception as exc:  # noqa: BLE001
                    print(f"ERR image discovery {name}: {exc}", file=sys.stderr)
                    failed += 1
                    continue

        if not isinstance(src, str) or not src.strip():
            print(f"ERR no source image: {name}", file=sys.stderr)
            failed += 1
            continue

        try:
            download(session, src, dest)
            ok += 1
            print(f"OK {idx}/{len(selected)} {name} -> {dest.relative_to(root)}")
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"ERR {name}: {exc}", file=sys.stderr)

        if args.delay:
            time.sleep(args.delay)

    if args.update_json and changed:
        json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Updated JSON source image URLs: {json_path}")

    print("\nDONE")
    print(f"Downloaded: {ok}")
    print(f"Skipped:    {skipped}")
    print(f"Failed:     {failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
