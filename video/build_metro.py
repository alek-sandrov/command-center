#!/usr/bin/env python3
"""What-if for the shelters video: count metro stations as shelters.

Uses the same population grid, census scaling and 1 km straight-line rule as
scripts/build_analizi.py, and writes video/metro.json:
  city      cover / uncovered with shelters only (must match data/analizi.json) and with metro
  districts the same per district
  grid      per hexagon of data/analizi.json: share of residents within 1 km, in tenths (0-9, A)
  stations  [lat, lng, name] of the metro stations used

Usage: python3 video/build_metro.py [path/to/kontur_population_BG.gpkg]
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
import build_analizi as B  # noqa: E402

KM = 1.0


def main():
    karta = json.loads((ROOT / 'data' / 'karta.json').read_text(encoding='utf-8'))
    shapes = json.loads((ROOT / 'data' / 'rayoni.json').read_text(encoding='utf-8'))
    analizi = json.loads((ROOT / 'data' / 'analizi.json').read_text(encoding='utf-8'))
    names = [s['name'] for s in shapes]
    layers = karta['layers']

    # Same sampling and census scaling as build_analizi.main()
    bbox = (min(s['bbox'][0] for s in shapes), min(s['bbox'][1] for s in shapes),
            max(s['bbox'][2] for s in shapes), max(s['bbox'][3] for s in shapes))
    cells, hexes = [], []
    for hlat, hlng, samples in B.hexagons(B.load_kontur(sys.argv[1] if len(sys.argv) > 1 else None), bbox):
        mine = []
        for lat, lng, pop in samples:
            i = B.district_of(shapes, lat, lng)
            if i >= 0 and pop > 0:
                mine.append([lat, lng, pop, i, len(hexes)])
        if mine:
            cells += mine
            hexes.append([hlat, hlng])
    grid_sum = [0.0] * len(names)
    for c in cells:
        grid_sum[c[3]] += c[2]
    for c in cells:
        c[2] *= B.CENSUS_2021[names[c[3]]] / grid_sum[c[3]]

    shelters = [(p[0], p[1]) for p in layers['shelters']]
    # The metro layer also lists entrances; a station is the row marked "Метростанция"
    stations = [p for p in layers['metro'] if p[3] == 'Метростанция']
    both = shelters + [(p[0], p[1]) for p in stations]
    for c in cells:
        c.append(B.nearest_km(c[0], c[1], shelters) <= KM)
        c.append(B.nearest_km(c[0], c[1], both) <= KM)

    total = sum(B.CENSUS_2021.values())
    out = {'stations': [[p[0], p[1], p[2]] for p in stations], 'districts': [], 'city': {}}
    city_in = [0.0, 0.0]
    for i, name in enumerate(names):
        mine = [c for c in cells if c[3] == i]
        pop = B.CENSUS_2021[name]
        a = sum(c[2] for c in mine if c[5])
        b = sum(c[2] for c in mine if c[6])
        city_in[0] += a
        city_in[1] += b
        out['districts'].append({
            'name': name, 'population': pop,
            'stations': sum(1 for p in stations if p[5] == i),
            'cover': round(100 * a / pop, 1), 'cover_metro': round(100 * b / pop, 1),
            'uncovered': round(pop - a, -1), 'uncovered_metro': round(pop - b, -1),
        })
    out['city'] = {
        'population': total, 'stations': len(stations),
        'cover': round(100 * city_in[0] / total, 1), 'cover_metro': round(100 * city_in[1] / total, 1),
        'uncovered': round(total - city_in[0], -2), 'uncovered_metro': round(total - city_in[1], -2),
    }
    # The baseline must equal the published analysis, or the comparison means nothing
    assert out['city']['cover'] == analizi['city']['cover']['shelter'], (out['city']['cover'], analizi['city']['cover']['shelter'])

    # Grid shares with metro, keyed like data/analizi.json's grid (same hexagon centres)
    rows = {}
    for c in cells:
        r = rows.setdefault(c[4], [0.0, 0.0])
        r[0] += c[2]
        if c[6]:
            r[1] += c[2]
    share = {}
    for h, (lat, lng) in enumerate(hexes):
        pop, inside = rows[h]
        if round(pop) >= 1:
            share[f'{round(lat, 5)},{round(lng, 5)}'] = '0123456789A'[round(10 * inside / pop)]
    out['grid'] = [share[f'{g[0]},{g[1]}'] for g in analizi['grid']]

    (ROOT / 'video' / 'metro.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps(out['city'], ensure_ascii=False))
    for d in sorted(out['districts'], key=lambda d: d['cover_metro'] - d['cover'], reverse=True):
        print(f"{d['name']:15} st={d['stations']:2} {d['cover']:5.1f} -> {d['cover_metro']:5.1f}  uncovered {d['uncovered']:.0f} -> {d['uncovered_metro']:.0f}")


if __name__ == '__main__':
    main()
