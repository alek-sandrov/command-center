// Shared district selector shown in the navbar on every page.
// The choice is kept in localStorage and in the URL (?rayon=slatina) so links can be shared.
// Pages react to it with SofiaDistrict.onChange(callback).
(function () {
    // Same order as data/rayoni.json and the district index in data/karta.json
    const LIST = [
        ['Банкя', 'bankya'], ['Витоша', 'vitosha'], ['Връбница', 'vrabnitsa'], ['Възраждане', 'vazrazhdane'],
        ['Изгрев', 'izgrev'], ['Илинден', 'ilinden'], ['Искър', 'iskar'], ['Красна поляна', 'krasna-polyana'],
        ['Красно село', 'krasno-selo'], ['Кремиковци', 'kremikovtsi'], ['Лозенец', 'lozenets'], ['Люлин', 'lyulin'],
        ['Младост', 'mladost'], ['Надежда', 'nadezhda'], ['Нови Искър', 'novi-iskar'], ['Оборище', 'oborishte'],
        ['Овча купел', 'ovcha-kupel'], ['Панчарево', 'pancharevo'], ['Подуяне', 'poduyane'], ['Сердика', 'serdika'],
        ['Слатина', 'slatina'], ['Средец', 'sredets'], ['Студентски', 'studentski'], ['Триадица', 'triaditsa']
    ].map(([name, slug], index) => ({ name, slug, index }));

    const KEY = 'sp-rayon';
    const bySlug = Object.fromEntries(LIST.map(d => [d.slug, d]));
    const listeners = [];
    let current = null;
    let shapesPromise = null;

    function store(slug) {
        try {
            if (slug) localStorage.setItem(KEY, slug); else localStorage.removeItem(KEY);
        } catch { /* private mode: selection still works for this page */ }
    }

    function initial() {
        const fromUrl = new URLSearchParams(location.search).get('rayon');
        if (fromUrl !== null) {
            store(bySlug[fromUrl] ? fromUrl : '');
            return bySlug[fromUrl] || null;
        }
        try {
            return bySlug[localStorage.getItem(KEY)] || null;
        } catch {
            return null;
        }
    }

    function withDistrict(href) {
        const url = new URL(href, location.href);
        if (current) url.searchParams.set('rayon', current.slug); else url.searchParams.delete('rayon');
        return url;
    }

    // Keep the address bar and links to our own pages in step with the selection
    function syncUrl() {
        history.replaceState(null, '', withDistrict(location.href));
        document.querySelectorAll('a[href$=".html"], a[href*=".html?"]').forEach(a => {
            const url = withDistrict(a.getAttribute('href'));
            if (url.origin === location.origin) a.href = url.pathname.split('/').pop() + url.search + url.hash;
        });
    }

    function set(slug) {
        const next = bySlug[slug] || null;
        if (next === current) return;
        current = next;
        store(current?.slug || '');
        syncUrl();
        document.querySelectorAll('.district-select').forEach(s => { s.value = current?.slug || ''; });
        listeners.forEach(fn => fn(current));
    }

    function buildSelect() {
        const nav = document.querySelector('.nav-container');
        if (!nav) return;
        const select = document.createElement('select');
        select.className = 'district-select';
        select.setAttribute('aria-label', I18N.t('Изберете район'));
        select.add(new Option(I18N.t('📍 Цяла София'), ''));
        LIST.forEach(d => select.add(new Option(I18N.district(d.name), d.slug)));
        select.value = current?.slug || '';
        select.addEventListener('change', () => set(select.value));
        nav.querySelector('.nav-brand').after(select);
    }

    // Ray casting point-in-polygon on [lng, lat] rings; polygons are [outer, ...holes]
    function inRing(lng, lat, ring) {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i], [xj, yj] = ring[j];
            if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
    }

    function contains(shape, lat, lng) {
        const [s, w, n, e] = shape.bbox;
        if (lat < s || lat > n || lng < w || lng > e) return false;
        return shape.polygons.some(p => inRing(lng, lat, p[0]) && !p.slice(1).some(h => inRing(lng, lat, h)));
    }

    function init() {
        buildSelect();
        if (current || new URLSearchParams(location.search).has('rayon')) syncUrl();
    }

    current = initial();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.SofiaDistrict = {
        list: LIST,
        get: () => current,
        set,
        onChange: fn => listeners.push(fn),
        // District shapes (data/rayoni.json), loaded once on first use
        shapes: () => (shapesPromise ||= fetch('data/rayoni.json').then(r => r.json())),
        contains
    };
})();
