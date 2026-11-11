// Service worker: keeps a copy of the site on the phone so it works without internet.
//
// Saved automatically (small, so the site opens offline at all):
//   sp-core     every page, plus the scripts, styles and images each page uses, the map points
//               and the last homepage status (offline.json "pages" and "data"). Saved at install,
//               refreshed at most every 6 hours.
//   sp-runtime  the newest copy of anything fetched while online, so offline shows the last
//               values seen (pages, live status, fonts, district map images that were opened).
//
// Saved only when the visitor asks (the "Без интернет" card, pwa.js), as packs from offline.json:
//   map   sp-map    the street map of Sofia (maps/tiles, ~770 small files, ~15 MB)
//   docs  sp-docs   the protection plans and the in-app PDF viewer
// Once saved, a pack's files are downloaded again only when they change (fingerprints in
// offline.json). The visitor can remove a pack again.
//
// While online everything still comes fresh from the network (so updates reach people at once);
// the saved copy is used when the network fails or takes longer than NETWORK_TIMEOUT_MS.

const CORE = 'sp-core';
const RUNTIME = 'sp-runtime';
const PACK_CACHES = { map: 'sp-map', docs: 'sp-docs' };
const STATE = '/__offline/state';          // { coreAt, packs: { map: bool, docs: bool } }, in sp-core
const SAVED = '/__offline/saved';          // { url: fingerprint } of the pack files saved, in sp-core
const CORE_REFRESH_MS = 6 * 3600e3;
const NETWORK_TIMEOUT_MS = 4000;
const CDN = 'https://cdnjs.cloudflare.com';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const WEATHER_HOST = 'api.open-meteo.com';
// Big files that belong to a pack and are never saved automatically
const PACK_ONLY = /^\/(vendor\/pdfjs\/|maps\/)/;

// A page's address without .html or a query: /karta.html?rayon=x and /karta are the same page
function pageKey(url) {
    const u = new URL(url, self.location.origin);
    let path = u.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
    if (!path) path = '/';
    return new URL(path, self.location.origin).href;
}

const abs = path => new URL(path, self.location.origin).href;

// Responses that came through a redirect can't answer a page load, so store a clean copy.
// Takes its own clone, so the response passed in can still be returned to the page.
async function storable(res) {
    const copy = res.clone();
    if (!copy.redirected) return copy;
    return new Response(await copy.blob(), { status: copy.status, statusText: copy.statusText, headers: copy.headers });
}

// Worth saving: a successful response, or an opaque one (a cross-site file such as a font
// stylesheet, whose status the browser hides)
const keepable = res => res.ok || res.type === 'opaque';

async function readJson(key, fallback) {
    const hit = await (await caches.open(CORE)).match(key);
    return hit ? hit.json() : fallback;
}

async function writeJson(key, value) {
    await (await caches.open(CORE)).put(key, new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }));
}

async function readState() {
    const state = await readJson(STATE, {});
    return { coreAt: state.coreAt || 0, packs: state.packs || {} };
}

const writeState = state => writeJson(STATE, state);

