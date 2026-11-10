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

    // In the installed app a link with target="_blank" would leave the app (and its saved copy),
    // so documents open inside the app instead
    if (standalone) {
        document.addEventListener('click', e => {
            const a = e.target.closest?.('a[href]');
            if (a && a.target === '_blank' && new URL(a.href, location.href).origin === location.origin) a.removeAttribute('target');
        }, true);
    }

    // --- Saved documents (dokumenti.html) -----------------------------------------------------
    // Nothing large is downloaded without asking: the visitor saves the documents (~19 MB) with a
    // button here, sees the progress, and can remove them again. Once saved, new versions are
    // fetched on later visits (sw.js).
    const status = document.getElementById('offline-status');
    if (!status) return;
    const text = status.querySelector('.offline-status-text');
    const saveBtn = status.querySelector('.offline-save');
    const removeBtn = status.querySelector('.offline-remove');
    status.hidden = false;

    if (!('serviceWorker' in navigator) || !window.caches) {
        text.textContent = t('Този браузър не може да запази сайта за ползване без интернет.');
        saveBtn.hidden = removeBtn.hidden = true;
        return;
    }

    const mb = bytes => (bytes / 1e6).toLocaleString(I18N.lang === 'en' ? 'en-GB' : 'bg-BG', { maximumFractionDigits: 1 });
    const tell = async type => (await navigator.serviceWorker.ready).active?.postMessage({ type });
    let busy = false;  // a button was pressed and the worker hasn't reported back yet

    async function render() {
        try {
            const { docs } = await (await fetch('/offline.json', { cache: 'no-store' })).json();
            const stateHit = await (await caches.open('sp-core')).match('/__offline/state');
            const wanted = !!(stateHit && (await stateHit.json()).docsWanted);
            const saved = new Set((await (await caches.open('sp-docs')).keys()).map(r => new URL(r.url).pathname));
            const done = docs.filter(d => saved.has(d.url)).length;
            const total = mb(docs.reduce((n, d) => n + d.bytes, 0));
            saveBtn.textContent = t('Запази документите ({mb} MB)', { mb: total });
            removeBtn.textContent = wanted && done < docs.length ? t('Спри свалянето') : t('Изтрий запазените документи');
            saveBtn.hidden = wanted;
            removeBtn.hidden = !wanted;
            saveBtn.disabled = removeBtn.disabled = busy;
            if (!wanted) {
                text.textContent = t('Плановете за защита и листовките за печат ({n} документа, {mb} MB) могат да се запазят на това устройство, за да се отварят и без интернет.', { n: docs.length, mb: total });
            } else if (done < docs.length) {
                text.textContent = t('Сваляне: {done} от {n} документа ({mb} MB общо). Оставете страницата отворена.', { done, n: docs.length, mb: total });
            } else {
                text.textContent = t('Всички {n} документа ({mb} MB) са запазени на това устройство и се отварят и без интернет. Новите версии се свалят автоматично.', { n: docs.length, mb: total });
            }
            if (iOS && !standalone) {
                text.append(' ', t('На iPhone добавете сайта към началния екран, иначе Safari може да изтрие запазеното копие.'));
            }
        } catch {
            text.textContent = t('Не успяхме да проверим запазените документи.');
        }
    }
    saveBtn.addEventListener('click', () => { busy = true; render(); tell('save-docs'); });
    removeBtn.addEventListener('click', () => { busy = true; render(); tell('remove-docs'); });
    navigator.serviceWorker.addEventListener('message', e => {
        if (e.data?.type === 'docs-progress') { busy = false; render(); }
    });
    render();
})();
