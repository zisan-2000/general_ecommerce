#!/usr/bin/env python3
"""Refresh Star Tech seed from live listings and keep up to 50 products/category."""
from __future__ import annotations
import argparse, copy, hashlib, json, math, re, sys, tempfile, time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote, unquote, urljoin, urlsplit, urlunsplit
import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from download_startech_images import HEADERS

BASE = "https://www.startech.com.bd"
DEFAULT_JSON = "prisma/startech_productseed.json"
DEFAULT_STATS = "prisma/startech_productseed.stats.json"

def canonical(url: str) -> str:
    parsed = urlsplit(urljoin(BASE, url))
    if parsed.hostname != "www.startech.com.bd" or parsed.scheme not in ("http","https"):
        raise ValueError(f"Unexpected source URL: {url}")
    return urlunsplit(("https", parsed.netloc, quote(unquote(parsed.path).strip().rstrip("/"), safe="/"), "", ""))

def fetch(url: str, delay: float) -> BeautifulSoup:
    cache = Path(tempfile.gettempdir()) / "general-ecommerce-startech-pages"
    cache.mkdir(exist_ok=True)
    cached = cache / (hashlib.sha256(url.encode()).hexdigest()+".html")
    if cached.exists() and time.time() - cached.stat().st_mtime < 3600:
        return BeautifulSoup(cached.read_text(encoding="utf-8"), "html.parser")
    time.sleep(delay)
    with requests.Session() as session:
        session.headers.update(HEADERS)
        session.mount("https://", HTTPAdapter(max_retries=Retry(total=3, backoff_factor=1, status_forcelist=[429,500,502,503,504])))
        r = session.get(url, timeout=40)
        r.raise_for_status()
        cached.write_text(r.text, encoding="utf-8")
        return BeautifulSoup(r.text, "html.parser")

def money(text: str):
    m = re.search(r"\d[\d,]*(?:\.\d+)?", text or "")
    return float(m.group().replace(",","")) if m else None

def text_at(soup, selector: str) -> str:
    n = soup.select_one(selector)
    return n.get_text(" ", strip=True) if n else ""

def parse_product(soup: BeautifulSoup, url: str, category: str, existing: dict|None):
    status = text_at(soup, ".product-status").lower()
    offer = soup.select_one('.short-description [itemprop="availability"]')
    availability = (offer.get("href","") or offer.get("content","")) if offer else ""
    if not status and not availability:
        raise ValueError(f"Missing availability markup: {url}")
    if status not in ("in stock","available") and (status or not availability.endswith("/InStock")):
        return None
    price_node = soup.select_one(".product-info-table .product-price")
    if not price_node:
        raise ValueError(f"Missing price markup: {url}")
    current = price_node.select_one("ins")
    if current:
        price = money(current.get_text())
    else:
        clean_price = BeautifulSoup(str(price_node), "html.parser")
        for old in clean_price.select("del"): old.decompose()
        price = money(clean_price.get_text())
    if price is None or price <= 0: return None
    old_price = price_node.select_one("del")
    original = money(old_price.get_text()) if old_price else None

    image_node = soup.select_one(".product-img-holder img")
    src = (image_node.get("src") or image_node.get("data-src")) if image_node else None
    name = text_at(soup, "h1")
    if not src or not name:
        raise ValueError(f"Missing product name/image: {url}")
    src = urljoin(url, src)
    ext = Path(urlsplit(src).path).suffix.lower()
    if ext not in (".jpg",".jpeg",".png",".webp",".avif",".gif"):
        raise ValueError(f"Unexpected image extension: {src}")

    features = [li.get_text(" ", strip=True) for li in soup.select(".short-description li:not(.view-more)")]
    model = next((line.split(":",1)[1].strip() for line in features if line.lower().startswith("model:")), None)
    warranty = None
    for row in soup.select("#specification tr"):
        cells = row.select("td")
        if len(cells)==2 and "warranty" in cells[0].get_text().lower():
            warranty = cells[1].get_text(" ", strip=True) or None

    slug = existing["slug"] if existing and existing.get("slug") else re.sub(r"[^a-z0-9]+","-",name.lower()).strip("-")
    sku = existing["sku"] if existing and existing.get("sku") else "ST-"+hashlib.sha256(url.encode()).hexdigest()[:12].upper()
    image = f"/images/products/startech/{category}/{slug}{ext}"
    if existing and existing.get("image") and Path(existing["image"]).suffix.lower()==ext:
        image = existing["image"]

    p = copy.deepcopy(existing) if existing else {"featured":False,"stock":10,"weight":None,"dimensions":None,"variants":[]}
    p.update({
        "name":name,"slug":slug,"sku":sku,"categorySlug":category,
        "brandName":text_at(soup,".product-brand") or None,
        "model":model,"warranty":warranty,
        "basePrice":price,"originalPrice":original if original and original>price else None,
        "currency":"BDT","available":True,"image":image,"gallery":[image],
        "shortDesc":"; ".join(features) or None,"description":"; ".join(features) or name,
        "sourceProductUrl":url,"sourceImageUrl":src,"sourceGalleryUrls":[src],
        "localImageFile":"public"+image,
    })
    return p