async function list() {
    const res = await fetch('/offline.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`offline.json: ${res.status}`);
    await (await caches.open(CORE)).put('/offline.json', res.clone());  // the offline card reads it offline too
    return res.json();
}

// Local scripts, styles and images a page uses, read from its HTML (so nothing has to be listed by hand)
function assetsOf(html, pageUrl) {
    const urls = new Set();
    for (const [, ref] of html.matchAll(/\s(?:src|href)="([^"#]+)"/g)) {
        const u = new URL(ref, pageUrl);
        const local = u.origin === self.location.origin && /\.(js|css|svg|png|jpg|jpeg|webp|json|webmanifest)$/.test(u.pathname);
        if ((local && !PACK_ONLY.test(u.pathname.slice(1))) || u.origin === CDN) urls.add(u.href);
    }
    return urls;
}

async function inBatches(items, size, fn) {
    for (let i = 0; i < items.length; i += size) await Promise.allSettled(items.slice(i, i + size).map(fn));
}

async function broadcast(msg) {
    for (const client of await self.clients.matchAll()) client.postMessage(msg);
}

// Save every page and everything it uses. cache: 'no-cache' revalidates with the server, so files
// that haven't changed cost almost nothing to check.
async function saveCore(force = false) {
    const state = await readState();
    if (!force && Date.now() - state.coreAt < CORE_REFRESH_MS) return;
    const { pages, data } = await list();
    const cache = await caches.open(CORE);
    const assets = new Set(data.map(abs));
    await inBatches(pages, 3, async page => {
        const res = await fetch(page, { cache: 'no-cache' });
        if (!res.ok) return;
        const copy = await storable(res);
        assetsOf(await res.text(), res.url).forEach(a => assets.add(a));
        await cache.put(pageKey(page), copy);
    });
    await inBatches([...assets], 4, async url => {
        const res = await fetch(url, { cache: 'no-cache', mode: url.startsWith(CDN) ? 'cors' : 'same-origin' });
        if (res.ok) await cache.put(url, res);
    });
    const fresh = await readState();  // a pack may have been chosen meanwhile
    fresh.coreAt = Date.now();
    await writeState(fresh);
}

// --- Packs the visitor asked for -----------------------------------------------------------------
const running = {};
const cancelled = {};

// Download a pack's files that are missing or have changed, and drop ones no longer listed
function savePack(name) {
    running[name] ||= (async () => {
        cancelled[name] = false;
        const files = (await list()).packs[name] || [];
        const cache = await caches.open(PACK_CACHES[name]);
        const wanted = new Set(files.map(f => abs(f.url)));
        let saved = await readJson(SAVED, {});
        for (const req of await cache.keys()) {
            if (!wanted.has(req.url)) { await cache.delete(req); delete saved[req.url]; }
        }
        const todo = [];
        for (const f of files) {
            const url = abs(f.url);
            if (saved[url] !== f.hash || !(await cache.match(url))) todo.push({ url, hash: f.hash });
        }
        await inBatches(todo, name === 'map' ? 8 : 2, async ({ url, hash }) => {  // map tiles are small
            if (cancelled[name]) return;
            const res = await fetch(url, { cache: 'no-cache' });
            if (!res.ok || cancelled[name]) return;
            await cache.put(url, await storable(res));
            saved = await readJson(SAVED, {});
            saved[url] = hash;
            await writeJson(SAVED, saved);
            broadcast({ type: 'pack-progress', pack: name });
        });
        broadcast({ type: 'pack-progress', pack: name });
    })().finally(() => { running[name] = null; });
    return running[name];
}

async function removePack(name) {
    cancelled[name] = true;
    await running[name]?.catch(() => {});
    const cache = await caches.open(PACK_CACHES[name]);
    const saved = await readJson(SAVED, {});
    for (const req of await cache.keys()) delete saved[req.url];
    await writeJson(SAVED, saved);
    await caches.delete(PACK_CACHES[name]);
    broadcast({ type: 'pack-progress', pack: name });
}

async function setPack(name, wanted) {
    if (!PACK_CACHES[name]) return;
    const state = await readState();
    state.packs[name] = wanted;
    await writeState(state);
    return wanted ? savePack(name) : removePack(name);
}

self.addEventListener('install', event => {
    event.waitUntil(saveCore(true).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keep = [CORE, RUNTIME, ...Object.values(PACK_CACHES)];
        for (const name of await caches.keys()) if (!keep.includes(name)) await caches.delete(name);
        // A pack the visitor hasn't asked for is removed (the first version saved the documents
        // without asking)
        const { packs } = await readState();
        for (const name of Object.keys(PACK_CACHES)) if (!packs[name]) await removePack(name);
        await self.clients.claim();
    })());
});

// From pwa.js: 'sync' on each visit (refresh the saved copy; the 6-hour limit keeps it cheap, and
// saved packs get new versions); 'save-pack' / 'remove-pack' from the buttons on the offline card
self.addEventListener('message', event => {
    const { type, pack } = event.data || {};
    if (type === 'sync') {
        event.waitUntil(Promise.allSettled([
            saveCore(),
            readState().then(s => Promise.allSettled(Object.keys(PACK_CACHES).filter(n => s.packs[n]).map(savePack)))
        ]));
    } else if (type === 'save-pack') {
        event.waitUntil(setPack(pack, true).catch(() => broadcast({ type: 'pack-progress', pack })));
    } else if (type === 'remove-pack') {
        event.waitUntil(setPack(pack, false));
    }
});

