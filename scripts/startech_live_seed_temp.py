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
            time.sleep(0.06)
            return BeautifulSoup(r.text, "html.parser")
        except Exception as e:
            last = e
            time.sleep(1 + i)
    raise last

def money_values(text):
    vals = []
    for raw in re.findall(r"([0-9][0-9,]*)\s*৳", text or ""):
        try:
            vals.append(int(raw.replace(",", "")))
        except Exception:
            pass
    return vals

def product_cards(soup):
    for sel in (".p-item", ".product-layout", ".product-thumb"):
        cards = soup.select(sel)
        if cards:
            return cards
    return []

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
    prices = money_values(text)
    if not prices:
        return None
    base_price = prices[0]
    original_price = prices[1] if len(prices) > 1 and prices[1] > base_price else None

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
    public_url = f"/images/products/startech/{category_slug}/{pslug}{ext}"
    sku = "ST-" + hashlib.sha1(product_url.encode()).hexdigest()[:12].upper()
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
        "image": public_url if source_image else "",
        "gallery": [public_url] if source_image else [],
        "shortDesc": short_desc,
        "description": short_desc,
        "weight": None,
        "dimensions": None,
        "variants": [],
        "sourceProductUrl": product_url,
        "sourceImageUrl": source_image,
        "sourceGalleryUrls": [source_image] if source_image else [],
        "localImageFile": f"public{public_url}" if source_image else None,
    }

def collect_products(url, category_slug, limit=10):
    products, seen = [], set()
    for page in range(1, 5):
        try:
            soup = get_soup(with_query(url, page=page, limit=24))
        except Exception as e:
            print("WARN listing failed", url, e)
            break
        cards = product_cards(soup)
        if not cards:
            break
        for card in cards:
            item = product_from_card(card, category_slug)
            if not item or item["sourceProductUrl"] in seen:
                continue
            seen.add(item["sourceProductUrl"])
            products.append(item)
            if len(products) >= limit:
                return products
    return products

def direct_menu_children(home, root_url):
    root_url = canon(root_url)
    candidates = []
    for a in home.select("a[href]"):
        try:
            if canon(a.get("href")) == root_url:
                candidates.append(a)
        except Exception:
            pass
    if not candidates:
        return []

    best = []
    for root_a in candidates:
        root_li = root_a.find_parent("li")
        if not root_li:
            continue
        children = []
        seen = set()
        for a in root_li.find_all("a", href=True):
            if a is root_a:
                continue
            name = clean(a.get_text(" ", strip=True))
            if not name or len(name) > 80:
                continue
            url = canon(a.get("href"))
            if url == root_url or not same_site(url) or url in seen:
                continue

            # Count LI ancestors between child anchor and the root LI.
            li = a.find_parent("li")
            depth = 0
            cur = li
            while cur is not None and cur is not root_li:
                cur = cur.find_parent("li")
                depth += 1
                if depth > 8:
                    break
            if cur is not root_li:
                continue
            if depth != 1:
                continue

            low_url = url.lower()
            if any(x in low_url for x in ["/account", "/login", "/register", "/cart", "/compare", "/offer", "/blog"]):
                continue
            seen.add(url)
            children.append((name, url))
        if len(children) > len(best):
            best = children
    return best

def root_name_from_page(soup, fallback):
    h1 = soup.select_one("h1")
    if h1:
        t = clean(h1.get_text(" ", strip=True))
        t = re.sub(r"\s+Price.*$", "", t, flags=re.I)
        if t and len(t) < 100:
            return t
    return fallback

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
    home = get_soup(BASE)
    categories, targets = [], []
    used_slugs = set()
    sort_order = 10

    for fallback_name, path in ROOTS:
        root_url = canon(path)
        try:
            root_soup = get_soup(root_url)
        except Exception as e:
            print("WARN root skipped", root_url, e)
            continue
        root_name = root_name_from_page(root_soup, fallback_name)
        root_slug = slugify(fallback_name)
        if root_slug in used_slugs:
            root_slug += "-" + hashlib.sha1(root_url.encode()).hexdigest()[:5]
        used_slugs.add(root_slug)
        categories.append(category_record(root_name, root_slug, None, root_url, sort_order, True))
        sort_order += 10

        children = direct_menu_children(home, root_url)
        if children:
            print("ROOT", root_name, "children", len(children))
            for child_name, child_url in children:
                cslug = root_slug + "-" + slugify(child_name)
                if cslug in used_slugs:
                    cslug += "-" + hashlib.sha1(child_url.encode()).hexdigest()[:5]
                used_slugs.add(cslug)
                categories.append(category_record(child_name, cslug, root_slug, child_url, sort_order, False))
                sort_order += 10
                targets.append((child_name, cslug, child_url))
                print(" TARGET", child_name, child_url)
        else:
            print("ROOT", root_name, "no direct menu children; using root")
            targets.append((root_name, root_slug, root_url))

    all_products, global_urls = [], set()
    per_category = {}
    for idx, (name, cslug, url) in enumerate(targets, 1):
        print(f"[{idx}/{len(targets)}] {name}")
        items = collect_products(url, cslug, 10)
        kept = []
        for item in items:
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
    Path("startech_productseed.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    stats = {
        "categoryRecords": len(categories),
        "targetProductCategories": len(targets),
        "products": len(all_products),
        "productsPerCategory": per_category,
    }
    Path("startech_productseed.stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("DONE", json.dumps(stats))

if __name__ == "__main__":
    main()
