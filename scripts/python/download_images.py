#!/usr/bin/env python3
import json, re, mimetypes
from pathlib import Path
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
DATA = json.loads((ROOT/'tk_group_grocery_seed.json').read_text(encoding='utf-8'))
OUT = ROOT/'images'; OUT.mkdir(exist_ok=True)
headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36'}

def pick_image(html, base_url):
    s=BeautifulSoup(html,'html.parser')
    for sel,attr in [('meta[property="og:image"]','content'),('meta[name="twitter:image"]','content')]:
        t=s.select_one(sel)
        if t and t.get(attr): return urljoin(base_url,t.get(attr))
    imgs=[]
    for im in s.find_all('img'):
        src=im.get('data-large_image') or im.get('data-src') or im.get('src')
        if not src: continue
        alt=(im.get('alt') or '').lower()
        w=im.get('width') or ''
        if 'logo' in alt or 'icon' in alt: continue
        imgs.append(urljoin(base_url,src))
    return imgs[0] if imgs else None

manifest=[]
for p in DATA['products']:
    src=p.get('sourcePage')
    if not src or not p.get('image'):
        continue
    rec={'sku':p['sku'],'item':p['item'],'sourcePage':src,'saved':False,'imageUrl':None,'file':p['image']}
    try:
        r=requests.get(src,headers=headers,timeout=30)
        r.raise_for_status()
        img=pick_image(r.text,src)
        if not img: raise RuntimeError('No image found on source page')
        rec['imageUrl']=img
        ir=requests.get(img,headers=headers,timeout=45)
        ir.raise_for_status()
        ct=(ir.headers.get('content-type') or '').split(';')[0]
        ext=mimetypes.guess_extension(ct) or Path(img.split('?')[0]).suffix or '.jpg'
        if ext=='.jpe': ext='.jpg'
        target=OUT/(Path(p['image']).stem+ext)
        target.write_bytes(ir.content)
        rec['file']='images/'+target.name
        rec['saved']=True
        print('OK ',p['item'],'->',target.name)
    except Exception as e:
        rec['error']=str(e)
        print('SKIP',p['item'],e)
    manifest.append(rec)
(ROOT/'image_download_manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')