// --- Answering requests ------------------------------------------------------------------------

// Network first: fresh while online, the saved copy if the network fails or is too slow
async function networkFirst(request, { key = request, cacheName = RUNTIME, fallbacks = [] } = {}) {
    const cached = async () => {
        for (const name of [cacheName, ...fallbacks]) {
            const hit = await (await caches.open(name)).match(key);
            if (hit) return hit;
        }
        return null;
    };
    const network = fetch(request).then(async res => {
        if (res.ok) await (await caches.open(cacheName)).put(key, await storable(res));
        return res;
    });
    network.catch(() => {});  // a failure is handled below; don't report it twice
    const slow = new Promise(resolve => setTimeout(resolve, NETWORK_TIMEOUT_MS, 'slow'));
    try {
        const first = await Promise.race([network, slow]);
        if (first !== 'slow') return first;
        return (await cached()) || (await network);
    } catch {
        const hit = await cached();
        if (hit) return hit;
        throw new Error('offline and not saved');
    }
}

async function cacheFirst(request, cacheName, { fallbacks = [] } = {}) {
    for (const name of [cacheName, ...fallbacks]) {
        const hit = await (await caches.open(name)).match(request);
        if (hit) return hit;
    }
    const res = await fetch(request);
    if (keepable(res)) await (await caches.open(cacheName)).put(request, await storable(res));
    return res;
}

// A file of a pack: the saved copy if the visitor saved the pack, otherwise straight from the
// network without keeping a copy
async function fromPack(name, request, url) {
    const saved = await (await caches.open(PACK_CACHES[name])).match(url.origin + url.pathname);
    if (saved) return saved;
    return fetch(request);
}

function offlinePage() {
    const html = `<!DOCTYPE html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Няма интернет – sofia-prepping.com</title></head>
<body style="margin:0;background:#0A0C0F;color:#E6E9ED;font-family:system-ui,sans-serif;padding:32px 20px;line-height:1.5">
<h1 style="font-size:22px">Няма връзка с интернет</h1>
<p>Тази страница не е запазена на устройството. Запазените страници работят и без интернет:</p>
<p><a style="color:#F2A93B" href="/">Начало</a> · <a style="color:#F2A93B" href="/karta">Интерактивна карта</a> · <a style="color:#F2A93B" href="/dokumenti">Документи</a></p>
<p style="color:#8B95A1">При спешен случай: 112</p></body></html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    const local = url.origin === self.location.origin;

    if (local && url.pathname.startsWith('/maps/tiles/')) {
        event.respondWith(fromPack('map', request, url).catch(() => Response.error()));
        return;
    }
    if (local && (url.pathname.endsWith('.pdf') || url.pathname.startsWith('/vendor/pdfjs/'))) {
        event.respondWith(fromPack('docs', request, url)
            .catch(() => (request.mode === 'navigate' ? offlinePage() : Response.error())));
        return;
    }
    if (local && request.mode === 'navigate') {
        event.respondWith(networkFirst(request, { key: pageKey(url), fallbacks: [CORE] }).catch(offlinePage));
        return;
    }
    if (local) {
        if (url.pathname === '/sw.js') return;  // also the "is there internet?" check in pwa.js
        if (url.pathname === '/api/status') {
            event.respondWith(networkFirst(request, { fallbacks: [CORE] }));
        } else if (url.pathname.startsWith('/img/punktove/') && !url.pathname.includes('/thumb/')) {
            event.respondWith(cacheFirst(request, RUNTIME, { fallbacks: [CORE] }));  // large district maps: kept once opened
        } else {
            event.respondWith(networkFirst(request, { fallbacks: [CORE] }));
        }
        return;
    }
    if (url.origin === CDN) {
        event.respondWith(cacheFirst(request, CORE));  // exact versions with integrity hashes: never change
    } else if (FONT_HOSTS.includes(url.hostname)) {
        event.respondWith(cacheFirst(request, RUNTIME));
    } else if (url.hostname === WEATHER_HOST) {
        event.respondWith(networkFirst(request));
    }
});
