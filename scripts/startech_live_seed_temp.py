#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse, urlencode, parse_qs, urlunparse

import requests
from bs4 import BeautifulSoup

BASE = "https://www.startech.com.bd"

ROOTS = [
    ("Laptop & Notebook", "/laptop-notebook"),
    ("Desktop PC", "/desktop-pc"),
    ("Component", "/component"),
    ("Monitor", "/monitor"),
    ("UPS", "/ups"),
    ("Mobile Phone", "/mobile-phone"),
    ("Tablet", "/tablet-pc"),
    ("Office Equipment", "/office-equipment"),
    ("Camera", "/camera"),
    ("Security", "/security-camera"),
    ("Networking", "/networking"),
    ("Software", "/software"),
    ("Server & Storage", "/server-networking"),
    ("Accessories", "/accessories"),
    ("Gadget", "/gadget"),
    ("Gaming", "/gaming"),
    ("TV", "/television"),
    ("Appliance", "/appliance"),
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}

session = requests.Session()
session.headers.update(HEADERS)

def clean(s):
    return re.sub(r"\s+", " ", s or "").strip()

def slugify(s):
    s = clean(s).lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "item"

def canon(url):
    u = urljoin(BASE, url)
    p = urlparse(u)
    return urlunparse((p.scheme, p.netloc, p.path.rstrip("/") or "/", "", "", ""))

def same_site(url):
    return urlparse(urljoin(BASE, url)).netloc in {"startech.com.bd", "www.startech.com.bd"}

def with_query(url, **kwargs):
    p = urlparse(url)
    q = parse_qs(p.query)
    for k, v in kwargs.items():
        q[k] = [str(v)]
    return urlunparse((p.scheme, p.netloc, p.path, p.params, urlencode(q, doseq=True), p.fragment))

def get_soup(url, retries=4):
    last = None
    for i in range(retries):
        try:
            r = session.get(url, timeout=35)
            r.raise_for_status()
            time.sleep(0.08)
            return BeautifulSoup(r.text, "html.parser")
        except Exception as e:
            last = e
            time.sleep(1 + i)
    raise last

def title_from_page(soup, fallback):
    h1 = soup.select_one("h1")
    if h1:
        t = clean(h1.get_text(" ", strip=True))
        t = re.sub(r"\s+Price.*$", "", t, flags=re.I)
        if t and len(t) < 100:
            return t
    return fallback

def category_links(soup, current_url):
    current = canon(current_url)
    selectors = [
        ".cat-items .cat-item a",
        ".cat-items a.cat-item",
        ".cat-items a",
        ".cat-item a",
        ".category-list a",
        ".sub-category a",
        ".sub-categories a",
        ".category-item a",
        ".child-cat a",
        ".child-category a",
    ]
    out = []
    seen = set()
    for sel in selectors:
        found = []
        for a in soup.select(sel):
            href = a.get("href")
            name = clean(a.get_text(" ", strip=True))
            if not href or not name or len(name) > 90:
                continue
            url = canon(href)
            if not same_site(url) or url == current or url in seen:
                continue
            low = name.lower()
            if low in {"next", "prev", "buy now", "compare", "view more", "show all"}:
                continue
            if any(x in url.lower() for x in ["/account", "/login", "/register", "/cart", "/compare", "/offer", "/blog"]):
                continue
            seen.add(url)
            found.append((name, url))
        if found:
            out.extend(found)
            break
    return out

def money_values(text):
    vals = []
    for raw in re.findall(r"([0-9][0-9,]*)\s*৳", text or ""):
        try:
            vals.append(int(raw.replace(",", "")))
        except Exception:
            pass
    return vals

def product_cards(soup):
    cards = soup.select(".p-item")
    if not cards:
        cards = soup.select(".product-layout")
    if not cards:
        cards = soup.select(".product-thumb")
    return cards

def image_src(card):
    img = card.select_one(".p-item-img img") or card.select_one(".image img") or card.select_one("img")
    if not img:
        return None
    for attr in ("data-src", "data-original", "data-lazy", "src"):
        value = img.get(attr)
        if value and not str(value).startswith("data:"):
            return urljoin(BASE, str(value))
    return None

