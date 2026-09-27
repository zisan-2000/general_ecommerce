#!/usr/bin/env python3
from __future__ import annotations
import argparse, io, json, re, sys, time
from collections import OrderedDict
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse
import requests
from bs4 import BeautifulSoup
from PIL import Image
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE="https://www.startech.com.bd"
ROOT=f"{BASE}/television-shop"
CATS=OrderedDict([
 ("all-tv","All TV"),("led-tv","LED TV"),("smart-tv","Smart TV"),
 ("android-tv","Android TV"),("4k-tv","4K TV"),("tv-box","TV Box"),
 ("tv-stand-wall-mount","TV Stand & Wall Mount")
])
BRANDS=["Haier","Samsung","Sony","XIAOMI","Hisense","TCL","SMART","LG","SINGER","beko","Transtec","ROWA","Realview"]
HEADERS={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36","Accept-Language":"en-US,en;q=0.9"}

def norm(s): return re.sub(r"\s+"," ",s or "").strip().casefold()
def slug(s):
    s=(s or "").lower().replace("&"," and ").replace("/"," ")
    return re.sub(r"[^a-z0-9]+","-",s).strip("-") or "unknown"
def canon(u):
    x=urlparse(urljoin(BASE,u)); return urlunparse((x.scheme or "https",x.netloc.lower(),x.path.rstrip("/"),"","",""))
def params(u,**kw):
    x=urlparse(u); q=dict(parse_qsl(x.query,keep_blank_values=True))
    for k,v in kw.items():
        if v is None:q.pop(k,None)
        else:q[k]=str(v)
    return urlunparse((x.scheme,x.netloc,x.path,x.params,urlencode(q),x.fragment))

class Client:
    def __init__(self,delay):
        self.delay=delay; self.s=requests.Session(); self.s.headers.update(HEADERS); self.cache={}
        r=Retry(total=5,connect=5,read=5,status=5,backoff_factor=.8,status_forcelist=(429,500,502,503,504),allowed_methods=frozenset({"GET"}),respect_retry_after_header=True)
        self.s.mount("https://",HTTPAdapter(max_retries=r))
    def soup(self,u,cache=True):
        u=urljoin(BASE,u)
        if not cache or u not in self.cache:
            r=self.s.get(u,timeout=(15,60)); r.raise_for_status(); self.cache[u]=r.text
            if self.delay:time.sleep(self.delay)
        return BeautifulSoup(self.cache[u],"html.parser")
    def image(self,u):
        r=self.s.get(urljoin(BASE,u),timeout=(15,90)); r.raise_for_status()
        if (r.headers.get("content-type") or "").split(";")[0].lower().startswith("text/"): raise RuntimeError("Image URL returned text")
        return r.content

def count(s):
    m=re.search(r"Showing\s+\d+\s+to\s+\d+\s+of\s+([\d,]+)\s+\(([\d,]+)\s+Pages?\)",s.get_text(" ",strip=True),re.I)
    return (int(m.group(1).replace(",","")),int(m.group(2).replace(",",""))) if m else (None,None)
def links(s):
    out=OrderedDict()
    for sel in [".p-item-name a",".product-layout h4 a",".product-thumb h4 a",".product-name a"]:
        for a in s.select(sel):
            if a.get("href") and a.get_text(" ",strip=True): out.setdefault(canon(a["href"]),a.get_text(" ",strip=True))
        if out:break
    return out
def discover(c):
    s=c.soup(ROOT); out={}
    for k,label in CATS.items():
        matches=[]
        for a in s.find_all("a",href=True):
            if norm(a.get_text(" ",strip=True))==norm(label):
                u=canon(a["href"]); matches.append((sum(10 for t in k.split("-") if t in urlparse(u).path.lower()),u))
        out[k]=sorted(matches,reverse=True)[0][1] if matches else None
    out["all-tv"]=out.get("all-tv") or ROOT
    return out
def crawl(c,u):
    products=OrderedDict(); page=1; total=pages=None
    while True:
        s=c.soup(params(u,page=page,limit=100,sort="pd.name",order="ASC"),cache=False)
        if page==1: total,pages=count(s)
        b=links(s); before=len(products)
        for x,n in b.items():products.setdefault(x,n)
        print(f"    page {page}: {len(b)} cards, {len(products)-before} new, total {len(products)}"+(f"/{total}" if total else ""))
        if pages and page>=pages:break
        if not pages and (not b or len(products)==before):break
        page+=1
        if page>100:break
    return products,total
def brand(name):
    n=norm(name)
    for b in sorted(BRANDS,key=len,reverse=True):
        if n==norm(b) or n.startswith(norm(b)+" ") or n.startswith(norm(b)+"-"):return slug(b)
    return "_unknown-brand"
def primary(s,u):
    for q,a in [('meta[property="og:image"]',"content"),('meta[name="twitter:image"]',"content")]:
        t=s.select_one(q)
        if t and t.get(a):return urljoin(u,t.get(a))
    for q in [".product-img-holder img",".product-image img",".gallery img",".thumbnail img","img[itemprop='image']"]:
        for im in s.select(q):
            for a in ("data-zoom-image","data-large-image","data-src","data-original","src"):
                x=im.get(a)
                if x and not any(z in x.lower() for z in ("logo","placeholder","loading","icon")):return urljoin(u,x)
def valid_png(p):
    if not p.is_file() or p.stat().st_size<1:return False
    try:
        with Image.open(p) as im:
            if im.format!="PNG":return False
            im.verify()
        return True
    except:return False
def write_png(raw,p):
    p.parent.mkdir(parents=True,exist_ok=True); tmp=p.with_name(p.name+".part")
    try:
        with Image.open(io.BytesIO(raw)) as im:
            im.load()
            out=im.convert("RGBA") if im.mode in ("RGBA","LA") or (im.mode=="P" and "transparency" in im.info) else im.convert("RGB")
            out.save(tmp,format="PNG")
        with Image.open(tmp) as chk: chk.verify()
        if p.exists():p.unlink()
        tmp.replace(p)
    finally:tmp.unlink(missing_ok=True)
def save(p,d):p.write_text(json.dumps(d,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--project-root",default=".")
    ap.add_argument("--output-root",default="public/images/products/television-shop")
    ap.add_argument("--manifest",default="startech_tv_hierarchy_image_manifest.json")
    ap.add_argument("--category",choices=list(CATS))
    ap.add_argument("--limit",type=int,default=0)
    ap.add_argument("--delay",type=float,default=.25)
    ap.add_argument("--overwrite",action="store_true")
    ap.add_argument("--dry-run",action="store_true")
    a=ap.parse_args(); root=Path(a.project_root).resolve(); out=(root/a.output_root).resolve(); mp=(root/a.manifest).resolve()
    c=Client(a.delay); urls=discover(c); chosen=[a.category] if a.category else list(CATS)
    man={"source":ROOT,"categoryUrls":urls,"categories":{},"summary":{"downloaded":0,"skipped":0,"failed":0}}
    dl=sk=fail=0
    for cat in chosen:
        label=CATS[cat]; u=urls.get(cat); print(f"\nCATEGORY: {label}\n  URL: {u}")
        if not u:
            man["categories"][cat]={"name":label,"error":"URL not discovered"}; fail+=1; continue
        products,total=crawl(c,u); items=list(products.items())[:a.limit or None]
        cr={"name":label,"url":u,"siteReportedCount":total,"uniqueFound":len(products),"countMatched":total is None or len(products)>=total,"products":[]}
        for i,(pu,name) in enumerate(items,1):
            b=brand(name); stem=slug(Path(urlparse(pu).path.rstrip("/")).name or name); target=out/cat/b/f"{stem}.png"
            rec={"name":name,"productUrl":pu,"brand":b,"image":str(target.relative_to(root)).replace("\\","/"),"status":None}
            if a.dry_run:rec["status"]="dry-run"; print(f"  [{i}/{len(items)}] MAP {cat}/{b}/{target.name}")
            else:
                try:
                    if valid_png(target) and not a.overwrite:rec["status"]="skipped";sk+=1;print(f"  [{i}/{len(items)}] SKIP {name}")
                    else:
                        s=c.soup(pu,cache=False); iu=primary(s,pu)
                        if not iu:raise RuntimeError("Primary image not found")
                        write_png(c.image(iu),target);rec["status"]="downloaded";rec["sourceImageUrl"]=iu;dl+=1
                        print(f"  [{i}/{len(items)}] OK {name}\n      -> {rec['image']}")
                except Exception as e:rec["status"]="failed";rec["error"]=str(e);fail+=1;print(f"  ERR {name}: {e}",file=sys.stderr)
            cr["products"].append(rec); man["categories"][cat]=cr;man["summary"]={"downloaded":dl,"skipped":sk,"failed":fail};save(mp,man)
    print(f"\nDONE\nDownloaded: {dl}\nSkipped: {sk}\nFailed: {fail}\nManifest: {mp}\nImage root: {out}")
    return 1 if fail else 0
if __name__=="__main__":raise SystemExit(main())