def resolve_slug_collisions(data: dict) -> int:
    used = {}
    fixed = 0
    for p in data["products"]:
        slug = (p.get("slug") or "").strip()
        src = canonical(p["sourceProductUrl"])
        if not slug:
            slug = "product-" + hashlib.sha256(src.encode()).hexdigest()[:8]
        if slug in used and used[slug] != src:
            base = slug
            slug = f"{base}-{hashlib.sha256(src.encode()).hexdigest()[:8]}"
            while slug in used and used[slug] != src:
                slug += "x"
            fixed += 1
            print(f"Resolved duplicate slug: {base} -> {slug}")
        used[slug] = src
        if slug != p.get("slug"):
            ext = Path(p.get("image","")).suffix or Path(urlsplit(p.get("sourceImageUrl","")).path).suffix or ".jpg"
            p["slug"] = slug
            image = f"/images/products/startech/{p['categorySlug']}/{slug}{ext}"
            p["image"] = image
            p["gallery"] = [image]
            p["localImageFile"] = "public" + image

    # category images must point to included product images
    by_cat = {}
    for p in data["products"]:
        by_cat.setdefault(p["categorySlug"], p["image"])
    for c in data["categories"]:
        if c["slug"] in by_cat:
            c["image"] = by_cat[c["slug"]]
    return fixed

def stats_for(data: dict):
    counts = Counter(p["categorySlug"] for p in data["products"])
    targets = [c["slug"] for c in data["categories"] if c.get("sourceCategoryUrl")]
    return {"categoryRecords":len(data["categories"]),"targetProductCategories":len(targets),"products":len(data["products"]),"productsPerCategory":{s:counts[s] for s in targets}}

def validate(data: dict, limit=50):
    categories, products = data["categories"], data["products"]
    category_slugs = {c["slug"] for c in categories}
    if len(category_slugs)!=len(categories): raise ValueError("Duplicate category slugs")
    seen_categories=set()
    for c in categories:
        parent=c.get("parentSlug")
        if parent is not None and parent not in seen_categories:
            raise ValueError(f"Missing parent or parent ordered after child: {c['slug']}")
        seen_categories.add(c["slug"])
    for key in ("slug","sku","sourceProductUrl"):
        vals=[canonical(p[key]) if key=="sourceProductUrl" else p.get(key) for p in products]
        if len(vals)!=len(set(vals)) or not all(vals): raise ValueError(f"Empty or duplicate {key}")
    for p in products:
        if p["categorySlug"] not in category_slugs: raise ValueError(f"Unknown category: {p['slug']}")
        price=p["basePrice"]
        if isinstance(price,bool) or not isinstance(price,(int,float)) or not math.isfinite(price) or not 0<price<100000000:
            raise ValueError(f"Invalid price: {p['slug']}")
        image=p["image"]
        if not image.startswith(f"/images/products/startech/{p['categorySlug']}/") or p["localImageFile"]!="public"+image:
            raise ValueError(f"Inconsistent image path: {p['slug']}")
        if not p.get("sourceImageUrl") or urlsplit(p["sourceImageUrl"]).scheme not in ("http","https"):
            raise ValueError(f"Missing source image: {p['slug']}")
        if p.get("gallery") != [image] or not isinstance(p.get("variants"),list):
            raise ValueError(f"Invalid gallery/variants: {p['slug']}")
    stats=stats_for(data)
    if any(v>limit for v in stats["productsPerCategory"].values()): raise ValueError("Category exceeds requested limit")
    return stats

