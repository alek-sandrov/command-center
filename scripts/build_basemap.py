#!/usr/bin/env python3
"""Build maps/sofia.pmtiles: the street map of Sofia that the site's maps draw (map-style.js).

Cuts the Sofia area out of a Protomaps daily build of OpenStreetMap (vector tiles)
(zoom 0-14) by reading only the parts of the remote archive it needs (HTTP range requests). One file on our
own site means the map needs no outside tile server, and visitors can save it for offline use.

Map data © OpenStreetMap contributors (ODbL); basemap tiles by Protomaps.

Needs: pip install pmtiles
Usage: python3 scripts/build_basemap.py [YYYYMMDD]   (default: yesterday's build)
After rebuilding, run scripts/build_offline.py so phones that saved the map get the new one.
"""
import gzip
import json
import math
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path

from pmtiles.reader import deserialize_directory, deserialize_header
from pmtiles.tile import Compression, zxy_to_tileid
from pmtiles.writer import Writer

OUT = Path(__file__).resolve().parent.parent / 'maps' / 'sofia.pmtiles'
UA = 'sofia-prepping.com basemap builder'
# Stolichna municipality with a small margin: south, west, north, east
BBOX = (42.53, 23.08, 42.87, 23.62)
# Zoom 15 would double the file (to ~26 MB); the map draws zoom-14 tiles larger for closer views
MAX_ZOOM = 14


def tile_range(z):
    s, w, n, e = BBOX
    def x(lng): return int((lng + 180) / 360 * 2 ** z)
    def y(lat):
        r = math.radians(lat)
        return int((1 - math.asinh(math.tan(r)) / math.pi) / 2 * 2 ** z)
    return range(x(w), x(e) + 1), range(y(n), y(s) + 1)


def main():
    build = sys.argv[1] if len(sys.argv) > 1 else (date.today() - timedelta(days=1)).strftime('%Y%m%d')
    url = f'https://build.protomaps.com/{build}.pmtiles'

    @lru_cache(maxsize=None)
    def get(offset, length):
        req = urllib.request.Request(url, headers={'Range': f'bytes={offset}-{offset + length - 1}', 'User-Agent': UA})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=60) as res:
                    data = res.read()
                    if len(data) != length:
                        raise IOError(f'short read {len(data)}/{length}')
                    return data
            except Exception:
                if attempt == 3:
                    raise

    header = deserialize_header(get(0, 127))
    gz = header['internal_compression'] == Compression.GZIP

    @lru_cache(maxsize=None)
    def directory(offset, length):
        return deserialize_directory(get(offset, length))  # handles the archive's own compression

    def locate(tile_id):
        """(offset, length) of a tile's data in the remote archive, or None"""
        off, length = header['root_offset'], header['root_length']
        for _ in range(4):
            entries = directory(off, length)
            lo, hi, hit = 0, len(entries) - 1, None
            while lo <= hi:  # last entry with tile_id <= wanted
                mid = (lo + hi) // 2
                if entries[mid].tile_id <= tile_id:
                    hit, lo = entries[mid], mid + 1
                else:
                    hi = mid - 1
            if hit is None:
                return None
            if hit.run_length == 0:
                off, length = header['leaf_directory_offset'] + hit.offset, hit.length
                continue
            if tile_id < hit.tile_id + hit.run_length:
                return header['tile_data_offset'] + hit.offset, hit.length
            return None
        return None

    wanted = []
    for z in range(0, MAX_ZOOM + 1):
        xs, ys = tile_range(z)
        wanted += [(z, x, y) for x in xs for y in ys]
    print(f'build {build}: {len(wanted)} tiles in zoom 0-{MAX_ZOOM}')

    def fetch(zxy):
        where = locate(zxy_to_tileid(*zxy))
        return zxy, (get(*where) if where else None)

    with ThreadPoolExecutor(max_workers=12) as pool:
        tiles = {zxy: data for zxy, data in pool.map(fetch, wanted) if data}
    print(f'fetched {len(tiles)} tiles, {sum(map(len, tiles.values())) / 1e6:.1f} MB')

    meta_raw = get(header['metadata_offset'], header['metadata_length'])
    metadata = json.loads(gzip.decompress(meta_raw) if gz else meta_raw)
    metadata['description'] = f'Sofia area from Protomaps build {build}'

    s, w, n, e = BBOX
    out_header = {
        'tile_type': header['tile_type'], 'tile_compression': header['tile_compression'],
        'min_zoom': 0, 'max_zoom': MAX_ZOOM,
        'min_lon_e7': int(w * 1e7), 'min_lat_e7': int(s * 1e7), 'max_lon_e7': int(e * 1e7), 'max_lat_e7': int(n * 1e7),
        'center_zoom': 12, 'center_lon_e7': int(23.3219 * 1e7), 'center_lat_e7': int(42.6977 * 1e7),
    }
    OUT.parent.mkdir(exist_ok=True)
    with open(OUT, 'wb') as f:
        writer = Writer(f)
        for zxy in sorted(tiles, key=lambda t: zxy_to_tileid(*t)):
            writer.write_tile(zxy_to_tileid(*zxy), tiles[zxy])
        writer.finalize(out_header, metadata)
    print(f'wrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB)')


if __name__ == '__main__':
    main()
