#!/usr/bin/env python3
from __future__ import annotations

import argparse, json, mimetypes, re, sys, time
from collections import OrderedDict
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE = "https://www.startech.com.bd"
MONITOR_URL = f"{BASE}/monitor"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": BASE + "/",
}

KNOWN_BRANDS = [
    "ThundeRobot", "Thermaltake", "Titan Army", "TrendSonic", "Value-Top",
    "PC Power", "ViewSonic", "Gigasonic", "Eurovision", "FeuVision",
    "Hikvision", "Gigabyte", "Samsung", "Philips", "Corsair", "Uniview",
    "KOORUI", "GEESUU", "Arzopa", "Xiaomi", "Huawei", "Lenovo", "Dahua",
    "Walton", "Smart", "Fopo", "AIWA", "MSI", "AOC", "Asus", "BenQ",
    "LG", "Acer", "HP", "Dell", "Apple",
]

TYPE_LABELS = OrderedDict([
    ("gaming-monitor", "Gaming Monitor"),
    ("curved-monitor", "Curved Monitor"),
    ("touch-monitor", "Touch Monitor"),
    ("4k-monitor", "4K Monitor"),
    ("portable-monitor", "Portable Monitor"),
    ("monitor-arm", "Monitor Arm"),
])


def norm(v: str) -> str:
    return re.sub(r"\s+", " ", v or "").strip().casefold()


def slugify(v: str) -> str:
    v = (v or "").strip().lower().replace("&", " and ").replace("/", " ")
    return re.sub(r"[^a-z0-9]+", "-", v).strip("-") or "unknown"


def canonical(url: str) -> str:
    p = urlparse(urljoin(BASE, url))
    return urlunparse((p.scheme or "https", p.netloc.lower(), p.path.rstrip("/"), "", "", ""))


def make_url(url: str, **params) -> str:
    p = urlparse(url)
    q = dict(parse_qsl(p.query, keep_blank_values=True))
    for k, v in params.items():
        if v is None:
            q.pop(k, None)
        else:
            q[k] = str(v)
    return urlunparse((p.scheme, p.netloc, p.path, p.params, urlencode(q), p.fragment))


class Client:
    def __init__(self, delay: float):
        self.delay = delay
        self.s = requests.Session()
        self.s.headers.update(HEADERS)
        retry = Retry(
            total=5, connect=5, read=5, status=5, backoff_factor=1.0,
            status_forcelist=(408, 425, 429, 500, 502, 503, 504),
            allowed_methods=frozenset({"GET"}), respect_retry_after_header=True,
        )
        self.s.mount("https://", HTTPAdapter(max_retries=retry, pool_connections=10, pool_maxsize=10))
        self.cache = {}

    def soup(self, url: str, use_cache: bool = True) -> BeautifulSoup:
        full = urljoin(BASE, url)
        if not use_cache or full not in self.cache:
            r = self.s.get(full, timeout=(15, 60))
            r.raise_for_status()
            if not r.text.strip():
                raise RuntimeError(f"Empty HTML: {full}")
            self.cache[full] = r.text
            if self.delay:
                time.sleep(self.delay)
        return BeautifulSoup(self.cache[full], "html.parser")

    def image_response(self, url: str):
        r = self.s.get(urljoin(BASE, url), timeout=(15, 90), stream=True)
        r.raise_for_status()
        ctype = (r.headers.get("content-type") or "").split(";")[0].strip().lower()
        if ctype and not ctype.startswith("image/"):
            r.close()
            raise ValueError(f"Not an image: {ctype}")
        return r


def parse_count(soup: BeautifulSoup):
    m = re.search(
        r"Showing\s+\d+\s+to\s+\d+\s+of\s+([\d,]+)\s+\(([\d,]+)\s+Pages?\)",
        soup.get_text(" ", strip=True), re.I,
    )
    if not m:
        return None, None
    return int(m.group(1).replace(",", "")), int(m.group(2).replace(",", ""))