def build(data: dict, limit: int, workers: int, delay: float):
    result=copy.deepcopy(data)
    result["products"]=[]
    existing={canonical(p["sourceProductUrl"]):p for p in data["products"]}
    assigned=set()

    for category in data["categories"]:
        source=category.get("sourceCategoryUrl")
        if not source: continue
        slug=category["slug"]
        collected=[]; checked=set(); failures=[]

        def read_product(url):
            old=existing.get(url)
            try: return parse_product(fetch(url,delay),url,slug,old)
            except (requests.RequestException,ValueError) as exc:
                failures.append(url); print(f"SKIP detail {url}: {exc}",flush=True); return None

        def collect(urls):
            urls=list(dict.fromkeys(u for u in urls if u not in checked and u not in assigned and (u not in existing or existing[u]["categorySlug"]==slug)))
            checked.update(urls)
            with ThreadPoolExecutor(max_workers=workers) as pool:
                for product in pool.map(read_product, urls):
                    if product and len(collected)<limit:
                        collected.append(product); assigned.add(product["sourceProductUrl"])

        collect([u for u,p in existing.items() if p["categorySlug"]==slug][:limit])
        page=1; fingerprints=set()
        while len(collected)<limit:
            soup=fetch(f"{source}?limit=90&page={page}",delay)
            cards=soup.select(".p-item")
            if not cards: raise ValueError(f"No listing cards found at {source}, page {page}; refusing partial output")
            urls=[]
            for card in cards:
                a=card.select_one(".p-item-name a")
                offer=card.select_one('[itemprop="availability"]')
                availability=(offer.get("content","") or offer.get("href","")) if offer else ""
                if a and availability.endswith("/InStock"): urls.append(canonical(a["href"]))
            fp=tuple(a["href"] for a in soup.select(".p-item-name a"))
            if fp in fingerprints: break
            fingerprints.add(fp)
            for offset in range(0,len(urls),workers):
                if len(collected)>=limit: break
                collect(urls[offset:offset+workers])
            next_link=next((a for a in soup.select(".pagination a") if a.get_text(strip=True).upper()=="NEXT"),None)
            if not next_link: break
            page+=1
        if failures and len(collected)<limit:
            raise ValueError(f"{slug}: failed to verify {len(failures)} pages; retry before accepting a short category")
        result["products"].extend(collected)
        print(f"{slug}: {len(collected)}/{limit} available products ({len(checked)} checked)",flush=True)

    fixed=resolve_slug_collisions(result)
    print(f"Slug collisions resolved: {fixed}",flush=True)
    return result

def main():
    if hasattr(sys.stdout,"reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    ap=argparse.ArgumentParser()
    ap.add_argument("--json",default=DEFAULT_JSON); ap.add_argument("--stats",default=DEFAULT_STATS)
    ap.add_argument("--limit",type=int,default=50); ap.add_argument("--workers",type=int,default=4)
    ap.add_argument("--delay",type=float,default=0.2); ap.add_argument("--validate-only",action="store_true")
    args=ap.parse_args()
    path,stats_path=Path(args.json),Path(args.stats)
    data=json.loads(path.read_text(encoding="utf-8"))
    if not args.validate_only: data=build(data,args.limit,args.workers,args.delay)
    stats=validate(data,args.limit)
    if args.validate_only:
        if json.loads(stats_path.read_text(encoding="utf-8")) != stats: raise ValueError("Stats do not match actual seed")
    else:
        path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        stats_path.write_text(json.dumps(stats,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(stats,indent=2))
    return 0

if __name__=="__main__": raise SystemExit(main())
