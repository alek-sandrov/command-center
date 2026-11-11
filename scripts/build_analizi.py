#!/usr/bin/env python3
"""Build data/analizi.json for the City Readiness Index (gotovnost.html).

For every place where people live in Sofia, measures how far it is to the nearest point
of each civil-protection resource on the map (data/karta.json), and from that how many
residents of each district live within walking distance of it.

Inputs
  - data/karta.json, data/rayoni.json  (scripts/build_karta.py)
  - Kontur Population: residents on a grid of H3 hexagons (~0.74 km2 each), from the
    European Commission's GHSL and Microsoft/Meta building data. Public, CC BY 4.0:
    https://data.humdata.org/dataset/kontur-population-bulgaria
    It shows *where* in a district people live; each district's hexagons are then scaled
    so their total equals the district population in the 2021 census (НСИ).

Each district gets a score from 0 to 100 for five pillars: the share of its residents
within the distance below of at least one point of that kind (straight-line distance,
roughly a 12-15 minute walk for 1 km). The readiness index is the plain average of the five.

Usage: python3 scripts/build_analizi.py [path/to/kontur_population_BG.gpkg]
       (without a path the Kontur file is downloaded to a temporary folder)
"""
import gzip
import json
import math
import sqlite3
import struct
import sys
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'analizi.json'
KONTUR_URL = ('https://geodata-eu-central-1-kontur-public.s3.amazonaws.com/kontur_datasets/'
              'kontur_population_BG_20231101.gpkg.gz')
KONTUR_DATE = '2023-11-01'

# Permanent population by district, census of 7 September 2021 (НСИ), same order as data/rayoni.json
CENSUS_2021 = {
    'Банкя': 12747, 'Витоша': 76778, 'Връбница': 44028, 'Възраждане': 36649, 'Изгрев': 31189,
    'Илинден': 30336, 'Искър': 59925, 'Красна поляна': 53274, 'Красно село': 79883,
    'Кремиковци': 22464, 'Лозенец': 57134, 'Люлин': 106112, 'Младост': 104047, 'Надежда': 64655,
    'Нови Искър': 28774, 'Оборище': 28943, 'Овча купел': 57036, 'Панчарево': 30261,
    'Подуяне': 71437, 'Сердика': 43263, 'Слатина': 66687, 'Средец': 25740, 'Студентски': 74163,
    'Триадица': 68765,
}

# key, map layers it is measured against, distance in km, keep(point) filter
PILLARS = [
    ('shelter', ['shelters'], 1.0, None),
    ('evac', ['evac'], 1.0, None),
    ('medical', ['hospitals'], 2.0, None),
    ('water', ['fountains', 'springs'], 1.0, lambda p: 'Не работи' not in p[3]),
    ('iodine', ['iodine'], 1.0, None),
]
# Shown alongside, not part of the score
EXTRA = [
    ('pharmacy', ['pharmacies'], 0.5, None),
    ('tents', ['tents'], 2.0, None),
]


HEXAGON = [[-82, -560], [-510, -207], [-429, 354], [82, 560], [510, 207], [429, -354]]


def mercator_to_latlng(x, y):
    lng = x / 6378137 * 180 / math.pi
    lat = (2 * math.atan(math.exp(y / 6378137)) - math.pi / 2) * 180 / math.pi
    return lat, lng


# Each hexagon is split into 19 sample points (its centre, and points a third and two thirds of
# the way out towards each corner and each edge middle), each with 1/19 of its residents. Small
# central districts are only a few hexagons across, so this places residents on the right side
# of a district boundary and measures distances from where they live within the hexagon.
SAMPLES = [(0.0, 0)] + [(f, k) for f in (1 / 3, 2 / 3) for k in range(6)] + [(2 / 3, k + 0.5) for k in range(6)]