def product_links(soup: BeautifulSoup):
    out = OrderedDict()
    for sel in [
        ".p-item .p-item-name a", ".p-item-name a", ".product-layout .name a",
        ".product-layout h4 a", ".product-thumb h4 a", ".product-name a",
    ]:
        batch = OrderedDict()
        for a in soup.select(sel):
            href, name = a.get("href"), a.get_text(" ", strip=True)
            if href and name:
                u = canonical(str(href))
                if urlparse(u).netloc in {"startech.com.bd", "www.startech.com.bd"}:
                    batch.setdefault(u, name)
        if batch:
            out.update(batch)
            break
    return out


def crawl_pass(client: Client, sort=None, order=None, limit=None):
    first_url = make_url(MONITOR_URL, sort=sort, order=order, limit=limit, page=1)
    first = client.soup(first_url, use_cache=False)
    reported, pages = parse_count(first)
    out = OrderedDict()
    page = 1
    while True:
        u = make_url(MONITOR_URL, sort=sort, order=order, limit=limit, page=page)
        soup = first if page == 1 else client.soup(u, use_cache=False)
        batch = product_links(soup)
        before = len(out)
        for pu, name in batch.items():
            out.setdefault(pu, name)
        print(f"    page {page}: {len(batch)} cards, {len(out)-before} new, total {len(out)}" + (f"/{reported}" if reported else ""))
        if pages is not None:
            if page >= pages:
                break
        else:
            if not batch or len(out) == before:
                break
        if page >= 120:
            break
        page += 1
    return out, reported, page


def collect_master(client: Client):
    passes = [
        ("default", None, None, None),
        ("name-asc", "pd.name", "ASC", 100),
        ("name-desc", "pd.name", "DESC", 100),
        ("price-asc", "p.price", "ASC", 100),
        ("price-desc", "p.price", "DESC", 100),
    ]
    merged = OrderedDict()
    reported_values, results = [], []
    for label, sort, order, limit in passes:
        print(f"\nCATALOG PASS: {label}")
        found, reported, pages = crawl_pass(client, sort, order, limit)
        before = len(merged)
        for u, name in found.items():
            merged.setdefault(u, name)
        if reported is not None:
            reported_values.append(reported)
        results.append({
            "name": label, "sort": sort, "order": order, "requestedLimit": limit,
            "productsFound": len(found), "newProductsAddedToUnion": len(merged)-before,
            "pagesScanned": pages, "reportedTotal": reported,
        })
        current = max(reported_values) if reported_values else None
        exact = sum(1 for r in results if current is not None and r["productsFound"] == current)
        print(f"  PASS RESULT: {len(found)} unique; union {len(merged)}")
        if current is not None and len(merged) >= current and exact >= 2:
            print("  Count verified by multiple independent passes.")
            break
    return merged, (max(reported_values) if reported_values else None), results


def find_exact_link(client: Client, label: str):
    soup = client.soup(MONITOR_URL)
    wanted = norm(label)
    candidates = []
    for a in soup.find_all("a", href=True):
        if norm(a.get_text(" ", strip=True)) != wanted:
            continue
        u = canonical(str(a["href"]))
        path = urlparse(u).path.lower()
        score = sum(10 for t in slugify(label).split("-") if len(t) >= 2 and t in path)
        candidates.append((score, -len(path), u))
    if not candidates:
        return None
    candidates.sort(reverse=True)
    return candidates[0][2]


def crawl_listing(client: Client, url: str):
    first = client.soup(url)
    _, pages = parse_count(first)
    found = set()
    page = 1
    while True:
        page_url = make_url(url, page=page, limit=100, sort="pd.name", order="ASC")
        soup = first if page == 1 else client.soup(page_url, use_cache=False)
        batch = product_links(soup)
        found.update(batch.keys())
        if pages is not None:
            if page >= pages:
                break
        else:
            if not batch:
                break
        if page >= 100:
            break
        page += 1
    return found


