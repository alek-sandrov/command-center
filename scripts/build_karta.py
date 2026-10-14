#!/usr/bin/env python3
"""Build data/karta.json for the combined map (karta.html).

Pulls every layer from its public source and writes one compact file:
  - Sofia Municipality open data (api.sofiaplan.bg): disaster centres,
    mineral springs, metro stations and entrances
  - Google My Maps (KML export): bomb shelters, drinking fountains
  - OpenStreetMap (Overpass API): hospitals, pharmacies

If a source can't be reached, that layer keeps its points from the previous
data/karta.json so a flaky server never empties the map.

Usage: python3 scripts/build_karta.py
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from html import unescape
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'data' / 'karta.json'
UA = 'sofia-prepping.com map builder (https://sofia-prepping.com)'

# Rough bounding box of Stolichna municipality: south, west, north, east
BBOX = (42.55, 23.10, 42.85, 23.60)

SOFIAPLAN = 'https://api.sofiaplan.bg/datasets/{}'
KML = 'https://www.google.com/maps/d/kml?mid={}&forcekml=1'
SHELTERS_MAP = '1HWcRRnvgI71wfiiQ5P4QNZ45XdR4tx8T'
FOUNTAINS_MAP = '1s1SiRpB38OK8MYMPQGTm1WQ3dK2XPfg'
OVERPASS = ['https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter']


def fetch(url, data=None, timeout=90, tries=3):
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode('utf-8')
        except Exception as e:  # network errors, timeouts, HTTP errors
            last = e
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f'{url}: {last}')


def in_bbox(lat, lng):
    s, w, n, e = BBOX
    return s <= lat <= n and w <= lng <= e


def point(geom):
    """First coordinate of a Point/MultiPoint/Polygon as (lat, lng)."""
    c = geom['coordinates']
    while isinstance(c[0], list):
        c = c[0]
    return round(c[1], 6), round(c[0], 6)


def clean(text):
    return re.sub(r'\s+', ' ', unescape(text or '')).strip()


def row(lat, lng, name, info='', extra=''):
    return [lat, lng, clean(name), clean(info), clean(extra)]


def sofiaplan(n):
    return json.loads(fetch(SOFIAPLAN.format(n)))['features']


def disaster_centres():
    evac, iodine, tents = [], [], []
    fix = {'Слатима': 'Слатина', 'Студентско': 'Студентски'}
    for f in sofiaplan(552):
        p = f['properties']
        lat, lng = point(f['geometry'])
        kind = p['type'] or ''
        fn = (p['function'] or '').replace('Учебно заведени', 'Учебно заведение').replace('заведениее', 'заведение')
        rayon = fix.get(p['rayon'], p['rayon'] or '')
        where = f'Район {rayon}' if rayon else ''
        if kind.startswith('Сграда'):
            evac.append(row(lat, lng, p['name'] or fn, fn, where))
        elif kind.startswith('Палатков'):
            tents.append(row(lat, lng, p['name'] or 'Палатков лагер', fn, where))
        elif 'йодид' in kind:
            if kind.startswith('Основен'):
                label = 'Основен пункт за доставка на йодни таблетки'
            elif kind.startswith('Резервен'):
                label = 'Резервен пункт за доставка на йодни таблетки'
            else:
                label = 'Пункт за раздаване на йодни таблетки'
            iodine.append(row(lat, lng, p['name'] or label, label, where))
    return {'evac': evac, 'iodine': iodine, 'tents': tents}


def springs():
    out = []
    for f in sofiaplan(550):
        p = f['properties']
        if 'наблюдателни' in (p['type_'] or ''):
            continue  # observation boreholes, not water sources
        lat, lng = point(f['geometry'])
        name = 'Минерален извор' + (f' {p["name"]}' if p['name'] else '')
        out.append(row(lat, lng, name, p['type_']))
    return out


def metro():
    out = []
    for f in sofiaplan(53):
        lat, lng = point(f['geometry'])
        out.append(row(lat, lng, f'Метростанция „{f["properties"]["name"]}“', 'Метростанция'))
    for f in sofiaplan(85):
        p = f['properties']
        lat, lng = point(f['geometry'])
        station = p['metro_st'] or ''
        out.append(row(lat, lng, f'Вход – метростанция „{station}“' if station else 'Вход на метро', p['name'] or '', 'вход'))
    return out


def placemarks(kml):
    for pm in re.findall(r'<Placemark>(.*?)</Placemark>', kml, re.S):
        c = re.search(r'<coordinates>\s*([-\d.]+),([-\d.]+)', pm)
        if not c:
            continue
        name = re.search(r'<name>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</name>', pm, re.S)
        desc = re.search(r'<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</description>', pm, re.S)
        data = {k: clean(v) for k, v in re.findall(r'<Data name="([^"]*)">\s*<value>([^<]*)</value>', pm)}
        yield (round(float(c.group(2)), 6), round(float(c.group(1)), 6),
               clean(name.group(1) if name else ''), clean(desc.group(1) if desc else ''), data)


def shelters():
    out = []
    for lat, lng, name, desc, _ in placemarks(fetch(KML.format(SHELTERS_MAP))):
        if not in_bbox(lat, lng):
            continue
        category = re.match(r'(I{1,3}|І{1,3})[^:]*', desc.replace('І', 'I'))
        info = 'Противорадиационно укритие' if name.startswith('ПРУ') else 'Скривалище'
        out.append(row(lat, lng, name, info, category.group(0) if category else ''))
    return out


def fountains():
    out = []
    for lat, lng, name, _, d in placemarks(fetch(KML.format(FOUNTAINS_MAP))):
        water = d.get('Тип на водата', '')
        if not in_bbox(lat, lng) or water == 'Заведение' or not water:
            continue  # cafés offering refills won't be open in an emergency
        works = d.get('Чешмата работи', '').lower()
        status = {'да': 'Работи', 'не': 'Не работи'}.get(works, 'Няма данни дали работи')
        details = d.get('Детайли', '')
        info = f'{water} вода · {status}' if water != 'ВИК' else f'Питейна вода (ВиК) · {status}'
        out.append(row(lat, lng, name or details[:60] or 'Чешма', info, details if name else ''))
    return out


def osm():
    s, w, n, e = BBOX
    q = (f'[out:json][timeout:60];(nwr["amenity"~"^(hospital|pharmacy)$"]({s},{w},{n},{e}););'
         'out center tags;')
    data = None
    for url in OVERPASS:
        try:
            data = json.loads(fetch(url, urllib.parse.urlencode({'data': q}).encode(), timeout=120))
            break
        except Exception as err:
            print(f'  overpass {url} failed: {err}', file=sys.stderr)
    if data is None:
        raise RuntimeError('all Overpass servers failed')
    hospitals, pharmacies = [], []
    for el in data['elements']:
        t = el.get('tags', {})
        lat = el.get('lat') or el.get('center', {}).get('lat')
        lng = el.get('lon') or el.get('center', {}).get('lon')
        if lat is None:
            continue
        addr = ' '.join(filter(None, [t.get('addr:street'), t.get('addr:housenumber')]))
        if t.get('amenity') == 'hospital':
            hospitals.append(row(round(lat, 6), round(lng, 6), t.get('name', 'Болница'), addr,
                                 'Спешно отделение' if t.get('emergency') == 'yes' else ''))
        else:
            pharmacies.append(row(round(lat, 6), round(lng, 6), t.get('name', 'Аптека'), addr,
                                  'Денонощна' if t.get('opening_hours') == '24/7' else ''))
    return {'hospitals': hospitals, 'pharmacies': pharmacies}


def main():
    old = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {'layers': {}, 'updated': {}}
    layers, updated = dict(old.get('layers', {})), dict(old.get('updated', {}))
    today = date.today().isoformat()
    builders = [
        (('evac', 'iodine', 'tents'), disaster_centres),
        (('springs',), lambda: {'springs': springs()}),
        (('metro',), lambda: {'metro': metro()}),
        (('shelters',), lambda: {'shelters': shelters()}),
        (('fountains',), lambda: {'fountains': fountains()}),
        (('hospitals', 'pharmacies'), osm),
    ]
    failed = []
    for keys, build in builders:
        try:
            result = build()
            for k in keys:
                if not result[k]:
                    raise RuntimeError(f'{k}: no points returned')
            for k in keys:
                layers[k] = result[k]
                updated[k] = today
            print(f'ok   {", ".join(f"{k}={len(result[k])}" for k in keys)}')
        except Exception as err:
            failed.append(keys)
            kept = ', '.join(f'{k}={len(layers.get(k, []))}' for k in keys)
            print(f'FAIL {", ".join(keys)}: {err} (keeping previous: {kept})', file=sys.stderr)

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({'updated': updated, 'layers': layers}, ensure_ascii=False,
                              separators=(',', ':')), encoding='utf-8')
    print(f'wrote {OUT} ({OUT.stat().st_size // 1024} KB)')
    # Only fail the run when nothing at all could be refreshed
    return 1 if len(failed) == len(builders) else 0


if __name__ == '__main__':
    sys.exit(main())
