// Offline use (the site as an installable app). Loaded on every page after chrome.js.
//  - registers the service worker (sw.js), which keeps a copy of the site and the documents
//  - a bar under the navbar when there is no internet
//  - a tip to install the site (Android: an Install button; iPhone: "Share → Add to Home Screen"),
//    which can be closed for 30 days
//  - on dokumenti.html, how many documents are saved for offline use
(function () {
    const { t } = I18N;
    const DISMISS_KEY = 'sp-install-dismissed';
    const DISMISS_MS = 30 * 86400e3;
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const nav = document.querySelector('nav');

    function bar(className) {
        const el = document.createElement('div');
        el.className = `site-bar ${className}`;
        el.setAttribute('role', 'status');
        (nav || document.body.firstChild)?.after(el);
        return el;
    }

    // --- Service worker -------------------------------------------------------------------
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(reg => {
            reg.active?.postMessage({ type: 'sync' });  // refresh the saved copy (the worker limits how often)
        }).catch(() => { /* e.g. private mode on some browsers: the site still works online */ });
    }

    // --- No internet -----------------------------------------------------------------------
    // The browser's own online flag misses Wi-Fi without internet, so ask the server: sw.js is
    // never answered from the saved copy, so this reaches the network or fails
    const offline = bar('offline-bar');
    offline.textContent = t('Няма интернет · показваме запазеното копие на сайта. При спешен случай: 112');
    offline.hidden = true;
    async function checkOnline() {
        let online = navigator.onLine;
        if (online) {
            try {
                online = (await fetch('/sw.js', { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(6000) })).ok;
            } catch {
                online = false;
            }
        }
        offline.hidden = online;
    }
    checkOnline();
    setInterval(checkOnline, 60000);
    addEventListener('online', checkOnline);
    addEventListener('offline', checkOnline);

    // --- Install tip ------------------------------------------------------------------------
    function dismissed() {
        try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < DISMISS_MS; } catch { return false; }
    }

    function installTip(text, action) {
        const tip = bar('install-bar');
        tip.append(Object.assign(document.createElement('span'), { textContent: text }));
        if (action) tip.append(action);
        const close = Object.assign(document.createElement('button'), { type: 'button', className: 'site-bar-close', textContent: '×' });
        close.setAttribute('aria-label', t('Затвори'));
        close.addEventListener('click', () => {
            tip.remove();
            try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
        });
        tip.append(close);
        return tip;
    }

    if (!standalone && !dismissed()) {
        if (iOS) {
            installTip(t('За да работи без интернет: натиснете „Сподели“ и „Добави към началния екран“.'));
        } else {
            // Chrome, Edge, Samsung Internet: the browser offers its own install dialog
            addEventListener('beforeinstallprompt', event => {
                event.preventDefault();
                const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'site-bar-action', textContent: t('Инсталирай') });
                const tip = installTip(t('Инсталирайте сайта като приложение, за да работи и без интернет.'), btn);
                btn.addEventListener('click', async () => {
                    event.prompt();
                    await event.userChoice.catch(() => null);
                    tip.remove();
                });
            });
        }
    }

    // In the installed app there are no browser buttons: a PDF opened directly would have no way
    // back, so PDFs open in the site's own viewer (dokument.html), and other links to our own pages
    // stay inside the app instead of opening a browser tab
    if (standalone) {
        document.addEventListener('click', e => {
            const a = e.target.closest?.('a[href]');
            if (!a) return;
            const url = new URL(a.href, location.href);
            if (url.origin !== location.origin) return;
            if (url.pathname.endsWith('.pdf')) {
                e.preventDefault();
                const label = a.querySelector('.map-label')?.textContent
                    || a.closest('.sheet-card')?.querySelector('.sheet-card-name')?.firstChild?.textContent
                    || '';
                location.href = `/dokument?f=${encodeURIComponent(url.pathname)}&t=${encodeURIComponent(label.trim())}`;
            } else if (a.target === '_blank') {
                a.removeAttribute('target');
            }
        }, true);
    }

    // --- Packs saved on request ("Без интернет" card) ---------------------------------------------
    // Nothing large is downloaded without asking. A card (.offline-packs, data-packs="map docs")
    // offers each pack with its size, shows progress, and can remove it again. Once saved, new
    // versions are fetched on later visits (sw.js).
    const PACKS = {
        map: {
            name: 'Карта на улиците',
            about: 'Улиците, сградите и имената на картите на сайта, за да се виждат и без интернет.'
        },
        docs: {
            name: 'Документи',
            about: 'Плановете за защита и листовките за печат по райони, за да се отварят и без интернет.'
        }
    };
    const supported = 'serviceWorker' in navigator && !!window.caches;
    const mb = bytes => (bytes / 1e6).toLocaleString(I18N.lang === 'en' ? 'en-GB' : 'bg-BG', { maximumFractionDigits: 1 });
    const tell = async (type, pack) => (await navigator.serviceWorker.ready).active?.postMessage({ type, pack });

    async function packStatus() {
        const list = await (await fetch('/offline.json', { cache: 'no-store' })).json();
        const stateHit = await (await caches.open('sp-core')).match('/__offline/state');
        const chosen = (stateHit && (await stateHit.json()).packs) || {};
        const out = {};
        for (const [name, files] of Object.entries(list.packs || {})) {
            const saved = new Set((await (await caches.open(`sp-${name}`)).keys()).map(r => new URL(r.url).pathname));
            out[name] = {
                wanted: !!chosen[name],
                done: files.filter(f => saved.has(f.url)).length,
                total: files.length,
                pdfs: files.filter(f => f.url.endsWith('.pdf')).length,
                bytes: files.reduce((n, f) => n + f.bytes, 0)
            };
        }
        return out;
    }

    // Offline on a map page without the street map saved: say why the map is empty
    if (document.querySelector('#map, #home-map, #sheet-map') && supported) {
        const note = () => packStatus().then(st => {
            if (st.map && !st.map.wanted && !offline.hidden) {
                offline.textContent = t('Няма интернет · картата на улиците не е запазена на това устройство, затова части от нея може да липсват. При спешен случай: 112');
            }
        }).catch(() => {});
        new MutationObserver(note).observe(offline, { attributes: true, attributeFilter: ['hidden'] });
        note();  // the bar may already be showing
    }

    document.querySelectorAll('.offline-packs').forEach(card => {
        card.hidden = false;
        const box = card.querySelector('.offline-pack-list');
        if (!supported) {
            box.textContent = t('Този браузър не може да запази сайта за ползване без интернет.');
            return;
        }
        const busy = {};
        const rows = {};
        for (const name of (card.dataset.packs || 'map docs').split(' ')) {
            const row = document.createElement('div');
            row.className = 'offline-pack';
            const title = Object.assign(document.createElement('div'), { className: 'offline-pack-name' });
            const text = Object.assign(document.createElement('p'), { className: 'offline-pack-text' });
            const save = Object.assign(document.createElement('button'), { type: 'button', className: 'modal-nav-btn' });
            const remove = Object.assign(document.createElement('button'), { type: 'button', className: 'link-button' });
            save.addEventListener('click', () => { busy[name] = true; render(); tell('save-pack', name); });
            remove.addEventListener('click', () => { busy[name] = true; render(); tell('remove-pack', name); });
            row.append(title, text, save, remove);
            box.append(row);
            rows[name] = { title, text, save, remove };
        }
        if (iOS && !standalone) {
            box.append(Object.assign(document.createElement('p'), {
                className: 'offline-pack-text',
                textContent: t('На iPhone добавете сайта към началния екран, иначе Safari може да изтрие запазеното копие.')
            }));
        }

        async function render() {
            let st;
            try {
                st = await packStatus();
            } catch {
                Object.values(rows).forEach(r => { r.text.textContent = t('Не успяхме да проверим какво е запазено.'); });
                return;
            }
            for (const [name, r] of Object.entries(rows)) {
                const p = st[name];
                if (!p) continue;
                const info = PACKS[name];
                const size = mb(p.bytes);
                const count = name === 'docs' ? t('{n} документа, {mb} MB', { n: p.pdfs, mb: size }) : `${size} MB`;
                r.title.textContent = `${t(info.name)} · ${count}`;
                r.save.textContent = t('Запази ({mb} MB)', { mb: size });
                r.remove.textContent = p.wanted && p.done < p.total ? t('Спри свалянето') : t('Изтрий');
                r.save.hidden = p.wanted;
                r.remove.hidden = !p.wanted;
                r.save.disabled = r.remove.disabled = !!busy[name];
                r.text.textContent = !p.wanted ? t(info.about)
                    : p.done < p.total ? t('Сваляне: {done} от {total} файла. Оставете страницата отворена.', { done: p.done, total: p.total })
                    : t('Запазено на това устройство · работи без интернет. Новите версии се свалят автоматично.');
            }
        }
        navigator.serviceWorker.addEventListener('message', e => {
            if (e.data?.type === 'pack-progress') { busy[e.data.pack] = false; render(); }
        });
        render();
    });
})();
