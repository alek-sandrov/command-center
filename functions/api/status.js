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
    if (res.status === 204) return type === 'json' ? null : '';  // e.g. EMSC when nothing matched
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

// Earthquakes within 50 km of Sofia (close enough to be felt or cause damage)
// in the last 30 days, from EMSC
const QUAKE_KM = 50;

async function earthquakes() {
    const since = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 19);
    const url = `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&lat=${SOFIA.lat}&lon=${SOFIA.lng}` +
        `&maxradius=${(QUAKE_KM / 111.2).toFixed(3)}&minmag=1.5&starttime=${since}&limit=50&orderby=time`;
    const data = await get(url);
    const items = (data?.features || []).map(f => {
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
    return { items: items.slice(0, 10), count: items.length, radiusKm: QUAKE_KM, days: 30 };
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

// Latest PM2.5 / PM10 from outdoor sensor.community sensors across Sofia.
// Returns one row per sensor [lat, lng, pm25, pm10] so the page can take the
// median for the whole city or for one district.
async function air() {
    // Only particulate sensors: halves the response (no temperature/humidity-only devices)
    const types = 'SDS011,SPS30,PMS5003,PMS7003,HPM,NextPM';
    const data = await get(`https://data.sensor.community/airrohr/v1/filter/type=${types}&area=${SOFIA.lat},${SOFIA.lng},18`, { timeout: 15000 });
    const sensors = new Map();
    for (const s of data) {
        if (Number(s.location?.indoor)) continue;
        const lat = parseFloat(s.location?.latitude), lng = parseFloat(s.location?.longitude);
        if (!(lat && lng)) continue;
        const values = {};
        for (const v of s.sensordatavalues || []) {
            const n = parseFloat(v.value);
            if (n >= 0 && n < 500) values[v.value_type] = n;
        }
        // The feed can hold several readings per sensor; keep the newest (last)
        if (values.P2 !== undefined) {
            sensors.set(s.sensor?.id ?? `${lat},${lng}`,
                [Math.round(lat * 1e4) / 1e4, Math.round(lng * 1e4) / 1e4, values.P2, values.P1 ?? null]);
        }
    }
    if (!sensors.size) throw new Error('no PM2.5 readings');
    return { sensors: [...sensors.values()] };
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

// Average of all coordinates in a GeoJSON feature list, used to place an outage in a district
function centre(geojson) {
    let sx = 0, sy = 0, n = 0;
    for (const [, x, y] of (geojson || '').matchAll(/\[(2[23]\.\d+),(4[23]\.\d+)/g)) {
        sx += +x; sy += +y; n++;
    }
    return n ? { lat: Math.round(sy / n * 1e5) / 1e5, lng: Math.round(sx / n * 1e5) / 1e5 } : {};
}

// Active district-heating accidents and repairs from toplo.bg (embedded JSON on the page)
async function heating() {
    const html = await get('https://www.toplo.bg/accidents-and-maintenance', { type: 'text', timeout: 15000 });
    const now = Date.now();
    const items = [];
    // Cheap pre-filter: only the "var info" blocks are needed, skip the rest of the page
    for (const m of html.matchAll(/var info = \{/g)) {
        const start = m.index + m[0].length - 1;
        // ContentItemId is the last field, so the object ends at the next "}" after it;
        // fall back to a full brace scan if the page layout ever changes
        const last = html.indexOf('"ContentItemId"', start);
        const end = last > 0 ? html.indexOf('}', last) : -1;
        let info;
        try {
            info = JSON.parse(end > 0 && end - start < 200000 ? html.slice(start, end + 1) : objectAt(html, start));
        } catch {
            try { info = JSON.parse(objectAt(html, start)); } catch { continue; }
        }
        const from = Date.parse(info.FromDate);
        const until = info.UntilDate ? Date.parse(info.UntilDate) : null;
        if (from > now || (until && until < now)) continue;
        items.push({ region: info.Region, name: info.Name, addresses: info.Addresses || '', from, until, ...centre(info.GeolocationSerialized) });
    }
    items.sort((a, b) => b.from - a.from);
    return { count: items.length, items };
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
