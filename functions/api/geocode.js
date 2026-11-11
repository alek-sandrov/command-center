// Cloudflare Pages Function: GET /api/geocode?q=<address>
// Address search for the homepage and okolo.html, limited to Sofia municipality, from Photon
// (OpenStreetMap data, https://photon.komoot.io). Going through our own address keeps the site's
// security policy at 'self', caches each search for a day at the edge, and means visitors' browsers
// never contact a third party. Only the typed text is passed on, nothing about the visitor.

const PHOTON = 'https://photon.komoot.io/api/';
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

    const params = new URLSearchParams({
        q, limit: '8', lang: 'default', bbox: BBOX.join(','),
        lat: String(CENTRE.lat), lon: String(CENTRE.lon)
    });
    let data;
    try {
        const res = await fetch(`${PHOTON}?${params}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`${res.status} from photon`);
        data = await res.json();
    } catch (err) {
        return json({ ok: false, error: String(err.message || err) }, 502);
    }

    const [w, s, e, n] = BBOX;
    const seen = new Set();
    const results = [];
    for (const f of data.features || []) {
        const [lng, lat] = f.geometry?.coordinates || [];
        if (!(lat >= s && lat <= n && lng >= w && lng <= e)) continue;
        const { title, where } = describe(f.properties || {});
        const id = `${title}|${where}`;
        if (!title || seen.has(id)) continue;
        seen.add(id);
        results.push({ title, where, lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 });
    }
    const res = json({ ok: true, results: results.slice(0, 6) }, 200, CACHE_SECONDS);
    if (cache) context.waitUntil?.(cache.put(key, res.clone()));
    return res;
}
