#!/usr/bin/env python3
"""
Download ALL Star Tech Office Equipment product primary images into hierarchy folders.

Source:
    https://www.startech.com.bd/office-equipment

Default output:
    public/images/products/office-equipment/...

Current direct categories on Star Tech include:
    projector
    conference-system
    pa-system
    interactive-flat-panel
    video-wall
    signage-kiosk
    printer
      laser-printer
      large-format-printer
      id-card-printer
      pos-printer
      label-printer
    digital-weight-machine
    photocopier
    toner-cartridge
    ink-bottle
    ribbon
    printer-paper
    printer-drum
    scanner
    barcode-scanner
    cash-drawer
    telephone-set
    ip-phone
    pabx-system
    money-counting-machine
    paper-shredder
    laminating-machine
    binding-machine

Examples:
    python -m pip install requests beautifulsoup4

    # Mapping only
    python download_startech_office_equipment_images.py --project-root . --dry-run

    # Test first 10
    python download_startech_office_equipment_images.py --project-root . --limit 10

    # Download all Office Equipment product images
    python download_startech_office_equipment_images.py --project-root .

    # Download one branch
    python download_startech_office_equipment_images.py --project-root . --category printer
    python download_startech_office_equipment_images.py --project-root . --category scanner

    # Re-download existing images
    python download_startech_office_equipment_images.py --project-root . --overwrite
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
OFFICE_URL = f"{BASE}/office-equipment"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Referer": BASE + "/",
}

CATEGORY_TREE = OrderedDict([
    ("Projector", []),
    ("Conference System", []),
    ("PA System", []),
    ("Interactive Flat Panel", []),
    ("Video Wall", []),
    ("Signage Kiosk", []),
    ("Printer", [
        "Laser Printer",
        "Large Format Printer",
        "ID Card Printer",
        "POS Printer",
        "Label Printer",
    ]),
    ("Digital Weight Machine", []),
    ("Photocopier", []),
    ("Toner Cartridge", []),
    ("Ink Bottle", []),
    ("Ribbon", []),
    ("Printer Paper", []),
    ("Printer Drum", []),
    ("Scanner", []),
    ("Barcode Scanner", []),
    ("Cash Drawer", []),
    ("Telephone Set", []),
    ("IP Phone", []),
    ("PABX System", []),
    ("Money Counting Machine", []),
    ("Paper Shredder", []),
    ("Laminating Machine", []),
    ("Binding Machine", []),
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
            status_forcelist=(429,500,502,503,504),
            allowed_methods=frozenset({"GET"}),
            respect_retry_after_header=True,
        )
        self.session.mount("https://", HTTPAdapter(max_retries=retry))
        self.cache: dict[str,str] = {}

    def soup(self, url: str) -> BeautifulSoup:
        full = urljoin(BASE, url)
        if full not in self.cache:
            r = self.session.get(full, timeout=40)
            r.raise_for_status()
            self.cache[full] = r.text
            if self.delay:
                time.sleep(self.delay)
        return BeautifulSoup(self.cache[full], "html.parser")

    def image_response(self, url: str) -> requests.Response:
        r = self.session.get(urljoin(BASE, url), timeout=60, stream=True)
        r.raise_for_status()
        ctype = (r.headers.get("content-type") or "").split(";")[0].strip().lower()
        if ctype and not ctype.startswith("image/"):
            r.close()
            raise ValueError(f"Expected image response, received {ctype}")
        return r

def parse_count(soup: BeautifulSoup):
    m = re.search(
        r"Showing\s+\d+\s+to\s+\d+\s+of\s+([\d,]+)\s+\(([\d,]+)\s+Pages?\)",
        soup.get_text(" ", strip=True),
        re.I,
    )
    if not m:
        return None, None
    return int(m.group(1).replace(",","")), int(m.group(2).replace(",",""))

def product_links(soup: BeautifulSoup) -> OrderedDict[str,str]:
    out = OrderedDict()
    for sel in [".p-item-name a",".product-layout h4 a",".product-thumb h4 a",".product-name a"]:
        for a in soup.select(sel):
            href = a.get("href")
            name = a.get_text(" ", strip=True)
            if href and name:
                out.setdefault(canonical(href), name)
        if out:
            break
    return out

def crawl(client: Client, url: str, verbose=False):
    products = OrderedDict()
    page = 1
    total = pages = None
    while True:
        soup = client.soup(with_page(url,page))
        if page == 1:
            total, pages = parse_count(soup)
        batch = product_links(soup)
        before = len(products)
        for u,n in batch.items():
            products.setdefault(u,n)
        if verbose:
            print(
                f"  page {page}: {len(batch)} cards, "
                f"{len(products)-before} new, collected {len(products)}"
                + (f"/{total}" if total is not None else "")
            )
        if pages is not None:
            if page >= pages:
                break
        else:
            if not batch or len(products)==before:
                break
            if page >= 200:
                raise RuntimeError(f"Pagination safety limit reached: {url}")
        page += 1
    return products, total

def find_exact_link(client: Client, page_url: str, label: str) -> str | None:
    soup = client.soup(page_url)
    wanted = norm_text(label)
    candidates = []
    parent_path = urlparse(canonical(page_url)).path.rstrip("/").lower()
    for a in soup.find_all("a", href=True):
        if norm_text(a.get_text(" ", strip=True)) != wanted:
            continue
        u = canonical(a["href"])
        path = urlparse(u).path.lower()
        score = 0
        if parent_path and path.startswith(parent_path + "/"):
            score += 50
        if any(tok in path for tok in slugify(label).split("-") if len(tok)>=3):
            score += 20
        candidates.append((score, -len(path), u))
    if not candidates:
        return None
    candidates.sort(reverse=True)
    return candidates[0][2]

def discover_nodes(client: Client):
    nodes = []
    for top_order, (top_name, children) in enumerate(CATEGORY_TREE.items(), start=1):
        top_slug = slugify(top_name)
        top_url = find_exact_link(client, OFFICE_URL, top_name)
        print(f"  Office Equipment > {top_name}: {top_url or 'NOT FOUND'}")
        nodes.append({
            "name": top_name,
            "slug": top_slug,
            "path": ["office-equipment", top_slug],
            "url": top_url,
            "depth": 2,
            "order": top_order,
            "products": set(),
        })
        if not top_url:
            continue
        for child_order, child_name in enumerate(children, start=1):
            child_slug = slugify(child_name)
            child_url = find_exact_link(client, top_url, child_name) or find_exact_link(client, OFFICE_URL, child_name)
            print(f"      > {child_name}: {child_url or 'NOT FOUND'}")
            nodes.append({
                "name": child_name,
                "slug": child_slug,
                "path": ["office-equipment", top_slug, child_slug],
                "url": child_url,
                "depth": 3,
                "order": top_order*100+child_order,
                "products": set(),
            })
    return nodes

def primary_image(soup: BeautifulSoup, product_url: str) -> str | None:
    for sel, attr in [
        ('meta[property="og:image"]',"content"),
        ('meta[name="twitter:image"]',"content"),
    ]:
        tag = soup.select_one(sel)
        if tag and tag.get(attr):
            return urljoin(product_url, tag.get(attr))
    for sel in [".product-img-holder img",".product-image img",".gallery img",".thumbnail img","img[itemprop='image']"]:
        for img in soup.select(sel):
            for attr in ("data-zoom-image","data-src","data-original","src"):
                src = img.get(attr)
                if src:
                    full = urljoin(product_url, src)
                    if not any(x in full.lower() for x in ("logo","placeholder","loading","icon")):
                        return full
    return None

def image_ext(url: str, ctype: str="") -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".webp",".jpg",".jpeg",".png",".gif",".avif"}:
        return ".jpg" if suffix==".jpeg" else suffix
    ext = mimetypes.guess_extension((ctype or "").split(";")[0].strip().lower()) or ".jpg"
    return ".jpg" if ext in {".jpe",".jpeg"} else ext

def file_stem(url: str, name: str) -> str:
    leaf = Path(urlparse(url).path.rstrip("/")).name
    s = slugify(leaf or name)
    return s or hashlib.sha256(url.encode()).hexdigest()[:12]

def existing(folder: Path, stem: str) -> Path|None:
    for ext in (".webp",".jpg",".jpeg",".png",".gif",".avif"):
        p = folder / f"{stem}{ext}"
        if p.is_file() and p.stat().st_size>0:
            return p
    return None

def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream,"reconfigure"):
            stream.reconfigure(encoding="utf-8")

    ap = argparse.ArgumentParser()
    ap.add_argument("--project-root", default=".")
    ap.add_argument("--output-root", default="public/images/products")
    ap.add_argument("--manifest", default="startech_office_equipment_image_manifest.json")
    ap.add_argument("--category", default="")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--delay", type=float, default=0.30)
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    root = Path(args.project_root).resolve()
    output_root = (root / args.output_root).resolve()
    manifest_path = (root / args.manifest).resolve()

    client = Client(args.delay)

    print(f"Reading Office Equipment master catalog: {OFFICE_URL}")
    master, reported_total = crawl(client, OFFICE_URL, verbose=True)

    print("\nMASTER CATALOG")
    print(f"  Site reported: {reported_total if reported_total is not None else 'unknown'}")
    print(f"  Unique product URLs found: {len(master)}")

    print("\nDiscovering Office Equipment hierarchy...")
    nodes = discover_nodes(client)

    master_urls = set(master.keys())
    for node in nodes:
        if not node["url"]:
            continue
        try:
            branch, _ = crawl(client, node["url"], verbose=False)
            node["products"] = set(branch.keys()) & master_urls
            print(f"    {' > '.join(node['path'])}: {len(node['products'])} matched")
        except Exception as exc:
            print(f"WARN {node['name']}: {exc}", file=sys.stderr)

    valid_top = {slugify(name) for name in CATEGORY_TREE}
    if args.category and args.category not in valid_top:
        ap.error("--category must be one of: " + ", ".join(sorted(valid_top)))

    selected = []
    for url, name in master.items():
        matches = [n for n in nodes if url in n["products"]]
        matches.sort(key=lambda n: (-n["depth"], n["order"]))
        path = matches[0]["path"] if matches else ["office-equipment","_uncategorized"]

        if args.category and (len(path)<2 or path[1] != args.category):
            continue

        selected.append((url,name,path,matches))

    if args.limit:
        selected = selected[:args.limit]

    manifest = {
        "sourceCategoryUrl": OFFICE_URL,
        "siteReportedProductCount": reported_total,
        "uniqueMasterProductsFound": len(master),
        "selectedCategory": args.category or None,
        "requestedForThisRun": len(selected),
        "outputRoot": str(output_root.relative_to(root)).replace("\\","/"),
        "categories": [
            {
                "name":n["name"],
                "slug":n["slug"],
                "path":n["path"],
                "url":n["url"],
                "matchedProductCount":len(n["products"]),
            } for n in nodes
        ],
        "products": [],
        "summary": {"downloaded":0,"skippedExisting":0,"failed":0,"dryRun":bool(args.dry_run)},
    }

    downloaded=skipped=failed=0

    print("\nProcessing Office Equipment products...")

    for idx,(product_url,product_name,path,matches) in enumerate(selected,start=1):
        folder = output_root.joinpath(*path)
        progress=f"[{idx}/{len(selected)}]"
        rec={
            "name":product_name,
            "sourceProductUrl":product_url,
            "categoryPath":path,
            "matchedCategories":[{"name":m["name"],"slug":m["slug"],"path":m["path"],"url":m["url"]} for m in matches],
            "sourceImageUrl":None,
            "localImageFile":None,
            "status":None,
        }

        if args.dry_run:
            rec["status"]="dry-run"
            print(f"{progress} MAP {'/'.join(path)} <- {product_name}")
            manifest["products"].append(rec)
            continue

        try:
            folder.mkdir(parents=True, exist_ok=True)
            stem = file_stem(product_url, product_name)
            old = existing(folder, stem)

            if old and not args.overwrite:
                rec["status"]="skipped-existing"
                rec["localImageFile"]=str(old.relative_to(root)).replace("\\","/")
                skipped += 1
                print(f"{progress} SKIP exists: {rec['localImageFile']}")
            else:
                soup = client.soup(product_url)
                image_url = primary_image(soup, product_url)
                if not image_url:
                    raise RuntimeError("Primary image not found")

                ir = client.image_response(image_url)
                try:
                    ext = image_ext(image_url, ir.headers.get("content-type",""))
                    target = folder / f"{stem}{ext}"
                    part = target.with_name(target.name+".part")
                    try:
                        with part.open("wb") as f:
                            for chunk in ir.iter_content(64*1024):
                                if chunk:
                                    f.write(chunk)
                        if not part.exists() or part.stat().st_size==0:
                            raise RuntimeError("Empty image response")
                        part.replace(target)
                    finally:
                        part.unlink(missing_ok=True)
                finally:
                    ir.close()

                rec["status"]="downloaded"
                rec["sourceImageUrl"]=image_url
                rec["localImageFile"]=str(target.relative_to(root)).replace("\\","/")
                downloaded += 1
                print(f"{progress} OK   {product_name}")
                print(f"         -> {rec['localImageFile']}")

        except Exception as exc:
            failed += 1
            rec["status"]="failed"
            rec["error"]=str(exc)
            print(f"{progress} ERR  {product_name}: {exc}", file=sys.stderr)

        manifest["products"].append(rec)
        manifest["summary"].update({"downloaded":downloaded,"skippedExisting":skipped,"failed":failed})
        manifest_path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")

    manifest["summary"].update({"downloaded":downloaded,"skippedExisting":skipped,"failed":failed})
    manifest_path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")

    print("\nDONE")
    print(f"Master products found: {len(master)}")
    if reported_total is not None:
        print(f"Site reported count:   {reported_total}")
    print(f"Processed this run:    {len(selected)}")
    print(f"Downloaded:            {downloaded}")
    print(f"Skipped existing:      {skipped}")
    print(f"Failed:                {failed}")
    print(f"Manifest:              {manifest_path}")
    print(f"Image root:            {output_root}")

    return 1 if failed else 0

if __name__=="__main__":
    raise SystemExit(main())