def hexagons(gpkg, bbox):
    """Each hexagon near bbox (south, west, north, east): its centre and its sample points,
    as (lat, lng, [(lat, lng, population), ...])."""
    s, w, n, e = bbox
    con = sqlite3.connect(gpkg)
    for blob, pop in con.execute('SELECT geom, population FROM population'):
        flags = blob[3]
        if (flags >> 1) & 7 != 1:
            raise ValueError('expected an xy envelope in the GeoPackage geometry header')
        order = '<' if flags & 1 else '>'
        minx, maxx, miny, maxy = struct.unpack(order + '4d', blob[8:40])
        lat, lng = mercator_to_latlng((minx + maxx) / 2, (miny + maxy) / 2)
        if not (s - 0.01 <= lat <= n + 0.01 and w - 0.01 <= lng <= e + 0.01):
            continue
        wkb = blob[40:]
        bo = '<' if wkb[0] == 1 else '>'
        npts = struct.unpack(bo + 'I', wkb[9:13])[0]
        ring = [struct.unpack(bo + '2d', wkb[13 + 16 * i:29 + 16 * i]) for i in range(npts - 1)]
        cx = sum(x for x, _ in ring) / len(ring)
        cy = sum(y for _, y in ring) / len(ring)
        samples = []
        for f, k in SAMPLES:
            if k == int(k):
                vx, vy = ring[int(k)]
            else:  # middle of the edge after corner int(k)
                a, b = ring[int(k)], ring[(int(k) + 1) % len(ring)]
                vx, vy = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            samples.append((*mercator_to_latlng(cx + f * (vx - cx), cy + f * (vy - cy)), pop / len(SAMPLES)))
        yield (*mercator_to_latlng(cx, cy), samples)


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


def district_of(shapes, lat, lng):
    for i, shape in enumerate(shapes):
        s, w, n, e = shape['bbox']
        if s <= lat <= n and w <= lng <= e:
            for p in shape['polygons']:
                if in_ring(lng, lat, p[0]) and not any(in_ring(lng, lat, h) for h in p[1:]):
                    return i
    return -1


def area_km2(shape):
    """Area of a district from its [lng, lat] rings (local equirectangular projection)."""
    total = 0.0
    for poly in shape['polygons']:
        for k, ring in enumerate(poly):
            lat0 = sum(p[1] for p in ring) / len(ring)
            kx = 111.32 * math.cos(math.radians(lat0))
            a = 0.0
            for i in range(len(ring)):
                x1, y1 = ring[i - 1][0] * kx, ring[i - 1][1] * 110.57
                x2, y2 = ring[i][0] * kx, ring[i][1] * 110.57
                a += x1 * y2 - x2 * y1
            total += abs(a) / 2 * (1 if k == 0 else -1)
    return total


def nearest_km(lat, lng, points):
    kx = math.cos(math.radians(lat))
    best = float('inf')
    for plat, plng in points:
        d = ((plat - lat) ** 2 + ((plng - lng) * kx) ** 2)
        if d < best:
            best = d
    return math.sqrt(best) * 111.2


def load_kontur(arg):
    if arg:
        return Path(arg)
    tmp = Path(tempfile.mkdtemp())
    print('downloading Kontur population grid...', file=sys.stderr)
    req = urllib.request.Request(KONTUR_URL, headers={'User-Agent': 'sofia-prepping.com analysis builder'})
    with urllib.request.urlopen(req, timeout=120) as res:
        (tmp / 'kontur.gpkg').write_bytes(gzip.decompress(res.read()))
    return tmp / 'kontur.gpkg'


