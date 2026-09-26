#!/usr/bin/env python3
from __future__ import annotations

import argparse, json, mimetypes, re, sys, time
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE = "https://www.startech.com.bd"
CATEGORY_URL = f"{BASE}/access-point"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}

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
        self.s = requests.Session()
        self.s.headers.update(HEADERS)
        retry = Retry(
            total=4, connect=4, read=4, backoff_factor=0.8,
            status_forcelist=(429,500,502,503,504),
            allowed_methods=frozenset({"GET"}),
            respect_retry_after_header=True,
        )
        self.s.mount("https://", HTTPAdapter(max_retries=retry))
        self.cache = {}

    def soup(self, url: str) -> BeautifulSoup:
        full = urljoin(BASE, url)
        if full not in self.cache:
            r = self.s.get(full, timeout=40)
            r.raise_for_status()
            self.cache[full] = r.text
            if self.delay:
                time.sleep(self.delay)
        return BeautifulSoup(self.cache[full], "html.parser")

    def image_response(self, url: str):
        r = self.s.get(urljoin(BASE, url), timeout=60, stream=True)
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

def product_links(soup: BeautifulSoup):
    out = {}
    for sel in [
        ".p-item .p-item-name a",
        ".p-item-name a",
        ".product-layout h4 a",
        ".product-thumb h4 a",
        ".product-name a",
    ]:
        for a in soup.select(sel):
            href = a.get("href")
            name = a.get_text(" ", strip=True)
            if href and name:
                out.setdefault(canonical(href), name)
        if out:
            break
    return out

def crawl(client: Client):
    products = {}
    page = 1
    total = pages = None
    while True:
        soup = client.soup(with_page(CATEGORY_URL, page))
        if page == 1:
            total, pages = parse_count(soup)
        batch = product_links(soup)
        before = len(products)
        for u, n in batch.items():
            products.setdefault(u, n)
        print(
            f"page {page}: {len(batch)} cards, {len(products)-before} new, total {len(products)}"
            + (f"/{total}" if total is not None else "")
        )
        if pages is not None:
            if page >= pages:
                break
        else:
            if not batch or len(products) == before:
                break
        page += 1
    return products, total

def primary_image(soup: BeautifulSoup, product_url: str):
    for sel, attr in [
        ('meta[property="og:image"]',"content"),
        ('meta[name="twitter:image"]',"content"),
    ]:
        t = soup.select_one(sel)
        if t and t.get(attr):
            return urljoin(product_url, str(t.get(attr)))
    for sel in [
        ".product-img-holder img",
        ".product-image img",
        ".gallery img",
        ".thumbnail img",
        "img[itemprop='image']",
    ]:
        for img in soup.select(sel):
            for attr in ("data-zoom-image","data-large-image","data-src","data-original","src"):
                src = img.get(attr)
                if src:
                    full = urljoin(product_url, str(src))
                    if not any(x in full.lower() for x in ("logo","placeholder","loading","icon")):
                        return full
    return None

def image_ext(url: str, ctype: str):
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".webp",".jpg",".jpeg",".png",".gif",".avif"}:
        return ".jpg" if suffix == ".jpeg" else suffix
    ext = mimetypes.guess_extension((ctype or "").split(";")[0].strip().lower()) or ".jpg"
    return ".jpg" if ext in {".jpe",".jpeg"} else ext

def existing(folder: Path, stem: str):
    for ext in (".webp",".jpg",".jpeg",".png",".gif",".avif"):
        p = folder / f"{stem}{ext}"
        if p.is_file() and p.stat().st_size > 0:
            return p
    return None

def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    ap = argparse.ArgumentParser()
    ap.add_argument("--project-root", default=".")
    ap.add_argument("--output-root", default="public/images/products/networking/Access Point")
    ap.add_argument("--manifest", default="startech_access_point_image_manifest.json")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--delay", type=float, default=0.30)
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    root = Path(args.project_root).resolve()
    out = (root / args.output_root).resolve()
    manifest_path = (root / args.manifest).resolve()

    client = Client(args.delay)
    products, reported_total = crawl(client)
    selected = list(products.items())
    if args.limit:
        selected = selected[:args.limit]

    manifest = {
        "sourceCategoryUrl": CATEGORY_URL,
        "categoryPath": ["networking", "Access Point"],
        "siteReportedProductCount": reported_total,
        "uniqueProductsFound": len(products),
        "products": [],
        "summary": {
            "downloaded": 0,
            "skippedExisting": 0,
            "failed": 0,
            "dryRun": bool(args.dry_run),
        },
    }

    downloaded = skipped = failed = 0

    for idx, (product_url, name) in enumerate(selected, start=1):
        progress = f"[{idx}/{len(selected)}]"
        stem = slugify(Path(urlparse(product_url).path.rstrip("/")).name or name)
        rec = {
            "name": name,
            "sourceProductUrl": product_url,
            "categoryPath": ["networking", "Access Point"],
            "sourceImageUrl": None,
            "localImageFile": None,
            "status": None,
        }

        if args.dry_run:
            rec["status"] = "dry-run"
            print(f"{progress} MAP networking/Access Point <- {name}")
            manifest["products"].append(rec)
            continue

        try:
            out.mkdir(parents=True, exist_ok=True)
            old = existing(out, stem)
            if old and not args.overwrite:
                rec["status"] = "skipped-existing"
                rec["localImageFile"] = str(old.relative_to(root)).replace("\\","/")
                skipped += 1
                print(f"{progress} SKIP exists: {rec['localImageFile']}")
            else:
                soup = client.soup(product_url)
                img = primary_image(soup, product_url)
                if not img:
                    raise RuntimeError("Primary image not found")

                ir = client.image_response(img)
                try:
                    ext = image_ext(img, ir.headers.get("content-type",""))
                    target = out / f"{stem}{ext}"
                    part = target.with_name(target.name + ".part")
                    try:
                        with part.open("wb") as f:
                            for chunk in ir.iter_content(64 * 1024):
                                if chunk:
                                    f.write(chunk)
                        if not part.exists() or part.stat().st_size == 0:
                            raise RuntimeError("Empty image response")
                        part.replace(target)
                    finally:
                        part.unlink(missing_ok=True)
                finally:
                    ir.close()

                rec["status"] = "downloaded"
                rec["sourceImageUrl"] = img
                rec["localImageFile"] = str(target.relative_to(root)).replace("\\","/")
                downloaded += 1
                print(f"{progress} OK   {name}")
                print(f"         -> {rec['localImageFile']}")
        except Exception as exc:
            failed += 1
            rec["status"] = "failed"
            rec["error"] = str(exc)
            print(f"{progress} ERR  {name}: {exc}", file=sys.stderr)

        manifest["products"].append(rec)
        manifest["summary"].update({
            "downloaded": downloaded,
            "skippedExisting": skipped,
            "failed": failed,
        })
        manifest_path.write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

    manifest["summary"].update({
        "downloaded": downloaded,
        "skippedExisting": skipped,
        "failed": failed,
    })
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print("\nDONE")
    print(f"Products found:        {len(products)}")
    if reported_total is not None:
        print(f"Site reported count:   {reported_total}")
    print(f"Processed this run:    {len(selected)}")
    print(f"Downloaded:            {downloaded}")
    print(f"Skipped existing:      {skipped}")
    print(f"Failed:                {failed}")
    print(f"Manifest:              {manifest_path}")
    print(f"Image folder:          {out}")

    return 1 if failed else 0

if __name__ == "__main__":
    raise SystemExit(main())