def type_memberships(client: Client, master_urls: set[str]):
    memberships, urls = {}, {}
    for slug, label in TYPE_LABELS.items():
        u = find_exact_link(client, label)
        urls[slug] = u
        if not u:
            memberships[slug] = set()
            continue
        try:
            memberships[slug] = crawl_listing(client, u) & master_urls
            print(f"  {label}: {len(memberships[slug])} matched")
        except Exception as exc:
            memberships[slug] = set()
            print(f"  WARN {label}: {exc}", file=sys.stderr)
    return memberships, urls


def detect_brand(name: str):
    n = norm(name)
    for brand in sorted(KNOWN_BRANDS, key=len, reverse=True):
        b = norm(brand)
        if n == b or n.startswith(b + " ") or n.startswith(b + "-"):
            return slugify(brand)
    return "_unknown-brand"


def primary_image(soup: BeautifulSoup, product_url: str):
    for sel, attr in [
        ('meta[property="og:image"]', "content"),
        ('meta[name="twitter:image"]', "content"),
        ('meta[itemprop="image"]', "content"),
    ]:
        tag = soup.select_one(sel)
        if tag and tag.get(attr):
            return urljoin(product_url, str(tag.get(attr)))
    for sel in [
        ".product-img-holder img", ".product-image img", ".main-img img",
        ".gallery img", ".thumbnail img", "img[itemprop='image']",
    ]:
        for img in soup.select(sel):
            for attr in ("data-zoom-image", "data-large-image", "data-src", "data-original", "src"):
                src = img.get(attr)
                if src:
                    full = urljoin(product_url, str(src))
                    if not any(x in full.lower() for x in ("logo", "placeholder", "loading", "icon", "spinner")):
                        return full
    return None


def image_ext(url: str, ctype: str):
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif"}:
        return ".jpg" if suffix == ".jpeg" else suffix
    ext = mimetypes.guess_extension((ctype or "").split(";")[0].strip().lower()) or ".jpg"
    return ".jpg" if ext in {".jpe", ".jpeg"} else ext


def existing(folder: Path, stem: str):
    for ext in (".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif"):
        p = folder / f"{stem}{ext}"
        if p.is_file() and p.stat().st_size > 0:
            return p
    return None


