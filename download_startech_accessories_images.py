#!/usr/bin/env python3
from __future__ import annotations

import argparse, hashlib, json, mimetypes, re, sys, time
from collections import OrderedDict
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE = 'https://www.startech.com.bd'
ACCESSORIES_URL = f'{BASE}/accessories'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': BASE + '/',
}

CATEGORY_LABELS = OrderedDict([
    ('keyboard','Keyboard'), ('mouse','Mouse'), ('headphone','Headphone'),
    ('bluetooth-headphone','Bluetooth Headphone'), ('mouse-pad','Mouse Pad'),
    ('wrist-rest','Wrist Rest'), ('headphone-stand','Headphone Stand'),
    ('speaker-home-theater','Speaker & Home Theater'),
    ('bluetooth-speakers','Bluetooth Speakers'), ('webcam','Webcam'),
    ('soundbar','Soundbar'), ('cable','Cable'), ('converter','Converter'),
    ('card-reader','Card Reader'), ('hubs-docks','Hubs & Docks'),
    ('microphone','Microphone'), ('digital-voice-recorder','Digital Voice Recorder'),
    ('presenter','Presenter'), ('memory-card','Memory Card'), ('sound-card','Sound Card'),
    ('capture-card','Capture Card'), ('pen-drive','Pen Drive'), ('thermal-paste','Thermal Paste'),
    ('hdd-ssd-enclosure','HDD-SSD Enclosure'), ('power-strip','Power Strip'),
    ('bluetooth-adapter','Bluetooth Adapter'),
])

MULTIWORD_BRANDS = [
    'Audio Technica','Royal Kludge','PC Power','K&F Concept','Thonet & Vander',
    'Cooler Master','Golden Field','Western Digital','Xtrike Me','Arctic Hunter',
    'Value-Top','SteelSeries'
]

def norm_text(v:str)->str:
    return re.sub(r'\s+',' ',v or '').strip().casefold()

def slugify(v:str)->str:
    v=(v or '').strip().lower().replace('&',' and ').replace('/',' ')
    return re.sub(r'[^a-z0-9]+','-',v).strip('-') or 'unknown'

def canonical(url:str)->str:
    p=urlparse(urljoin(BASE,url))
    return urlunparse((p.scheme or 'https',p.netloc,p.path.rstrip('/'),'','',''))

def with_page(url:str,page:int)->str:
    p=urlparse(url); q=dict(parse_qsl(p.query,keep_blank_values=True))
    if page<=1: q.pop('page',None)
    else: q['page']=str(page)
    return urlunparse((p.scheme,p.netloc,p.path,p.params,urlencode(q),p.fragment))

class Client:
    def __init__(self,delay:float):
        self.delay=delay
        self.s=requests.Session(); self.s.headers.update(HEADERS)
        retry=Retry(total=4,connect=4,read=4,backoff_factor=.8,status_forcelist=(429,500,502,503,504),allowed_methods=frozenset({'GET'}),respect_retry_after_header=True)
        self.s.mount('https://',HTTPAdapter(max_retries=retry)); self.cache={}
    def soup(self,url:str)->BeautifulSoup:
        full=urljoin(BASE,url)
        if full not in self.cache:
            r=self.s.get(full,timeout=40); r.raise_for_status(); self.cache[full]=r.text
            if self.delay: time.sleep(self.delay)
        return BeautifulSoup(self.cache[full],'html.parser')
    def image_response(self,url:str):
        r=self.s.get(urljoin(BASE,url),timeout=60,stream=True); r.raise_for_status()
        c=(r.headers.get('content-type') or '').split(';')[0].lower()
        if c and not c.startswith('image/'): r.close(); raise ValueError(f'Expected image response, got {c}')
        return r

def parse_count(soup):
    m=re.search(r'Showing\s+\d+\s+to\s+\d+\s+of\s+([\d,]+)\s+\(([\d,]+)\s+Pages?\)',soup.get_text(' ',strip=True),re.I)
    return (int(m.group(1).replace(',','')),int(m.group(2).replace(',',''))) if m else (None,None)

def product_links(soup):
    out=OrderedDict()
    for sel in ['.p-item-name a','.product-layout h4 a','.product-thumb h4 a','.product-name a']:
        for a in soup.select(sel):
            href=a.get('href'); name=a.get_text(' ',strip=True)
            if href and name: out.setdefault(canonical(href),name)
        if out: break
    return out

