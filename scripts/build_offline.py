#!/usr/bin/env python3
"""Build offline.json: what the service worker (sw.js) saves on the phone for offline use.

  pages: every page of the site, by its address (/karta, not karta.html). The service worker
         reads each page and also saves the scripts, styles and images it uses.
  data:  files the scripts load themselves (map points, district shapes) and the homepage
         status, so offline it shows the last values seen.
  docs:  the protection plans and printable PDFs, each with a fingerprint of its content,
         so phones download a document again only when it has changed.

Run it after adding or removing a page or a PDF, or after replacing a PDF:
  python3 scripts/build_offline.py
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'offline.json'
DATA = ['data/karta.json', 'data/rayoni.json']
DOC_FOLDERS = ['planove', 'pechat']
# The homepage status as status.js and news.js request it, saved so the page shows the last
# values seen instead of nothing (keep the part names and v= in step with those files)
STATUS_PARTS = ['warnings', 'earthquakes', 'air', 'water', 'heating', 'radiation', 'news']
STATUS_URL = '/api/status?part={}&v=3'


def fingerprint(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def main():
    pages = sorted('/' if p.stem == 'index' else f'/{p.stem}' for p in ROOT.glob('*.html'))
    docs = []
    for folder in DOC_FOLDERS:
        for pdf in sorted((ROOT / folder).glob('*.pdf')):
            docs.append({'url': f'/{folder}/{pdf.name}', 'hash': fingerprint(pdf), 'bytes': pdf.stat().st_size})
    for f in DATA:
        assert (ROOT / f).exists(), f
    data = [f'/{f}' for f in DATA] + [STATUS_URL.format(p) for p in STATUS_PARTS]
    OUT.write_text(json.dumps({'pages': pages, 'data': data, 'docs': docs},
                              ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    size = sum(d['bytes'] for d in docs) / 1e6
    print(f'wrote {OUT.name}: {len(pages)} pages, {len(docs)} documents ({size:.1f} MB)')


if __name__ == '__main__':
    main()