def write_manifest(path: Path, data: dict):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    ap = argparse.ArgumentParser()
    ap.add_argument("--project-root", default=".")
    ap.add_argument("--output-root", default="public/images/products/monitor")
    ap.add_argument("--manifest", default="startech_monitor_complete_image_manifest.json")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--delay", type=float, default=0.25)
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--validate-only", action="store_true")
    ap.add_argument("--skip-type-tags", action="store_true")
    ap.add_argument("--allow-count-mismatch", action="store_true")
    args = ap.parse_args()

    root = Path(args.project_root).resolve()
    out_root = (root / args.output_root).resolve()
    manifest_path = (root / args.manifest).resolve()
    client = Client(args.delay)

    print(f"Reading complete Monitor catalog: {MONITOR_URL}")
    master, reported, pass_results = collect_master(client)
    found = len(master)

    print("\nCATALOG VERIFICATION")
    print(f"Site reported count:   {reported if reported is not None else 'unknown'}")
    print(f"Unique products found: {found}")

    complete = reported is None or found >= reported
    if not complete and not args.allow_count_mismatch:
        failure = {
            "sourceCategoryUrl": MONITOR_URL,
            "catalogComplete": False,
            "siteReportedProductCount": reported,
            "uniqueProductsFound": found,
            "catalogPasses": pass_results,
            "products": [{"name": n, "sourceProductUrl": u} for u, n in master.items()],
        }
        write_manifest(manifest_path, failure)
        print("\nERROR: Product count mismatch. No images downloaded.", file=sys.stderr)
        print("Re-run the script. Use --allow-count-mismatch only if you accept a partial crawl.", file=sys.stderr)
        return 2

    master_urls = set(master.keys())
    if args.skip_type_tags:
        memberships = {s: set() for s in TYPE_LABELS}
        type_urls = {s: None for s in TYPE_LABELS}
    else:
        print("\nCollecting monitor type tags...")
        memberships, type_urls = type_memberships(client, master_urls)

    records = []
    for u, name in master.items():
        records.append({
            "name": name,
            "sourceProductUrl": u,
            "brandSlug": detect_brand(name),
            "typeTags": [s for s, urls in memberships.items() if u in urls],
        })

    selected = records[: args.limit] if args.limit else records
    manifest = {
        "sourceCategoryUrl": MONITOR_URL,
        "catalogComplete": complete,
        "siteReportedProductCount": reported,
        "uniqueProductsFound": found,
        "catalogPasses": pass_results,
        "outputRoot": str(out_root.relative_to(root)).replace("\\", "/"),
        "typeGroups": {
            s: {"name": TYPE_LABELS[s], "url": type_urls.get(s), "matchedProductCount": len(memberships.get(s, set()))}
            for s in TYPE_LABELS
        },
        "requestedForThisRun": len(selected),
        "products": [],
        "summary": {"downloaded": 0, "skippedExisting": 0, "failed": 0, "validatedOnly": bool(args.validate_only)},
    }

    if args.validate_only:
        manifest["products"] = [{**r, "sourceImageUrl": None, "localImageFile": None, "status": "validated"} for r in records]
        write_manifest(manifest_path, manifest)
        print("\nVALIDATION COMPLETE - no images downloaded.")
        print(f"Manifest: {manifest_path}")
        return 0

    downloaded = skipped = failed = 0
    print("\nDownloading Monitor images...")

    for idx, rec in enumerate(selected, start=1):
        name, product_url, brand = rec["name"], rec["sourceProductUrl"], rec["brandSlug"]
        folder = out_root / brand
        stem = slugify(Path(urlparse(product_url).path.rstrip("/")).name or name)
        result = {**rec, "sourceImageUrl": None, "localImageFile": None, "status": None}
        progress = f"[{idx}/{len(selected)}]"
        try:
            old = existing(folder, stem)
            if old and not args.overwrite:
                result["status"] = "skipped-existing"
                result["localImageFile"] = str(old.relative_to(root)).replace("\\", "/")
                skipped += 1
                print(f"{progress} SKIP {name}")
            else:
                soup = client.soup(product_url, use_cache=False)
                img = primary_image(soup, product_url)
                if not img:
                    raise RuntimeError("Primary image not found")
                ir = client.image_response(img)
                try:
                    folder.mkdir(parents=True, exist_ok=True)
                    ext = image_ext(img, ir.headers.get("content-type", ""))
                    target = folder / f"{stem}{ext}"
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
                result["status"] = "downloaded"
                result["sourceImageUrl"] = img
                result["localImageFile"] = str(target.relative_to(root)).replace("\\", "/")
                downloaded += 1
                print(f"{progress} OK   {name}")
                print(f"         -> {result['localImageFile']}")
        except Exception as exc:
            failed += 1
            result["status"] = "failed"
            result["error"] = str(exc)
            print(f"{progress} ERR  {name}: {exc}", file=sys.stderr)

        manifest["products"].append(result)
        manifest["summary"].update({"downloaded": downloaded, "skippedExisting": skipped, "failed": failed})
        write_manifest(manifest_path, manifest)

    print("\nDONE")
    print(f"Site reported count:   {reported if reported is not None else 'unknown'}")
    print(f"Unique products found: {found}")
    print(f"Processed this run:    {len(selected)}")
    print(f"Downloaded:            {downloaded}")
    print(f"Skipped existing:      {skipped}")
    print(f"Failed:                {failed}")
    print(f"Unknown-brand items:   {sum(1 for r in records if r['brandSlug'] == '_unknown-brand')}")
    print(f"Manifest:              {manifest_path}")
    print(f"Image root:            {out_root}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
