#!/usr/bin/env python3
"""Archive the live city status, so it can later be counted and charted over time.

The live sources (functions/api/status.js) only ever show "now". This script reads them from the
public site every run (the archive workflow runs it every 30 minutes) and keeps two kinds of record
in an archive folder (the `arhiv` branch of this repository):

  events/YYYY/MM/YYYY-MM-DD.ndjson   one line per change: an item that appeared ("open") with its
                                     details, or one that is no longer listed ("close") with how long
                                     it was seen. Water outages, heating faults and repairs, weather
                                     warnings, earthquakes and official announcements.
  snapshots/YYYY/MM/YYYY-MM-DD.ndjson  one line per run: the numbers at that moment (air quality for
                                     the city and each district, radiation per station, weather,
                                     outage counts per district, which sources answered).
  state.json                         the items open right now, to know what changed next run.

Dates in file names are Sofia dates; every time inside is epoch milliseconds (UTC).
A source that doesn't answer leaves its open items open: nothing is closed on a failed read.

Usage: python3 scripts/archive_status.py <archive folder> [site]   (site defaults to the live one)
"""
import hashlib
import json
import statistics
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_analizi import district_of  # noqa: E402  same point-in-district test as the analyses

ROOT = Path(__file__).resolve().parent.parent
SITE = 'https://sofia-prepping.com'
API = '{site}/api/status?part={part}&v=3'
WEATHER = ('https://api.open-meteo.com/v1/forecast?latitude=42.6977&longitude=23.3219'
           '&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m'
           '&wind_speed_unit=kmh&timezone=UTC')
UA = 'sofia-prepping.com status archive'
TZ = ZoneInfo('Europe/Sofia')
SCHEMA = 1
# Items that last (closed when they are no longer listed) and items that just happen (only opened)
LASTING = ('water', 'water_planned', 'heating', 'warnings')
MIN_SENSORS = 2  # a district's air value needs at least this many sensors

README = """# Sofia status archive

Written by `scripts/archive_status.py` (branch with the site's code) through the
"Archive live status" workflow, every 30 minutes. See the script for the format.
Times are epoch milliseconds (UTC); file names use Sofia dates.

- `events/YYYY/MM/YYYY-MM-DD.ndjson` – an item appeared (`"op": "open"`, with `data`) or is no
  longer listed (`"op": "close"`, with `first` and `last` seen). Sources: `water`,
  `water_planned`, `heating`, `warnings`, `earthquakes`, `official`.
- `snapshots/YYYY/MM/YYYY-MM-DD.ndjson` – the numbers at each run.
- `state.json` – items open at the last run.

Districts are numbered 0-23 in the order of `data/rayoni.json`.
"""


def get_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=40) as res:
        return json.load(res)


def fetch(site):
    out = {}
    for part in ('water', 'heating', 'warnings', 'earthquakes', 'air', 'radiation', 'news'):
        try:
            data = get_json(API.format(site=site, part=part))
            out[part] = data if data.get('ok') else None
        except Exception as err:  # one source down must not stop the others
            print(f'{part}: {err}', file=sys.stderr)
            out[part] = None
    try:
        out['weather'] = get_json(WEATHER)['current']
    except Exception as err:
        print(f'weather: {err}', file=sys.stderr)
        out['weather'] = None
    return out


def key(*parts):
    return hashlib.sha1('|'.join(str(p) for p in parts).encode()).hexdigest()[:12]


def median(values):
    return round(statistics.median(values), 1) if values else None


def current_items(src, shapes, names):
    """The items each source lists right now: {source: {key: data}}. A source that failed is absent."""
    items = {}
    if src['water']:
        for kind, rows in (('water', src['water']['current']), ('water_planned', src['water']['planned'])):
            items[kind] = {key(r['district'], r['type'], r['location'], r['start']): {
                'district': names.index(r['district']) if r['district'] in names else None,
                'type': r['type'], 'location': r['location'], 'reason': r['reason'],
                'start': r['start'], 'until': r['until']} for r in rows}
    if src['heating']:
        items['heating'] = {key(r['region'], r['name'], r['from']): {
            'district': district_of(shapes, r['lat'], r['lng']) if r.get('lat') else None,
            'region': r['region'], 'name': r['name'], 'addresses': (r.get('addresses') or '')[:400],
            'from': r['from'], 'until': r['until'], 'lat': r.get('lat'), 'lng': r.get('lng')} for r in src['heating']['items']}
    if src['warnings']:
        items['warnings'] = {key(r['level'], r['event'], r['onset']): {
            'level': r['level'], 'event': r['event'], 'onset': r['onset'], 'expires': r['expires'],
            'description': (r.get('description') or '')[:600]} for r in src['warnings']['items']}
    if src['earthquakes']:
        items['earthquakes'] = {key(r['time'], r['mag'], r['region']): {
            k: r.get(k) for k in ('time', 'mag', 'region', 'km', 'depth', 'lat', 'lng', 'url')} for r in src['earthquakes']['items']}
    if src['news']:
        items['official'] = {key(r['url']): {k: r.get(k) for k in ('source', 'title', 'url', 'date')}
                             for r in src['news']['official']}
    return items