def crawl(client,url,verbose=False):
    products=OrderedDict(); page=1; total=pages=None
    while True:
        soup=client.soup(with_page(url,page))
        if page==1: total,pages=parse_count(soup)
        batch=product_links(soup); before=len(products)
        for u,n in batch.items(): products.setdefault(u,n)
        if verbose: print(f'  page {page}: {len(batch)} cards, {len(products)-before} new, collected {len(products)}'+(f'/{total}' if total else ''))
        if pages is not None:
            if page>=pages: break
        elif not batch or len(products)==before: break
        if page>=400: raise RuntimeError('Pagination safety limit reached')
        page+=1
    return products,total

def find_category_url(client,label):
    soup=client.soup(ACCESSORIES_URL); wanted=norm_text(label); candidates=[]
    for a in soup.find_all('a',href=True):
        if norm_text(a.get_text(' ',strip=True))!=wanted: continue
        u=canonical(a['href']); path=urlparse(u).path.lower(); score=0
        if '/accessories' in path: score+=30
        for tok in slugify(label).split('-'):
            if len(tok)>=3 and tok in path: score+=10
        candidates.append((score,-len(path),u))
    if not candidates: return None
    candidates.sort(reverse=True); return candidates[0][2]

def detect_brand(name):
    n=norm_text(name)
    for b in sorted(MULTIWORD_BRANDS,key=len,reverse=True):
        bn=norm_text(b)
        if n==bn or n.startswith(bn+' '): return slugify(b)
    return slugify(re.split(r'\s+',name.strip())[0] if name.strip() else 'unknown')

def primary_image(soup,product_url):
    for sel,attr in [('meta[property="og:image"]','content'),('meta[name="twitter:image"]','content')]:
        t=soup.select_one(sel)
        if t and t.get(attr): return urljoin(product_url,str(t.get(attr)))
    for sel in ['.product-img-holder img','.product-image img','.gallery img','.thumbnail img','img[itemprop="image"]']:
        for img in soup.select(sel):
            for attr in ('data-zoom-image','data-large-image','data-src','data-original','src'):
                src=img.get(attr)
                if src:
                    full=urljoin(product_url,str(src))
                    if not any(x in full.lower() for x in ('logo','placeholder','loading','icon')): return full
    return None

def image_ext(url,ctype=''):
    sfx=Path(urlparse(url).path).suffix.lower()
    if sfx in {'.webp','.jpg','.jpeg','.png','.gif','.avif'}: return '.jpg' if sfx=='.jpeg' else sfx
    ext=mimetypes.guess_extension((ctype or '').split(';')[0].strip().lower()) or '.jpg'
    return '.jpg' if ext in {'.jpe','.jpeg'} else ext

def file_stem(url,name):
    leaf=Path(urlparse(url).path.rstrip('/')).name
    return slugify(leaf or name) or hashlib.sha256(url.encode()).hexdigest()[:12]

def existing(folder,stem):
    for ext in ('.webp','.jpg','.jpeg','.png','.gif','.avif'):
        p=folder/f'{stem}{ext}'
        if p.is_file() and p.stat().st_size>0: return p
    return None

