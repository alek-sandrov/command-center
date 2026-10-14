// Cloudflare Pages Function: GET /api/status?part=<earthquakes|warnings|air|water|heating>
// Live city status for the homepage from sources a browser can't read directly
// (no CORS). Each part is cached at the edge for 10 minutes.

const CACHE_SECONDS = 600;
const SOFIA = { lat: 42.6977, lng: 23.3219 };
const TZ = 'Europe/Sofia';
const UA = 'Mozilla/5.0 (compatible; sofia-prepping.com status)';

const WATER_DISTRICTS = ['', 'Банкя', 'Витоша', 'Връбница', 'Възраждане', 'Изгрев', 'Илинден', 'Искър',
    'Красна поляна', 'Красно село', 'Кремиковци', 'Лозенец', 'Люлин', 'Младост', 'Надежда', 'Нови Искър',
    'Оборище', 'Овча купел', 'Панчарево', 'Подуяне', 'Сердика', 'Слатина', 'Средец', 'Студентски', 'Триадица'];

async function get(url, { headers = {}, timeout = 12000, type = 'json' } = {}) {
    const res = await fetch(url, {
        headers: { 'User-Agent': UA, ...headers },
        signal: AbortSignal.timeout(timeout)
    });
    if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
    return type === 'json' ? res.json() : res.text();
}

function distanceKm(lat1, lng1, lat2, lng2) {
    const r = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * r / 2) ** 2 +
        Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lng2 - lng1) * r / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a));
}

function sofiaTime(ms, withDate = true) {
    return new Intl.DateTimeFormat('bg-BG', {
        timeZone: TZ, hour: '2-digit', minute: '2-digit',
        ...(withDate ? { day: '2-digit', month: '2-digit' } : {})
    }).format(new Date(ms));
}

// Earthquakes within ~350 km of Sofia in the last 7 days (EMSC)
async function earthquakes() {
    const since = new Date(Date.now() - 7 * 86400e3).toISOString().slice(0, 19);
    const url = `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&lat=${SOFIA.lat}&lon=${SOFIA.lng}` +
        `&maxradius=3.2&minmag=2.5&starttime=${since}&limit=50&orderby=time`;
    const data = await get(url);
    const items = data.features.map(f => {
        const p = f.properties;
        return {
            mag: Math.round(p.mag * 10) / 10,
            region: p.flynn_region,
            time: Date.parse(p.time),
            km: Math.round(distanceKm(SOFIA.lat, SOFIA.lng, p.lat, p.lon)),
            depth: Math.round(p.depth),
            url: `https://www.seismicportal.eu/eventdetails.html?unid=${p.unid}`
        };
    });
    return { items: items.slice(0, 8), count: items.length };
}

// Yellow/orange/red weather warnings for Sofia-city (NUTS3 BG411) from Meteoalarm.
// The Atom feed lists only active warnings and is small; the Bulgarian text comes
// from each Sofia warning's CAP document.
async function warnings() {
    const atom = await get('https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-bulgaria', { type: 'text' });
    const capLinks = new Set();
    for (const [, entry] of atom.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
        if (!/<value>BG411<\/value>/.test(entry)) continue;
        const link = entry.match(/type="application\/cap\+xml" href="([^"]+)"/);
        if (link) capLinks.add(link[1].replace(/&amp;/g, '&'));
    }
    const tag = (xml, name) => (xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`)) || [])[1]?.trim() || '';
    const now = Date.now();
    const items = [];
    for (const url of capLinks) {
        const cap = await get(url, { type: 'text' });
        const infos = [...cap.matchAll(/<info>([\s\S]*?)<\/info>/g)].map(m => m[1]);
        const info = infos.find(i => tag(i, 'language') === 'bg') || infos[0];
        if (!info) continue;
        const level = parseInt((info.match(/<valueName>awareness_level<\/valueName>\s*<value>(\d)/) || [])[1], 10) || 1;
        const expires = Date.parse(tag(info, 'expires'));
        if (level < 2 || expires < now) continue;
        const onset = Date.parse(tag(info, 'onset'));
        items.push({ level, event: tag(info, 'event'), description: tag(info, 'description'), onset, expires, active: onset <= now });
    }
    items.sort((a, b) => b.level - a.level || a.onset - b.onset);
    return { items };
}

// Median PM2.5 / PM10 from outdoor sensor.community sensors within 8 km of the centre
async function air() {
    const data = await get(`https://data.sensor.community/airrohr/v1/filter/area=${SOFIA.lat},${SOFIA.lng},8`, { timeout: 15000 });
    const pm25 = [], pm10 = [];
    for (const s of data) {
        if (s.location?.indoor) continue;
        for (const v of s.sensordatavalues || []) {
            const n = parseFloat(v.value);
            if (!(n >= 0 && n < 500)) continue;
            if (v.value_type === 'P2') pm25.push(n);
            if (v.value_type === 'P1') pm10.push(n);
        }
    }
    const median = a => {
        if (!a.length) return null;
        a.sort((x, y) => x - y);
        const m = a.length >> 1;
        return Math.round((a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2) * 10) / 10;
    };
    if (!pm25.length) throw new Error('no PM2.5 readings');
    return { pm25: median(pm25), pm10: median(pm10), sensors: pm25.length };
}