def snapshot(now, src, shapes, items):
    snap = {'t': now, 'v': SCHEMA, 'ok': {k: v is not None for k, v in src.items()}}
    if src['air']:
        sensors = src['air']['sensors']
        by_district = [[] for _ in shapes]
        for lat, lng, pm25, _pm10 in sensors:
            i = district_of(shapes, lat, lng)
            if i >= 0:
                by_district[i].append(pm25)
        snap['air'] = {
            'n': len(sensors),
            'pm25': median([s[2] for s in sensors]),
            'pm10': median([s[3] for s in sensors if s[3] is not None]),
            'pm25_by_district': [median(v) if len(v) >= MIN_SENSORS else None for v in by_district]
        }
    if src['radiation']:
        snap['radiation'] = {'updated': src['radiation'].get('updated'),
                             'stations': {s['name']: s['value'] for s in src['radiation']['sofia']}}
    if src['weather']:
        w = src['weather']
        snap['weather'] = {k: w.get(k) for k in ('temperature_2m', 'relative_humidity_2m', 'precipitation',
                                                 'weather_code', 'wind_speed_10m', 'wind_gusts_10m')}
    for name in ('water', 'water_planned', 'heating'):
        if name in items:
            per = [0] * len(shapes)
            for it in items[name].values():
                if it['district'] is not None and it['district'] >= 0:
                    per[it['district']] += 1
            snap[name] = {'n': len(items[name]), 'by_district': per}
    if 'warnings' in items:
        snap['warning_level'] = max((it['level'] for it in items['warnings'].values()), default=1)
    return snap


def append(path, rows):
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a', encoding='utf-8') as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False, separators=(',', ':')) + '\n')


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    out = Path(sys.argv[1])
    site = sys.argv[2] if len(sys.argv) > 2 else SITE
    out.mkdir(parents=True, exist_ok=True)
    shapes = json.loads((ROOT / 'data' / 'rayoni.json').read_text(encoding='utf-8'))
    names = [s['name'] for s in shapes]

    now = int(time.time() * 1000)
    src = fetch(site)
    if not any(src.values()):
        sys.exit('no source answered; nothing archived')
    items = current_items(src, shapes, names)

    state_file = out / 'state.json'
    state = json.loads(state_file.read_text(encoding='utf-8')) if state_file.exists() else {'open': {}}
    events = []
    for name, now_items in items.items():
        was = state['open'].setdefault(name, {})
        for k, data in now_items.items():
            if k in was:
                was[k]['last'] = now
            else:
                events.append({'t': now, 'src': name, 'op': 'open', 'key': k, 'data': data})
                was[k] = {'first': now, 'last': now}
        if name in LASTING:
            for k in [k for k in was if k not in now_items]:
                events.append({'t': now, 'src': name, 'op': 'close', 'key': k, 'first': was[k]['first'], 'last': was[k]['last']})
                del was[k]
        else:
            # Earthquakes and announcements only happen once; forget them when they leave the source's list
            for k in [k for k in was if k not in now_items]:
                del was[k]
    state['updated'] = now
    state['v'] = SCHEMA

    day = datetime.fromtimestamp(now / 1000, TZ).strftime('%Y/%m/%Y-%m-%d')
    append(out / 'events' / f'{day}.ndjson', events)
    append(out / 'snapshots' / f'{day}.ndjson', [snapshot(now, src, shapes, items)])
    state_file.write_text(json.dumps(state, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    if not (out / 'README.md').exists():
        (out / 'README.md').write_text(README, encoding='utf-8')

    opened = sum(e['op'] == 'open' for e in events)
    closed = len(events) - opened
    answered = sum(v is not None for v in src.values())
    print(f'archived {day}: {answered}/{len(src)} sources, {opened} opened, {closed} closed')


if __name__ == '__main__':
    main()
