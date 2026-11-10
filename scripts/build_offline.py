#!/usr/bin/env python3
"""Build offline.json: what the service worker (sw.js) saves on the device for offline use.

  pages: every page of the site, by its address (/karta, not karta.html). The service worker
         reads each page and also saves the scripts, styles and images it uses.
  data:  files the scripts load themselves (map points, district shapes) and the homepage
         status, so offline it shows the last values seen.
  packs: larger downloads saved only when the visitor asks (the "Без интернет" card):
           map   the street map of Sofia (maps/sofia.pmtiles, from scripts/build_basemap.py)
           docs  the protection plans and printable PDFs, plus the in-app PDF viewer (PDF.js)
         Each file has a fingerprint of its content, so a device downloads it again only when
         it has changed.

Run it after adding, removing or replacing a page, a PDF or the street map:
  python3 scripts/build_offline.py
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'offline.json'
DATA = ['data/karta.json', 'data/rayoni.json']
# The homepage status as status.js and news.js request it (keep the part names and v= in step)
STATUS_PARTS = ['warnings', 'earthquakes', 'air', 'water', 'heating', 'radiation', 'news']
STATUS_URL = '/api/status?part={}&v=3'
PACKS = {
    'map': ['maps/sofia.pmtiles'],
    'docs': ['planove/*.pdf', 'pechat/*.pdf', 'vendor/pdfjs/pdf.min.js', 'vendor/pdfjs/pdf.worker.min.js'],
}


def fingerprint(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def main():
    pages = sorted('/' if p.stem == 'index' else f'/{p.stem}' for p in ROOT.glob('*.html'))
    for f in DATA:
        assert (ROOT / f).exists(), f
    data = [f'/{f}' for f in DATA] + [STATUS_URL.format(p) for p in STATUS_PARTS]
    packs = {}
    for name, patterns in PACKS.items():
        files = [p for pattern in patterns for p in sorted(ROOT.glob(pattern))]
        assert files, name
        packs[name] = [{'url': '/' + p.relative_to(ROOT).as_posix(), 'hash': fingerprint(p), 'bytes': p.stat().st_size}
                       for p in files]
    OUT.write_text(json.dumps({'pages': pages, 'data': data, 'packs': packs}, ensure_ascii=False, indent=1) + '\n',
                   encoding='utf-8')
    sizes = ', '.join(f'{n}: {len(f)} files, {sum(x["bytes"] for x in f) / 1e6:.1f} MB' for n, f in packs.items())
    print(f'wrote {OUT.name}: {len(pages)} pages; packs {sizes}')


if __name__ == '__main__':
    main()