// Current and planned water outages from Sofiyska Voda's public GIS
async function water() {
    const base = 'https://gispx.sofiyskavoda.bg/arcgis/rest/services/WSI_PUBLIC/InfoCenter_Public/MapServer';
    const fields = 'ALERTTYPE,START_,ALERTEND,LOCATION,DESCRIPTION,SOFIADISTRICT,END_H,END_M';
    const headers = { Referer: 'https://gispx.sofiyskavoda.bg/WebApp.InfoCenter/', 'User-Agent': 'Mozilla/5.0' };
    const query = layer => get(`${base}/${layer}/query?where=1%3D1&outFields=${fields}&returnGeometry=false&f=json`, { headers });
    const [current, planned] = await Promise.all([query(2), query(3)]);
    const map = (f, kind) => {
        const a = f.attributes;
        const multiDay = a.ALERTEND && a.ALERTEND - a.START_ > 86400e3;
        const until = a.END_H ? `${multiDay ? sofiaTime(a.ALERTEND).split(',')[0] + ' ' : ''}${a.END_H}:${a.END_M || '00'}` : '';
        return {
            kind,
            type: a.ALERTTYPE,
            district: WATER_DISTRICTS[a.SOFIADISTRICT] || '',
            location: (a.LOCATION || '').replace(/^\s*зона\s*(на|за)\s*спиране\s*[:\-–]?\s*/i, ''),
            reason: a.DESCRIPTION || '',
            start: a.START_,
            until
        };
    };
    return {
        current: current.features.map(f => map(f, 'current')),
        planned: planned.features.map(f => map(f, 'planned'))
    };
}

// Returns the JSON object literal starting at html[start] === '{' by matching braces outside strings
function objectAt(html, start) {
    let depth = 0, inString = false;
    for (let i = start; i < html.length; i++) {
        const c = html[i];
        if (inString) {
            if (c === '\\') i++;
            else if (c === '"') inString = false;
        } else if (c === '"') inString = true;
        else if (c === '{') depth++;
        else if (c === '}' && --depth === 0) return html.slice(start, i + 1);
    }
    throw new Error('unterminated object');
}

// Active district-heating accidents and repairs from toplo.bg (embedded JSON on the page)
async function heating() {
    const html = await get('https://www.toplo.bg/accidents-and-maintenance', { type: 'text', timeout: 15000 });
    const now = Date.now();
    const items = [];
    for (const m of html.matchAll(/var info = \{/g)) {
        let info;
        try { info = JSON.parse(objectAt(html, m.index + m[0].length - 1)); } catch { continue; }
        const from = Date.parse(info.FromDate);
        const until = info.UntilDate ? Date.parse(info.UntilDate) : null;
        if (from > now || (until && until < now)) continue;
        items.push({ region: info.Region, name: info.Name, addresses: info.Addresses || '', from, until });
    }
    items.sort((a, b) => b.from - a.from);
    return { count: items.length, items: items.slice(0, 10) };
}

async function settle(fn) {
    try {
        return { ok: true, ...(await fn()) };
    } catch (err) {
        return { ok: false, error: String(err.message || err) };
    }
}

// Each source is its own request (/api/status?part=air) so one call stays within
// the Workers CPU limit and a slow source doesn't hold up the others.
const PARTS = { earthquakes, warnings, air, water, heating };

export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const part = url.searchParams.get('part');
    if (!PARTS[part]) {
        return new Response(JSON.stringify({ error: 'unknown part', parts: Object.keys(PARTS) }), {
            status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
    }
    const cache = globalThis.caches?.default;
    const key = new Request(`${url.origin}/api/status?part=${part}`);
    if (cache) {
        const hit = await cache.match(key);
        if (hit) return hit;
    }
    const body = { generated: Date.now(), ...(await settle(PARTS[part])) };
    const res = new Response(JSON.stringify(body), {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            // Failed lookups are cached briefly so a broken source is retried soon
            'Cache-Control': `public, max-age=${body.ok ? CACHE_SECONDS : 60}`
        }
    });
    if (cache) context.waitUntil?.(cache.put(key, res.clone()));
    return res;
}
