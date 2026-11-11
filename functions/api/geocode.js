// Cloudflare Pages Function: GET /api/geocode?q=<address>
// Address search for the homepage and okolo.html, limited to Sofia municipality, from Photon
// (OpenStreetMap data, https://photon.komoot.io). Photon fails now and then, so if it does not
// answer the same search goes to OpenStreetMap's Nominatim (https://nominatim.org), which is
// slower but has the same data. Going through our own address keeps the site's
// security policy at 'self', caches each search for a day at the edge, and means visitors' browsers
// never contact a third party. Only the typed text is passed on, nothing about the visitor.

const PHOTON = 'https://photon.komoot.io/api/';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const BBOX = [23.10, 42.55, 23.60, 42.85];  // west, south, east, north (as scripts/build_karta.py)
const CENTRE = { lat: 42.6977, lon: 23.3219 };
const CACHE_SECONDS = 86400;
const UA = 'sofia-prepping.com address search (https://sofia-prepping.com)';

function json(body, status = 200, maxAge = 0) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': maxAge ? `public, max-age=${maxAge}` : 'no-store'
        }
    });
}

// "ул. Граф Игнатиев 10" / "бл. 15, ж.к. Младост 1": the place itself first, then where it is
function describe(p) {
    const street = [p.street, p.housenumber].filter(Boolean).join(' ');
    const title = p.name || street || p.district || p.city || '';
    const where = [p.name && street, p.district !== title ? p.district : '', p.locality, p.city !== 'София' ? p.city : '', p.county]
        .filter(Boolean)
        .filter((x, i, a) => a.indexOf(x) === i && x !== title);
    return { title, where: where.join(', ') };
}

export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const q = (url.searchParams.get('q') || '').replace(/\s+/g, ' ').trim();
    if (q.length < 2 || q.length > 120) return json({ ok: false, error: 'query must be 2-120 characters' }, 400);

    const cache = globalThis.caches?.default;
    const key = new Request(`${url.origin}/api/geocode?q=${encodeURIComponent(q.toLowerCase())}`);
    if (cache) {
        const hit = await cache.match(key);
        if (hit) return hit;
    }

    let found;
    try {
        found = await lookup(q);
        // Addresses copied from elsewhere often carry more than the geocoder can match. Try simpler
        // forms of the same address until one finds something.
        for (const simpler of variants(q)) {
            if (found.some(inSofia)) break;
            found = await lookup(simpler);
        }
    } catch (err) {
        return json({ ok: false, error: String(err.message || err) }, 502);
    }

    const [w, s, e, n] = BBOX;
    const seen = new Set();
    const results = [];
    for (const { lat, lng, title, where } of found) {
        if (!(lat >= s && lat <= n && lng >= w && lng <= e)) continue;
        const id = `${title}|${where}`;
        if (!title || seen.has(id)) continue;
        seen.add(id);
        results.push({ title, where, lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 });
    }
    const res = json({ ok: true, results: results.slice(0, 6) }, 200, CACHE_SECONDS);
    if (cache) context.waitUntil?.(cache.put(key, res.clone()));
    return res;
}

const inSofia = ({ lat, lng }) => lat >= BBOX[1] && lat <= BBOX[3] && lng >= BBOX[0] && lng <= BBOX[2];

// Photon first; Nominatim if Photon does not answer
async function lookup(q) {
    try {
        return await photon(q);
    } catch (first) {
        try {
            return await nominatim(q);
        } catch (second) {
            throw new Error(`${first.message || first}; ${second.message || second}`);
        }
    }
}

// "ж.к. Младост 1Младост, ул. „Никола Генадиев“ 50" -> "Никола Генадиев 50, Младост 1 Младост",
// "Никола Генадиев 50": without quotes and words such as "ул." (the geocoder matches the bare
// name better), then the part with the house number on its own. At most two extra lookups.
const KINDS = /(^|[\s,])(ул\.?|улица|бул\.?|булевард|ж\.?к\.?|жк|кв\.?|пл\.?|площад|гр\.|с\.|str\.?|ul\.?|bul\.?|blvd\.?|zh\.?k\.?)(?=\s|$)/giu;
function variants(q) {
    const clean = q
        .replace(/[„“”"«»']/g, ' ')
        .replace(/(\d)(\p{L}{3,})/gu, '$1 $2')       // "1Младост" (two pieces glued by copying)
        .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')       // "МладостМладост"
        .replace(KINDS, '$1')
        .replace(/(?<![\p{L}\d])(София|Sofia|България|Bulgaria|\d{4})(?![\p{L}\d])/giu, '')
        .replace(/\s+/g, ' ').replace(/\s*,[\s,]*/g, ', ').replace(/^[\s,]+|[\s,]+$/g, '');
    const parts = clean.split(', ').filter(Boolean);
    // the street and house number: a name, then a number at the end ("Никола Генадиев 50", not "бл. 15")
    const numbered = parts.find(x => /\p{L}{3,}\s+\d+\s*\p{L}?$/u.test(x) && !/(бл|bl)\.?\s*\d+\s*\p{L}?$/iu.test(x));
    const out = [];
    if (numbered && parts.length > 1) out.push([numbered, ...parts.filter(x => x !== numbered)].join(', '));
    else if (clean !== q) out.push(clean);
    if (numbered && numbered !== out[0]) out.push(numbered);
    return out.filter((x, i, a) => x.length >= 2 && x !== q && a.indexOf(x) === i).slice(0, 2);
}

async function getJson(url, ms) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'bg' }, signal: AbortSignal.timeout(ms) });
    if (!res.ok) throw new Error(`${res.status} from ${new URL(url).hostname}`);
    return res.json();
}

async function photon(q) {
    const params = new URLSearchParams({
        q, limit: '8', lang: 'default', bbox: BBOX.join(','),
        lat: String(CENTRE.lat), lon: String(CENTRE.lon)
    });
    const data = await getJson(`${PHOTON}?${params}`, 5000);
    return (data.features || []).map(f => {
        const [lng, lat] = f.geometry?.coordinates || [];
        return { lat, lng, ...describe(f.properties || {}) };
    });
}

// Nominatim's address parts, named as Photon names them, so describe() works for both
async function nominatim(q) {
    const [w, s, e, n] = BBOX;
    const params = new URLSearchParams({
        q, format: 'jsonv2', addressdetails: '1', limit: '8', bounded: '1',
        viewbox: [w, n, e, s].join(','), 'accept-language': 'bg'
    });
    const data = await getJson(`${NOMINATIM}?${params}`, 8000);
    return (Array.isArray(data) ? data : []).map(r => {
        const a = r.address || {};
        return {
            lat: parseFloat(r.lat), lng: parseFloat(r.lon),
            ...describe({
                name: r.name, street: a.road || a.pedestrian, housenumber: a.house_number,
                district: a.suburb || a.neighbourhood || a.quarter, locality: a.village || a.town,
                city: a.city, county: a.county
            })
        };
    });
}

export { variants };
