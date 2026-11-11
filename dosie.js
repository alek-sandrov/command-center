// District dossier (dosie.html): a multi-page A4 document for the district chosen in the navbar.
//   1  Summary: key figures, findings, contents
//   2  Map 1 – protection resources (the whole page)
//   3  Map 2 – shelter reach: where residents live more than 1 km from a shelter (the whole page)
//   4  Readiness assessment against all of Sofia
//   5+ Register of every place on map 1, numbered as on the map, over as many pages as it needs
//   …  Method and sources
// Map pages turn landscape for wide districts. Sets window.dossierReady once the maps are drawn.
(function () {
    const { t } = I18N;
    const LOCALE = I18N.lang === 'en' ? 'en-GB' : 'bg-BG';
    const NF = new Intl.NumberFormat(LOCALE);
    const NF1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
    const num = n => NF.format(Math.max(0, Math.round(n)));  // also turns -0 from rounding into 0
    const km = n => t('{n} км', { n: NF1.format(n) });
    // Whole percent, except just short of 0 or 100 (99.8% must not read as 100%)
    const pct = v => ((v > 99 && v < 100) || (v > 0 && v < 1) ? NF1.format(Math.floor(v * 10) / 10) : String(Math.round(v)));
    const SITE = 'https://sofia-prepping.com';

    // Places on map 1 and in the register. code = the letter before each number
    const ASSETS = [
        { key: 'shelter', layers: ['shelters'], code: 'У', en: 'S', label: 'Укрития', colour: '#111827', neighbours: 3 },
        { key: 'medical', layers: ['hospitals'], code: 'Б', en: 'H', label: 'Болници и здравни центрове', colour: '#dc2626', neighbours: 3 },
        { key: 'evac', layers: ['evac'], code: 'Н', en: 'A', label: 'Сгради за временно настаняване', colour: '#2563eb' },
        { key: 'iodine', layers: ['iodine'], code: 'Й', en: 'I', label: 'Пунктове за йодни таблетки', colour: '#b45309' },
        { key: 'water', layers: ['fountains', 'springs'], code: 'В', en: 'W', label: 'Питейна вода: чешми и извори', colour: '#0e7490', keep: p => !p[3].includes('Не работи') },
        { key: 'tents', layers: ['tents'], code: 'П', en: 'T', label: 'Места за палатъчни лагери', colour: '#047857' }
    ];
    const codeOf = a => (I18N.lang === 'en' ? a.en : a.code);
    const PILLAR_LABELS = { shelter: 'Укритие', evac: 'Настаняване', medical: 'Медицина', water: 'Вода', iodine: 'Йод', pharmacy: 'Аптека', tents: 'Палатков лагер' };
    const PILLAR_DESC = {
        shelter: 'укритие', evac: 'сграда за настаняване', medical: 'болница или здравен център',
        water: 'работеща чешма или извор', iodine: 'пункт за йодни таблетки'
    };
    const GAP = '#dc2626';

    const $ = id => document.getElementById(id);
    const el = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    };
    const dateBg = iso => { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };

    function distanceKm(lat1, lng1, lat2, lng2) {
        const r = Math.PI / 180;
        const a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lng2 - lng1) * r / 2) ** 2;
        return 12742 * Math.asin(Math.sqrt(a));
    }

    let dataPromise = null;
    const loadData = () => (dataPromise ||= Promise.all([
        fetch('data/karta.json').then(r => r.json()),
        fetch('data/analizi.json').then(r => r.json()),
        SofiaDistrict.shapes()
    ]));

    let maps = [];
    let build = 0;  // increases with each rebuild, so a slow older build stops

    // --- Page scaffolding ----------------------------------------------------------------------
    function makePage(ctx, section, { map = false, land = false } = {}) {
        const page = el('section', `dp${map ? ' dp-mapped' : ''}${land ? ' land' : ''}`);
        const strip = el('div', 'dp-strip');
        strip.append(el('span', '', t('Отворени данни // за обществено ползване')), el('span', '', `${t('Досие на район')} · ${ctx.title}`));
        const body = el('div', 'dp-body');
        const foot = el('div', 'dp-foot');
        foot.append(el('span', '', `${ctx.docId} · ${ctx.today}`), el('span', 'dp-foot-section', t(section)), el('span', 'dp-pno'));
        page.append(strip, body, foot);
        page.dataset.section = section;
        $('doc').append(page);
        return { page, body };
    }

    function heading(body, kicker, title) {
        const h = el('header', 'dp-head');
        h.append(el('div', 'dp-kicker', kicker), el('h2', '', title));
        body.append(h);
        return h;
    }

    // --- Data for one district -------------------------------------------------------------------
    function prepare(d, karta, analizi, shapes) {
        const i = d.index;
        const row = analizi.districts[i];
        const shape = shapes[i];
        const cells = analizi.grid.filter(c => c[3] === i);
        // Where the district's residents live on average: distances to neighbouring places are measured from here
        const popSum = cells.reduce((s, c) => s + c[2], 0) || 1;
        const centre = cells.length
            ? [cells.reduce((s, c) => s + c[0] * c[2], 0) / popSum, cells.reduce((s, c) => s + c[1] * c[2], 0) / popSum]
            : [(shape.bbox[0] + shape.bbox[2]) / 2, (shape.bbox[1] + shape.bbox[3]) / 2];

        const assets = ASSETS.map(a => {
            const all = a.layers.flatMap(k => karta.layers[k] || []).filter(p => !a.keep || a.keep(p));
            let items = all.filter(p => p[5] === i).map(p => ({ p }));
            if (a.neighbours && items.length < 2) {
                items = items.concat(all.filter(p => p[5] !== i)
                    .map(p => ({ p, near: distanceKm(centre[0], centre[1], p[0], p[1]) }))
                    .sort((x, y) => x.near - y.near)
                    .slice(0, a.neighbours));
            }
            items.forEach((it, n) => { it.id = `${codeOf(a)}${n + 1}`; });
            return { ...a, items, own: items.filter(it => it.near === undefined).length, all };
        });
        const ranked = [...analizi.districts].sort((a, b) => b.score - a.score);
        const shown = analizi.pillars.map(p => p.key);
        const order = [...shown, ...analizi.extra.map(p => p.key)];
        return {
            d, row, shape, cells, centre, assets, analizi, karta, order,
            city: analizi.city, rank: ranked.indexOf(row) + 1, pillars: analizi.pillars,
            title: I18N.district(d.name),
            docId: `SP-D${String(i + 1).padStart(2, '0')}-${(karta.updated && Object.values(karta.updated).sort().pop() || '').replace(/-/g, '').slice(0, 6)}`,
            today: new Date().toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Sofia' }),
            dataDate: dateBg(analizi.points_updated),
            land: (() => {
                const [s, w, n, e] = shape.bbox;
                const a = L.CRS.EPSG3857.project(L.latLng(s, w)), b = L.CRS.EPSG3857.project(L.latLng(n, e));
                return Math.abs(b.x - a.x) / (Math.abs(b.y - a.y) || 1) > 1.15;  // wider than tall
            })()
        };
    }

    // Short sentences with the main points, from the numbers
    function findings(ctx) {
        const { row, city, pillars } = ctx;
        const out = [];
        const shelters = ctx.assets[0];
        if (!shelters.own) {
            out.push(t('На територията на района няма нито едно укритие. {n} жители ({p}%) са на над {km} от най-близкото.',
                { n: num(row.uncovered.shelter), p: pct(100 - row.cover.shelter), km: km(pillars[0].km) }));
        } else {
            out.push(t('{c} укрития в района; {p}% от жителите имат укритие до {km} (София: {city}%).',
                { c: shelters.own, p: pct(row.cover.shelter), km: km(pillars[0].km), city: Math.round(city.cover.shelter) }));
        }
        const diffs = pillars.map(p => ({ p, diff: row.cover[p.key] - city.cover[p.key] }));
        const worst = [...diffs].sort((a, b) => a.diff - b.diff)[0];
        const best = [...diffs].sort((a, b) => b.diff - a.diff)[0];
        if (worst.diff < -5 && worst.p.key !== 'shelter') {
            out.push(t('Най-голям пропуск спрямо София: {what} – {v}% от жителите в обхват срещу {c}% средно.',
                { what: t(PILLAR_LABELS[worst.p.key]).toLowerCase(), v: Math.round(row.cover[worst.p.key]), c: Math.round(city.cover[worst.p.key]) }));
        }
        if (best.diff > 5) {
            out.push(t('Най-силна страна: {what} – {v}% от жителите в обхват (София: {c}%).',
                { what: t(PILLAR_LABELS[best.p.key]).toLowerCase(), v: Math.round(row.cover[best.p.key]), c: Math.round(city.cover[best.p.key]) }));
        }
        out.push(t('Индекс на готовност {s} от 100 – № {r} от {n} района (София: {c}).',
            { s: Math.round(row.score), r: ctx.rank, n: ctx.analizi.districts.length, c: Math.round(city.score) }));
        return out;
    }

    // --- Page 1: summary ---------------------------------------------------------------------
    function coverPage(ctx) {
        const { body } = makePage(ctx, 'Обобщение');
        body.classList.add('dp-cover');
        const top = el('div', 'dp-cover-top');
        const titles = el('div');
        titles.append(el('div', 'dp-kicker', t('Досие на район')), el('h1', '', ctx.title),
            el('p', 'dp-lede', t('Защита на населението при бедствия и аварии: ресурси, обхват и пропуски по отворени данни')));
        const qr = el('div', 'dp-qr');
        const code = el('div', 'dp-qr-code');
        qr.append(code, el('span', '', t('Актуална версия онлайн')));
        top.append(titles, qr);
        body.append(top);
        new QRCode(code, { text: `${SITE}/dosie?rayon=${ctx.d.slug}${I18N.lang === 'en' ? '&lang=en' : ''}`, width: 256, height: 256, correctLevel: QRCode.CorrectLevel.M });

        const meta = el('dl', 'dp-meta');
        [[t('Документ №'), ctx.docId], [t('Изготвен'), ctx.today], [t('Данни към'), ctx.dataDate], [t('Класификация'), t('Публично')]]
            .forEach(([k, v]) => { const x = el('div'); x.append(el('dt', '', k), el('dd', '', v)); meta.append(x); });
        body.append(meta);

        const { row } = ctx;
        const kpis = el('div', 'dp-kpis');
        [[t('Жители'), num(row.population), t('преброяване 2021')],
            [t('Площ'), `${num(row.area)} ${t('км²')}`, t('{n} жители на км²', { n: num(row.population / row.area) })],
            [t('Индекс на готовност'), `${Math.round(row.score)}`, t('№ {r} от {n} · София {c}', { r: ctx.rank, n: ctx.analizi.districts.length, c: Math.round(ctx.city.score) })],
            [t('Укрития в района'), String(ctx.assets[0].own), t('{p}% от жителите до {km}', { p: pct(row.cover.shelter), km: km(ctx.pillars[0].km) })]
        ].forEach(([k, v, s]) => {
            const box = el('div', 'dp-kpi');
            box.append(el('span', 'dp-kpi-k', k), el('span', 'dp-kpi-v', v), el('span', 'dp-kpi-s', s));
            kpis.append(box);
        });
        body.append(kpis);

        const f = el('section', 'dp-block');
        f.append(el('h3', '', t('Основни изводи')));
        const ul = el('ol', 'dp-findings');
        findings(ctx).forEach(x => ul.append(el('li', '', x)));
        f.append(ul);
        body.append(f);

        const toc = el('section', 'dp-block');
        toc.append(el('h3', '', t('Съдържание')));
        toc.append(el('ol', 'dp-toc'));
        body.append(toc);
    }

    // --- Map pages -------------------------------------------------------------------------------
    function mapPage(ctx, section, kicker, title) {
        const { page, body } = makePage(ctx, section, { map: true, land: ctx.land });
        const box = el('div', 'dp-map');
        body.append(box);
        const head = el('div', 'dp-overlay dp-map-title');
        head.append(el('div', 'dp-kicker', kicker), el('div', 'dp-map-h', title), el('div', 'dp-map-sub', ctx.title));
        body.append(head);
        const map = L.map(box, {
            zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false,
            doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, zoomSnap: 0.1
        });
        maps.push(map);
        const tiles = MapStyle.basemap(map, { flavor: 'light' });
        L.control.scale({ imperial: false, position: 'bottomright', maxWidth: 160 }).addTo(map);
        const north = el('div', 'dp-overlay dp-north');
        north.innerHTML = '<svg width="22" height="30" viewBox="0 0 22 30" aria-hidden="true"><path d="M11 2l7 18-7-5-7 5z"/><text x="11" y="29" text-anchor="middle">N</text></svg>';
        body.append(north);

        // Everything outside the district faded, district outlined
        const rings = ctx.shape.polygons.map(poly => poly.map(ring => ring.map(([lng, lat]) => [lat, lng])));
        L.polygon([[[-85, -180], [-85, 180], [85, 180], [85, -180]], ...rings.map(p => p[0])],
            { stroke: false, fillColor: '#ffffff', fillOpacity: 0.5, interactive: false }).addTo(map);
        const outline = L.polygon(rings, { color: '#111827', weight: 2.2, dashArray: '8 4', fill: false, interactive: false }).addTo(map);
        const loaded = Promise.race([
            new Promise(resolve => tiles.once('load', resolve)),
            new Promise(resolve => setTimeout(resolve, 12000))
        ]);
        return { page, body, map, outline, loaded };
    }

    const markerIcon = (colour, label) => {
        const w = 8 + label.length * 6.2;
        return L.divIcon({
            className: '',
            html: `<div class="dp-marker" style="background:${colour};min-width:${w}px">${label}</div>`,
            iconSize: [w, 16], iconAnchor: [w / 2, 8]
        });
    };

    function fit(map, outline, extra) {
        const b = outline.getBounds();
        extra.forEach(p => b.extend(p));
        map.fitBounds(b, { paddingTopLeft: [60, 120], paddingBottomRight: [60, 150] });
    }

    function resourcesMap(ctx) {
        const m = mapPage(ctx, 'Карта 1 · Ресурси за защита', t('Карта 1'), t('Ресурси за защита на населението'));
        const extra = [];
        // Draw the less important layers first, so shelters and hospitals end up on top
        [...ctx.assets].reverse().forEach(a => a.items.forEach(it => {
            L.marker([it.p[0], it.p[1]], { icon: markerIcon(a.colour, it.id), interactive: false, zIndexOffset: a.key === 'shelter' ? 1000 : 0 }).addTo(m.map);
            if (it.near !== undefined) extra.push([it.p[0], it.p[1]]);
        }));
        fit(m.map, m.outline, extra);

        const legend = el('div', 'dp-overlay dp-legend');
        legend.append(el('div', 'dp-legend-h', t('Легенда')));
        ctx.assets.forEach(a => {
            const r = el('div', 'dp-legend-row');
            const chip = el('span', 'dp-chip', codeOf(a));
            chip.style.background = a.colour;
            const neighbours = a.items.length - a.own;
            r.append(chip, el('span', '', t(a.label)), el('span', 'dp-legend-n', neighbours ? `${a.own} + ${neighbours}` : String(a.own)));
            legend.append(r);
        });
        const hasNear = ctx.assets.some(a => a.items.length > a.own);
        legend.append(el('div', 'dp-legend-note', hasNear
            ? t('„+“ – най-близките в съседни райони, защото в района има по-малко от 2. Номерата съвпадат с регистъра.')
            : t('Номерата съвпадат с регистъра на обектите.')));
        const outlineKey = el('div', 'dp-legend-row');
        outlineKey.append(el('span', 'dp-line'), el('span', '', t('граница на района')));
        legend.append(outlineKey);
        m.body.append(legend);
        return m.loaded;
    }

    function reachMap(ctx) {
        const m = mapPage(ctx, 'Карта 2 · Обхват на укритията', t('Карта 2'), t('Обхват на укритията ({km})', { km: km(ctx.pillars[0].km) }));
        const { analizi } = ctx;
        const s = ctx.order.indexOf('shelter');
        ctx.cells.forEach(([lat, lng, pop, , share]) => {
            const kx = 111320 * Math.cos(lat * Math.PI / 180);
            const corners = analizi.hexagon.map(([n, e]) => [lat + n / 110574, lng + e / kx]);
            const c = share[s];
            const out = (1 - (c === 'A' ? 1 : Number(c) / 10)) * pop;
            L.polygon(corners, out < 1
                ? { stroke: false, fillColor: '#64748b', fillOpacity: 0.18, interactive: false }
                : { stroke: false, fillColor: GAP, fillOpacity: Math.min(0.8, 0.15 + 0.65 * Math.sqrt(out / 2000)), interactive: false }).addTo(m.map);
        });
        // The listed shelters, plus any other whose 1 km circle reaches places where the district's residents live
        const shelters = ctx.assets[0];
        const own = new Map(shelters.items.map(it => [it.p, it.id]));
        const reach = ctx.pillars[0].km + 0.5;  // half a hexagon's width beyond the circle
        const reaches = p => ctx.cells.some(c => distanceKm(p[0], p[1], c[0], c[1]) <= reach);
        shelters.all.filter(p => own.has(p) || reaches(p)).forEach(p => {
            L.circle([p[0], p[1]], { radius: ctx.pillars[0].km * 1000, color: '#111827', weight: 1.2, dashArray: '4 4', fillColor: '#111827', fillOpacity: 0.04, interactive: false }).addTo(m.map);
            L.marker([p[0], p[1]], { icon: markerIcon('#111827', own.get(p) || ''), interactive: false, zIndexOffset: 1000 }).addTo(m.map);
        });
        fit(m.map, m.outline, shelters.items.filter(it => it.near !== undefined).map(it => [it.p[0], it.p[1]]));

        const { row, city } = ctx;
        const stat = el('div', 'dp-overlay dp-stat');
        stat.append(
            el('div', 'dp-kicker', t('Жители извън обхват')),
            el('div', 'dp-stat-v', num(row.uncovered.shelter)),
            el('div', 'dp-stat-s', t('{p}% от района · София: {c}%', { p: pct(100 - row.cover.shelter), c: Math.round(100 - city.cover.shelter) })),
            el('div', 'dp-stat-s', t('Половината жители са до {km} от укритие', { km: km(row.median_km.shelter) }))
        );
        m.body.append(stat);

        const legend = el('div', 'dp-overlay dp-legend');
        legend.append(el('div', 'dp-legend-h', t('Жители на шестоъгълник (~0,7 км²) без укритие до {km}', { km: km(ctx.pillars[0].km) })));
        const scale = el('div', 'dp-ramp');
        [100, 500, 2000].forEach(n => {
            const sw = el('span', 'dp-ramp-item');
            const box = el('i');
            box.style.background = GAP;
            box.style.opacity = String(Math.min(0.8, 0.15 + 0.65 * Math.sqrt(n / 2000)));
            sw.append(box, document.createTextNode(n === 2000 ? `${num(n)}+` : num(n)));
            scale.append(sw);
        });
        const ok = el('span', 'dp-ramp-item');
        const okBox = el('i');
        okBox.style.background = 'rgba(100,116,139,0.3)';
        ok.append(okBox, document.createTextNode(t('в обхват')));
        scale.append(ok);
        legend.append(scale);
        const ring = el('div', 'dp-legend-row');
        ring.append(el('span', 'dp-ring'), el('span', '', t('укритие и кръг с радиус {km}', { km: km(ctx.pillars[0].km) })));
        legend.append(ring, el('div', 'dp-legend-note', t('Разпределението на жителите е по модела Kontur Population, приведено към преброяване 2021. Разстоянията са по права линия.')));
        m.body.append(legend);
        return m.loaded;
    }

    // --- Page: readiness assessment --------------------------------------------------------------
    function assessmentPage(ctx) {
        const { body } = makePage(ctx, 'Оценка на готовността');
        heading(body, t('Раздел 3'), t('Оценка на готовността'));
        const { row, city, analizi } = ctx;

        const top = el('div', 'dp-score');
        const big = el('div', 'dp-score-v', String(Math.round(row.score)));
        big.append(el('small', '', '/100'));
        const side = el('div', 'dp-score-side');
        const diff = Math.round(row.score - city.score);
        side.append(el('div', 'dp-kicker', t('Индекс на готовност')),
            el('div', 'dp-score-rank', t('№ {r} от {n} района', { r: ctx.rank, n: analizi.districts.length })),
            el('div', 'dp-score-diff', t('{d} пункта спрямо средното за София ({c})', { d: `${diff >= 0 ? '+' : '−'}${Math.abs(diff)}`, c: Math.round(city.score) })));
        top.append(big, side);
        body.append(top);
        body.append(el('p', 'dp-text', t('Индексът е средното от петте стълба по-долу. Всеки стълб е делът от жителите на района, които имат такъв обект в рамките на посоченото разстояние.')));

        // Pillars table
        const table = el('table', 'dp-table dp-pillars');
        const thead = el('thead');
        const hr = el('tr');
        [t('Стълб'), t('В обхват'), '', t('София'), t('Извън обхват'), t('Половината до'), t('Обекти')].forEach((h, i) => hr.append(el('th', i > 0 && i !== 2 ? 'r' : '', h)));
        thead.append(hr);
        const tbody = el('tbody');
        analizi.pillars.forEach(p => {
            const tr = el('tr');
            const v = row.cover[p.key], c = city.cover[p.key];
            const name = el('td');
            name.append(el('strong', '', t(PILLAR_LABELS[p.key])), el('span', 'dp-sub', t('{what} до {km}', { what: t(PILLAR_DESC[p.key]), km: km(p.km) })));
            const bar = el('td', 'dp-barcell');
            const track = el('span', 'dp-bar');
            const fill = el('i');
            fill.style.width = `${v}%`;
            fill.style.background = v - c <= -7 ? GAP : v - c >= 7 ? '#2563eb' : '#64748b';
            const tick = el('b');
            tick.style.left = `${c}%`;
            track.append(fill, tick);
            bar.append(track);
            tr.append(name, el('td', 'r strong', `${pct(v)}%`), bar, el('td', 'r', `${Math.round(c)}%`),
                el('td', 'r', num(row.uncovered[p.key])), el('td', 'r', km(row.median_km[p.key])), el('td', 'r', num(row.counts[p.key])));
            tbody.append(tr);
        });
        table.append(thead, tbody);
        body.append(table);
        const key = el('div', 'dp-keyline');
        const kTick = el('span', 'dp-key-tick');
        const kLow = el('span', 'dp-key-sw'); kLow.style.background = GAP;
        const kHigh = el('span', 'dp-key-sw'); kHigh.style.background = '#2563eb';
        key.append(kTick, document.createTextNode(t('средно за София')), kLow, document.createTextNode(t('7+ пункта под средното')),
            kHigh, document.createTextNode(t('7+ пункта над средното')));
        body.append(key);

        const extras = el('p', 'dp-text dp-muted', analizi.extra.map(p =>
            t('{what} до {km}: {v}% от жителите (София: {c}%)', { what: t(PILLAR_LABELS[p.key]), km: km(p.km), v: Math.round(row.cover[p.key]), c: Math.round(city.cover[p.key]) })).join(' · '));
        body.append(extras);

        // All districts on one axis, this one highlighted
        const strip = el('section', 'dp-block');
        strip.append(el('h3', '', t('Мястото на района сред всички {n}', { n: analizi.districts.length })));
        const axis = el('div', 'dp-dots');
        const line = el('div', 'dp-dots-line');
        axis.append(line);
        const avg = el('div', 'dp-dots-avg');
        avg.style.left = `${city.score}%`;
        avg.append(el('span', '', t('София {c}', { c: Math.round(city.score) })));
        axis.append(avg);
        [...analizi.districts].sort((a, b) => a.score - b.score).forEach(dd => {
            const dot = el('i', dd === row ? 'me' : '');
            dot.style.left = `${dd.score}%`;
            axis.append(dot);
        });
        const me = el('div', 'dp-dots-me');
        me.style.left = `${row.score}%`;
        me.textContent = `${I18N.districtName(ctx.d.name)} ${Math.round(row.score)}`;
        axis.append(me);
        const ticks = el('div', 'dp-dots-ticks');
        [0, 25, 50, 75, 100].forEach(v => { const s = el('span', '', String(v)); s.style.left = `${v}%`; ticks.append(s); });
        axis.append(ticks);
        strip.append(axis);
        const best = [...analizi.districts].sort((a, b) => b.score - a.score);
        strip.append(el('p', 'dp-text dp-muted', t('Най-висок индекс: {a} ({av}). Най-нисък: {b} ({bv}).', {
            a: I18N.districtName(best[0].name), av: Math.round(best[0].score),
            b: I18N.districtName(best[best.length - 1].name), bv: Math.round(best[best.length - 1].score)
        })));
        body.append(strip);

        // Biggest gaps in residents
        const gaps = analizi.pillars.map(p => ({ p, n: row.uncovered[p.key] })).filter(g => g.n >= 100).sort((a, b) => b.n - a.n);
        const g = el('section', 'dp-block');
        g.append(el('h3', '', t('Пропуски в брой жители')));
        if (gaps.length) {
            const ul = el('ul', 'dp-gaps');
            gaps.forEach(x => {
                const li = el('li');
                li.append(el('strong', '', num(x.n)), document.createTextNode(' ' + t('жители на над {km} от {what}', { km: km(x.p.km), what: t(PILLAR_DESC[x.p.key]) })));
                ul.append(li);
            });
            g.append(ul);
        } else g.append(el('p', 'dp-text', t('Всички жители имат всеки вид обект наблизо.')));
        body.append(g);
    }

    // --- Pages: register (as many as it takes) ---------------------------------------------------
    function registerPages(ctx) {
        let page = null, body = null, table = null, tbody = null, part = 0;
        const COLS = [t('№'), t('Име'), t('Вид / бележка'), t('Координати')];
        const overflows = () => body.scrollHeight > body.clientHeight + 1;
        const newPage = () => {
            ({ page, body } = makePage(ctx, 'Регистър на обектите'));
            heading(body, t('Раздел 4'), part++ ? t('Регистър на обектите (продължение)') : t('Регистър на обектите'));
            if (part === 1) body.append(el('p', 'dp-text dp-muted', t('Всички обекти от карта 1 с номерата от картата. Обекти в съседни райони са отбелязани с разстоянието от средищната точка на населението на района.')));
        };
        const startTable = (a, cont) => {
            const h = el('h3', 'dp-reg-h');
            const chip = el('span', 'dp-chip', codeOf(a));
            chip.style.background = a.colour;
            h.append(chip, document.createTextNode(` ${t(a.label)}${cont ? ' ' + t('(продължение)') : ''}`));
            body.append(h);
            table = el('table', 'dp-table dp-reg');
            const thead = el('thead');
            const tr = el('tr');
            COLS.forEach((c, i) => tr.append(el('th', `c${i}`, c)));
            thead.append(tr);
            tbody = el('tbody');
            table.append(thead, tbody);
            body.append(table);
            return h;
        };
        newPage();
        ctx.assets.forEach(a => {
            let h = startTable(a, false);
            if (overflows()) { h.remove(); table.remove(); newPage(); h = startTable(a, false); }
            if (!a.items.length) {
                const tr = el('tr');
                const td = el('td', 'dp-muted', t('Няма в района.'));
                td.colSpan = 4;
                tr.append(td);
                tbody.append(tr);
                return;
            }
            a.items.forEach(it => {
                const [lat, lng, name, info, extra] = it.p;
                const tr = el('tr');
                const notes = [info !== name ? info : '', /^Район /.test(extra) ? '' : extra].filter(Boolean).map(x => I18N.text(x));
                if (it.near !== undefined) notes.push(t('съседен район ({district}), {km}', { district: I18N.districtName(SofiaDistrict.list[it.p[5]]?.name || ''), km: km(it.near) }));
                tr.append(el('td', 'dp-id', it.id), el('td', '', I18N.text(name) || t(a.label)), el('td', 'dp-muted', notes.join(' · ')),
                    el('td', 'dp-mono', `${lat.toFixed(5)}, ${lng.toFixed(5)}`));
                tbody.append(tr);
                if (overflows()) {
                    tr.remove();
                    if (!tbody.children.length) { table.previousSibling.remove(); table.remove(); }
                    newPage();
                    startTable(a, true);
                    tbody.append(tr);
                }
            });
        });
        // Places the dossier does not list one by one
        const counts = ['pharmacies', 'metro'].map(k => [k, ctx.karta.layers[k].filter(p => p[5] === ctx.d.index).length]);
        const p = el('p', 'dp-text dp-muted', t('Също в района (не са изброени): аптеки: {ph} · метростанции и входове: {m}. Вижте ги на интерактивната карта.', { ph: counts[0][1], m: counts[1][1] }));
        body.append(p);
        if (overflows()) { p.remove(); newPage(); body.append(p); }
    }

    // --- Page: method and sources ----------------------------------------------------------------
    function methodPage(ctx) {
        const { body } = makePage(ctx, 'Методика и източници');
        heading(body, t('Раздел 5'), t('Методика и източници'));
        const block = (title, items, ordered) => {
            const s = el('section', 'dp-block');
            s.append(el('h3', '', title));
            if (typeof items === 'string') s.append(el('p', 'dp-text', items));
            else {
                const ul = el(ordered ? 'ol' : 'ul', 'dp-list');
                items.forEach(x => ul.append(el('li', '', x)));
                s.append(ul);
            }
            body.append(s);
        };
        block(t('Как е изчислено'), [
            t('Населението на района (преброяване 2021, НСИ) е разпределено върху мрежа от шестоъгълници с площ около 0,7 км² по модела Kontur Population.'),
            t('За всяко място е измерено разстоянието по права линия до най-близкия обект от всеки вид. Стълбът е делът от жителите в рамките на прага (1 км, за болници 2 км).'),
            t('Индексът на готовност е средното от петте стълба с еднаква тежест: укритие, настаняване, медицина, вода, йод.'),
            t('Когато в района има по-малко от 2 укрития или болници, досието показва и 3-те най-близки в съседни райони.')
        ]);
        block(t('Ограничения'), [
            t('Пешеходният път обикновено е с 20–40% по-дълъг от разстоянието по права линия.'),
            t('Капацитетът на укритията не е известен и не е отчетен.'),
            t('Списъкът с укрития е от публична карта и вероятно е непълен; официален регистър не е публикуван.'),
            t('Досието е независима оценка от отворени данни и не е официален документ на институциите.')
        ]);
        block(t('Източници'), [
            t('Столична община – отворени данни (urbandata.sofia.bg): сгради за настаняване, пунктове за йодни таблетки, места за палатъчни лагери, минерални извори.'),
            t('Google My Maps „Скривалища и ПРУ“ и „Чешмите в България 2024“: укрития и чешми.'),
            t('OpenStreetMap: болници и здравни центрове, аптеки, основна карта.'),
            t('НСИ – Преброяване 2021; Kontur Population (CC BY 4.0): население.')
        ]);
        const sos = el('div', 'dp-sos');
        sos.append(el('strong', '', '112'), el('span', '', t('Единен европейски номер за спешна помощ. При бедствие следвайте указанията на властите и BG-ALERT.')));
        body.append(sos);
        body.append(el('p', 'dp-text dp-muted', t('Онлайн: интерактивна карта – sofia-prepping.com/karta · индекс на готовност – sofia-prepping.com/gotovnost · оперативна обстановка – sofia-prepping.com/obstanovka')));
    }

    // --- Assemble ----------------------------------------------------------------------------
    async function render(d) {
        const run = ++build;
        window.dossierReady = false;
        maps.forEach(m => m.remove());
        maps = [];
        $('doc').replaceChildren();
        $('dossier-print').disabled = true;
        $('dossier-pages').textContent = '';
        if (!d) {
            $('dossier-pick').hidden = false;
            $('dossier-loading').hidden = true;
            $('dossier-list').replaceChildren(...SofiaDistrict.list.map(x => {
                const a = el('a', 'dossier-link', I18N.district(x.name));
                a.href = `dosie.html?rayon=${x.slug}`;
                a.addEventListener('click', e => { e.preventDefault(); SofiaDistrict.set(x.slug); });
                return a;
            }));
            document.title = `${t('Досие на район')} - Sofia Prepping`;
            return;
        }
        $('dossier-pick').hidden = true;
        $('dossier-loading').hidden = false;
        let karta, analizi, shapes;
        try {
            [karta, analizi, shapes] = await loadData();
        } catch {
            $('dossier-loading').textContent = t('Неуспешно зареждане на данните.');
            return;
        }
        if (run !== build) return;
        $('dossier-loading').hidden = true;
        const ctx = prepare(d, karta, analizi, shapes);
        document.title = `${ctx.title} – ${t('досие')} - Sofia Prepping`;

        coverPage(ctx);
        const ready = [resourcesMap(ctx), reachMap(ctx)];
        assessmentPage(ctx);
        registerPages(ctx);
        methodPage(ctx);

        // Page numbers and contents
        const pages = [...document.querySelectorAll('#doc .dp')];
        pages.forEach((p, i) => { p.querySelector('.dp-pno').textContent = t('стр. {i} / {n}', { i: i + 1, n: pages.length }); });
        const toc = document.querySelector('.dp-toc');
        const seen = new Map();
        pages.forEach((p, i) => { if (!seen.has(p.dataset.section)) seen.set(p.dataset.section, [i + 1, i + 1]); else seen.get(p.dataset.section)[1] = i + 1; });
        seen.forEach(([from, to], section) => {
            const li = el('li');
            li.append(el('span', '', t(section)), el('span', 'dp-toc-dots'), el('span', 'dp-toc-p', from === to ? String(from) : `${from}–${to}`));
            toc.append(li);
        });
        $('dossier-pages').textContent = t('{n} страници A4', { n: pages.length });
        $('dossier-print').disabled = false;

        await Promise.all(ready);
        if (run === build) window.dossierReady = true;
    }

    $('dossier-print').addEventListener('click', () => window.print());
    SofiaDistrict.onChange(render);
    render(SofiaDistrict.get());
})();
