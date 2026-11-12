// Place page (okolo.html?lat=&lng=&a=<label>&w=<where>, &me=1 for the device's location, &p=1 for a
// point placed on the map, or ?pick=1 to start by placing one): the nearest place of each kind with
// distance and directions, a map with the way to each, the district's readiness and, through
// status.js, the live status of that district. The "Here" pin can be dragged (or the map tapped
// while picking) to set the exact spot when the address search only found the street.
// Everything is worked out in the browser; the coordinates are never sent anywhere.
(function () {
    const { t } = I18N;
    const LOCALE = I18N.lang === 'en' ? 'en-GB' : 'bg-BG';
    const NF1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
    const WALK_KMH = 4.8;
    const DETOUR = 1.25;  // a walking route is usually about a quarter longer than the straight line

    // What to look for. pillar = the readiness measure it belongs to (data/analizi.json)
    const KINDS = [
        { key: 'shelters', layers: ['shelters'], label: 'Укритие', pillar: 'shelter' },
        { key: 'evac', layers: ['evac'], label: 'Сграда за временно настаняване', pillar: 'evac' },
        { key: 'hospitals', layers: ['hospitals'], label: 'Болница или здравен център', pillar: 'medical' },
        { key: 'water', layers: ['fountains', 'springs'], label: 'Питейна вода', pillar: 'water', keep: p => !p[3].includes('Не работи') },
        { key: 'iodine', layers: ['iodine'], label: 'Пункт за йодни таблетки', pillar: 'iodine' },
        { key: 'pharmacies', layers: ['pharmacies'], label: 'Аптека', pillar: 'pharmacy' },
        { key: 'tents', layers: ['tents'], label: 'Място за палатков лагер', pillar: 'tents' },
        { key: 'metro', layers: ['metro'], label: 'Метро' }
    ];

    const $ = id => document.getElementById(id);
    const el = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    };

    function distanceKm(lat1, lng1, lat2, lng2) {
        const r = Math.PI / 180;
        const a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lng2 - lng1) * r / 2) ** 2;
        return 12742 * Math.asin(Math.sqrt(a));
    }
    const dist = km => (km < 1 ? t('{n} м', { n: Math.max(10, Math.round(km * 100) * 10) }) : t('{n} км', { n: NF1.format(km) }));
    const walk = km => t('~{n} мин пеша', { n: Math.max(1, Math.round(km * DETOUR / WALK_KMH * 60)) });

    const params = new URLSearchParams(location.search);
    const SOFIA = [42.6977, 23.3219];
    const valid = (la, ln) => la > 41 && la < 44.5 && ln > 22 && ln < 29;
    let lat = parseFloat(params.get('lat'));
    let lng = parseFloat(params.get('lng'));
    let placed = valid(lat, lng);
    let pinned = params.get('p') === '1';  // moved by hand on the map
    let karta, analizi, map, pin, drawn;

    async function init() {
        const picking = !placed;
        if (picking) {
            $('ok-grid').classList.add('picking');
            $('ok-empty').hidden = false;
            $('ok-kicker').textContent = t('Посочете място');
            $('ok-title').textContent = t('Къде сте?');
            document.title = `${t('Около вас')} - Sofia Prepping`;
        }
        try {
            [karta, analizi] = await Promise.all([
                fetch('data/karta.json').then(r => r.json()),
                fetch('data/analizi.json').then(r => r.json())
            ]);
        } catch {
            $('ok-list').replaceChildren(el('li', 'error', t('Неуспешно зареждане на данните.')));
            return;
        }
        map = L.map('ok-map', { renderer: MapStyle.renderer(), zoomSnap: 0.25, wheelPxPerZoomLevel: 90 });
        MapStyle.basemap(map);
        MapStyle.autoScale(map);
        drawn = L.layerGroup().addTo(map);
        if (picking) {
            map.setView(SOFIA, 12);
            startPicking();
        } else {
            await render(true);
        }
    }

    // Picking: a tap puts the pin there (another tap or a drag moves it), and the place is only
    // looked up when the visitor confirms, so they can see exactly which point they chose
    function startPicking() {
        let draft = null;
        const bar = $('ok-confirm');
        const put = ll => {
            if (!draft) {
                draft = L.marker(ll, {
                    draggable: true, autoPan: true, zIndexOffset: 1000,
                    icon: L.divIcon({ className: 'ok-pin', html: '<span></span>', iconSize: [26, 26], iconAnchor: [13, 13] })
                }).bindTooltip(t('Тук'), { permanent: true, direction: 'top', offset: [0, -14], className: 'ri-leaflet-tip' }).addTo(map);
            } else {
                draft.setLatLng(ll);
            }
            if (map.getZoom() < 15) map.setView(ll, 15);
            const first = bar.hidden;
            bar.hidden = false;
            // Phones: bring the map up so the pin is not under the bar at the bottom of the screen
            if (first && window.innerWidth <= 760) {
                const box = map.getContainer().getBoundingClientRect();
                const nav = document.querySelector('.navbar')?.getBoundingClientRect().bottom || 0;
                window.scrollBy({ top: box.top - nav - 8, behavior: 'smooth' });
            }
        };
        const onClick = e => put(e.latlng);
        map.on('click', onClick);
        $('ok-confirm-go').addEventListener('click', () => {
            if (!draft) return;
            const ll = draft.getLatLng();
            map.off('click', onClick);
            map.removeLayer(draft);
            bar.hidden = true;
            moveTo(ll.lat, ll.lng, true);
        });
    }

    // The visitor put the pin somewhere: work everything out again for that point
    async function moveTo(la, ln, first) {
        lat = Math.round(la * 1e5) / 1e5;
        lng = Math.round(ln * 1e5) / 1e5;
        placed = true;
        pinned = true;
        const url = new URL(location.href);
        ['pick', 'a', 'w', 'me'].forEach(k => url.searchParams.delete(k));
        url.searchParams.set('lat', lat);
        url.searchParams.set('lng', lng);
        url.searchParams.set('p', '1');
        history.replaceState(null, '', url);
        $('ok-grid').classList.remove('picking');
        $('ok-empty').hidden = true;
        await render(first);
    }

    async function render(fit) {
        const here = [lat, lng];
        const me = params.get('me') === '1' && !pinned;
        const label = pinned ? t('Посочено място') : me ? t('Вашето местоположение') : (params.get('a') || t('Избрано място'));
        $('ok-kicker').textContent = pinned ? t('Справка за място на картата') : me ? t('Справка за вашето местоположение') : t('Справка за адрес');
        $('ok-title').textContent = label;
        document.title = `${label} - Sofia Prepping`;

        const district = await SofiaDistrict.at(lat, lng);
        // The live status panel (status.js) follows the navbar district: make it this place's
        if (district && SofiaDistrict.get() !== district) SofiaDistrict.set(district.slug);

        const where = [pinned ? '' : params.get('w'), district ? I18N.district(district.name) : t('извън Столична община'),
            `${lat.toFixed(5)}°N ${lng.toFixed(5)}°E`].filter(Boolean)
            .filter((x, i, a) => a.findIndex(y => y.includes(x) || x.includes(y)) === i);
        $('ok-sub').textContent = where.join(' · ');

        const nearest = KINDS.map(k => {
            const layer = MapStyle.LAYERS.find(l => l.key === k.layers[0]);
            const points = k.layers.flatMap(key => karta.layers[key] || []).filter(p => !k.keep || k.keep(p));
            let best = null;
            let within = 0;
            for (const p of points) {
                const km = distanceKm(lat, lng, p[0], p[1]);
                if (km <= 1) within++;
                if (!best || km < best.km) best = { p, km };
            }
            const pillar = k.pillar && [...analizi.pillars, ...analizi.extra].find(x => x.key === k.pillar);
            return { ...k, layer, best, within, limit: pillar ? pillar.km : null };
        });

        $('ok-report').href = `kontakt.html?kind=error&ref=${encodeURIComponent(location.pathname + location.search)}`;
        draw(nearest, here, fit);
        renderList(nearest, map);
        renderReadiness(nearest, district, analizi);
    }

    function draw(nearest, here, fit) {
        drawn.clearLayers();
        L.circle(here, { radius: 1000, color: '#F2A93B', weight: 1, dashArray: '4 6', fill: false, interactive: false }).addTo(drawn);
        const bounds = L.latLngBounds([here]);
        nearest.forEach(n => {
            if (!n.best) return;
            const to = [n.best.p[0], n.best.p[1]];
            L.polyline([here, to], { color: n.layer.colour === '#0D1014' ? (n.layer.stroke || '#E6E9ED') : n.layer.colour, weight: 1.5, dashArray: '3 5', opacity: 0.8, interactive: false }).addTo(drawn);
            n.marker = MapStyle.marker(n.layer, n.best.p).bindPopup(() => {
                const div = MapStyle.popupFor(n.layer, n.best.p);
                div.insertBefore(el('div', 'popup-kind', `${t(n.label)} · ${dist(n.best.km)}`), div.firstChild);
                div.children[1].remove();  // the layer name, replaced by the line above
                return div;
            }).addTo(drawn);
            if (n.best.km < 3 || n.pillar === 'shelter') bounds.extend(to);
        });
        if (!pin) {
            pin = L.marker(here, {
                draggable: true, autoPan: true, zIndexOffset: 1000, keyboard: true,
                title: t('Плъзнете, за да уточните мястото'),
                icon: L.divIcon({ className: 'ok-pin', html: '<span></span>', iconSize: [26, 26], iconAnchor: [13, 13] })
            }).bindTooltip(t('Тук'), { permanent: true, direction: 'top', offset: [0, -14], className: 'ri-leaflet-tip' }).addTo(map);
            pin.on('dragend', () => { const p = pin.getLatLng(); moveTo(p.lat, p.lng, false); });
        } else {
            pin.setLatLng(here);
        }
        if (fit) map.fitBounds(bounds.pad(0.12), { maxZoom: 16 });
    }

    function renderList(nearest, map) {
        $('ok-list').replaceChildren(...nearest.map(n => {
            const li = el('li', 'ok-item');
            if (!n.best) {
                li.append(el('span', 'ok-kind', t(n.label)), el('span', 'ok-none', t('Няма данни')));
                return li;
            }
            const [plat, plng, name] = n.best.p;
            const head = el('div', 'ok-item-head');
            head.append(MapStyle.swatch(n.layer), el('span', 'ok-kind', t(n.label)), el('span', 'ok-dist', dist(n.best.km)));
            const far = n.limit && n.best.km > n.limit;
            if (far) head.querySelector('.ok-dist').classList.add('far');
            const nameEl = el('div', 'ok-name', I18N.text(name) || t(n.label));
            const meta = el('div', 'ok-meta');
            meta.append(document.createTextNode([walk(n.best.km), n.within > 1 ? t('{n} в радиус 1 км', { n: n.within }) : ''].filter(Boolean).join(' · ')));
            const route = MapStyle.directionsLink(plat, plng);
            route.className = 'ok-route';
            meta.append(route);
            li.append(head, nameEl, meta);
            li.tabIndex = 0;
            const show = () => {
                map.flyTo([plat, plng], Math.max(map.getZoom(), 16), { duration: 0.6 });
                n.marker.openPopup();
                if (window.innerWidth < 900) $('ok-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
            };
            li.addEventListener('click', e => { if (!e.target.closest('a')) show(); });
            li.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.target.closest('a')) show(); });
            return li;
        }));
    }

    function renderReadiness(nearest, district, analizi) {
        const body = $('ok-ready-body');
        if (!district) {
            body.replaceChildren(el('p', 'ok-none', t('Мястото е извън Столична община, затова няма оценка на района.')));
            return;
        }
        const row = analizi.districts[district.index];
        const ranked = [...analizi.districts].sort((a, b) => b.score - a.score);
        const top = el('div', 'ok-score');
        const v = el('span', 'ri-score-value', String(Math.round(row.score)));
        v.append(el('small', '', '/100'));
        const side = el('div', 'ri-score-side');
        side.append(el('span', 'ri-rank', t('№ {r} от {n} района', { r: ranked.indexOf(row) + 1, n: ranked.length })),
            el('span', 'ri-score-note', t('{district} · София: {c}', { district: I18N.district(district.name), c: Math.round(analizi.city.score) })));
        top.append(v, side);

        const checks = el('ul', 'ok-checks');
        analizi.pillars.forEach(p => {
            const n = nearest.find(x => x.pillar === p.key);
            const ok = n && n.best && n.best.km <= p.km;
            const li = el('li', ok ? 'yes' : 'no');
            li.append(el('span', 'ok-mark', ok ? '✓' : '✕'),
                el('span', 'ok-check-label', t('{what} до {km}', { what: t(n.label), km: t('{n} км', { n: NF1.format(p.km) }) })),
                el('span', 'ok-check-note', t('{v}% от района', { v: Math.round(row.cover[p.key]) })));
            checks.append(li);
        });
        const met = analizi.pillars.filter(p => { const n = nearest.find(x => x.pillar === p.key); return n && n.best && n.best.km <= p.km; }).length;

        const links = el('div', 'ok-links');
        const idx = el('a', 'ri-link', t('Индекс на готовност →'));
        idx.href = `gotovnost.html?rayon=${district.slug}`;
        const dos = el('a', 'ri-link', t('Досие на района →'));
        dos.href = `dosie.html?rayon=${district.slug}`;
        links.append(idx, dos);

        body.replaceChildren(top,
            el('h3', 'ok-h3', t('Това място: {n} от {total} в обхват', { n: met, total: analizi.pillars.length })),
            checks,
            el('p', 'ok-note', t('„% от района“ е делът на жителите на района, които имат такъв обект на това разстояние.')),
            links);
    }

    init();
})();
