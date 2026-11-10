// Service worker: keeps a copy of the site on the phone so it works without internet.
//
// What is saved (offline.json lists the pages and documents; scripts/build_offline.py builds it):
//   sp-core     every page, plus the scripts, styles and images each page uses, the map data
//               and the libraries from cdnjs. Saved at install, refreshed at most every 6 hours.
//   sp-docs     the protection plans and printable PDFs (~19 MB), only when the visitor asks
//               for them (the "Без интернет" card on dokumenti.html). Once saved, a document is
//               downloaded again only when it changes. They can be removed from the same card.
//   sp-runtime  the newest copy of anything fetched while online (pages, live status, fonts,
//               district map images that were opened), so offline shows the last values seen.
//
// Map background tiles are not handled here: the browser keeps the ones viewed in its own cache
// (OpenStreetMap allows a week, and another week when offline), and fetching them through a
// service worker loses the Referer header on iPhones, which OpenStreetMap requires.
//
// While online everything still comes fresh from the network (so updates reach people at once);
// the saved copy is used when the network fails or takes longer than NETWORK_TIMEOUT_MS.

const CORE = 'sp-core';
const DOCS = 'sp-docs';
const RUNTIME = 'sp-runtime';
const STATE = '/__offline/state';          // { coreAt, docsWanted }, kept in the core cache
const SAVED_DOCS = '/__offline/docs';      // { url: fingerprint } of the documents saved
const CORE_REFRESH_MS = 6 * 3600e3;
const NETWORK_TIMEOUT_MS = 4000;
const CDN = 'https://cdnjs.cloudflare.com';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const WEATHER_HOST = 'api.open-meteo.com';

// A page's address without .html or a query: /karta.html?rayon=x and /karta are the same page
function pageKey(url) {
    const u = new URL(url, self.location.origin);
    let path = u.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
    if (!path) path = '/';
    return new URL(path, self.location.origin).href;
}

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

const readState = () => readJson(STATE, { coreAt: 0, docsWanted: false });
const writeState = state => writeJson(STATE, state);

async function list() {
    const res = await fetch('/offline.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`offline.json: ${res.status}`);
    await (await caches.open(CORE)).put('/offline.json', res.clone());  // the documents page reads it offline too
    return res.json();
}

// Local scripts, styles and images a page uses, read from its HTML (so nothing has to be listed by hand)
function assetsOf(html, pageUrl) {
    const urls = new Set();
    for (const [, ref] of html.matchAll(/\s(?:src|href)="([^"#]+)"/g)) {
        const u = new URL(ref, pageUrl);
        const local = u.origin === self.location.origin && /\.(js|css|svg|png|jpg|jpeg|webp|json|webmanifest)$/.test(u.pathname);
        if (local || u.origin === CDN) urls.add(u.href);
    }
    return urls;
}

async function inBatches(items, size, fn) {
    for (let i = 0; i < items.length; i += size) await Promise.allSettled(items.slice(i, i + size).map(fn));
}

// Save every page and everything it uses. cache: 'no-cache' revalidates with the server, so files
// that haven't changed cost almost nothing to check.
async function saveCore(force = false) {
    const state = await readState();
    if (!force && Date.now() - state.coreAt < CORE_REFRESH_MS) return;
    const { pages, data } = await list();
    const cache = await caches.open(CORE);
    const assets = new Set(data.map(d => new URL(d, self.location.origin).href));
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
    state.coreAt = Date.now();
    await writeState(state);
}

// Download the documents that are missing or have changed, and drop ones no longer listed.
// Runs only after the visitor asked for the documents (state.docsWanted).
let docsRunning = null;
let docsCancelled = false;
function saveDocs() {
    docsRunning ||= (async () => {
        docsCancelled = false;
        const { docs } = await list();
        const cache = await caches.open(DOCS);
        const saved = await readJson(SAVED_DOCS, {});
        const wanted = new Set(docs.map(d => new URL(d.url, self.location.origin).href));
        for (const req of await cache.keys()) {
            if (!wanted.has(req.url)) { await cache.delete(req); delete saved[req.url]; }
        }
        const todo = [];
        for (const d of docs) {
            const url = new URL(d.url, self.location.origin).href;
            if (saved[url] !== d.hash || !(await cache.match(url))) todo.push({ url, hash: d.hash });
        }
        await inBatches(todo, 2, async ({ url, hash }) => {
            if (docsCancelled) return;
            const res = await fetch(url, { cache: 'no-cache' });
            if (!res.ok || docsCancelled) return;
            await cache.put(url, await storable(res));
            saved[url] = hash;
            await writeJson(SAVED_DOCS, saved);
            broadcast({ type: 'docs-progress' });
        });
        broadcast({ type: 'docs-progress' });
    })().finally(() => { docsRunning = null; });
    return docsRunning;
}

async function removeDocs() {
    docsCancelled = true;
    await docsRunning?.catch(() => {});
    await caches.delete(DOCS);
    await writeJson(SAVED_DOCS, {});
    broadcast({ type: 'docs-progress' });
}

async function setDocsWanted(wanted) {
    const state = await readState();
    state.docsWanted = wanted;
    await writeState(state);
    return wanted ? saveDocs() : removeDocs();
}

async function broadcast(msg) {
    for (const client of await self.clients.matchAll()) client.postMessage(msg);
}

self.addEventListener('install', event => {
    event.waitUntil(saveCore(true).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keep = [CORE, DOCS, RUNTIME];
        for (const name of await caches.keys()) if (!keep.includes(name)) await caches.delete(name);
        // The first version downloaded the documents without asking: remove them unless the visitor
        // has since asked for them
        if (!(await readState()).docsWanted) await removeDocs();
        await self.clients.claim();
    })());
});

// From pwa.js: 'sync' on each visit (refresh the saved copy; the 6-hour limit keeps it cheap, and
// saved documents are updated only if the visitor asked for them); 'save-docs' and 'remove-docs'
// from the buttons on dokumenti.html
self.addEventListener('message', event => {
    const type = event.data?.type;
    if (type === 'sync') {
        event.waitUntil(Promise.allSettled([saveCore(), readState().then(s => s.docsWanted && saveDocs())]));
    } else if (type === 'save-docs') {
        event.waitUntil(setDocsWanted(true).catch(() => broadcast({ type: 'docs-progress' })));
    } else if (type === 'remove-docs') {
        event.waitUntil(setDocsWanted(false));
    }
});

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

    // Documents, whether opened as a page or downloaded: the saved copy if the visitor saved them
    // (kept up to date by saveDocs), otherwise straight from the network without keeping a copy
    if (local && url.pathname.endsWith('.pdf')) {
        event.respondWith((async () => {
            const saved = await (await caches.open(DOCS)).match(url.origin + url.pathname);
            if (saved) return saved;
            try {
                return await fetch(request);
            } catch {
                return request.mode === 'navigate' ? offlinePage() : Response.error();
            }
        })());
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