def main():
    for stream in (sys.stdout,sys.stderr):
        if hasattr(stream,'reconfigure'): stream.reconfigure(encoding='utf-8')
    ap=argparse.ArgumentParser()
    ap.add_argument('--project-root',default='.')
    ap.add_argument('--output-root',default='public/images/products')
    ap.add_argument('--manifest',default='startech_accessories_image_manifest.json')
    ap.add_argument('--category',default='',choices=['']+list(CATEGORY_LABELS.keys()))
    ap.add_argument('--limit',type=int,default=0)
    ap.add_argument('--delay',type=float,default=.30)
    ap.add_argument('--overwrite',action='store_true')
    ap.add_argument('--dry-run',action='store_true')
    args=ap.parse_args()

    root=Path(args.project_root).resolve(); output_root=(root/args.output_root).resolve(); manifest_path=(root/args.manifest).resolve()
    client=Client(args.delay)

    print(f'Reading Accessories master catalog: {ACCESSORIES_URL}')
    master,reported_total=crawl(client,ACCESSORIES_URL,verbose=True)
    print('\nMASTER CATALOG'); print(f'  Site reported: {reported_total if reported_total is not None else "unknown"}'); print(f'  Unique product URLs found: {len(master)}')

    master_urls=set(master.keys()); nodes=[]
    print('\nDiscovering Accessories category URLs...')
    for order,(slug,label) in enumerate(CATEGORY_LABELS.items(),start=1):
        url=find_category_url(client,label); matched=set()
        if url:
            try:
                branch,_=crawl(client,url); matched=set(branch.keys()) & master_urls
            except Exception as exc: print(f'WARN {label}: {exc}',file=sys.stderr)
        print(f'  Accessories > {label}: {url or "NOT FOUND"} ({len(matched)} matched)')
        nodes.append({'slug':slug,'name':label,'url':url,'order':order,'products':matched})

    selected=[]
    for product_url,product_name in master.items():
        matches=[n for n in nodes if product_url in n['products']]; matches.sort(key=lambda n:n['order'])
        category=matches[0]['slug'] if matches else '_uncategorized'; brand=detect_brand(product_name)
        if args.category and category!=args.category: continue
        selected.append((product_url,product_name,category,brand,matches))
    if args.limit: selected=selected[:args.limit]

    manifest={'sourceCategoryUrl':ACCESSORIES_URL,'siteReportedProductCount':reported_total,'uniqueMasterProductsFound':len(master),'selectedCategory':args.category or None,'requestedForThisRun':len(selected),'outputRoot':str(output_root.relative_to(root)).replace('\\','/'),'categories':[{'name':n['name'],'slug':n['slug'],'url':n['url'],'matchedProductCount':len(n['products'])} for n in nodes],'products':[],'summary':{'downloaded':0,'skippedExisting':0,'failed':0,'dryRun':bool(args.dry_run)}}
    downloaded=skipped=failed=0

    print('\nProcessing Accessories products...')
    for idx,(product_url,product_name,category,brand,matches) in enumerate(selected,start=1):
        path=['accessories',category,brand]; folder=output_root.joinpath(*path); progress=f'[{idx}/{len(selected)}]'
        rec={'name':product_name,'sourceProductUrl':product_url,'categoryPath':path,'brandSlug':brand,'matchedCategories':[{'name':m['name'],'slug':m['slug'],'url':m['url']} for m in matches],'sourceImageUrl':None,'localImageFile':None,'status':None}
        if args.dry_run:
            rec['status']='dry-run'; print(f'{progress} MAP {"/".join(path)} <- {product_name}'); manifest['products'].append(rec); continue
        try:
            folder.mkdir(parents=True,exist_ok=True); stem=file_stem(product_url,product_name); old=existing(folder,stem)
            if old and not args.overwrite:
                rec['status']='skipped-existing'; rec['localImageFile']=str(old.relative_to(root)).replace('\\','/'); skipped+=1; print(f'{progress} SKIP exists: {rec["localImageFile"]}')
            else:
                soup=client.soup(product_url); image_url=primary_image(soup,product_url)
                if not image_url: raise RuntimeError('Primary image not found')
                ir=client.image_response(image_url)
                try:
                    ext=image_ext(image_url,ir.headers.get('content-type','')); target=folder/f'{stem}{ext}'; part=target.with_name(target.name+'.part')
                    try:
                        with part.open('wb') as f:
                            for chunk in ir.iter_content(64*1024):
                                if chunk: f.write(chunk)
                        if not part.exists() or part.stat().st_size==0: raise RuntimeError('Empty image response')
                        part.replace(target)
                    finally: part.unlink(missing_ok=True)
                finally: ir.close()
                rec['status']='downloaded'; rec['sourceImageUrl']=image_url; rec['localImageFile']=str(target.relative_to(root)).replace('\\','/'); downloaded+=1
                print(f'{progress} OK   {product_name}'); print(f'         -> {rec["localImageFile"]}')
        except Exception as exc:
            failed+=1; rec['status']='failed'; rec['error']=str(exc); print(f'{progress} ERR  {product_name}: {exc}',file=sys.stderr)
        manifest['products'].append(rec); manifest['summary'].update({'downloaded':downloaded,'skippedExisting':skipped,'failed':failed})
        manifest_path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

    manifest['summary'].update({'downloaded':downloaded,'skippedExisting':skipped,'failed':failed})
    manifest_path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print('\nDONE'); print(f'Master products found: {len(master)}'); print(f'Site reported count:   {reported_total}'); print(f'Processed this run:    {len(selected)}'); print(f'Downloaded:            {downloaded}'); print(f'Skipped existing:      {skipped}'); print(f'Failed:                {failed}'); print(f'Manifest:              {manifest_path}'); print(f'Image root:            {output_root}')
    return 1 if failed else 0

if __name__=='__main__':
    raise SystemExit(main())
