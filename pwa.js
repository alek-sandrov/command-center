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
    const status = document.getElementById('offline-status');
    if (!status) return;
    const text = status.querySelector('.offline-status-text');
    const button = status.querySelector('button');
    status.hidden = false;

    if (!('serviceWorker' in navigator) || !window.caches) {
        text.textContent = t('Този браузър не може да запази сайта за ползване без интернет.');
        button.hidden = true;
        return;
    }

    const mb = bytes => (bytes / 1e6).toLocaleString(I18N.lang === 'en' ? 'en-GB' : 'bg-BG', { maximumFractionDigits: 1 });
    async function render() {
        try {
            const { docs } = await (await fetch('/offline.json', { cache: 'no-store' })).json();
            const cache = await caches.open('sp-docs');
            const saved = new Set((await cache.keys()).map(r => new URL(r.url).pathname));
            const done = docs.filter(d => saved.has(d.url));
            const total = docs.reduce((n, d) => n + d.bytes, 0);
            text.textContent = done.length === docs.length
                ? t('Всички {n} документа ({mb} MB) са запазени на това устройство и се отварят и без интернет.', { n: docs.length, mb: mb(total) })
                : t('Запазени за ползване без интернет: {done} от {n} документа ({mb} MB общо). Свалянето продължава, докато сайтът е отворен.', { done: done.length, n: docs.length, mb: mb(total) });
            if (iOS && !standalone) {
                text.append(' ', t('На iPhone добавете сайта към началния екран, иначе Safari може да изтрие запазеното копие.'));
            }
        } catch {
            text.textContent = t('Не успяхме да проверим запазените документи.');
        }
    }
    button.addEventListener('click', async () => {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({ type: 'sync' });
        text.textContent = t('Проверяваме за нови версии…');
        setTimeout(render, 3000);
    });
    navigator.serviceWorker.addEventListener('message', e => { if (e.data?.type === 'docs-progress') render(); });
    render();
})();
