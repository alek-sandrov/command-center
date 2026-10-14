#!/usr/bin/env python3
"""Build data/karta.json for the combined map (karta.html).

Pulls every layer from its public source and writes one compact file:
  - Sofia Municipality open data (api.sofiaplan.bg): disaster centres,
    mineral springs, metro stations and entrances
  - Google My Maps (KML export): bomb shelters, drinking fountains
  - OpenStreetMap (Overpass API): hospitals, pharmacies

If a source can't be reached, that layer keeps its points from the previous
data/karta.json so a flaky server never empties the map.

Every point is tagged with the index of its district (data/rayoni.json, built
from the municipality's official district boundaries), or -1 if outside all.

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
DISTRICTS_OUT = OUT.parent / 'rayoni.json'
UA = 'sofia-prepping.com map builder (https://sofia-prepping.com)'

# Rough bounding box of Stolichna municipality: south, west, north, east
BBOX = (42.55, 23.10, 42.85, 23.60)

SOFIAPLAN = 'https://api.sofiaplan.bg/datasets/{}'
KML = 'https://www.google.com/maps/d/kml?mid={}&forcekml=1'
SHELTERS_MAP = '1HWcRRnvgI71wfiiQ5P4QNZ45XdR4tx8T'
FOUNTAINS_MAP = '1s1SiRpB38OK8MYMPQGTm1WQ3dK2XPfg'
OVERPASS = ['https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter']


# Official district boundaries; order here is the index used in data files and the URL slug
DISTRICTS = [
    ('Банкя', 'bankya', 'БАНКЯ'), ('Витоша', 'vitosha', 'ВИТОША'), ('Връбница', 'vrabnitsa', 'ВРЪБНИЦА'),
    ('Възраждане', 'vazrazhdane', 'ВЪЗРАЖДАНЕ'), ('Изгрев', 'izgrev', 'ИЗГРЕВ'), ('Илинден', 'ilinden', 'ИЛИНДЕН'),
    ('Искър', 'iskar', 'ИСКЪР'), ('Красна поляна', 'krasna-polyana', 'КРАСНА ПОЛЯНА'),
    ('Красно село', 'krasno-selo', 'КРАСНО СЕЛО'), ('Кремиковци', 'kremikovtsi', 'КРЕМИКОВЦИ'),
    ('Лозенец', 'lozenets', 'ЛОЗЕНЕЦ'), ('Люлин', 'lyulin', 'ЛЮЛИН'), ('Младост', 'mladost', 'МЛАДОСТ'),
    ('Надежда', 'nadezhda', 'НАДЕЖДА'), ('Нови Искър', 'novi-iskar', 'НОВИ ИСКЪР'), ('Оборище', 'oborishte', 'ОБОРИЩЕ'),
    ('Овча купел', 'ovcha-kupel', 'ОВЧА КУПЕЛ'), ('Панчарево', 'pancharevo', 'ПАНЧАРЕВО'), ('Подуяне', 'poduyane', 'ПОДУЯНЕ'),
    ('Сердика', 'serdika', 'СЕРДИКА'), ('Слатина', 'slatina', 'СЛАТИНА'), ('Средец', 'sredets', 'СРЕДЕЦ'),
    ('Студентски', 'studentski', 'СТУДЕНТСКИ'), ('Триадица', 'triaditsa', 'ТРИАДИЦА'),
]


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


def simplify(ring, tol):
    """Douglas-Peucker simplification of a closed ring of [lng, lat] points.

    A closed ring starts and ends on the same point, so it is split at the vertex
    farthest from the start and each half is simplified separately.
    """
    if len(ring) < 5:
        return ring
    x0, y0 = ring[0]
    mid = max(range(len(ring)), key=lambda i: (ring[i][0] - x0) ** 2 + (ring[i][1] - y0) ** 2)
    first, second = simplify_line(ring[:mid + 1], tol), simplify_line(ring[mid:], tol)
    out = first + second[1:]
    return out if len(out) >= 4 else ring


def simplify_line(ring, tol):
    if len(ring) < 3:
        return ring
    keep = [False] * len(ring)
    keep[0] = keep[-1] = True
    stack = [(0, len(ring) - 1)]
    while stack:
        a, b = stack.pop()
        (x1, y1), (x2, y2) = ring[a], ring[b]
        dx, dy = x2 - x1, y2 - y1
        norm = (dx * dx + dy * dy) ** 0.5 or 1e-12
        best, idx = 0, None
        for i in range(a + 1, b):
            x, y = ring[i]
            d = abs(dy * (x - x1) - dx * (y - y1)) / norm
            if d > best:
                best, idx = d, i
        if idx is not None and best > tol:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(ring, keep) if k]


def in_ring(lng, lat, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > lat) != (yj > lat) and lng < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def in_polygons(lng, lat, polygons):
    # polygons: list of [outer, *holes]
    return any(in_ring(lng, lat, poly[0]) and not any(in_ring(lng, lat, h) for h in poly[1:]) for poly in polygons)


def districts():
    """Full-resolution polygons for tagging, plus a simplified copy for the browser."""
    by_name = {f['properties']['obns_cyr']: f['geometry'] for f in sofiaplan(350)}
    full, light = [], []
    for name, slug, official in DISTRICTS:
        g = by_name[official]
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        full.append(polys)
        simple = [[[[round(x, 5), round(y, 5)] for x, y in simplify(r, 0.0002)] for r in poly] for poly in polys]
        xs = [x for poly in polys for x, _ in poly[0]]
        ys = [y for poly in polys for _, y in poly[0]]
        light.append({'name': name, 'slug': slug,
                      'bbox': [round(min(ys), 5), round(min(xs), 5), round(max(ys), 5), round(max(xs), 5)],
                      'polygons': simple})
    return full, light


def tag(rows, full):
    """Append the district index to every row (-1 when outside all districts).

    Disaster-centre points carry the district they serve ("Район X"); that wins over
    location, since e.g. a district's iodine supply point can sit in a neighbouring one.
    """
    index = {name: i for i, (name, _, _) in enumerate(DISTRICTS)}
    for r in rows:
        served = r[4][6:] if r[4].startswith('Район ') else None
        r[5:] = [index[served] if served in index else
                 next((i for i, polys in enumerate(full) if in_polygons(r[1], r[0], polys)), -1)]


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
    try:
        full, light = districts()
        DISTRICTS_OUT.write_text(json.dumps(light, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        print(f'ok   districts={len(light)} ({DISTRICTS_OUT.stat().st_size // 1024} KB)')
    except Exception as err:
        full = None
        print(f'FAIL districts: {err} (points keep their previous district tags)', file=sys.stderr)
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

    if full:
        for rows in layers.values():
            tag(rows, full)

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({'updated': updated, 'layers': layers}, ensure_ascii=False,
                              separators=(',', ':')), encoding='utf-8')
    print(f'wrote {OUT} ({OUT.stat().st_size // 1024} KB)')
    # Only fail the run when nothing at all could be refreshed
    return 1 if len(failed) == len(builders) else 0


if __name__ == '__main__':
    sys.exit(main())
