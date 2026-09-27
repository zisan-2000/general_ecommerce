#!/usr/bin/env python3
"""
Build a schema-oriented Star Tech product seed from the two hierarchy JSON files.

Inputs
------
1) category_subcategory_brand_seed JSON
2) product_image_hierarchy JSON

For every local product image, the script:
- derives a likely Star Tech product slug from the image filename
- tries https://www.startech.com.bd/<slug> first
- falls back to Star Tech search when direct URL matching fails
- scrapes product name, price, regular/original price, brand, model, MPN,
  product code, warranty, description, key features and specification groups
- maps the product back to Category -> Subcategory -> Brand from the local path
- writes ONE seed product for duplicate local mirrors of the same Star Tech page
- preserves every local source image path for audit
- converts specification rows into:
    * specificationGroups (display/detail page)
    * variantOptions (ProductVariantOption / ProductVariantOptionValue)
    * a default variant.options JSON object

The script DOES NOT write to the database. Use the companion
seed_startech_generated.ts file to import the resulting JSON into Prisma.

Install
-------
    python -m pip install requests beautifulsoup4

Examples
--------
Full run:
    python build_startech_full_seed.py \
      --category-json category_subcategory_brand_seed.json \
      --image-json product_image_hierarchy.json \
      --output prisma/startech_full_product_seed.json

Test only Hisense fridge products:
    python build_startech_full_seed.py \
      --category-json category_subcategory_brand_seed.json \
      --image-json product_image_hierarchy.json \
      --category appliance --subcategory fridge --brand hisense --limit 5

Test TV wall mount:
    python build_startech_full_seed.py \
      --category-json category_subcategory_brand_seed.json \
      --image-json product_image_hierarchy.json \
      --category television-shop --subcategory tv-stand-wall-mount --limit 5

Useful options:
    --stock 200
    --cost-ratio 0.96
    --delay 0.35
    --workers 4
    --cache-dir .cache/startech-full-seed
    --refresh
    --respect-source-availability

Output files
------------
<output>.json
<output>.stats.json
<output>.unmatched.json

Important
---------
Star Tech pages and HTML can change. The generator refuses low-confidence search
matches and puts them in the unmatched file instead of silently assigning the
wrong product.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import html
import json
import math
import os
import re
import sys
import threading
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import quote_plus, unquote, urljoin, urlsplit, urlunsplit

import requests
from bs4 import BeautifulSoup, Tag
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


BASE = "https://www.startech.com.bd"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif"}
SPECIAL_FOLDERS = {"_direct", "_other", "_uncategorized"}
DEFAULT_CACHE_SECONDS = 7 * 24 * 60 * 60

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/154.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Referer": BASE + "/",
}


# ---------------------------------------------------------------------------
# Generic helpers
# ---------------------------------------------------------------------------


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def slugify(value: str) -> str:
    value = unquote(str(value or "")).strip().lower()
    value = value.replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return re.sub(r"-{2,}", "-", value).strip("-") or "unknown"


def pretty_name(value: str) -> str:
    acronyms = {
        "ac": "AC", "ai": "AI", "amd": "AMD", "bdcom": "BDCOM",
        "cpu": "CPU", "dvr": "DVR", "gpu": "GPU", "hdd": "HDD",
        "hp": "HP", "ip": "IP", "ips": "IPS", "jbl": "JBL",
        "kvm": "KVM", "lan": "LAN", "lg": "LG", "nas": "NAS",
        "nvr": "NVR", "olt": "OLT", "onu": "ONU", "pc": "PC",
        "poe": "PoE", "ps4": "PS4", "ps5": "PS5", "ram": "RAM",
        "rgb": "RGB", "san": "SAN", "ssd": "SSD", "tcl": "TCL",
        "tv": "TV", "ups": "UPS", "usb": "USB", "vr": "VR",
        "wifi": "WiFi", "xvr": "XVR",
    }
    parts = re.split(r"[-_\s]+", clean_text(value))
    out = []
    for part in parts:
        if not part:
            continue
        low = part.lower()
        out.append(acronyms.get(low, part[:1].upper() + part[1:]))
    return " ".join(out)


def canonical_startech_url(url: str) -> str:
    p = urlsplit(urljoin(BASE, url))
    host = p.hostname or ""
    if host not in {"startech.com.bd", "www.startech.com.bd"}:
        raise ValueError(f"Unexpected Star Tech URL: {url}")
    path = quote_plus(unquote(p.path).strip().rstrip("/"), safe="/-._~")
    # quote_plus encodes spaces as +; path URLs are cleaner with %20 / slug style.
    path = path.replace("+", "%20") or "/"
    return urlunsplit(("https", "www.startech.com.bd", path, "", ""))


def money(text: str) -> float | None:
    if not text:
        return None
    # Prefer a number immediately before the taka symbol when present.
    m = re.search(r"([0-9][0-9,]*(?:\.\d+)?)\s*(?:৳|Tk\.?|BDT)", text, re.I)
    if not m:
        m = re.search(r"[0-9][0-9,]*(?:\.\d+)?", text)
    if not m:
        return None
    raw = m.group(1) if m.lastindex else m.group(0)
    try:
        value = float(raw.replace(",", ""))
    except ValueError:
        return None
    return value if math.isfinite(value) else None


def json_dump_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def sha12(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:12].upper()


def text_at(soup: BeautifulSoup | Tag, selector: str) -> str:
    node = soup.select_one(selector)
    return clean_text(node.get_text(" ", strip=True)) if node else ""


def normalize_brand(value: str | None) -> str:
    return slugify(value or "")


def safe_html(node: Tag | None, fallback: str = "") -> str:
    if not node:
        return fallback
    clone = BeautifulSoup(str(node), "html.parser")
    for bad in clone.select("script, style, iframe, form, button, input, noscript"):
        bad.decompose()
    # Return inner HTML for the outer selected container.
    root = clone.find()
    if not root:
        return fallback
    return "".join(str(x) for x in root.contents).strip() or fallback


def unique_name(base: str, used: set[str], prefix: str = "") -> str:
    candidate = clean_text(base) or "Specification"
    if candidate.casefold() not in used:
        used.add(candidate.casefold())
        return candidate
    if prefix:
        candidate2 = f"{prefix} - {candidate}"
        if candidate2.casefold() not in used:
            used.add(candidate2.casefold())
            return candidate2
    i = 2
    while f"{candidate} ({i})".casefold() in used:
        i += 1
    result = f"{candidate} ({i})"
    used.add(result.casefold())
    return result


# ---------------------------------------------------------------------------
# Input hierarchy parsing
# ---------------------------------------------------------------------------


@dataclass
class ImageRecord:
    image: str
    category_slug: str
    category_name: str
    path_parts: list[str]
    filename_stem: str
    subcategory_slug: str | None = None
    subcategory_name: str | None = None
    folder_brand_slug: str | None = None
    folder_brand_name: str | None = None
    source_kind: str = "unknown"

    def audit_dict(self) -> dict[str, Any]:
        return {
            "image": self.image,
            "categorySlug": self.category_slug,
            "categoryName": self.category_name,
            "subcategorySlug": self.subcategory_slug,
            "subcategoryName": self.subcategory_name,
            "folderBrandSlug": self.folder_brand_slug,
            "folderBrandName": self.folder_brand_name,
            "sourceKind": self.source_kind,
        }


@dataclass
class HierarchyHints:
    category_names: dict[str, str] = field(default_factory=dict)
    subcategory_names: dict[tuple[str, str], str] = field(default_factory=dict)
    brand_names: dict[str, str] = field(default_factory=dict)
    explicit_brand_paths: set[tuple[str, str, str]] = field(default_factory=set)
    direct_children: set[tuple[str, str]] = field(default_factory=set)


def load_hierarchy_hints(path: Path) -> HierarchyHints:
    data = json.loads(path.read_text(encoding="utf-8"))
    hints = HierarchyHints()

    for category in data.get("categories", []):
        cslug = slugify(category.get("slug") or category.get("folder") or category.get("name"))
        cname = clean_text(category.get("name")) or pretty_name(cslug)
        hints.category_names[cslug] = cname

        for sub in category.get("subcategories", []):
            sraw = sub.get("slug") or sub.get("folder") or sub.get("name")
            sslug = slugify(sraw)
            sname = clean_text(sub.get("name")) or pretty_name(sraw)
            hints.subcategory_names[(cslug, sslug)] = sname
            for brand in sub.get("brands", []):
                braw = brand.get("slug") or brand.get("folder") or brand.get("name")
                bslug = slugify(braw)
                bname = clean_text(brand.get("name")) or pretty_name(braw)
                if bslug and bslug not in {slugify(x) for x in SPECIAL_FOLDERS}:
                    hints.brand_names.setdefault(bslug, bname)
                    hints.explicit_brand_paths.add((cslug, sslug, bslug))

        for child in category.get("directChildren", []):
            if isinstance(child, str):
                raw = child
            else:
                raw = child.get("slug") or child.get("folder") or child.get("name")
            if raw:
                hints.direct_children.add((cslug, slugify(raw)))

    return hints


def image_stem(image_path: str) -> str:
    leaf = Path(urlsplit(image_path).path).name
    stem = Path(leaf).stem
    return slugify(stem)


def iter_image_records(image_json: Path, hints: HierarchyHints) -> Iterable[ImageRecord]:
    data = json.loads(image_json.read_text(encoding="utf-8"))
    source_root = data.get("sourceRoot", "/images/products").rstrip("/")

    def from_image(path: str, category: dict, sub: dict | None, brand: dict | None, kind: str):
        clean = str(path).replace("\\", "/")
        if not clean.startswith("/"):
            clean = "/" + clean
        relative = clean[len(source_root):].strip("/") if clean.startswith(source_root) else clean.strip("/")
        parts = relative.split("/")
        cslug_raw = category.get("slug") or category.get("folder") or (parts[0] if parts else "unknown")
        cslug = slugify(cslug_raw)
        cname = hints.category_names.get(cslug) or clean_text(category.get("name")) or pretty_name(cslug_raw)

        sslug = None
        sname = None
        if sub:
            sraw = sub.get("slug") or sub.get("folder") or sub.get("name")
            if sraw:
                sslug = slugify(sraw)
                sname = hints.subcategory_names.get((cslug, sslug)) or clean_text(sub.get("name")) or pretty_name(sraw)

        bslug = None
        bname = None
        if brand:
            braw = brand.get("slug") or brand.get("folder") or brand.get("name")
            if braw and str(braw) not in SPECIAL_FOLDERS:
                bslug = slugify(braw)
                bname = hints.brand_names.get(bslug) or clean_text(brand.get("name")) or pretty_name(braw)

        return ImageRecord(
            image=clean,
            category_slug=cslug,
            category_name=cname,
            path_parts=parts[:-1],
            filename_stem=image_stem(clean),
            subcategory_slug=sslug,
            subcategory_name=sname,
            folder_brand_slug=bslug,
            folder_brand_name=bname,
            source_kind=kind,
        )

    for category in data.get("categories", []):
        for img in category.get("directImages", []):
            yield from_image(img, category, None, None, "category-direct")

        for sub in category.get("subcategories", []):
            for img in sub.get("directImages", []):
                yield from_image(img, category, sub, None, "subcategory-direct")

            for brand in sub.get("brands", []):
                for img in brand.get("images", []):
                    yield from_image(img, category, sub, brand, "brand")

            for special in sub.get("specialFolders", []):
                for img in special.get("images", []):
                    yield from_image(img, category, sub, None, "special")


def filter_records(records: list[ImageRecord], args: argparse.Namespace) -> list[ImageRecord]:
    out = []
    for record in records:
        if args.category and record.category_slug != slugify(args.category):
            continue
        if args.subcategory and record.subcategory_slug != slugify(args.subcategory):
            continue
        if args.brand:
            wanted = slugify(args.brand)
            if record.folder_brand_slug != wanted and not (
                record.source_kind == "subcategory-direct" and record.subcategory_slug == wanted
            ):
                continue
        out.append(record)
    if args.limit:
        out = out[: args.limit]
    return out


# ---------------------------------------------------------------------------
# HTTP client + page matching
# ---------------------------------------------------------------------------


class StarTechClient:
    def __init__(self, cache_dir: Path, delay: float, refresh: bool = False, timeout: int = 45):
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.delay = max(0.0, delay)
        self.refresh = refresh
        self.timeout = timeout
        self.local = threading.local()
        self.rate_lock = threading.Lock()
        self.last_request = 0.0

    def session(self) -> requests.Session:
        session = getattr(self.local, "session", None)
        if session is None:
            session = requests.Session()
            session.headers.update(HEADERS)
            retry = Retry(
                total=5,
                connect=5,
                read=5,
                backoff_factor=0.8,
                status_forcelist=(429, 500, 502, 503, 504),
                allowed_methods=frozenset({"GET"}),
                respect_retry_after_header=True,
            )
            session.mount("https://", HTTPAdapter(max_retries=retry))
            self.local.session = session
        return session

    def cache_path(self, url: str) -> Path:
        key = hashlib.sha256(url.encode("utf-8")).hexdigest()
        return self.cache_dir / f"{key}.html"

    def throttle(self):
        if not self.delay:
            return
        with self.rate_lock:
            wait = self.delay - (time.time() - self.last_request)
            if wait > 0:
                time.sleep(wait)
            self.last_request = time.time()

    def get_html(self, url: str, allow_404: bool = False) -> str | None:
        url = urljoin(BASE, url)
        cache = self.cache_path(url)
        if cache.exists() and not self.refresh:
            age = time.time() - cache.stat().st_mtime
            if age <= DEFAULT_CACHE_SECONDS:
                return cache.read_text(encoding="utf-8", errors="replace")

        self.throttle()
        response = self.session().get(url, timeout=self.timeout, allow_redirects=True)
        if response.status_code == 404 and allow_404:
            return None
        response.raise_for_status()
        text = response.text
        cache.write_text(text, encoding="utf-8")
        return text

    def soup(self, url: str, allow_404: bool = False) -> BeautifulSoup | None:
        value = self.get_html(url, allow_404=allow_404)
        return BeautifulSoup(value, "html.parser") if value is not None else None


def looks_like_product_page(soup: BeautifulSoup | None) -> bool:
    if soup is None or not soup.select_one("h1"):
        return False
    markers = [
        soup.select_one(".product-info-table"),
        soup.select_one(".short-description"),
        soup.select_one(".product-img-holder"),
        soup.select_one("#description"),
        soup.select_one("#specification"),
        soup.select_one('[itemprop="availability"]'),
    ]
    return sum(bool(x) for x in markers) >= 2


def candidate_score(stem: str, href: str, title: str, brand_hint: str | None) -> float:
    target = slugify(stem)
    path_slug = slugify(Path(urlsplit(href).path.rstrip("/")).name)
    title_slug = slugify(title)
    scores = [SequenceMatcher(None, target, path_slug).ratio(), SequenceMatcher(None, target, title_slug).ratio()]
    score = max(scores)
    if target == path_slug:
        score += 0.25
    elif target in path_slug or path_slug in target:
        score += 0.08
    if brand_hint:
        b = slugify(brand_hint)
        if path_slug.startswith(b + "-") or title_slug.startswith(b + "-"):
            score += 0.05
    return min(score, 1.25)


def search_candidates(client: StarTechClient, stem: str) -> list[tuple[float, str, str]]:
    query = stem.replace("-", " ")
    search_url = f"{BASE}/index.php?route=product/search&search={quote_plus(query)}"
    soup = client.soup(search_url)
    if soup is None:
        return []
    found: dict[str, str] = {}
    for selector in (
        ".p-item-name a[href]",
        ".p-item h4 a[href]",
        ".product-layout h4 a[href]",
        ".product-thumb h4 a[href]",
    ):
        for a in soup.select(selector):
            href = a.get("href")
            if not href:
                continue
            try:
                url = canonical_startech_url(href)
            except ValueError:
                continue
            found.setdefault(url, clean_text(a.get_text(" ", strip=True)))
        if found:
            break
    return [(0.0, u, t) for u, t in found.items()]


def resolve_product_page(
    client: StarTechClient,
    stem: str,
    brand_hint: str | None,
    min_score: float,
) -> tuple[str | None, BeautifulSoup | None, dict[str, Any]]:
    direct = f"{BASE}/{stem}"
    try:
        soup = client.soup(direct, allow_404=True)
        if looks_like_product_page(soup):
            title = text_at(soup, "h1")
            return canonical_startech_url(direct), soup, {
                "method": "direct-slug",
                "score": 1.0,
                "query": stem,
                "candidateTitle": title,
            }
    except requests.RequestException:
        pass

    candidates = search_candidates(client, stem)
    scored = []
    for _, url, title in candidates:
        scored.append((candidate_score(stem, url, title, brand_hint), url, title))
    scored.sort(reverse=True, key=lambda x: x[0])

    if not scored or scored[0][0] < min_score:
        return None, None, {
            "method": "search-rejected",
            "score": scored[0][0] if scored else 0.0,
            "query": stem,
            "candidates": [
                {"score": round(s, 4), "url": u, "title": t}
                for s, u, t in scored[:5]
            ],
        }

    score, url, title = scored[0]
    soup = client.soup(url)
    if not looks_like_product_page(soup):
        return None, None, {
            "method": "search-invalid-page",
            "score": score,
            "query": stem,
            "candidateUrl": url,
            "candidateTitle": title,
        }
    return url, soup, {
        "method": "search",
        "score": round(score, 4),
        "query": stem,
        "candidateTitle": title,
    }


# ---------------------------------------------------------------------------
# Star Tech page parser
# ---------------------------------------------------------------------------


def parse_info_table(soup: BeautifulSoup) -> dict[str, str]:
    result: dict[str, str] = {}
    table = soup.select_one(".product-info-table")
    if table:
        # Newer markup often has rows/divs with label + value.
        for row in table.select("tr"):
            cells = row.find_all(["th", "td"], recursive=False)
            if len(cells) >= 2:
                key = clean_text(cells[0].get_text(" ", strip=True)).rstrip(":|")
                val = clean_text(" ".join(c.get_text(" ", strip=True) for c in cells[1:]))
                if key and val:
                    result[key] = val
        # Fallback to line parsing from rendered text.
        text = table.get_text("\n", strip=True)
        labels = ["Price", "Regular Price", "Status", "Product Code", "Brand"]
        lines = [clean_text(x) for x in text.splitlines() if clean_text(x)]
        for i, line in enumerate(lines):
            for label in labels:
                if line.casefold() == label.casefold() and i + 1 < len(lines):
                    result.setdefault(label, lines[i + 1].strip("| "))
                m = re.match(rf"^{re.escape(label)}\s*[:|]\s*(.+)$", line, re.I)
                if m:
                    result.setdefault(label, clean_text(m.group(1)))

    # Rendered-page fallback: find compact product-header text.
    header = soup.select_one(".product-details") or soup.select_one("#product") or soup
    blob = clean_text(header.get_text(" ", strip=True))[:8000]
    for label in ("Status", "Product Code", "Brand"):
        if label not in result:
            m = re.search(rf"\b{re.escape(label)}\s*[:|]?\s*([^|]+?)(?=\s+(?:Price|Regular Price|Status|Product Code|Brand|Key Features)\b|$)", blob, re.I)
            if m:
                result[label] = clean_text(m.group(1))
    return result


def parse_prices(soup: BeautifulSoup, info: dict[str, str]) -> tuple[float | None, float | None]:
    current = None
    original = None
    node = soup.select_one(".product-info-table .product-price") or soup.select_one(".product-price")
    if node:
        ins = node.select_one("ins")
        dele = node.select_one("del")
        if ins:
            current = money(ins.get_text(" ", strip=True))
        else:
            clone = BeautifulSoup(str(node), "html.parser")
            for old in clone.select("del"):
                old.decompose()
            current = money(clone.get_text(" ", strip=True))
        if dele:
            original = money(dele.get_text(" ", strip=True))

    if current is None:
        current = money(info.get("Price", ""))
    if original is None:
        original = money(info.get("Regular Price", ""))

    # Important fallback: some out-of-stock pages say "Price To be announced"
    # but the description still contains the latest known Bangladesh price.
    if current is None:
        body_text = soup.get_text(" ", strip=True)
        m = re.search(r"latest price of .*? in Bangladesh is\s*([0-9][0-9,]*(?:\.\d+)?)\s*৳", body_text, re.I)
        if m:
            current = money(m.group(1))

    if original is not None and current is not None and original <= current:
        original = None
    return current, original


def parse_key_features(soup: BeautifulSoup) -> list[str]:
    values = []
    for li in soup.select(".short-description li:not(.view-more)"):
        text = clean_text(li.get_text(" ", strip=True))
        if text and "view more" not in text.casefold():
            values.append(text)
    return list(dict.fromkeys(values))


def parse_specification_groups(soup: BeautifulSoup, features: list[str]) -> list[dict[str, Any]]:
    root = soup.select_one("#specification")
    groups: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    def ensure_group(name: str = "Specification") -> dict[str, Any]:
        nonlocal current
        if current is None:
            current = {"name": clean_text(name) or "Specification", "position": len(groups), "items": []}
            groups.append(current)
        return current

    if root:
        for row in root.select("tr"):
            cells = row.find_all(["th", "td"], recursive=False)
            if not cells:
                cells = row.select("th, td")
            texts = [clean_text(c.get_text(" ", strip=True)) for c in cells]
            texts = [x for x in texts if x]
            if not texts:
                continue

            colspan = any(str(c.get("colspan", "")) not in {"", "1"} for c in cells)
            row_classes = " ".join(row.get("class", [])) + " " + " ".join(
                " ".join(c.get("class", [])) for c in cells
            )
            headingish = colspan or len(texts) == 1 or "heading" in row_classes.casefold()
            if headingish:
                current = {"name": texts[0], "position": len(groups), "items": []}
                groups.append(current)
                continue

            if len(texts) >= 2:
                group = ensure_group()
                label = texts[0].rstrip(":")
                value = clean_text(" | ".join(texts[1:]))
                if label and value:
                    group["items"].append({
                        "label": label,
                        "value": value,
                        "position": len(group["items"]),
                    })

    groups = [g for g in groups if g.get("items")]

    # If the page has no specification table, promote colon-style key features.
    if not groups:
        items = []
        for feature in features:
            if ":" in feature:
                label, value = feature.split(":", 1)
                label, value = clean_text(label), clean_text(value)
                if label and value:
                    items.append({"label": label, "value": value, "position": len(items)})
        if items:
            groups = [{"name": "Key Features", "position": 0, "items": items}]

    # Deduplicate exact rows while retaining original grouping/order.
    seen = set()
    cleaned = []
    for group in groups:
        out_items = []
        for item in group["items"]:
            key = (item["label"].casefold(), item["value"].casefold())
            if key in seen:
                continue
            seen.add(key)
            item = dict(item)
            item["position"] = len(out_items)
            out_items.append(item)
        if out_items:
            cleaned.append({"name": group["name"], "position": len(cleaned), "items": out_items})
    return cleaned


def extract_model(features: list[str], groups: list[dict[str, Any]]) -> str | None:
    for line in features:
        m = re.match(r"Model\s*:\s*(.+)", line, re.I)
        if m:
            return clean_text(m.group(1)) or None
    for group in groups:
        for item in group["items"]:
            if item["label"].casefold() == "model":
                return item["value"]
    return None


def extract_mpn(features: list[str], groups: list[dict[str, Any]]) -> str | None:
    for line in features:
        m = re.match(r"MPN\s*:\s*(.+)", line, re.I)
        if m:
            return clean_text(m.group(1)) or None
    for group in groups:
        for item in group["items"]:
            if item["label"].casefold() in {"mpn", "part number", "part no"}:
                return item["value"]
    return None


def extract_warranty(groups: list[dict[str, Any]], soup: BeautifulSoup) -> str | None:
    for group in groups:
        for item in group["items"]:
            if "warranty" in item["label"].casefold():
                return item["value"] or None
    text = soup.get_text(" ", strip=True)
    # Conservative sentence capture near "comes with ... Warranty".
    m = re.search(r"comes with\s+(.{1,220}?\bWarranty)\b", text, re.I)
    return clean_text(m.group(1)) if m else None


def extract_dimensions_and_weight(groups: list[dict[str, Any]], soup: BeautifulSoup | None = None) -> tuple[dict[str, Any] | None, float | None]:
    dimensions = None
    weight = None
    for group in groups:
        for item in group["items"]:
            label = item["label"].casefold()
            value = item["value"]
            if weight is None and "weight" in label:
                m = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(kg|kilogram|g|gram)?", value, re.I)
                if m:
                    val = float(m.group(1))
                    unit = (m.group(2) or "kg").lower()
                    if unit in {"g", "gram"}:
                        val /= 1000.0
                    weight = val
            if dimensions is None and ("dimension" in label or "measurement" in label):
                nums = re.findall(r"([0-9]+(?:\.[0-9]+)?)", value)
                if len(nums) >= 3:
                    unit_match = re.search(r"\b(mm|cm|m|inch|inches|in)\b", value, re.I)
                    unit = (unit_match.group(1).lower() if unit_match else "mm")
                    dimensions = {
                        "length": float(nums[0]),
                        "width": float(nums[1]),
                        "height": float(nums[2]),
                        "unit": unit,
                    }
    if soup is not None:
        body = clean_text((soup.select_one("#description") or soup).get_text(" ", strip=True))
        if dimensions is None:
            # Examples: 1002x597x842 mm, 1002 x 597 x 842 mm. Prefer a
            # dimension/measures sentence when possible.
            candidates = re.findall(
                r"([0-9]+(?:\.[0-9]+)?)\s*(?:mm|cm|m)?\s*[x×]\s*"
                r"([0-9]+(?:\.[0-9]+)?)\s*(?:mm|cm|m)?\s*[x×]\s*"
                r"([0-9]+(?:\.[0-9]+)?)\s*(mm|cm|m)\b",
                body,
                re.I,
            )
            if candidates:
                a, b, c, unit = candidates[0]
                dimensions = {
                    "length": float(a),
                    "width": float(b),
                    "height": float(c),
                    "unit": unit.lower(),
                }
        if weight is None:
            m = re.search(r"(?:weight|weighs?)\s*(?:is|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*(kg|g)\b", body, re.I)
            if m:
                weight = float(m.group(1))
                if m.group(2).lower() == "g":
                    weight /= 1000.0
    return dimensions, weight


def build_short_desc(features: list[str]) -> str | None:
    if not features:
        return None
    lis = "".join(f"<li>{html.escape(x)}</li>" for x in features)
    return f"<h2>Key Features</h2>\n<ul>{lis}</ul>"


def variant_material(groups: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, str]]:
    used: set[str] = set()
    variant_options: list[dict[str, Any]] = []
    options: dict[str, str] = {}
    for group in groups:
        group_name = clean_text(group.get("name")) or "Specification"
        for item in group.get("items", []):
            label = unique_name(item.get("label", "Specification"), used, prefix=group_name)
            value = clean_text(item.get("value"))
            if not value:
                continue
            variant_options.append({
                "name": label,
                "position": len(variant_options),
                "values": [{"value": value, "position": 0}],
            })
            options[label] = value
    return variant_options, options


def parse_product_page(
    soup: BeautifulSoup,
    url: str,
    stock: int,
    cost_ratio: float,
    respect_source_availability: bool,
) -> dict[str, Any]:
    name = text_at(soup, "h1")
    if not name:
        raise ValueError("Missing product name")

    info = parse_info_table(soup)
    features = parse_key_features(soup)
    groups = parse_specification_groups(soup, features)
    price, original = parse_prices(soup, info)
    status = clean_text(info.get("Status") or text_at(soup, ".product-status"))
    available = status.casefold() in {"in stock", "available", "pre order", "pre-order"}
    if not status:
        availability = soup.select_one('[itemprop="availability"]')
        href = str(availability.get("href") or availability.get("content") or "") if availability else ""
        available = href.endswith("/InStock")
    source_available = available
    seed_available = source_available if respect_source_availability else True

    brand = clean_text(info.get("Brand")) or text_at(soup, ".product-brand") or None
    if brand and brand.casefold().startswith("brand"):
        brand = clean_text(re.sub(r"^brand\s*[:|]?", "", brand, flags=re.I)) or None

    product_code = clean_text(info.get("Product Code")) or None
    model = extract_model(features, groups)
    mpn = extract_mpn(features, groups)
    warranty = extract_warranty(groups, soup)
    dimensions, weight = extract_dimensions_and_weight(groups, soup)

    desc_node = soup.select_one("#description .full-description") or soup.select_one("#description")
    description = safe_html(desc_node, fallback=html.escape(name))
    short_desc = build_short_desc(features)
    variant_options, options = variant_material(groups)

    # SKU priority: real MPN -> Star Tech product code -> stable URL hash.
    sku = clean_text(mpn or "")
    if not sku:
        sku = f"ST-{product_code}" if product_code else f"ST-{sha12(url)}"

    numeric_price = float(price or 0.0)
    cost_price = round(numeric_price * cost_ratio, 2) if numeric_price > 0 else None
    low_stock = 10

    variant = {
        "sku": sku,
        "price": numeric_price,
        "currency": "BDT",
        "stock": int(stock),
        "options": options,
        "isDefault": True,
        "active": bool(seed_available),
        "lowStockThreshold": low_stock,
        "costPrice": cost_price,
        "colorImage": None,
    }

    return {
        "name": name,
        "slug": slugify(Path(urlsplit(url).path.rstrip("/")).name or name),
        "type": "PHYSICAL",
        "sku": sku,
        "description": description,
        "shortDesc": short_desc,
        "model": model,
        "warranty": warranty,
        "basePrice": numeric_price,
        "originalPrice": original,
        "currency": "BDT",
        "weight": weight,
        "dimensions": dimensions,
        "available": bool(seed_available),
        "featured": False,
        "soldCount": 0,
        "ratingAvg": 0,
        "ratingCount": 0,
        "lowStockThreshold": low_stock,
        "inventoryItemClass": "CONSUMABLE",
        "requiresAssetTag": False,
        "bundleStockLimit": None,
        "stock": int(stock),
        "brandName": brand,
        "variantOptions": variant_options,
        "variants": [variant],
        "specificationGroups": groups,
        "sourceProductUrl": canonical_startech_url(url),
        "sourceProductCode": product_code,
        "sourceStatus": status or None,
        "sourceMpn": mpn,
        "sourceKeyFeatures": features,
        "needsReview": bool(price is None or price <= 0),
    }


# ---------------------------------------------------------------------------
# Category / brand resolution from local paths
# ---------------------------------------------------------------------------


def choose_primary_record(records: list[ImageRecord], scraped_brand: str | None) -> ImageRecord:
    brand_slug = normalize_brand(scraped_brand)

    def score(r: ImageRecord) -> tuple[int, int, int, str]:
        points = 0
        if r.source_kind == "brand":
            points += 8
        elif r.source_kind == "subcategory-direct":
            points += 5
        elif r.source_kind == "category-direct":
            points += 3
        elif r.source_kind == "special":
            points -= 3
        if brand_slug and r.folder_brand_slug == brand_slug:
            points += 6
        if r.subcategory_slug and brand_slug and r.subcategory_slug == brand_slug:
            points += 4
        if r.subcategory_slug and r.subcategory_slug.startswith("all-"):
            points -= 2
        if any(x in r.path_parts for x in SPECIAL_FOLDERS):
            points -= 5
        # Prefer PNG when ties, then stable lexicographic path.
        png = int(Path(r.image).suffix.lower() == ".png")
        return points, len(r.path_parts), png, r.image

    return sorted(records, key=score, reverse=True)[0]


def resolve_taxonomy(record: ImageRecord, scraped_brand: str | None, hints: HierarchyHints) -> dict[str, Any]:
    scraped_slug = normalize_brand(scraped_brand)
    brand_name = clean_text(scraped_brand) or record.folder_brand_name
    brand_slug = scraped_slug or record.folder_brand_slug

    category_slug = record.category_slug
    category_name = hints.category_names.get(category_slug, record.category_name)
    sub_slug = record.subcategory_slug
    sub_name = record.subcategory_name

    # Three-level hierarchy category/subcategory/brand is explicit.
    if record.source_kind == "brand" and record.folder_brand_slug:
        return {
            "topCategorySlug": category_slug,
            "topCategoryName": category_name,
            "subcategorySlug": sub_slug,
            "subcategoryName": sub_name or (pretty_name(sub_slug) if sub_slug else None),
            "brandName": brand_name or pretty_name(record.folder_brand_slug),
            "brandSlug": brand_slug or record.folder_brand_slug,
        }

    # At category/child/image depth, the child may be a brand (Monitor/Asus,
    # Tablet/Samsung) OR a real subcategory (Gadget/Earbuds, TV wall mount).
    if record.source_kind == "subcategory-direct" and sub_slug:
        child_is_brand = bool(scraped_slug and scraped_slug == sub_slug)
        if not child_is_brand and (category_slug, sub_slug, scraped_slug) in hints.explicit_brand_paths:
            child_is_brand = True
        if child_is_brand:
            return {
                "topCategorySlug": category_slug,
                "topCategoryName": category_name,
                "subcategorySlug": None,
                "subcategoryName": None,
                "brandName": brand_name or sub_name or pretty_name(sub_slug),
                "brandSlug": scraped_slug or sub_slug,
            }

    return {
        "topCategorySlug": category_slug,
        "topCategoryName": category_name,
        "subcategorySlug": sub_slug,
        "subcategoryName": sub_name or (pretty_name(sub_slug) if sub_slug else None),
        "brandName": brand_name,
        "brandSlug": brand_slug,
    }


def make_unique_category_slugs(taxonomies: list[dict[str, Any]], hints: HierarchyHints) -> dict[tuple[str, str], str]:
    # Category.slug is globally unique in Prisma. Preserve simple child slugs
    # unless they collide across parents or with a top-level slug.
    top_slugs = set(hints.category_names) | {t["topCategorySlug"] for t in taxonomies}
    parents: dict[str, set[str]] = defaultdict(set)
    for parent, sub in hints.subcategory_names:
        if sub not in {slugify(x) for x in SPECIAL_FOLDERS}:
            parents[sub].add(parent)
    for t in taxonomies:
        if t.get("subcategorySlug"):
            parents[t["subcategorySlug"]].add(t["topCategorySlug"])

    mapping: dict[tuple[str, str], str] = {}
    for sub, parent_set in parents.items():
        for parent in parent_set:
            if len(parent_set) > 1 or sub in top_slugs:
                mapping[(parent, sub)] = slugify(f"{parent}-{sub}")
            else:
                mapping[(parent, sub)] = sub
    return mapping


def build_categories(products: list[dict[str, Any]], taxonomies: list[dict[str, Any]], hints: HierarchyHints) -> tuple[list[dict[str, Any]], dict[tuple[str, str], str]]:
    child_slug_map = make_unique_category_slugs(taxonomies, hints)
    top_order: dict[str, int] = {}
    top_names: dict[str, str] = {}
    child_names: dict[tuple[str, str], str] = {}
    top_images: dict[str, str] = {}
    child_images: dict[tuple[str, str], str] = {}

    # Preserve all top-level and explicit subcategory records from the hierarchy JSON,
    # even when a product page fails to match.
    for top, name in hints.category_names.items():
        top_order.setdefault(top, len(top_order))
        top_names.setdefault(top, name)
    for (top, sub), name in hints.subcategory_names.items():
        if sub not in {slugify(x) for x in SPECIAL_FOLDERS}:
            child_names.setdefault((top, sub), name)

    for idx, (product, tax) in enumerate(zip(products, taxonomies)):
        top = tax["topCategorySlug"]
        top_order.setdefault(top, len(top_order))
        top_names.setdefault(top, tax["topCategoryName"])
        top_images.setdefault(top, product["image"])
        if tax.get("subcategorySlug"):
            key = (top, tax["subcategorySlug"])
            child_names.setdefault(key, tax.get("subcategoryName") or pretty_name(tax["subcategorySlug"]))
            child_images.setdefault(key, product["image"])

    categories = []
    for top, order in sorted(top_order.items(), key=lambda x: x[1]):
        categories.append({
            "name": top_names[top],
            "slug": top,
            "parentSlug": None,
            "image": top_images.get(top),
            "isActive": True,
            "sortOrder": order,
            "showInHeader": True,
            "showInFooter": False,
            "featured": False,
        })
        children = [(key, name) for key, name in child_names.items() if key[0] == top]
        children.sort(key=lambda x: x[0][1])
        for child_order, (key, name) in enumerate(children):
            categories.append({
                "name": name,
                "slug": child_slug_map[key],
                "parentSlug": top,
                "image": child_images.get(key),
                "isActive": True,
                "sortOrder": child_order,
                "showInHeader": True,
                "showInFooter": False,
                "featured": False,
            })
    return categories, child_slug_map


# ---------------------------------------------------------------------------
# Product work unit
# ---------------------------------------------------------------------------


def scrape_group(
    stem: str,
    records: list[ImageRecord],
    client: StarTechClient,
    args: argparse.Namespace,
    hints: HierarchyHints,
) -> dict[str, Any]:
    brand_hint = next((r.folder_brand_name for r in records if r.folder_brand_name), None)
    url, soup, match = resolve_product_page(client, stem, brand_hint, args.min_match_score)
    if not url or soup is None:
        return {
            "ok": False,
            "stem": stem,
            "reason": "No confident Star Tech product match",
            "match": match,
            "sourceImages": [r.image for r in records],
            "sourceHierarchy": [r.audit_dict() for r in records],
        }

    try:
        parsed = parse_product_page(
            soup,
            url,
            stock=args.stock,
            cost_ratio=args.cost_ratio,
            respect_source_availability=args.respect_source_availability,
        )
    except Exception as exc:
        return {
            "ok": False,
            "stem": stem,
            "reason": f"Product parse failed: {exc}",
            "match": match,
            "sourceProductUrl": url,
            "sourceImages": [r.image for r in records],
            "sourceHierarchy": [r.audit_dict() for r in records],
        }

    primary = choose_primary_record(records, parsed.get("brandName"))
    taxonomy = resolve_taxonomy(primary, parsed.get("brandName"), hints)
    parsed["image"] = primary.image
    parsed["gallery"] = []
    parsed["localImageFile"] = "public" + primary.image
    parsed["sourceImages"] = [r.image for r in records]
    parsed["sourceHierarchy"] = [r.audit_dict() for r in records]
    parsed["match"] = match
    parsed["taxonomy"] = taxonomy

    return {"ok": True, "stem": stem, "product": parsed}


def ensure_unique_identities(products: list[dict[str, Any]]) -> None:
    used_slugs: set[str] = set()
    used_skus: set[str] = set()
    for product in products:
        base_slug = product["slug"]
        slug = base_slug
        n = 2
        while slug in used_slugs:
            slug = f"{base_slug}-{n}"
            n += 1
        product["slug"] = slug
        used_slugs.add(slug)

        base_sku = clean_text(product.get("sku")) or f"ST-{sha12(product['sourceProductUrl'])}"
        sku = base_sku
        n = 2
        while sku.casefold() in used_skus:
            sku = f"{base_sku}-{n}"
            n += 1
        product["sku"] = sku
        used_skus.add(sku.casefold())
        if product.get("variants"):
            product["variants"][0]["sku"] = sku


def validate_product_taxonomy(product: dict[str, Any]) -> None:
    taxonomy = product.get("taxonomy")
    required = ("topCategorySlug", "topCategoryName")
    nullable = ("subcategorySlug", "subcategoryName", "brandSlug", "brandName")
    invalid = []
    if not isinstance(taxonomy, dict):
        invalid.append("taxonomy must be an object")
    else:
        for key in required + nullable:
            if key not in taxonomy or not (
                (key in nullable and taxonomy[key] is None)
                or (isinstance(taxonomy[key], str) and taxonomy[key].strip())
            ):
                invalid.append(f"taxonomy.{key}")
        for slug, name in (("subcategorySlug", "subcategoryName"), ("brandSlug", "brandName")):
            if (taxonomy.get(slug) is None) != (taxonomy.get(name) is None):
                invalid.append(f"taxonomy.{slug}/{name} must both be present or null")
    if invalid:
        raise ValueError(
            f"Invalid product taxonomy for {product.get('name')!r} "
            f"(url={product.get('sourceProductUrl')!r}, image={product.get('image')!r}): "
            + "; ".join(invalid)
        )


def finalize_output(successes: list[dict[str, Any]], args: argparse.Namespace, hints: HierarchyHints) -> dict[str, Any]:
    # Deduplicate again by canonical Star Tech URL. Different local folders can mirror
    # the exact same product. Merge all local paths into one product record.
    by_url: dict[str, dict[str, Any]] = {}
    for result in successes:
        validate_product_taxonomy(result["product"])
    # Checkpoints and final output share successes. Never mutate worker results,
    # including nested variants modified by ensure_unique_identities().
    for result in sorted(successes, key=lambda r: (r["product"]["sourceProductUrl"], r["stem"])):
        product = copy.deepcopy(result["product"])
        url = product["sourceProductUrl"]
        if url not in by_url:
            by_url[url] = product
            continue
        existing = by_url[url]
        existing["sourceImages"] = list(dict.fromkeys(existing.get("sourceImages", []) + product.get("sourceImages", [])))
        existing["sourceHierarchy"] = existing.get("sourceHierarchy", []) + product.get("sourceHierarchy", [])
        candidates = []
        for h in existing["sourceHierarchy"]:
            rec = ImageRecord(
                image=h["image"],
                category_slug=h["categorySlug"],
                category_name=h["categoryName"],
                path_parts=urlsplit(h["image"]).path.strip("/").split("/")[:-1],
                filename_stem=image_stem(h["image"]),
                subcategory_slug=h.get("subcategorySlug"),
                subcategory_name=h.get("subcategoryName"),
                folder_brand_slug=h.get("folderBrandSlug"),
                folder_brand_name=h.get("folderBrandName"),
                source_kind=h.get("sourceKind", "unknown"),
            )
            candidates.append(rec)
        primary = choose_primary_record(candidates, existing.get("brandName"))
        existing["image"] = primary.image
        existing["gallery"] = []
        existing["localImageFile"] = "public" + primary.image
        existing["taxonomy"] = resolve_taxonomy(primary, existing.get("brandName"), hints)

    products = list(by_url.values())
    for product in products:
        validate_product_taxonomy(product)
    products.sort(key=lambda p: (p["taxonomy"]["topCategorySlug"], p["taxonomy"]["subcategorySlug"] or "", p["brandName"] or "", p["name"], p["sourceProductUrl"]))
    ensure_unique_identities(products)

    taxonomies = [p.pop("taxonomy") for p in products]
    categories, child_slug_map = build_categories(products, taxonomies, hints)
    for product, tax in zip(products, taxonomies):
        if tax.get("subcategorySlug"):
            product["categorySlug"] = child_slug_map[(tax["topCategorySlug"], tax["subcategorySlug"])]
        else:
            product["categorySlug"] = tax["topCategorySlug"]
        product["brandName"] = tax.get("brandName") or product.get("brandName")
        product["brandSlugHint"] = tax.get("brandSlug")

    return {
        "schemaVersion": 2,
        "source": {
            "site": BASE,
            "categoryHierarchyFile": str(args.category_json),
            "productImageHierarchyFile": str(args.image_json),
            "generatedAtUnix": int(time.time()),
        },
        "defaults": {
            "stock": args.stock,
            "costRatio": args.cost_ratio,
            "currency": "BDT",
            "productType": "PHYSICAL",
            "inventoryItemClass": "CONSUMABLE",
        },
        "categories": categories,
        "brands": [
            {"name": name, "slug": slug, "logo": None}
            for slug, name in sorted(
                {
                    **hints.brand_names,
                    **{slugify(p["brandName"]): p["brandName"] for p in products if p.get("brandName")},
                }.items(),
                key=lambda x: x[1].casefold(),
            )
            if slug and slug != "unknown"
        ],
        "products": products,
    }


def stats_for(seed: dict[str, Any], unmatched: list[dict[str, Any]], total_image_records: int) -> dict[str, Any]:
    products = seed.get("products", [])
    categories = seed.get("categories", [])
    brand_names = {b.get("name") for b in seed.get("brands", []) if b.get("name")}
    group_count = sum(len(p.get("specificationGroups", [])) for p in products)
    spec_count = sum(sum(len(g.get("items", [])) for g in p.get("specificationGroups", [])) for p in products)
    option_count = sum(len(p.get("variantOptions", [])) for p in products)
    review_count = sum(bool(p.get("needsReview")) for p in products)
    return {
        "sourceImageRecords": total_image_records,
        "uniqueProducts": len(products),
        "categories": len(categories),
        "brands": len(brand_names),
        "specificationGroups": group_count,
        "specificationItems": spec_count,
        "variantOptions": option_count,
        "unmatched": len(unmatched),
        "needsReview": review_count,
        "productsByTopCategory": dict(sorted(Counter(
            (p.get("sourceHierarchy") or [{}])[0].get("categorySlug", "unknown") for p in products
        ).items())),
    }


def resolve_input_path(path: Path, alternatives: list[Path]) -> Path:
    if path.exists():
        return path
    for candidate in alternatives:
        if candidate.exists():
            return candidate
    return path


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--category-json", default="prisma/startech_category_subcategory_brand_seed.json", type=Path)
    parser.add_argument("--image-json", default="product_image_hierarchy.json", type=Path)
    parser.add_argument("--output", default="prisma/startech_full_product_seed.json", type=Path)
    parser.add_argument("--cache-dir", default=".cache/startech-full-seed", type=Path)
    parser.add_argument("--category", default="")
    parser.add_argument("--subcategory", default="")
    parser.add_argument("--brand", default="")
    parser.add_argument("--limit", type=int, default=0, help="Limit image records after filters; 0 = all")
    parser.add_argument("--stock", type=int, default=200)
    parser.add_argument("--cost-ratio", type=float, default=0.96)
    parser.add_argument("--delay", type=float, default=0.35)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--timeout", type=int, default=45)
    parser.add_argument("--min-match-score", type=float, default=0.72)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--respect-source-availability", action="store_true", help="Use Star Tech In Stock/Out Of Stock status. Default seed keeps local catalog products available.")
    args = parser.parse_args()

    args.category_json = resolve_input_path(
        args.category_json,
        [Path("startech_category_subcategory_brand_seed.json"), Path("category_subcategory_brand_seed.json")],
    )
    args.image_json = resolve_input_path(
        args.image_json,
        [Path("prisma/product_image_hierarchy.json"), Path("product_image_hierarchy.json")],
    )

    if args.stock < 0:
        parser.error("--stock must be >= 0")
    if not 0 <= args.cost_ratio <= 1:
        parser.error("--cost-ratio must be between 0 and 1")
    if args.workers < 1:
        parser.error("--workers must be >= 1")
    if args.delay < 0:
        parser.error("--delay must be >= 0")
    if not 0 <= args.min_match_score <= 1.25:
        parser.error("--min-match-score must be between 0 and 1.25")

    for p in (args.category_json, args.image_json):
        if not p.exists():
            parser.error(f"Missing input file: {p}")

    hints = load_hierarchy_hints(args.category_json)
    all_records = list(iter_image_records(args.image_json, hints))
    records = filter_records(all_records, args)
    if not records:
        print("No image records matched the selected filters.")
        return 2

    grouped: dict[str, list[ImageRecord]] = defaultdict(list)
    for record in records:
        grouped[record.filename_stem].append(record)

    print("=" * 80)
    print("STAR TECH FULL SEED GENERATOR")
    print("=" * 80)
    print(f"Hierarchy image records : {len(records)}")
    print(f"Unique filename stems   : {len(grouped)}")
    print(f"Workers                 : {args.workers}")
    print(f"Delay                   : {args.delay}s (global request spacing)")
    print(f"Output                  : {args.output}")
    print("=" * 80)

    client = StarTechClient(args.cache_dir, args.delay, refresh=args.refresh, timeout=args.timeout)
    successes: list[dict[str, Any]] = []
    unmatched: list[dict[str, Any]] = []

    items = list(grouped.items())
    completed = 0

    def worker(item):
        stem, recs = item
        return scrape_group(stem, recs, client, args, hints)

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        future_map = {pool.submit(worker, item): item[0] for item in items}
        for future in as_completed(future_map):
            stem = future_map[future]
            completed += 1
            try:
                result = future.result()
            except Exception as exc:
                result = {
                    "ok": False,
                    "stem": stem,
                    "reason": f"Unhandled worker error: {exc}",
                    "sourceImages": [r.image for r in grouped[stem]],
                    "sourceHierarchy": [r.audit_dict() for r in grouped[stem]],
                }
            if result.get("ok"):
                successes.append(result)
                p = result["product"]
                print(f"[{completed}/{len(items)}] OK   {p['name']} | {p['image']}")
            else:
                unmatched.append(result)
                print(f"[{completed}/{len(items)}] MISS {stem}: {result.get('reason')}", file=sys.stderr)

            # Lightweight checkpoint every 25 completed work items.
            if completed % 25 == 0 or completed == len(items):
                partial_seed = finalize_output(successes, args, hints)
                json_dump_atomic(args.output, partial_seed)
                json_dump_atomic(args.output.with_suffix(".unmatched.json"), unmatched)
                json_dump_atomic(
                    args.output.with_suffix(".stats.json"),
                    stats_for(partial_seed, unmatched, len(records)),
                )

    seed = finalize_output(successes, args, hints)
    stats = stats_for(seed, unmatched, len(records))
    json_dump_atomic(args.output, seed)
    json_dump_atomic(args.output.with_suffix(".unmatched.json"), unmatched)
    json_dump_atomic(args.output.with_suffix(".stats.json"), stats)

    print("\n" + "=" * 80)
    print("DONE")
    print("=" * 80)
    for key, value in stats.items():
        if key != "productsByTopCategory":
            print(f"{key:24}: {value}")
    print(f"Seed JSON               : {args.output.resolve()}")
    print(f"Unmatched               : {args.output.with_suffix('.unmatched.json').resolve()}")
    print(f"Stats                   : {args.output.with_suffix('.stats.json').resolve()}")
    return 1 if unmatched else 0


if __name__ == "__main__":
    raise SystemExit(main())