def product_from_card(card, category_slug):
    link = card.select_one(".p-item-name a") or card.select_one(".product-name a") or card.select_one("h4 a") or card.select_one("h3 a")
    if not link or not link.get("href"):
        return None
    name = clean(link.get_text(" ", strip=True))
    if len(name) < 3:
        return None

    text = clean(card.get_text(" ", strip=True))
    low = text.lower()
    if "out of stock" in low or "up coming" in low or "upcoming" in low:
        return None

    product_url = canon(link.get("href"))
    if not same_site(product_url):
        return None

    prices = money_values(text)
    if not prices:
        return None
    base_price = prices[0]
    original_price = None
    if len(prices) > 1 and prices[1] > base_price:
        original_price = prices[1]

    features = []
    for li in card.select("li"):
        t = clean(li.get_text(" ", strip=True))
        if t and t not in features:
            features.append(t)
    short_desc = "; ".join(features[:4]) if features else name

    source_image = image_src(card)
    pslug = slugify(name)
    ext = ".webp"
    if source_image:
        path = urlparse(source_image).path.lower()
        for candidate in (".jpg", ".jpeg", ".png", ".webp"):
            if candidate in path:
                ext = candidate
                break
    local_public = f"/images/products/startech/{category_slug}/{pslug}{ext}"
    local_file = f"public{local_public}"

    sku = "ST-" + hashlib.sha1(product_url.encode("utf-8")).hexdigest()[:12].upper()
    brand = clean(name.split()[0]).strip(",-/") or None

    return {
        "name": name,
        "slug": pslug,
        "sku": sku,
        "categorySlug": category_slug,
        "brandName": brand,
        "model": None,
        "warranty": None,
        "basePrice": base_price,
        "originalPrice": original_price,
        "currency": "BDT",
        "stock": 10,
        "available": True,
        "featured": False,
        "image": local_public if source_image else "",
        "gallery": [local_public] if source_image else [],
        "shortDesc": short_desc,
        "description": short_desc,
        "weight": None,
        "dimensions": None,
        "variants": [],
        "sourceProductUrl": product_url,
        "sourceImageUrl": source_image,
        "sourceGalleryUrls": [source_image] if source_image else [],
        "localImageFile": local_file if source_image else None,
    }

def collect_products(url, category_slug, limit=10):
    products = []
    seen = set()
    for page in range(1, 5):
        page_url = with_query(url, page=page, limit=24)
        try:
            soup = get_soup(page_url)
        except Exception as e:
            print("WARN listing failed", page_url, e)
            break
        cards = product_cards(soup)
        if not cards:
            break
        for card in cards:
            item = product_from_card(card, category_slug)
            if not item:
                continue
            if item["sourceProductUrl"] in seen:
                continue
            seen.add(item["sourceProductUrl"])
            products.append(item)
            if len(products) >= limit:
                return products
    return products

def category_record(name, slug, parent_slug, source_url, sort_order, root=False):
    return {
        "name": name,
        "slug": slug,
        "parentSlug": parent_slug,
        "image": None,
        "isActive": True,
        "sortOrder": sort_order,
        "showInHeader": bool(root),
        "showInFooter": False,
        "featured": False,
        "sourceCategoryUrl": source_url,
    }

def main():
    categories = []
    targets = []
    used_cat_slugs = set()
    sort_order = 10

    for fallback_name, path in ROOTS:
        url = canon(path)
        try:
            soup = get_soup(url)
        except Exception as e:
            print("WARN root skipped", url, e)
            continue

        root_name = title_from_page(soup, fallback_name)
        root_slug = slugify(fallback_name)
        if root_slug in used_cat_slugs:
            root_slug += "-" + hashlib.sha1(url.encode()).hexdigest()[:5]
        used_cat_slugs.add(root_slug)
        categories.append(category_record(root_name, root_slug, None, url, sort_order, True))
        sort_order += 10

        children = category_links(soup, url)
        # Keep only unique child destinations; if the page exposes no category chips,
        # the root itself becomes the product category.
        if not children:
            targets.append((root_name, root_slug, url))
            print("TARGET ROOT", root_name, url)
            continue

        for child_name, child_url in children:
            cslug = root_slug + "-" + slugify(child_name)
            if cslug in used_cat_slugs:
                cslug += "-" + hashlib.sha1(child_url.encode()).hexdigest()[:5]
            used_cat_slugs.add(cslug)
            categories.append(category_record(child_name, cslug, root_slug, child_url, sort_order, False))
            sort_order += 10
            targets.append((child_name, cslug, child_url))
            print("TARGET", root_name, ">", child_name, child_url)

    all_products = []
    global_urls = set()
    per_category = {}
    for idx, (name, cslug, url) in enumerate(targets, 1):
        print(f"[{idx}/{len(targets)}] {name}")
        items = collect_products(url, cslug, 10)
        kept = []
        for item in items:
            # Product model has one categoryId, so globally de-duplicate.
            purl = item["sourceProductUrl"]
            if purl in global_urls:
                continue
            global_urls.add(purl)
            kept.append(item)
            all_products.append(item)
            if len(kept) >= 10:
                break
        per_category[cslug] = len(kept)
        print("  collected", len(kept))

    first_image = {}
    for p in all_products:
        if p["image"] and p["categorySlug"] not in first_image:
            first_image[p["categorySlug"]] = p["image"]
    for c in categories:
        if c["slug"] in first_image:
            c["image"] = first_image[c["slug"]]

    payload = {"categories": categories, "products": all_products}
    Path("startech_productseed.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8"
    )
    stats = {
        "categoryRecords": len(categories),
        "targetProductCategories": len(targets),
        "products": len(all_products),
        "productsPerCategory": per_category,
    }
    Path("startech_productseed.stats.json").write_text(
        json.dumps(stats, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8"
    )
    print("DONE", stats)

if __name__ == "__main__":
    main()
