// Address search box (form.place-search) on the homepage and okolo.html: suggestions as you type
// from /api/geocode (functions/api/geocode.js), or the crosshair button for the device's location.
// Both open okolo.html for that place. The device's location is only put in the address of the
// next page; it is never sent to any server.
(function () {
    const { t } = I18N;
    const DEBOUNCE_MS = 250;

    function target(params) {
        const url = new URL('okolo.html', location.href);
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') url.searchParams.set(k, v); });
        const lang = new URLSearchParams(location.search).get('lang');
        if (lang) url.searchParams.set('lang', lang);
        return url.pathname.split('/').pop() + url.search;
    }

    function attach(form) {
        const input = form.querySelector('input');
        const list = form.querySelector('.ps-results');
        const locate = form.querySelector('.ps-locate');
        const msg = form.parentElement.querySelector('.ps-msg');
        let results = [];
        let active = -1;
        let timer = null;
        let asked = '';
        let controller = null;

        const say = text => { if (msg) { msg.textContent = text || ''; msg.hidden = !text; } };

        function close() {
            list.hidden = true;
            input.setAttribute('aria-expanded', 'false');
            input.removeAttribute('aria-activedescendant');
            active = -1;
        }

        function render() {
            list.replaceChildren(...results.map((r, i) => {
                const li = document.createElement('li');
                li.id = `${list.id}-${i}`;
                li.setAttribute('role', 'option');
                li.className = i === active ? 'on' : '';
                const title = document.createElement('strong');
                title.textContent = r.title;
                const where = document.createElement('span');
                where.textContent = r.where;
                li.append(title, where);
                li.addEventListener('mousedown', e => { e.preventDefault(); go(r); });
                return li;
            }));
            list.hidden = !results.length;
            input.setAttribute('aria-expanded', String(!!results.length));
            if (active >= 0) input.setAttribute('aria-activedescendant', `${list.id}-${active}`);
            else input.removeAttribute('aria-activedescendant');
        }

        async function search(q) {
            if (controller) controller.abort();
            controller = new AbortController();
            asked = q;
            // A first lookup of an address can take a few seconds: say so instead of showing nothing
            const waiting = setTimeout(() => { if (q === asked) say(t('Търсене на адреса...')); }, 300);
            try {
                const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: controller.signal });
                const data = await res.json();
                if (q !== asked) return results;
                if (!data.ok) throw new Error(data.error || 'search failed');
                results = data.results;
                active = -1;
                say(results.length ? '' : t('Не намерихме „{q}“ в София. Опитайте с улица и номер или блок и квартал.', { q }));
                render();
            } catch (err) {
                if (err.name === 'AbortError' || q !== asked) return results;
                results = [];
                render();
                say(navigator.onLine === false
                    ? t('Търсенето на адрес изисква интернет. Без интернет използвайте бутона за местоположение.')
                    : t('Търсенето не отговаря в момента. Опитайте отново или използвайте местоположението си.'));
            } finally {
                clearTimeout(waiting);
            }
            return results;
        }

        function go(r) {
            close();
            input.value = r.title;
            location.href = target({ lat: r.lat, lng: r.lng, a: r.title, w: r.where });
        }

        input.addEventListener('input', () => {
            clearTimeout(timer);
            const q = input.value.trim();
            if (q.length < 3) { results = []; close(); say(''); return; }
            timer = setTimeout(() => search(q), DEBOUNCE_MS);
        });

        input.addEventListener('keydown', e => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (!results.length) return;
                e.preventDefault();
                active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
                render();
            } else if (e.key === 'Escape') {
                close();
            }
        });

        input.addEventListener('blur', () => setTimeout(close, 150));
        input.addEventListener('focus', () => { if (results.length) render(); });

        form.addEventListener('submit', async e => {
            e.preventDefault();
            const q = input.value.trim();
            if (q.length < 2) { input.focus(); return; }
            if (active >= 0 && results[active]) return go(results[active]);
            clearTimeout(timer);
            const found = q === asked && results.length ? results : await search(q);
            if (found.length) go(found[0]);
        });

        locate.addEventListener('click', () => {
            if (!navigator.geolocation) { say(t('Браузърът ви не поддържа определяне на местоположение.')); return; }
            locate.classList.add('busy');
            say(t('Търсене...'));
            navigator.geolocation.getCurrentPosition(pos => {
                locate.classList.remove('busy');
                say('');
                const r6 = v => Math.round(v * 1e5) / 1e5;
                location.href = target({ lat: r6(pos.coords.latitude), lng: r6(pos.coords.longitude), me: 1 });
            }, () => {
                locate.classList.remove('busy');
                say(t('Не успяхме да определим местоположението ви. Проверете дали сте разрешили достъп до локацията.'));
            }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
        });
    }

    document.querySelectorAll('form.place-search').forEach(attach);
})();