def main():
    karta = json.loads((ROOT / 'data' / 'karta.json').read_text(encoding='utf-8'))
    shapes = json.loads((ROOT / 'data' / 'rayoni.json').read_text(encoding='utf-8'))
    names = [s['name'] for s in shapes]
    assert set(names) == set(CENSUS_2021), 'district names differ from the census list'
    layers = karta['layers']

    bbox = (min(s['bbox'][0] for s in shapes), min(s['bbox'][1] for s in shapes),
            max(s['bbox'][2] for s in shapes), max(s['bbox'][3] for s in shapes))
    cells = []  # sample points: [lat, lng, residents, district, hexagon]
    hexes = []  # [lat, lng] of each hexagon with residents in Sofia
    for hlat, hlng, samples in hexagons(load_kontur(sys.argv[1] if len(sys.argv) > 1 else None), bbox):
        mine = []
        for lat, lng, pop in samples:
            i = district_of(shapes, lat, lng)
            if i >= 0 and pop > 0:
                mine.append([lat, lng, pop, i, len(hexes)])
        if mine:
            cells += mine
            hexes.append([hlat, hlng])

    # Scale each district's grid to its census population
    grid_sum = [0.0] * len(names)
    for c in cells:
        grid_sum[c[3]] += c[2]
    for c in cells:
        c[2] *= CENSUS_2021[names[c[3]]] / grid_sum[c[3]]

    measures = PILLARS + EXTRA
    points = {}
    for key, keys, _, keep in measures:
        points[key] = [(p[0], p[1]) for k in keys for p in layers[k] if keep is None or keep(p)]

    # Per cell: distance to the nearest point of each measure
    for c in cells:
        c.append([nearest_km(c[0], c[1], points[key]) for key, *_ in measures])

    def covered(cell, m):
        return cell[5][m] <= measures[m][2]

    districts = []
    for i, name in enumerate(names):
        mine = [c for c in cells if c[3] == i]
        pop = CENSUS_2021[name]
        row = {
            'name': name,
            'population': pop,
            'area': round(area_km2(shapes[i]), 1),
            'counts': {key: sum(1 for k in keys for p in layers[k]
                                if p[5] == i and (keep is None or keep(p))) for key, keys, _, keep in measures},
            'cover': {},
            'uncovered': {},
            'median_km': {},
        }
        for m, (key, *_) in enumerate(measures):
            inside = sum(c[2] for c in mine if covered(c, m))
            row['cover'][key] = round(100 * inside / pop, 1)
            row['uncovered'][key] = round(pop - inside, -1)
            # Distance within which half of the district's residents have a point (population-weighted median)
            ordered = sorted(mine, key=lambda c: c[5][m])
            acc = 0.0
            for c in ordered:
                acc += c[2]
                if acc >= pop / 2:
                    row['median_km'][key] = round(c[5][m], 2)
                    break
        row['score'] = round(sum(row['cover'][key] for key, *_ in PILLARS) / len(PILLARS), 1)
        districts.append(row)

    total = sum(CENSUS_2021.values())
    city = {
        'population': total,
        'cover': {key: round(sum(d['cover'][key] * d['population'] for d in districts) / total, 1)
                  for key, *_ in measures},
        'uncovered': {key: round(sum(d['uncovered'][key] for d in districts), -2) for key, *_ in measures},
        'counts': {key: len(points[key]) for key, *_ in measures},
    }
    city['score'] = round(sum(city['cover'][key] for key, *_ in PILLARS) / len(PILLARS), 1)

    # The grid for the map, one row per hexagon: centre, residents, the district most of them
    # live in, and per measure the share of them within reach, in tenths (0-9, A = all)
    rows = [[0.0, [0.0] * len(names), [0.0] * len(measures)] for _ in hexes]
    for c in cells:
        r = rows[c[4]]
        r[0] += c[2]
        r[1][c[3]] += c[2]
        for m in range(len(measures)):
            if covered(c, m):
                r[2][m] += c[2]
    grid = []
    for (lat, lng), (pop, by_district, inside) in zip(hexes, rows):
        if round(pop) < 1:
            continue
        share = ''.join('0123456789A'[round(10 * x / pop)] for x in inside)
        grid.append([round(lat, 5), round(lng, 5), round(pop), by_district.index(max(by_district)), share])

    out = {
        'points_updated': max(karta['updated'].values()),
        'population_source': {'census': '2021', 'grid': KONTUR_DATE},
        'pillars': [{'key': k, 'km': km} for k, _, km, _ in PILLARS],
        'extra': [{'key': k, 'km': km} for k, _, km, _ in EXTRA],
        'city': city,
        'districts': districts,
        # Corners of a grid hexagon in metres (north, east) from its centre; the same everywhere
        # in Sofia to within a metre
        'hexagon': HEXAGON,
        'grid': grid,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'wrote {OUT.name}: {len(grid)} grid cells, city score {city["score"]}')
    for d in sorted(districts, key=lambda d: d['score']):
        print(f'  {d["score"]:5.1f}  {d["name"]:<14} ' + ' '.join(f'{k}:{d["cover"][k]:5.1f}' for k, *_ in measures))


if __name__ == '__main__':
    main()
