#!/usr/bin/env python3
"""
Build grocery seed JSON files from local product images.

Designed for a general_ecommerce repository with images under:
    public/images/products/groceries

Output is compatible with the JSON shape used by the existing StarTech seeder:
    {
      "schemaVersion": 3,
      "categories": [...],
      "brands": [...],
      "products": [...]
    }

Default grocery taxonomy:
    Groceries
      - Rice
      - Lentil
      - Soyabean Oil
      - Atta
      - Salt
      - Sugar
      - Milk Powder
      - Turmeric Powder
      - Chilli Powder
      - Coriander Powder
      - Mustard Oil
      - Detergent - Rin
      - Surf Excel
      - Laundry Soap
      - Bathing Soap
      - Hand Wash
      - Toothpaste
      - Dish Wash
      - Toilet Cleaner
      - Onion
      - Ginger
      - Garlic
      - Honey
      - Isopgul

How matching works:
1. Scan every image recursively.
2. Determine subcategory from folder name first, then image filename/OCR keywords.
3. Build a search query from image filename + optional OCR text.
4. Discover candidate pages with Google Custom Search (if configured) or DuckDuckGo.
5. Parse Product JSON-LD / meta tags / page text from the selected page.
6. Never invent a missing price. Unresolved products are written as inactive placeholders.
7. Write one JSON per subcategory plus _all.json, index.json, unmatched.json, report.json.

Dependencies:
    python -m pip install requests beautifulsoup4 pillow

Optional OCR:
    python -m pip install pytesseract
    # Also install the Tesseract executable on Windows and make it available in PATH.

Optional Google Custom Search environment variables:
    GOOGLE_CSE_API_KEY
    GOOGLE_CSE_CX

Typical use from repository root:
    python prisma/groceries_json_builder.py

Or:
    python prisma/groceries_json_builder.py --image-folder public/images/products/groceries

JSON only, no OCR:
    python prisma/groceries_json_builder.py --no-ocr

Skip web lookup and create review placeholders from local images only:
    python prisma/groceries_json_builder.py --no-search
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import threading
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import parse_qs, quote_plus, unquote, urljoin, urlsplit

import requests
from bs4 import BeautifulSoup
from PIL import Image


PROJECT_ROOT = Path.cwd().resolve()
DEFAULT_IMAGE_ROOT = PROJECT_ROOT / "public" / "images" / "products" / "groceries"
DEFAULT_OUTPUT_ROOT = PROJECT_ROOT / "prisma" / "Grocery Product Seed" / "groceries"
DEFAULT_CACHE_ROOT = PROJECT_ROOT / ".cache" / "groceries-json-builder"

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".bmp"}

PARENT_CATEGORY = {"name": "Groceries", "slug": "groceries"}

SUBCATEGORIES = [
    ("rice", "Rice"),
    ("lentil", "Lentil"),
    ("soyabean-oil", "Soyabean Oil"),
    ("atta", "Atta"),
    ("salt", "Salt"),
    ("sugar", "Sugar"),
    ("milk-powder", "Milk Powder"),
    ("turmeric-powder", "Turmeric Powder"),
    ("chilli-powder", "Chilli Powder"),
    ("coriander-powder", "Coriander Powder"),
    ("mustard-oil", "Mustard Oil"),
    ("detergent-rin", "Detergent - Rin"),
    ("surf-excel", "Surf Excel"),
    ("laundry-soap", "Laundry Soap"),
    ("bathing-soap", "Bathing Soap"),
    ("hand-wash", "Hand Wash"),
    ("toothpaste", "Toothpaste"),
    ("dish-wash", "Dish Wash"),
    ("toilet-cleaner", "Toilet Cleaner"),
    ("onion", "Onion"),
    ("ginger", "Ginger"),
    ("garlic", "Garlic"),
    ("honey", "Honey"),
    ("isopgul", "Isopgul"),
]

SUBCATEGORY_NAMES = dict(SUBCATEGORIES)

# Synonyms are intentionally broad enough for common Bangladeshi package names,
# but category assignment still prefers the local folder name when available.
CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "rice": ("rice", "chinigura", "miniket", "basmati", "chal"),
    "lentil": ("lentil", "dal", "daal", "moshur", "masoor"),
    "soyabean-oil": ("soyabean", "soybean", "soya oil", "soy oil"),
    "atta": ("atta", "whole wheat flour", "wheat flour"),
    "salt": ("salt", "iodized salt", "iodised salt", "lobon"),
    "sugar": ("sugar", "refined sugar", "chini"),
    "milk-powder": ("milk powder", "full cream milk", "powder milk"),
    "turmeric-powder": ("turmeric", "halud", "holud"),
    "chilli-powder": ("chilli powder", "chili powder", "red chilli", "morich"),
    "coriander-powder": ("coriander", "dhonia", "dhania"),
    "mustard-oil": ("mustard oil", "sorisha oil", "sarisha oil"),
    "detergent-rin": ("rin", "detergent", "washing powder", "saf detergent", "white wash"),
    "surf-excel": ("surf excel", "surf-excel"),
    "laundry-soap": ("laundry soap", "laundry bar", "washing soap", "saf laundry"),
    "bathing-soap": ("bathing soap", "beauty soap", "toilet soap", "regina soap", "soap bar"),
    "hand-wash": ("hand wash", "handwash", "careplus hand"),
    "toothpaste": ("toothpaste", "tooth paste"),
    "dish-wash": ("dish wash", "dishwash", "dish washing", "eazy liquid"),
    "toilet-cleaner": ("toilet cleaner", "toilet cleaning", "ok toilet"),
    "onion": ("onion", "peyaj", "pyaj"),
    "ginger": ("ginger", "ada"),
    "garlic": ("garlic", "rosun", "roshun"),
    "honey": ("honey", "modhu", "madhu"),
    "isopgul": ("isopgul", "isabgol", "ispaghula", "psyllium", "sat isapgol"),
}

KNOWN_BRANDS = [
    "Pusti",
    "Pusti Glory",
    "Pusti Happy Time",
    "Family",
    "TEER",
    "Fresh",
    "Super Fresh",
    "Saf",
    "Regina",
    "CarePlus",
    "Eazy",
    "OK",
    "Rin",
    "Surf Excel",
    "Birds of Eden",
    "BOED",
]

# Manufacturer / group pages receive the strongest score bonus.
OFFICIAL_DOMAINS = {
    "pusti.com.bd",
    "www.pusti.com.bd",
    "pustiglory.com",
    "www.pustiglory.com",
    "tkfoodsbd.com",
    "www.tkfoodsbd.com",
    "primecosmeticsbd.com",
    "www.primecosmeticsbd.com",
    "citygroup.com.bd",
    "www.citygroup.com.bd",
    "mgi.org",
    "www.mgi.org",
}

# Useful Bangladesh retail fallback sites. They may contain price/SKU/pack details
# when the manufacturer page does not expose a Product schema.
RETAIL_DOMAINS = {
    "chaldal.com",
    "www.chaldal.com",
    "arogga.com",
    "www.arogga.com",
    "shwapno.com",
    "www.shwapno.com",
    "supershop.com.bd",
    "www.supershop.com.bd",
    "esomahar.com",
    "www.esomahar.com",
}

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/154.0.0.0 Safari/537.36"
)

_print_lock = threading.Lock()


def log(message: str) -> None:
    with _print_lock:
        print(message, flush=True)


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def slugify(value: str) -> str:
    value = clean_text(value).lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "unknown"


def pretty_name(value: str) -> str:
    value = value.replace("_", " ").replace("-", " ")
    value = re.sub(r"\s+", " ", value).strip()
    small = {"of", "and", "or", "the"}
    parts = []
    for i, word in enumerate(value.split()):
        if i and word.lower() in small:
            parts.append(word.lower())
        elif word.lower() in {"kg", "ml", "ltr", "lt", "pcs"}:
            parts.append(word.upper())
        else:
            parts.append(word[:1].upper() + word[1:])
    return " ".join(parts)


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=path.parent,
        prefix=path.name + ".",
        suffix=".tmp",
        delete=False,
    ) as handle:
        tmp = Path(handle.name)
        handle.write(payload)

    for attempt in range(10):
        try:
            tmp.replace(path)
            return
        except OSError as exc:
            transient = os.name == "nt" and getattr(exc, "winerror", None) in {5, 32, 33}
            if not transient or attempt == 9:
                exc.add_note(f"Unsaved JSON retained at: {tmp}")
                raise
            time.sleep(min(0.1 * (2**attempt), 2.0))


def normalize_input_folder(raw: str) -> Path:
    value = raw.strip().strip('"').strip("'").replace("\\", "/")
    if not value:
        raise ValueError("Image folder cannot be empty")

    p = Path(value)
    if p.is_absolute() and p.exists() and p.is_dir():
        return p.resolve()

    candidate = (PROJECT_ROOT / value.lstrip("/")).resolve()
    if candidate.exists() and candidate.is_dir():
        return candidate

    public_candidate = (PROJECT_ROOT / "public" / value.lstrip("/")).resolve()
    if public_candidate.exists() and public_candidate.is_dir():
        return public_candidate

    raise FileNotFoundError(f"Image folder not found: {raw}")


def public_url_for_file(path: Path) -> str:
    public_root = (PROJECT_ROOT / "public").resolve()
    try:
        rel = path.resolve().relative_to(public_root)
    except ValueError as exc:
        raise ValueError(f"Image must be inside {public_root}: {path}") from exc
    return "/" + rel.as_posix()


@dataclass(frozen=True)
class LocalImage:
    disk_path: Path
    public_path: str
    stem: str
    rel_dirs: tuple[str, ...]


@dataclass
class SearchCandidate:
    url: str
    title: str
    method: str
    score: float = 0.0


@dataclass
class ProductResult:
    key: str
    subcategory_slug: str
    images: list[LocalImage]
    product: dict[str, Any]
    matched: bool
    match_meta: dict[str, Any]


def scan_images(image_root: Path) -> list[LocalImage]:
    rows: list[LocalImage] = []
    for path in sorted(image_root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        rel = path.relative_to(image_root)
        rows.append(
            LocalImage(
                disk_path=path,
                public_path=public_url_for_file(path),
                stem=slugify(path.stem),
                rel_dirs=tuple(rel.parts[:-1]),
            )
        )
    return rows


def normalize_category_token(value: str) -> str:
    return slugify(value)


def category_from_text(text: str) -> tuple[str | None, float]:
    haystack = " " + clean_text(text).lower().replace("-", " ") + " "
    best_slug: str | None = None
    best_score = 0.0
    for slug, keywords in CATEGORY_KEYWORDS.items():
        score = 0.0
        for kw in keywords:
            kw_norm = kw.lower().replace("-", " ")
            if f" {kw_norm} " in haystack:
                score = max(score, 1.0 + min(len(kw_norm) / 50.0, 0.25))
            elif kw_norm in haystack:
                score = max(score, 0.8 + min(len(kw_norm) / 60.0, 0.2))
        if score > best_score:
            best_slug, best_score = slug, score
    return best_slug, best_score


def category_from_image(image: LocalImage, ocr_text: str = "") -> tuple[str, dict[str, Any]]:
    # 1. Exact/near folder match has highest priority.
    folder_scores: list[tuple[float, str, str]] = []
    for raw in image.rel_dirs:
        token = normalize_category_token(raw)
        for slug, name in SUBCATEGORIES:
            direct = 1.0 if token == slug else SequenceMatcher(None, token, slug).ratio()
            name_score = SequenceMatcher(None, token, slugify(name)).ratio()
            score = max(direct, name_score)
            if score >= 0.84:
                folder_scores.append((score, slug, raw))
    if folder_scores:
        score, slug, raw = max(folder_scores)
        return slug, {"method": "folder", "source": raw, "score": round(score, 4)}

    # 2. Filename + OCR keywords.
    text = " ".join([image.stem.replace("-", " "), ocr_text])
    slug, score = category_from_text(text)
    if slug:
        return slug, {"method": "text", "source": text[:500], "score": round(score, 4)}

    return "unclassified", {"method": "unclassified", "source": text[:500], "score": 0.0}


def candidate_name_from_stem(stem: str) -> str:
    text = stem.replace("-", " ")
    # Drop common local file suffixes without deleting useful pack-size numbers.
    text = re.sub(r"\b(?:image|img|front|back|main|primary|photo)\b", " ", text, flags=re.I)
    text = re.sub(r"\s+", " ", text).strip()
    return pretty_name(text)


def detect_brand(text: str) -> str | None:
    haystack = clean_text(text).lower()
    # Longest name first prevents "Fresh" from winning over "Super Fresh".
    for brand in sorted(KNOWN_BRANDS, key=len, reverse=True):
        if brand.lower() in haystack:
            return "Birds of Eden" if brand == "BOED" else brand
    return None


PACK_RE = re.compile(
    r"(?<!\w)(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|g|gm|grams?|l|lt|ltr|litre|liter|litres|liters|ml|pcs?|pieces?)(?!\w)",
    re.I,
)


def normalize_pack_size(text: str) -> str | None:
    match = PACK_RE.search(clean_text(text))
    if not match:
        return None
    number = match.group(1)
    unit = match.group(2).lower()
    unit_map = {
        "kgs": "kg",
        "kilogram": "kg",
        "kilograms": "kg",
        "gm": "g",
        "gram": "g",
        "grams": "g",
        "lt": "L",
        "ltr": "L",
        "litre": "L",
        "liter": "L",
        "litres": "L",
        "liters": "L",
        "l": "L",
        "piece": "pc",
        "pieces": "pc",
        "pcs": "pc",
        "pc": "pc",
    }
    unit = unit_map.get(unit, unit)
    return f"{number} {unit}"


def weight_kg_from_pack(pack: str | None) -> float | None:
    if not pack:
        return None
    m = re.match(r"^(\d+(?:\.\d+)?)\s*(kg|g)$", pack, re.I)
    if not m:
        return None
    n = float(m.group(1))
    return n if m.group(2).lower() == "kg" else n / 1000.0


def try_ocr(path: Path, enabled: bool) -> str:
    if not enabled:
        return ""
    try:
        import pytesseract  # type: ignore
    except Exception:
        return ""
    try:
        with Image.open(path) as im:
            # Upscaling improves label OCR on small catalog images.
            im = im.convert("RGB")
            max_side = max(im.size)
            if max_side < 1400:
                scale = 1400 / max_side
                im = im.resize((int(im.width * scale), int(im.height * scale)))
            text = pytesseract.image_to_string(im, config="--psm 6")
            return clean_text(text)[:1200]
    except Exception:
        return ""


def _decode_ddg_url(href: str) -> str | None:
    if href.startswith("//"):
        href = "https:" + href
    if "duckduckgo.com/l/" in href:
        qs = parse_qs(urlsplit(href).query)
        uddg = (qs.get("uddg") or [None])[0]
        return unquote(uddg) if uddg else None
    return href if href.startswith("http") else None


def search_candidates(query: str, timeout: int = 20) -> list[SearchCandidate]:
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"}
    found: dict[str, SearchCandidate] = {}

    api_key = os.getenv("GOOGLE_CSE_API_KEY", "").strip()
    cx = os.getenv("GOOGLE_CSE_CX", "").strip()
    if api_key and cx:
        try:
            r = requests.get(
                "https://www.googleapis.com/customsearch/v1",
                params={"key": api_key, "cx": cx, "q": query, "num": 10},
                headers=headers,
                timeout=timeout,
            )
            r.raise_for_status()
            for item in r.json().get("items", []):
                url = clean_text(item.get("link"))
                title = clean_text(item.get("title"))
                if url.startswith("http"):
                    found[url] = SearchCandidate(url=url, title=title, method="google-cse")
        except Exception:
            pass

    if not found:
        try:
            r = requests.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers=headers,
                timeout=timeout,
            )
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            for a in soup.select("a.result__a[href]"):
                url = _decode_ddg_url(clean_text(a.get("href")))
                title = clean_text(a.get_text(" ", strip=True))
                if url and url.startswith("http"):
                    found[url] = SearchCandidate(url=url, title=title, method="duckduckgo")
        except Exception:
            pass

    return list(found.values())


def token_set(text: str) -> set[str]:
    return {
        x
        for x in re.findall(r"[a-z0-9]+", clean_text(text).lower())
        if len(x) > 1 and x not in {"the", "and", "for", "with", "buy", "online", "bangladesh", "bd"}
    }


def score_candidate(query: str, candidate: SearchCandidate, subcategory_slug: str, brand_hint: str | None) -> float:
    q_tokens = token_set(query)
    title_tokens = token_set(candidate.title)
    overlap = len(q_tokens & title_tokens) / max(1, len(q_tokens))
    sequence = SequenceMatcher(None, slugify(query), slugify(candidate.title)).ratio()
    score = 0.55 * overlap + 0.35 * sequence

    host = (urlsplit(candidate.url).hostname or "").lower()
    if host in OFFICIAL_DOMAINS:
        score += 0.18
    elif host in RETAIL_DOMAINS:
        score += 0.08

    if brand_hint and brand_hint.lower() in candidate.title.lower():
        score += 0.12

    sub_name = SUBCATEGORY_NAMES.get(subcategory_slug, subcategory_slug)
    if any(kw.lower() in candidate.title.lower() for kw in CATEGORY_KEYWORDS.get(subcategory_slug, (sub_name,))):
        score += 0.08

    candidate.score = min(score, 1.0)
    return candidate.score


def cache_path_for_url(cache_root: Path, url: str) -> Path:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
    return cache_root / f"{digest}.html"


def fetch_html(url: str, cache_root: Path, refresh: bool, timeout: int = 30) -> str | None:
    cache = cache_path_for_url(cache_root, url)
    if cache.exists() and not refresh:
        try:
            return cache.read_text(encoding="utf-8", errors="replace")
        except Exception:
            pass

    try:
        r = requests.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"},
            timeout=timeout,
            allow_redirects=True,
        )
        if r.status_code >= 400:
            return None
        text = r.text
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(text, encoding="utf-8", errors="replace")
        return text
    except Exception:
        return None


def iter_jsonld_objects(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        graph = value.get("@graph")
        if isinstance(graph, list):
            for item in graph:
                yield from iter_jsonld_objects(item)
        elif isinstance(graph, dict):
            yield from iter_jsonld_objects(graph)
    elif isinstance(value, list):
        for item in value:
            yield from iter_jsonld_objects(item)


def is_product_jsonld(obj: dict[str, Any]) -> bool:
    t = obj.get("@type")
    if isinstance(t, str):
        return t.lower() == "product"
    if isinstance(t, list):
        return any(str(x).lower() == "product" for x in t)
    return False


def parse_jsonld_product(soup: BeautifulSoup) -> dict[str, Any] | None:
    for script in soup.select('script[type="application/ld+json"]'):
        raw = script.string or script.get_text("", strip=True)
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue
        for obj in iter_jsonld_objects(data):
            if is_product_jsonld(obj):
                return obj
    return None


def meta_content(soup: BeautifulSoup, *selectors: tuple[str, str]) -> str:
    for attr, value in selectors:
        tag = soup.find("meta", attrs={attr: value})
        if tag and tag.get("content"):
            return clean_text(tag.get("content"))
    return ""


def first_text(soup: BeautifulSoup, selectors: list[str]) -> str:
    for selector in selectors:
        node = soup.select_one(selector)
        if node:
            text = clean_text(node.get_text(" ", strip=True))
            if text:
                return text
    return ""


def numeric_price(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = clean_text(value).replace(",", "")
    m = re.search(r"(?:BDT|Tk\.?|Taka|৳)?\s*(\d+(?:\.\d{1,2})?)", text, re.I)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def parse_offer(offers: Any) -> tuple[float | None, str, bool | None]:
    if isinstance(offers, list):
        offers = next((x for x in offers if isinstance(x, dict)), None)
    if not isinstance(offers, dict):
        return None, "BDT", None

    price = numeric_price(offers.get("price") or offers.get("lowPrice"))
    currency = clean_text(offers.get("priceCurrency")) or "BDT"
    availability = clean_text(offers.get("availability")).lower()
    if not availability:
        available = None
    elif "instock" in availability or "in_stock" in availability:
        available = True
    elif "outofstock" in availability or "out_of_stock" in availability:
        available = False
    else:
        available = None
    return price, currency, available


def parse_page_product(url: str, html: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    product = parse_jsonld_product(soup)

    name = ""
    description = ""
    sku = ""
    brand = ""
    model = ""
    price: float | None = None
    currency = "BDT"
    available: bool | None = None

    if product:
        name = clean_text(product.get("name"))
        description = clean_text(product.get("description"))
        sku = clean_text(product.get("sku") or product.get("mpn") or product.get("productID"))
        model = clean_text(product.get("model"))
        raw_brand = product.get("brand")
        if isinstance(raw_brand, dict):
            brand = clean_text(raw_brand.get("name"))
        else:
            brand = clean_text(raw_brand)
        price, currency, available = parse_offer(product.get("offers"))

    name = name or meta_content(soup, ("property", "og:title"), ("name", "twitter:title"))
    name = name or first_text(soup, ["h1", ".product-title", ".product-name", "title"])

    description = description or meta_content(
        soup,
        ("name", "description"),
        ("property", "og:description"),
        ("name", "twitter:description"),
    )

    if price is None:
        price_meta = meta_content(
            soup,
            ("property", "product:price:amount"),
            ("itemprop", "price"),
        )
        price = numeric_price(price_meta)

    if not brand:
        text_for_brand = " ".join([name, description, first_text(soup, ["body"])[:2000]])
        brand = detect_brand(text_for_brand) or ""

    page_text = clean_text(soup.get_text(" ", strip=True))[:12000]
    pack_size = normalize_pack_size(" ".join([name, description, page_text]))

    return {
        "name": name,
        "description": description,
        "sku": sku,
        "brand": brand,
        "model": model,
        "price": price,
        "currency": currency or "BDT",
        "available": available,
        "packSize": pack_size,
        "hasProductJsonLd": product is not None,
        "pageTitle": clean_text(soup.title.get_text(" ", strip=True)) if soup.title else "",
        "sourceUrl": url,
    }


def make_stable_sku(prefix: str, identity: str) -> str:
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:20].upper()
    return f"{prefix}-{digest}"


def short_description(description: str, fallback_name: str) -> str | None:
    text = clean_text(description)
    if not text:
        return f"Grocery product: {fallback_name}."
    return text[:240]


def product_quality_score(local_query: str, page: dict[str, Any], candidate_score: float, brand_hint: str | None) -> float:
    name = clean_text(page.get("name"))
    if not name:
        return 0.0

    q_tokens = token_set(local_query)
    n_tokens = token_set(name)
    overlap = len(q_tokens & n_tokens) / max(1, len(q_tokens))
    seq = SequenceMatcher(None, slugify(local_query), slugify(name)).ratio()
    score = 0.35 * candidate_score + 0.35 * overlap + 0.25 * seq

    if page.get("hasProductJsonLd"):
        score += 0.08
    if brand_hint and brand_hint.lower() in (page.get("brand") or name).lower():
        score += 0.08
    return min(score, 1.0)


def build_query(image: LocalImage, subcategory_slug: str, ocr_text: str) -> tuple[str, str | None, str | None]:
    local_name = candidate_name_from_stem(image.stem)
    combined = " ".join([local_name, ocr_text])
    brand_hint = detect_brand(combined)
    pack_hint = normalize_pack_size(combined)
    category_name = SUBCATEGORY_NAMES.get(subcategory_slug, subcategory_slug)

    parts = []
    if brand_hint:
        parts.append(brand_hint)
    parts.append(local_name)
    if category_name.lower() not in local_name.lower():
        parts.append(category_name)
    if pack_hint and pack_hint.lower() not in local_name.lower():
        parts.append(pack_hint)
    parts.append("Bangladesh")

    query = clean_text(" ".join(parts))
    return query, brand_hint, pack_hint


def match_online_product(
    image: LocalImage,
    subcategory_slug: str,
    ocr_text: str,
    cache_root: Path,
    refresh: bool,
    min_score: float,
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    query, brand_hint, pack_hint = build_query(image, subcategory_slug, ocr_text)
    candidates = search_candidates(query)
    for c in candidates:
        score_candidate(query, c, subcategory_slug, brand_hint)
    candidates.sort(key=lambda x: x.score, reverse=True)

    audit: list[dict[str, Any]] = []
    best_page: dict[str, Any] | None = None
    best_meta: dict[str, Any] | None = None
    best_score = 0.0

    for candidate in candidates[:8]:
        if candidate.score < max(0.30, min_score - 0.25):
            continue
        html = fetch_html(candidate.url, cache_root, refresh)
        if not html:
            audit.append({"url": candidate.url, "title": candidate.title, "score": round(candidate.score, 4), "fetch": "failed"})
            continue
        page = parse_page_product(candidate.url, html)
        quality = product_quality_score(query, page, candidate.score, brand_hint)
        audit.append(
            {
                "url": candidate.url,
                "title": candidate.title,
                "candidateScore": round(candidate.score, 4),
                "qualityScore": round(quality, 4),
                "pageName": page.get("name"),
                "brand": page.get("brand"),
                "packSize": page.get("packSize"),
            }
        )
        if quality > best_score:
            best_score = quality
            best_page = page
            best_meta = {
                "method": candidate.method,
                "query": query,
                "candidateTitle": candidate.title,
                "candidateScore": round(candidate.score, 4),
                "qualityScore": round(quality, 4),
                "brandHint": brand_hint,
                "packHint": pack_hint,
            }

    if best_page and best_score >= min_score:
        meta = dict(best_meta or {})
        meta["candidates"] = audit
        return best_page, meta

    return None, {
        "method": "unmatched",
        "query": query,
        "brandHint": brand_hint,
        "packHint": pack_hint,
        "bestScore": round(best_score, 4),
        "candidates": audit,
    }


def local_boed_product(image: LocalImage, subcategory_slug: str, ocr_text: str) -> dict[str, Any] | None:
    combined = " ".join([image.stem.replace("-", " "), ocr_text]).lower()
    is_boed = any(x in combined for x in ("birds of eden", "birds-of-eden", "boed"))
    if not is_boed or subcategory_slug not in {"onion", "ginger", "garlic"}:
        return None

    name_map = {
        "onion": "Birds of Eden Fresh Onion",
        "ginger": "Birds of Eden Fresh Ginger",
        "garlic": "Birds of Eden Fresh Garlic",
    }
    pack = normalize_pack_size(combined)
    return {
        "name": f"{name_map[subcategory_slug]} {pack}" if pack else name_map[subcategory_slug],
        "description": f"Fresh {SUBCATEGORY_NAMES[subcategory_slug].lower()} packaged by Birds of Eden.",
        "sku": "",
        "brand": "Birds of Eden",
        "model": "",
        "price": None,
        "currency": "BDT",
        "available": None,
        "packSize": pack,
        "hasProductJsonLd": False,
        "pageTitle": "",
        "sourceUrl": None,
        "localOnly": True,
    }


def make_product(
    image_group: list[LocalImage],
    subcategory_slug: str,
    page: dict[str, Any] | None,
    match_meta: dict[str, Any],
    stock: int,
    available_without_price: bool,
) -> tuple[dict[str, Any], bool]:
    primary = sorted(image_group, key=lambda x: x.public_path)[0]
    local_name = candidate_name_from_stem(primary.stem)
    page = page or {}

    matched = bool(page)
    name = clean_text(page.get("name")) or local_name
    brand = clean_text(page.get("brand")) or detect_brand(local_name) or None
    pack_size = clean_text(page.get("packSize")) or normalize_pack_size(local_name)
    source_url = page.get("sourceUrl")

    source_sku = clean_text(page.get("sku"))
    sku = source_sku or make_stable_sku("GROCERY", f"{slugify(name)}|{primary.public_path}")

    price = page.get("price")
    base_price = float(price) if isinstance(price, (int, float)) else 0.0
    source_available = page.get("available")
    if source_available is False:
        available = False
    elif base_price > 0:
        available = True
    else:
        available = bool(available_without_price and matched)

    variant_options: list[dict[str, Any]] = []
    variant_values: dict[str, str] = {}
    if pack_size:
        variant_options = [
            {
                "name": "Pack Size",
                "position": 0,
                "values": [{"value": pack_size, "position": 0}],
            }
        ]
        variant_values = {"Pack Size": pack_size}

    cost_price = round(base_price * 0.96, 2) if base_price > 0 else None
    effective_stock = stock if available else 0

    specs = [
        {"label": "Category", "value": SUBCATEGORY_NAMES.get(subcategory_slug, subcategory_slug), "position": 0},
    ]
    if brand:
        specs.append({"label": "Brand", "value": brand, "position": len(specs)})
    if pack_size:
        specs.append({"label": "Pack Size", "value": pack_size, "position": len(specs)})
    if source_url:
        specs.append({"label": "Source", "value": str(source_url), "position": len(specs)})

    description = clean_text(page.get("description"))
    product: dict[str, Any] = {
        "unmatched": not matched,
        "name": name,
        "slug": slugify(name),
        "type": "PHYSICAL",
        "sku": sku,
        "categorySlug": subcategory_slug,
        "brandName": brand,
        "description": description,
        "shortDesc": short_description(description, name),
        "model": clean_text(page.get("model")) or None,
        "warranty": None,
        "basePrice": base_price,
        "originalPrice": None,
        "currency": clean_text(page.get("currency")) or "BDT",
        "weight": weight_kg_from_pack(pack_size),
        "dimensions": {"packageSize": pack_size} if pack_size else None,
        "available": available,
        "featured": False,
        "image": primary.public_path,
        "gallery": [x.public_path for x in image_group if x.public_path != primary.public_path],
        "soldCount": 0,
        "ratingAvg": 0,
        "ratingCount": 0,
        "lowStockThreshold": 10,
        "inventoryItemClass": "CONSUMABLE",
        "requiresAssetTag": False,
        "bundleStockLimit": None,
        "stock": effective_stock,
        "variants": [
            {
                "sku": sku,
                "price": base_price,
                "currency": clean_text(page.get("currency")) or "BDT",
                "stock": effective_stock,
                "options": variant_values,
                "isDefault": True,
                "active": available,
                "lowStockThreshold": 10,
                "costPrice": cost_price,
                "colorImage": None,
            }
        ],
        "variantOptions": variant_options,
        "specificationGroups": [
            {
                "name": "Product Details",
                "position": 0,
                "items": specs,
            }
        ],
        # Extra audit fields are harmless to the current JSON importer and make review easier.
        "sourceProductUrl": source_url,
        "sourceImages": [x.public_path for x in image_group],
        "needsReview": (not matched) or base_price <= 0,
        "match": match_meta,
    }
    return product, matched


def category_records(results: list[ProductResult]) -> list[dict[str, Any]]:
    image_by_subcategory: dict[str, str] = {}
    for result in results:
        if result.images:
            image_by_subcategory.setdefault(result.subcategory_slug, result.images[0].public_path)

    parent_image = next(iter(image_by_subcategory.values()), None)
    categories = [
        {
            "name": PARENT_CATEGORY["name"],
            "slug": PARENT_CATEGORY["slug"],
            "parentSlug": None,
            "image": parent_image,
            "isActive": True,
            "sortOrder": 0,
            "showInHeader": True,
            "showInFooter": False,
            "featured": False,
        }
    ]

    for order, (slug, name) in enumerate(SUBCATEGORIES, start=1):
        # Keep the requested taxonomy stable even if a category currently has no images.
        categories.append(
            {
                "name": name,
                "slug": slug,
                "parentSlug": PARENT_CATEGORY["slug"],
                "image": image_by_subcategory.get(slug),
                "isActive": True,
                "sortOrder": order,
                "showInHeader": False,
                "showInFooter": False,
                "featured": False,
            }
        )

    if any(r.subcategory_slug == "unclassified" for r in results):
        categories.append(
            {
                "name": "Unclassified Grocery",
                "slug": "unclassified",
                "parentSlug": PARENT_CATEGORY["slug"],
                "image": image_by_subcategory.get("unclassified"),
                "isActive": False,
                "sortOrder": len(categories),
                "showInHeader": False,
                "showInFooter": False,
                "featured": False,
            }
        )
    return categories


def brand_records(results: list[ProductResult]) -> list[dict[str, Any]]:
    brands: dict[str, str] = {}
    for result in results:
        name = clean_text(result.product.get("brandName"))
        if name:
            brands.setdefault(slugify(name), name)
    return [{"name": name, "slug": slug, "logo": None} for slug, name in sorted(brands.items())]


def seed_payload(results: list[ProductResult], image_root: Path, stock: int) -> dict[str, Any]:
    return {
        "schemaVersion": 3,
        "source": {
            "site": "multi-source-grocery-catalog",
            "imageRoot": str(image_root),
            "generatedAtUnix": int(time.time()),
            "generator": "prisma/groceries_json_builder.py",
        },
        "defaults": {
            "stock": stock,
            "currency": "BDT",
            "productType": "PHYSICAL",
            "inventoryItemClass": "CONSUMABLE",
        },
        "categories": category_records(results),
        "brands": brand_records(results),
        "products": [r.product for r in results],
    }


def subset_payload(all_payload: dict[str, Any], group_results: list[ProductResult]) -> dict[str, Any]:
    needed_slugs = {PARENT_CATEGORY["slug"]} | {r.subcategory_slug for r in group_results}
    needed_brands = {slugify(clean_text(r.product.get("brandName"))) for r in group_results if r.product.get("brandName")}
    return {
        **{k: v for k, v in all_payload.items() if k not in {"categories", "brands", "products"}},
        "categories": [c for c in all_payload["categories"] if c["slug"] in needed_slugs],
        "brands": [b for b in all_payload["brands"] if b["slug"] in needed_brands],
        "products": [r.product for r in group_results],
    }


def dedupe_product_slugs(results: list[ProductResult]) -> None:
    seen: dict[str, int] = defaultdict(int)
    for result in results:
        base = slugify(result.product["slug"])
        seen[base] += 1
        if seen[base] == 1:
            result.product["slug"] = base
            continue
        suffix_source = result.product.get("sku") or result.images[0].public_path
        suffix = hashlib.sha256(str(suffix_source).encode("utf-8")).hexdigest()[:8]
        result.product["slug"] = f"{base}-{suffix}"


def worker(
    key: str,
    images: list[LocalImage],
    args: argparse.Namespace,
    cache_root: Path,
) -> ProductResult:
    primary = images[0]
    ocr_text = try_ocr(primary.disk_path, args.ocr)
    subcategory_slug, category_meta = category_from_image(primary, ocr_text)

    local_page = local_boed_product(primary, subcategory_slug, ocr_text)
    if local_page:
        match_meta = {
            "method": "local-boed",
            "category": category_meta,
            "ocrText": ocr_text[:500] if ocr_text else None,
        }
        product, matched = make_product(
            images,
            subcategory_slug,
            local_page,
            match_meta,
            args.stock,
            args.available_without_price,
        )
        return ProductResult(key, subcategory_slug, images, product, matched, match_meta)

    page = None
    if not args.no_search:
        page, match_meta = match_online_product(
            primary,
            subcategory_slug,
            ocr_text,
            cache_root,
            args.refresh,
            args.min_match_score,
        )
    else:
        _, brand_hint, pack_hint = build_query(primary, subcategory_slug, ocr_text)
        match_meta = {
            "method": "search-disabled",
            "brandHint": brand_hint,
            "packHint": pack_hint,
        }

    match_meta["category"] = category_meta
    if ocr_text:
        match_meta["ocrText"] = ocr_text[:500]

    product, matched = make_product(
        images,
        subcategory_slug,
        page,
        match_meta,
        args.stock,
        args.available_without_price,
    )
    return ProductResult(key, subcategory_slug, images, product, matched, match_meta)


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--image-folder",
        default=str(DEFAULT_IMAGE_ROOT),
        help="Grocery image folder (default: public/images/products/groceries)",
    )
    parser.add_argument(
        "--output-root",
        default=str(DEFAULT_OUTPUT_ROOT),
        help="Output folder for grocery JSON files",
    )
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--stock", type=int, default=10)
    parser.add_argument("--min-match-score", type=float, default=0.64)
    parser.add_argument("--cache-dir", default=str(DEFAULT_CACHE_ROOT))
    parser.add_argument("--refresh", action="store_true", help="Ignore cached product pages")
    parser.add_argument("--no-search", action="store_true", help="Do not search the web")
    parser.add_argument("--no-ocr", dest="ocr", action="store_false", help="Disable optional OCR")
    parser.add_argument("--available-without-price", action="store_true", help="Allow matched products to be active even if no price was found")
    parser.set_defaults(ocr=True)
    args = parser.parse_args()

    if args.workers < 1:
        parser.error("--workers must be >= 1")
    if args.stock < 0:
        parser.error("--stock must be >= 0")
    if not (0.0 <= args.min_match_score <= 1.0):
        parser.error("--min-match-score must be between 0 and 1")

    image_root = normalize_input_folder(args.image_folder)
    public_products_root = (PROJECT_ROOT / "public" / "images" / "products").resolve()
    try:
        image_root.relative_to(public_products_root)
    except ValueError as exc:
        raise SystemExit(f"Image folder must be under {public_products_root}. Got: {image_root}") from exc

    output_root = Path(args.output_root)
    if not output_root.is_absolute():
        output_root = (PROJECT_ROOT / output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    cache_root = Path(args.cache_dir)
    if not cache_root.is_absolute():
        cache_root = (PROJECT_ROOT / cache_root).resolve()
    cache_root.mkdir(parents=True, exist_ok=True)

    images = scan_images(image_root)
    if not images:
        raise SystemExit(f"No product images found under {image_root}")

    # Images with the same file stem are treated as front/back/gallery images of one product.
    grouped: dict[str, list[LocalImage]] = defaultdict(list)
    for image in images:
        grouped[image.stem].append(image)

    log("\nGROCERY IMAGE -> JSON BUILDER")
    log(f"Image folder:          {image_root}")
    log(f"Images found:          {len(images)}")
    log(f"Unique product stems:  {len(grouped)}")
    log(f"Output:                {output_root}")
    log(f"Workers:               {args.workers}")
    log(f"Web search:            {'OFF' if args.no_search else 'ON'}")
    log(f"OCR:                   {'ON' if args.ocr else 'OFF'}")
    log("")

    started = time.perf_counter()
    results: list[ProductResult] = []
    checkpoint = output_root / "progress.json"

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(worker, key, records, args, cache_root): key
            for key, records in sorted(grouped.items())
        }
        for done, future in enumerate(as_completed(futures), start=1):
            key = futures[future]
            try:
                result = future.result()
            except Exception as exc:
                records = grouped[key]
                category_slug, category_meta = category_from_image(records[0], "")
                match_meta = {"method": "exception", "error": str(exc), "category": category_meta}
                product, matched = make_product(
                    records,
                    category_slug,
                    None,
                    match_meta,
                    args.stock,
                    args.available_without_price,
                )
                result = ProductResult(key, category_slug, records, product, matched, match_meta)

            results.append(result)
            marker = "OK" if result.matched else "REVIEW"
            log(
                f"[{done:>4}/{len(grouped)}] {marker:<6} "
                f"{result.subcategory_slug:<18} {result.product['name']}"
            )

            atomic_json(
                checkpoint,
                {
                    "imagesFound": len(images),
                    "uniqueProductStems": len(grouped),
                    "processed": done,
                    "matched": sum(1 for x in results if x.matched),
                    "unmatched": sum(1 for x in results if not x.matched),
                    "updatedAtUnix": int(time.time()),
                },
            )

    results.sort(key=lambda r: (r.subcategory_slug, r.product["name"].lower(), r.key))
    dedupe_product_slugs(results)

    payload = seed_payload(results, image_root, args.stock)
    all_file = output_root / "_all.json"
    atomic_json(all_file, payload)

    by_group: dict[str, list[ProductResult]] = defaultdict(list)
    for result in results:
        by_group[result.subcategory_slug].append(result)

    index_groups = []
    for slug, group_results in sorted(by_group.items()):
        group_file = output_root / f"{slug}.json"
        atomic_json(group_file, subset_payload(payload, group_results))
        index_groups.append(
            {
                "name": SUBCATEGORY_NAMES.get(slug, "Unclassified Grocery"),
                "slug": slug,
                "file": group_file.name,
                "status": "completed",
                "products": len(group_results),
                "matched": sum(1 for x in group_results if x.matched),
                "unmatched": sum(1 for x in group_results if not x.matched),
            }
        )

    index_file = output_root / "index.json"
    atomic_json(
        index_file,
        {
            "schemaVersion": 1,
            "sourceCategory": "groceries",
            "imageFolder": "/" + image_root.relative_to(PROJECT_ROOT / "public").as_posix(),
            "groups": index_groups,
            "allFile": "_all.json",
            "generatedAtUnix": int(time.time()),
        },
    )

    unmatched = [
        {
            "stem": r.key,
            "images": [x.public_path for x in r.images],
            "categorySlug": r.subcategory_slug,
            "productName": r.product.get("name"),
            "brandName": r.product.get("brandName"),
            "match": r.match_meta,
        }
        for r in results
        if not r.matched
    ]
    unmatched_file = output_root / "unmatched.json"
    atomic_json(unmatched_file, unmatched)

    report = {
        "status": "json-generated",
        "imageRoot": str(image_root),
        "outputDir": str(output_root),
        "imagesFound": len(images),
        "uniqueProductStems": len(grouped),
        "productsInJson": len(results),
        "matchedProducts": sum(1 for r in results if r.matched),
        "unmatchedProducts": len(unmatched),
        "unclassifiedProducts": sum(1 for r in results if r.subcategory_slug == "unclassified"),
        "brandsFound": len(payload["brands"]),
        "subcategoryCounts": dict(Counter(r.subcategory_slug for r in results)),
        "matchMethods": dict(Counter(str(r.match_meta.get("method", "unknown")) for r in results)),
        "timeSeconds": round(time.perf_counter() - started, 2),
        "files": {
            "index": str(index_file),
            "all": str(all_file),
            "unmatched": str(unmatched_file),
        },
    }
    report_file = output_root / "report.json"
    atomic_json(report_file, report)

    log("\n" + "=" * 76)
    log("FINAL REPORT")
    log("=" * 76)
    log(f"Images scanned:            {len(images)}")
    log(f"Unique product stems:      {len(grouped)}")
    log(f"Products written to JSON:  {len(results)}")
    log(f"Matched product pages:     {report['matchedProducts']}")
    log(f"Needs manual review:       {report['unmatchedProducts']}")
    log(f"Unclassified:              {report['unclassifiedProducts']}")
    log(f"Brands found:              {report['brandsFound']}")
    log(f"Index:                     {index_file}")
    log(f"Combined JSON:             {all_file}")
    log(f"Unmatched report:          {unmatched_file}")
    log(f"Full report:               {report_file}")
    log("=" * 76)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
