#!/usr/bin/env python3
"""
Build split Star Tech seed JSON files from an already-downloaded local image folder,
then seed them into the current general_ecommerce Prisma database.

Designed for:
  https://github.com/zisan-2000/general_ecommerce

Typical use (run from repository root):
  python prisma/startech_single_category_json_and_seed.py "https://www.startech.com.bd/desktops"
  python prisma/startech_single_category_json_and_seed.py "https://www.startech.com.bd/laptop-notebook"

If --image-folder is omitted the script asks for it interactively, for example:
  /images/products/desktop
  /images/products/laptop

What it does:
  1. Scans every local image recursively. No scanned image is silently dropped.
  2. Uses the image filename as the preferred Star Tech product slug.
  3. Tries direct Star Tech URL, Star Tech internal search, then Google discovery.
     If Google HTML/API is unavailable it can use DuckDuckGo only to discover a
     Star Tech URL. Product data is always scraped from startech.com.bd.
  4. Scrapes full product details, description, key features, price, brand,
     model, warranty, dimensions/weight, and specification groups.
  5. Maps local folder hierarchy to category/subcategory/child category + brand.
  6. Writes one JSON file per first-level subcategory under:
       prisma/StarTec Product Seed/<category-url-slug>/
     plus index.json, _all.json, report.json, and unmatched.json.
  7. Unresolved images are still represented as INACTIVE placeholder products,
     so the run has complete image coverage without inventing product details.
  8. Seeds completed JSON groups using the repository's Star Tech Prisma seeder.

Dependencies:
  python -m pip install requests beautifulsoup4

Optional Google Custom Search environment variables (more reliable than Google HTML):
  GOOGLE_CSE_API_KEY
  GOOGLE_CSE_CX

Notes:
  - Run from the repository root.
  - The script reuses scripts/python/build_startech_full_seed.py from this repo.
  - It does not fabricate missing prices/specifications. Unresolved products are
    marked unmatched=true and available=false for manual review.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote_plus, unquote, urljoin, urlsplit

import requests
from bs4 import BeautifulSoup


PROJECT_ROOT = Path.cwd().resolve()
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    from scripts.python import build_startech_full_seed as core
except Exception as exc:  # pragma: no cover - actionable startup error
    raise SystemExit(
        "Could not import scripts/python/build_startech_full_seed.py.\n"
        "Run this script from the general_ecommerce repository root and make sure "
        "that file exists.\n"
        f"Import error: {exc}"
    )


BASE = core.BASE
IMAGE_EXTENSIONS = set(core.IMAGE_EXTENSIONS)
SPECIAL_DIRS = {"_direct", "_other", "_uncategorized", "direct", "other"}
VARIANT_LABEL_HINTS = {
    "color",
    "colour",
    "capacity",
    "storage",
    "storage capacity",
    "ram",
    "memory",
    "memory size",
    "size",
    "screen size",
    "display size",
    "edition",
    "version",
    "interface",
    "connector",
    "form factor",
}


@dataclass(frozen=True)
class LocalImage:
    disk_path: Path
    public_path: str
    stem: str
    rel_dirs: tuple[str, ...]


@dataclass
class ProductWorkResult:
    stem: str
    product: dict[str, Any]
    category_chain: list[tuple[str, str]]
    group_key: str
    matched: bool
    match_meta: dict[str, Any]
    source_images: list[str]


_print_lock = threading.Lock()


def log(message: str) -> None:
    with _print_lock:
        print(message, flush=True)


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def clean_slug(value: str) -> str:
    return core.slugify(value)


def pretty(value: str) -> str:
    return core.pretty_name(value)


def canonical_startech_category(url: str) -> str:
    p = urlsplit(url.strip())
    if p.scheme not in {"http", "https"} or (p.hostname or "").lower() not in {
        "startech.com.bd",
        "www.startech.com.bd",
    }:
        raise ValueError("Category URL must be a startech.com.bd URL")
    path = "/" + p.path.strip("/")
    return f"https://www.startech.com.bd{path.rstrip('/')}"


def category_url_slug(url: str) -> str:
    path = urlsplit(url).path.strip("/")
    return clean_slug(Path(path).name or "startech-category")


def normalize_input_folder(raw: str, project_root: Path) -> Path:
    value = raw.strip().strip('"').strip("'").replace("\\", "/")
    if not value:
        raise ValueError("Image folder cannot be empty")

    p = Path(value)
    if p.is_absolute() and p.exists():
        return p.resolve()

    value = value.lstrip("/")
    candidates: list[Path] = []
    if value.startswith("public/"):
        candidates.append(project_root / value)
    else:
        candidates.append(project_root / value)
        candidates.append(project_root / "public" / value)
        if value.startswith("images/"):
            candidates.append(project_root / "public" / value)
        elif value.startswith("products/"):
            candidates.append(project_root / "public" / "images" / value)

    for candidate in candidates:
        if candidate.exists() and candidate.is_dir():
            return candidate.resolve()

    tried = "\n  - ".join(str(x) for x in candidates)
    raise FileNotFoundError(f"Image folder not found. Tried:\n  - {tried}")


def guess_image_folder(category_slug: str, project_root: Path) -> Path | None:
    aliases = {
        "desktops": "desktop",
        "desktop": "desktop",
        "laptop-notebook": "laptop",
        "laptop": "laptop",
        "monitor": "monitor",
        "components": "component",
        "component": "component",
        "camera": "camera",
        "networking": "networking",
        "television-shop": "television-shop",
        "tablet-pc": "tablet-pc",
        "office-equipment": "office-equipment",
        "security-camera": "security-camera",
        "server-networking": "server-networking",
        "power": "power",
        "software": "software",
        "gadget": "gadget",
        "gaming": "gaming",
        "appliance": "appliance",
        "accessories": "accessories",
    }
    folder = aliases.get(category_slug, category_slug)
    candidate = project_root / "public" / "images" / "products" / folder
    return candidate.resolve() if candidate.exists() and candidate.is_dir() else None


def public_url_for_file(path: Path, project_root: Path) -> str:
    public_root = (project_root / "public").resolve()
    try:
        rel = path.resolve().relative_to(public_root)
    except ValueError as exc:
        raise ValueError(f"Image must be inside {public_root}: {path}") from exc
    return "/" + rel.as_posix()


def candidate_stems(stem: str) -> list[str]:
    raw = clean_slug(stem)
    values = [raw]
    for pattern in (
        r"-(?:image|img|main|front|primary)$",
        r"-(?:0?[1-9]|1[0-9])$",
    ):
        reduced = re.sub(pattern, "", raw, flags=re.I).strip("-")
        if reduced and reduced not in values:
            values.append(reduced)
    return values


def scan_images(image_root: Path, project_root: Path) -> list[LocalImage]:
    records: list[LocalImage] = []
    for path in sorted(image_root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        rel = path.relative_to(image_root)
        records.append(
            LocalImage(
                disk_path=path,
                public_path=public_url_for_file(path, project_root),
                stem=clean_slug(path.stem),
                rel_dirs=tuple(rel.parts[:-1]),
            )
        )
    return records


def google_candidates(query: str, timeout: int = 20) -> list[tuple[str, str, str]]:
    """Return (url, title, method). URLs are discovery only; details still come from Star Tech."""
    q = f'site:startech.com.bd "{query}"'
    headers = {
        "User-Agent": core.HEADERS["User-Agent"],
        "Accept-Language": "en-US,en;q=0.9",
    }
    found: dict[str, tuple[str, str]] = {}

    api_key = os.getenv("GOOGLE_CSE_API_KEY", "").strip()
    cx = os.getenv("GOOGLE_CSE_CX", "").strip()
    if api_key and cx:
        try:
            r = requests.get(
                "https://www.googleapis.com/customsearch/v1",
                params={"key": api_key, "cx": cx, "q": q, "num": 10},
                headers=headers,
                timeout=timeout,
            )
            r.raise_for_status()
            for item in r.json().get("items", []):
                url = str(item.get("link") or "")
                title = str(item.get("title") or "")
                if _is_startech_url(url):
                    found[url] = (title, "google-cse")
        except Exception:
            pass

    if not found:
        try:
            r = requests.get(
                "https://www.google.com/search",
                params={"q": q, "num": 10, "hl": "en", "filter": "0"},
                headers=headers,
                timeout=timeout,
            )
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            for a in soup.select("a[href]"):
                href = str(a.get("href") or "")
                title = core.clean_text(a.get_text(" ", strip=True))
                url = _extract_google_result_url(href)
                if url and _is_startech_url(url):
                    found[url] = (title, "google-html")
        except Exception:
            pass

    if not found:
        try:
            r = requests.get(
                "https://html.duckduckgo.com/html/",
                params={"q": q},
                headers=headers,
                timeout=timeout,
            )
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            for a in soup.select("a.result__a[href]"):
                href = str(a.get("href") or "")
                title = core.clean_text(a.get_text(" ", strip=True))
                url = _decode_ddg_url(href)
                if url and _is_startech_url(url):
                    found[url] = (title, "duckduckgo-fallback")
        except Exception:
            pass

    out = []
    for url, (title, method) in found.items():
        try:
            out.append((core.canonical_startech_url(url), title, method))
        except Exception:
            continue
    return out


def _is_startech_url(url: str) -> bool:
    host = (urlsplit(url).hostname or "").lower()
    return host in {"startech.com.bd", "www.startech.com.bd"}


def _extract_google_result_url(href: str) -> str | None:
    if href.startswith("/url?"):
        qs = parse_qs(urlsplit(href).query)
        return (qs.get("q") or qs.get("url") or [None])[0]
    if href.startswith("http"):
        return href
    return None


def _decode_ddg_url(href: str) -> str | None:
    if href.startswith("//"):
        href = "https:" + href
    if "duckduckgo.com/l/" in href:
        qs = parse_qs(urlsplit(href).query)
        uddg = (qs.get("uddg") or [None])[0]
        return unquote(uddg) if uddg else None
    return href if href.startswith("http") else None


def resolve_extended(
    client: core.StarTechClient,
    stems: list[str],
    brand_hint: str | None,
    min_internal_score: float,
    min_external_score: float,
    allow_external: bool,
) -> tuple[str | None, BeautifulSoup | None, dict[str, Any]]:
    rejected: list[dict[str, Any]] = []

    for stem in stems:
        url, soup, meta = core.resolve_product_page(
            client,
            stem,
            brand_hint,
            min_internal_score,
        )
        if url and soup:
            meta = dict(meta)
            meta["attemptStem"] = stem
            return url, soup, meta
        rejected.append({"stem": stem, "meta": meta})

    if not allow_external:
        return None, None, {"method": "unmatched", "attempts": rejected}

    external_seen: set[str] = set()
    scored: list[tuple[float, str, str, str, str]] = []
    for stem in stems:
        query = stem.replace("-", " ")
        for url, title, method in google_candidates(query):
            if url in external_seen:
                continue
            external_seen.add(url)
            score = core.candidate_score(stem, url, title, brand_hint)
            scored.append((score, url, title, method, stem))

    scored.sort(key=lambda x: x[0], reverse=True)
    external_audit = [
        {"score": round(s, 4), "url": u, "title": t, "method": m, "stem": st}
        for s, u, t, m, st in scored[:10]
    ]

    for score, url, title, method, stem in scored[:6]:
        if score < min_external_score:
            continue
        try:
            soup = client.soup(url, allow_404=True)
        except Exception:
            continue
        if not core.looks_like_product_page(soup):
            continue
        page_title = core.text_at(soup, "h1") if soup else ""
        verified_score = max(score, core.candidate_score(stem, url, page_title, brand_hint))
        if verified_score < min_external_score:
            continue
        return url, soup, {
            "method": method,
            "score": round(verified_score, 4),
            "query": stem,
            "candidateTitle": title,
            "pageTitle": page_title,
        }

    return None, None, {
        "method": "unmatched",
        "attempts": rejected,
        "externalCandidates": external_audit,
    }


def fuzzy_brand_folder(folder: str, brand_name: str | None) -> bool:
    if not brand_name:
        return False
    f = clean_slug(folder)
    b = clean_slug(brand_name)
    if not f or not b:
        return False
    if f == b or f in b or b in f:
        return True
    return SequenceMatcher(None, f, b).ratio() >= 0.86


def taxonomy_from_local(
    top_slug: str,
    top_name: str,
    images: list[LocalImage],
    scraped_brand: str | None,
) -> tuple[list[tuple[str, str]], str | None, str]:
    # Prefer the deepest path, as it usually contains the most precise hierarchy.
    best = sorted(images, key=lambda x: (len(x.rel_dirs), x.public_path), reverse=True)[0]
    dirs = [d for d in best.rel_dirs if clean_slug(d) not in SPECIAL_DIRS]

    brand_folder: str | None = None
    category_dirs: list[str] = []
    for d in dirs:
        if fuzzy_brand_folder(d, scraped_brand):
            brand_folder = d
            continue
        category_dirs.append(d)

    chain: list[tuple[str, str]] = [(top_slug, top_name)]
    parent_slug = top_slug
    for depth, raw in enumerate(category_dirs):
        part = clean_slug(raw)
        if not part:
            continue
        if depth == 0:
            slug = part
        else:
            slug = clean_slug(f"{parent_slug}-{part}")
        chain.append((slug, pretty(raw)))
        parent_slug = slug

    group_key = clean_slug(category_dirs[0]) if category_dirs else "_direct"
    return chain, brand_folder, group_key


def compact_variant_fields(product: dict[str, Any]) -> None:
    """Keep full specs in specificationGroups, but only variant-like specs in variant options."""
    selected: list[dict[str, Any]] = []
    options: dict[str, str] = {}
    seen: set[str] = set()

    for group in product.get("specificationGroups", []):
        for item in group.get("items", []):
            label = core.clean_text(item.get("label"))
            value = core.clean_text(item.get("value"))
            if not label or not value:
                continue
            key = label.casefold().strip(":")
            if key not in VARIANT_LABEL_HINTS and not any(hint in key for hint in ("color", "capacity", "storage", "ram", "size", "edition", "version")):
                continue
            if key in seen:
                continue
            seen.add(key)
            selected.append(
                {
                    "name": label,
                    "position": len(selected),
                    "values": [{"value": value, "position": 0}],
                }
            )
            options[label] = value

    product["variantOptions"] = selected
    variants = product.get("variants") or []
    if variants:
        variants[0]["options"] = options


def placeholder_product(
    stem: str,
    images: list[LocalImage],
    category_slug: str,
    brand_name: str | None,
    match_meta: dict[str, Any],
) -> dict[str, Any]:
    image = images[0].public_path
    sku = "STARTECH-UNMATCHED-" + hashlib.sha256(stem.encode("utf-8")).hexdigest()[:24].upper()
    return {
        "unmatched": True,
        "name": pretty(stem),
        "slug": clean_slug(stem),
        "type": "PHYSICAL",
        "sku": sku,
        "categorySlug": category_slug,
        "brandName": brand_name,
        "description": "",
        "shortDesc": None,
        "model": None,
        "warranty": None,
        "basePrice": 0.0,
        "originalPrice": None,
        "currency": "BDT",
        "weight": None,
        "dimensions": None,
        "available": False,
        "featured": False,
        "image": image,
        "gallery": [],
        "soldCount": 0,
        "ratingAvg": 0,
        "ratingCount": 0,
        "lowStockThreshold": 10,
        "inventoryItemClass": "CONSUMABLE",
        "requiresAssetTag": False,
        "bundleStockLimit": None,
        "stock": 0,
        "variants": [],
        "variantOptions": [],
        "specificationGroups": [],
        "sourceProductUrl": None,
        "sourceProductCode": None,
        "sourceStatus": None,
        "sourceMpn": None,
        "sourceKeyFeatures": [],
        "needsReview": True,
        "match": match_meta,
        "sourceImages": [x.public_path for x in images],
    }


def work_one(
    stem: str,
    images: list[LocalImage],
    client: core.StarTechClient,
    args: argparse.Namespace,
    top_slug: str,
    top_name: str,
) -> ProductWorkResult:
    brand_hint = None
    if images:
        # Last local folder is often a brand; it is only a hint, never trusted as fact.
        brand_hint = pretty(images[0].rel_dirs[-1]) if images[0].rel_dirs else None

    url, soup, match_meta = resolve_extended(
        client=client,
        stems=candidate_stems(stem),
        brand_hint=brand_hint,
        min_internal_score=args.min_match_score,
        min_external_score=args.min_external_score,
        allow_external=not args.no_google,
    )

    if url and soup:
        product = core.parse_product_page(
            soup,
            url,
            stock=args.stock,
            cost_ratio=args.cost_ratio,
            respect_source_availability=not args.force_available,
        )
        scraped_brand = product.get("brandName")
        chain, brand_folder, group_key = taxonomy_from_local(
            top_slug, top_name, images, scraped_brand
        )
        product["categorySlug"] = chain[-1][0]
        product["brandName"] = scraped_brand or (pretty(brand_folder) if brand_folder else None)
        primary = sorted(images, key=lambda x: (len(x.rel_dirs), x.public_path), reverse=True)[0]
        product["image"] = primary.public_path
        product["gallery"] = []
        product["sourceImages"] = [x.public_path for x in images]
        product["match"] = match_meta
        compact_variant_fields(product)

        if not product.get("available"):
            product["stock"] = 0
            for variant in product.get("variants", []):
                variant["stock"] = 0
                variant["active"] = False

        return ProductWorkResult(
            stem=stem,
            product=product,
            category_chain=chain,
            group_key=group_key,
            matched=True,
            match_meta=match_meta,
            source_images=[x.public_path for x in images],
        )

    chain, brand_folder, group_key = taxonomy_from_local(
        top_slug, top_name, images, brand_hint
    )
    brand_name = pretty(brand_folder) if brand_folder else None
    product = placeholder_product(
        stem=stem,
        images=images,
        category_slug=chain[-1][0],
        brand_name=brand_name,
        match_meta=match_meta,
    )
    return ProductWorkResult(
        stem=stem,
        product=product,
        category_chain=chain,
        group_key=group_key,
        matched=False,
        match_meta=match_meta,
        source_images=[x.public_path for x in images],
    )


def category_records(results: list[ProductWorkResult]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    records: list[dict[str, Any]] = []
    sort_orders: dict[str | None, int] = defaultdict(int)
    image_for: dict[str, str] = {}

    for result in results:
        for slug, _name in result.category_chain:
            image_for.setdefault(slug, result.product.get("image") or result.source_images[0])

    for result in sorted(results, key=lambda r: (len(r.category_chain), r.group_key, r.stem)):
        parent: str | None = None
        for depth, (slug, name) in enumerate(result.category_chain):
            if slug in seen:
                parent = slug
                continue
            seen.add(slug)
            order = sort_orders[parent]
            sort_orders[parent] += 1
            records.append(
                {
                    "name": name,
                    "slug": slug,
                    "parentSlug": parent,
                    "image": image_for.get(slug),
                    "isActive": True,
                    "sortOrder": order,
                    "showInHeader": depth <= 1,
                    "showInFooter": False,
                    "featured": False,
                }
            )
            parent = slug
    return records


def brand_records(results: list[ProductWorkResult]) -> list[dict[str, Any]]:
    seen: dict[str, str] = {}
    for result in results:
        name = core.clean_text(result.product.get("brandName"))
        if not name:
            continue
        seen.setdefault(clean_slug(name), name)
    return [{"name": name, "slug": slug, "logo": None} for slug, name in sorted(seen.items())]


def seed_payload(
    results: list[ProductWorkResult],
    source_category_url: str,
    image_root: Path,
    stock: int,
    cost_ratio: float,
) -> dict[str, Any]:
    categories = category_records(results)
    brands = brand_records(results)
    products = [copy.deepcopy(r.product) for r in results]
    return {
        "schemaVersion": 3,
        "source": {
            "site": BASE,
            "categoryUrl": source_category_url,
            "imageRoot": str(image_root),
            "generatedAtUnix": int(time.time()),
            "generator": "prisma/startech_single_category_json_and_seed.py",
        },
        "defaults": {
            "stock": stock,
            "costRatio": cost_ratio,
            "currency": "BDT",
            "productType": "PHYSICAL",
            "inventoryItemClass": "CONSUMABLE",
        },
        "categories": categories,
        "brands": brands,
        "products": products,
    }


def subset_payload(all_payload: dict[str, Any], results: list[ProductWorkResult]) -> dict[str, Any]:
    needed_categories = {slug for r in results for slug, _ in r.category_chain}
    needed_brands = {
        clean_slug(str(r.product.get("brandName") or ""))
        for r in results
        if r.product.get("brandName")
    }
    payload = copy.deepcopy(all_payload)
    payload["categories"] = [c for c in all_payload["categories"] if c["slug"] in needed_categories]
    payload["brands"] = [b for b in all_payload["brands"] if b["slug"] in needed_brands]
    payload["products"] = [copy.deepcopy(r.product) for r in results]
    return payload


def ensure_startech_seeder(project_root: Path) -> Path:
    target = project_root / "prisma" / "startech-seed" / "index.ts"
    if target.exists():
        return target

    old = project_root / "prisma" / "Store" / "OLD-startech-seed" / "index.ts"
    generated = project_root / "prisma" / "Store" / "seed-startech-generated.ts"
    target.parent.mkdir(parents=True, exist_ok=True)

    if old.exists():
        shutil.copyfile(old, target)
        log(f"BOOTSTRAP seeder -> {target.relative_to(project_root)}")
        return target

    if generated.exists():
        text = generated.read_text(encoding="utf-8")
        # Target lives at prisma/startech-seed/index.ts, so these imports must reach repo root.
        text = text.replace('from "../generated/prisma"', 'from "../../generated/prisma"')
        text = text.replace('from "../lib/product-codes"', 'from "../../lib/product-codes"')
        target.write_text(text, encoding="utf-8")
        log(f"BOOTSTRAP fallback seeder -> {target.relative_to(project_root)}")
        return target

    raise FileNotFoundError(
        "No Star Tech Prisma seeder found. Expected either "
        "prisma/Store/OLD-startech-seed/index.ts or "
        "prisma/Store/seed-startech-generated.ts"
    )


def seed_database(project_root: Path, index_path: Path) -> tuple[int, int, str]:
    seeder = ensure_startech_seeder(project_root)
    npx = shutil.which("npx.cmd") or shutil.which("npx")
    if not npx:
        raise FileNotFoundError("npx was not found. Install Node.js/npm first.")

    cmd = [npx, "tsx", str(seeder.relative_to(project_root)), str(index_path.relative_to(project_root))]
    log("\nSEED COMMAND: " + " ".join(f'"{x}"' if " " in x else x for x in cmd))
    process = subprocess.run(
        cmd,
        cwd=project_root,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        encoding="utf-8",
        errors="replace",
    )
    output = process.stdout or ""
    print(output, end="" if output.endswith("\n") else "\n")
    seeded_count = len(re.findall(r"\]\s+Seeded\s+", output))
    return process.returncode, seeded_count, output


def human_seconds(seconds: float) -> str:
    total = int(round(seconds))
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    return f"{h}h {m}m {s}s"


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("category_url", help="Star Tech category URL, e.g. https://www.startech.com.bd/desktops")
    parser.add_argument("--image-folder", help="Local/public image folder, e.g. /images/products/desktop")
    parser.add_argument("--output-root", default="prisma/StarTec Product Seed", help="Root directory for generated category folders")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--delay", type=float, default=0.25, help="Minimum delay shared by Star Tech requests")
    parser.add_argument("--stock", type=int, default=10, help="Seed stock for matched in-stock products")
    parser.add_argument("--cost-ratio", type=float, default=0.96, help="Default costPrice/basePrice ratio used by repo parser")
    parser.add_argument("--min-match-score", type=float, default=0.72, help="Minimum Star Tech internal-search match score")
    parser.add_argument("--min-external-score", type=float, default=0.72, help="Minimum Google/DDG discovery match score")
    parser.add_argument("--cache-dir", default=".cache/startech-single-category")
    parser.add_argument("--refresh", action="store_true", help="Ignore cached Star Tech HTML")
    parser.add_argument("--no-google", action="store_true", help="Disable Google/DDG fallback discovery")
    parser.add_argument("--no-seed", action="store_true", help="Generate JSON only; do not seed database")
    parser.add_argument("--force-available", action="store_true", help="Mark matched products available even if Star Tech reports unavailable")
    args = parser.parse_args()

    if args.workers < 1:
        parser.error("--workers must be >= 1")
    if args.delay < 0:
        parser.error("--delay must be >= 0")
    if args.stock < 0:
        parser.error("--stock must be >= 0")
    if not (0 <= args.cost_ratio <= 2):
        parser.error("--cost-ratio must be between 0 and 2")

    started = time.perf_counter()
    category_url = canonical_startech_category(args.category_url)
    url_slug = category_url_slug(category_url)

    if args.image_folder:
        image_root = normalize_input_folder(args.image_folder, PROJECT_ROOT)
    else:
        guessed = guess_image_folder(url_slug, PROJECT_ROOT)
        prompt = "Image folder"
        if guessed:
            display = "/" + guessed.relative_to(PROJECT_ROOT / "public").as_posix()
            prompt += f" [{display}]"
        prompt += ": "
        raw = input(prompt).strip()
        if not raw and guessed:
            image_root = guessed
        else:
            image_root = normalize_input_folder(raw, PROJECT_ROOT)

    public_products_root = (PROJECT_ROOT / "public" / "images" / "products").resolve()
    try:
        image_root.relative_to(public_products_root)
    except ValueError as exc:
        raise SystemExit(
            f"Image folder must be under {public_products_root}. Got: {image_root}"
        ) from exc

    top_slug = clean_slug(image_root.name)
    top_name = pretty(image_root.name)
    images = scan_images(image_root, PROJECT_ROOT)
    if not images:
        raise SystemExit(f"No product images found under {image_root}")

    grouped: dict[str, list[LocalImage]] = defaultdict(list)
    for image in images:
        grouped[image.stem].append(image)

    out_dir = (PROJECT_ROOT / args.output_root / url_slug).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    cache_dir = (PROJECT_ROOT / args.cache_dir / url_slug).resolve()
    client = core.StarTechClient(
        cache_dir=cache_dir,
        delay=args.delay,
        refresh=args.refresh,
        timeout=45,
    )

    log("\nSTAR TECH SINGLE CATEGORY JSON + SEED")
    log(f"Category URL:       {category_url}")
    log(f"Image folder:       {image_root}")
    log(f"Images found:       {len(images)}")
    log(f"Unique file stems:  {len(grouped)}")
    log(f"Output:             {out_dir}")
    log(f"Workers:            {args.workers}")
    log(f"Google fallback:    {'OFF' if args.no_google else 'ON'}")
    log("")

    results: list[ProductWorkResult] = []
    done = 0
    checkpoint = out_dir / "progress.json"

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(
                work_one,
                stem,
                records,
                client,
                args,
                top_slug,
                top_name,
            ): stem
            for stem, records in sorted(grouped.items())
        }
        for future in as_completed(futures):
            stem = futures[future]
            done += 1
            try:
                result = future.result()
            except Exception as exc:
                # Preserve coverage even on unexpected parser/network errors.
                records = grouped[stem]
                chain, brand_folder, group_key = taxonomy_from_local(
                    top_slug, top_name, records, None
                )
                meta = {"method": "exception", "error": str(exc)}
                product = placeholder_product(
                    stem,
                    records,
                    chain[-1][0],
                    pretty(brand_folder) if brand_folder else None,
                    meta,
                )
                result = ProductWorkResult(
                    stem=stem,
                    product=product,
                    category_chain=chain,
                    group_key=group_key,
                    matched=False,
                    match_meta=meta,
                    source_images=[x.public_path for x in records],
                )

            results.append(result)
            marker = "OK" if result.matched else "REVIEW"
            method = result.match_meta.get("method", "unknown")
            log(f"[{done:>4}/{len(grouped)}] {marker:<6} {stem} ({method})")

            atomic_json(
                checkpoint,
                {
                    "categoryUrl": category_url,
                    "imagesFound": len(images),
                    "uniqueStems": len(grouped),
                    "processed": done,
                    "matched": sum(1 for x in results if x.matched),
                    "unmatched": sum(1 for x in results if not x.matched),
                    "updatedAtUnix": int(time.time()),
                },
            )

    results.sort(key=lambda r: (r.group_key, r.stem))
    all_payload = seed_payload(
        results,
        source_category_url=category_url,
        image_root=image_root,
        stock=args.stock,
        cost_ratio=args.cost_ratio,
    )

    all_file = out_dir / "_all.json"
    atomic_json(all_file, all_payload)

    by_group: dict[str, list[ProductWorkResult]] = defaultdict(list)
    for result in results:
        by_group[result.group_key].append(result)

    index_groups = []
    generated_files = []
    for group_key, group_results in sorted(by_group.items()):
        file_name = f"{group_key}.json"
        group_file = out_dir / file_name
        atomic_json(group_file, subset_payload(all_payload, group_results))
        generated_files.append(group_file)
        index_groups.append(
            {
                "name": group_key,
                "file": file_name,
                "status": "completed",
                "products": len(group_results),
                "matched": sum(1 for x in group_results if x.matched),
                "unmatched": sum(1 for x in group_results if not x.matched),
            }
        )

    index_payload = {
        "schemaVersion": 1,
        "sourceCategoryUrl": category_url,
        "imageFolder": public_url_for_file(next(iter(grouped.values()))[0].disk_path, PROJECT_ROOT).rsplit("/", 1)[0],
        "groups": index_groups,
        "allFile": "_all.json",
        "generatedAtUnix": int(time.time()),
    }
    index_file = out_dir / "index.json"
    atomic_json(index_file, index_payload)

    unmatched = [
        {
            "stem": r.stem,
            "images": r.source_images,
            "categorySlug": r.product.get("categorySlug"),
            "brandName": r.product.get("brandName"),
            "match": r.match_meta,
        }
        for r in results
        if not r.matched
    ]
    unmatched_file = out_dir / "unmatched.json"
    atomic_json(unmatched_file, unmatched)

    match_methods = Counter(str(r.match_meta.get("method", "unknown")) for r in results)
    generated_seconds = time.perf_counter() - started
    report: dict[str, Any] = {
        "status": "json-generated",
        "categoryUrl": category_url,
        "imageRoot": str(image_root),
        "outputDir": str(out_dir),
        "imagesFound": len(images),
        "uniqueProductStems": len(grouped),
        "productsInJson": len(results),
        "matchedProducts": sum(1 for r in results if r.matched),
        "unmatchedProducts": len(unmatched),
        "imageCoverage": len({img for r in results for img in r.source_images}),
        "jsonGroupFiles": len(generated_files),
        "matchMethods": dict(match_methods),
        "jsonGenerationTimeSeconds": round(generated_seconds, 2),
        "seedAttempted": False,
        "seedExitCode": None,
        "seededProductsFromConsole": 0,
        "seedSucceeded": False,
        "files": {
            "index": str(index_file),
            "all": str(all_file),
            "unmatched": str(unmatched_file),
        },
    }

    report_file = out_dir / "report.json"
    atomic_json(report_file, report)

    seed_exit = 0
    if not args.no_seed:
        report["seedAttempted"] = True
        try:
            seed_started = time.perf_counter()
            seed_exit, seeded_count, _seed_output = seed_database(PROJECT_ROOT, index_file)
            report["seedExitCode"] = seed_exit
            report["seededProductsFromConsole"] = seeded_count
            report["seedSucceeded"] = seed_exit == 0
            report["seedTimeSeconds"] = round(time.perf_counter() - seed_started, 2)
            report["status"] = "completed" if seed_exit == 0 else "seed-failed"
        except Exception as exc:
            seed_exit = 2
            report["seedExitCode"] = seed_exit
            report["seedSucceeded"] = False
            report["seedError"] = str(exc)
            report["status"] = "seed-failed"
            log(f"SEED ERROR: {exc}")
        atomic_json(report_file, report)

    total_seconds = time.perf_counter() - started
    log("\n" + "=" * 72)
    log("FINAL REPORT")
    log("=" * 72)
    log(f"Images scanned:             {len(images)}")
    log(f"Unique product stems:       {len(grouped)}")
    log(f"Products written to JSON:   {len(results)}")
    log(f"Matched full details:       {sum(1 for r in results if r.matched)}")
    log(f"Needs manual review:        {len(unmatched)}")
    log(f"Image coverage:             {report['imageCoverage']}/{len(images)}")
    log(f"Subcategory JSON files:     {len(generated_files)}")
    log(f"Seed attempted:             {report['seedAttempted']}")
    log(f"Seed success:               {report['seedSucceeded']}")
    log(f"Seeded console count:       {report['seededProductsFromConsole']}")
    log(f"Time taken:                 {human_seconds(total_seconds)}")
    log(f"Index:                      {index_file}")
    log(f"Combined JSON:              {all_file}")
    log(f"Unmatched report:           {unmatched_file}")
    log(f"Full report:                {report_file}")
    log("=" * 72)

    # JSON generation itself is successful even when review items exist.
    # A database seed failure is returned as non-zero so CI/terminal notices it.
    return seed_exit if (not args.no_seed and seed_exit != 0) else 0


if __name__ == "__main__":
    raise SystemExit(main())
