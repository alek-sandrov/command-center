// City Readiness Index (gotovnost.html). Reads data/analizi.json (scripts/build_analizi.py):
// per district the share of residents within reach of each kind of protection resource, and a
// population grid for the map. Follows the district picked in the navbar.
(function () {
    const { t } = I18N;
    const LOCALE = I18N.lang === 'en' ? 'en-GB' : 'bg-BG';
    const NF = new Intl.NumberFormat(LOCALE);
    const NF1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
    const num = n => NF.format(Math.round(n));
    const km = n => t('{n} км', { n: NF1.format(n) });

    // Score pillars, then the extra measures shown in the dossier (same order as the grid's share strings)
    const MEASURES = {
        shelter: { label: 'Укритие', desc: 'Противорадиационно укритие или скривалище', gap: '{n} жители на над {km} от укритие', layers: ['shelters'] },
        evac: { label: 'Настаняване', desc: 'Сграда за временно настаняване при бедствие', gap: '{n} жители на над {km} от сграда за настаняване', layers: ['evac'] },
        medical: { label: 'Медицина', desc: 'Болница или здравен център', gap: '{n} жители на над {km} от болница', layers: ['hospitals'] },
        water: { label: 'Вода', desc: 'Работеща чешма или минерален извор', gap: '{n} жители на над {km} от работеща чешма', layers: ['fountains', 'springs'] },
        iodine: { label: 'Йод', desc: 'Пункт за йодни таблетки', gap: '{n} жители на над {km} от пункт за йодни таблетки', layers: ['iodine'] },
        pharmacy: { label: 'Аптека', layers: ['pharmacies'] },
        tents: { label: 'Палатков лагер', layers: ['tents'] }
    };

    // Diverging classes: a district's value against the value for all of Sofia (points of 100)
    const CLASSES = [
        { key: 'lo2', max: -20, colour: '#E66767', label: '−20 и по-малко' },
        { key: 'lo1', max: -7, colour: '#A24D4D', label: '−20 до −7' },
        { key: 'mid', max: 7, colour: '#3A4048', label: '±7' },
        { key: 'hi1', max: 20, colour: '#2C5A93', label: '+7 до +20' },
        { key: 'hi2', max: Infinity, colour: '#3987E5', label: '+20 и повече' }
    ];
    const classOf = (v, ref) => CLASSES.find(c => v - ref < c.max) || CLASSES[CLASSES.length - 1];
    const GAP = '#E66767';

    const $ = id => document.getElementById(id);
    const el = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    };

    let data, shapes, pillars, order, rankOf;
    let measure = 'index';
    let view = 'districts';
    let sort = { key: 'score', dir: -1 };
    let map, cityBounds, districtLayers = [], hexLayer, pointLayer, focus;
    let karta = null;

    const value = (row, m = measure) => (m === 'index' ? row.score : row.cover[m]);
    const label = m => (m === 'index' ? t('Индекс') : t(MEASURES[m].label));

    // ---------------------------------------------------------------------------------------
    async function init() {
        try {
            [data, shapes] = await Promise.all([
                fetch('data/analizi.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
                SofiaDistrict.shapes()
            ]);
        } catch {
            $('ri-kpis').replaceChildren(el('div', 'error', t('Неуспешно зареждане на данните.')));
            $('ri-dossier').replaceChildren();
            return;
        }
        pillars = data.pillars.map(p => p.key);
        order = [...pillars, ...data.extra.map(p => p.key)];
        const ranked = [...data.districts].sort((a, b) => b.score - a.score);
        rankOf = new Map(ranked.map((d, i) => [d.name, i + 1]));

        const date = d => new Date(d).toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
        $('ri-meta').textContent = [
            t('Обекти към {date}', { date: date(data.points_updated) }),
            t('Население: преброяване {c} · модел Kontur {g}', { c: data.population_source.census, g: data.population_source.grid.slice(0, 4) }),
            t('{n} района · {p} жители', { n: data.districts.length, p: num(data.city.population) })
        ].join(' · ');

        buildKpis();
        buildMeasureChips();
        buildPillarList();
        buildMap();
        buildTable();
        buildBars();
        document.querySelectorAll('.ri-view button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
        SofiaDistrict.onChange(() => select(true));
        select(!!SofiaDistrict.get());
    }

    // --- Headline figures --------------------------------------------------------------------
    function buildKpis() {
        const c = data.city;
        const none = data.districts.filter(d => d.counts.shelter === 0);
        const worst = [...data.districts].sort((a, b) => a.score - b.score)[0];
        const tile = (code, title, big, unit, note, onClick) => {
            const box = el(onClick ? 'button' : 'div', 'ri-kpi');
            if (onClick) { box.type = 'button'; box.addEventListener('click', onClick); }
            box.append(el('span', 'ri-kpi-code', code), el('span', 'ri-kpi-title', title));
            const v = el('span', 'ri-kpi-value', big);
            if (unit) v.append(el('small', '', unit));
            box.append(v, el('span', 'ri-kpi-note', note));
            return box;
        };
        $('ri-kpis').replaceChildren(
            tile('01', t('Индекс · цяла София'), String(Math.round(c.score)), '/100',
                t('средно от {n} стълба', { n: pillars.length })),
            tile('02', t('Без укритие до {km}', { km: km(data.pillars[0].km) }), num(c.uncovered.shelter), '',
                t('{p}% от жителите на София', { p: Math.round(100 - c.cover.shelter) })),
            tile('03', t('Райони без нито едно укритие'), String(none.length), `/${data.districts.length}`,
                none.slice(0, 4).map(d => I18N.districtName(d.name)).join(', ') + (none.length > 4 ? ' …' : '')),
            tile('04', t('Най-нисък индекс'), String(Math.round(worst.score)), '/100',
                I18N.district(worst.name), () => SofiaDistrict.set(SofiaDistrict.list[data.districts.indexOf(worst)].slug))
        );
    }

    function buildMeasureChips() {
        const box = $('ri-measures');
        ['index', ...pillars].forEach(m => {
            const b = el('button', m === measure ? 'on' : '', label(m));
            b.type = 'button';
            b.dataset.measure = m;
            b.setAttribute('aria-pressed', String(m === measure));
            b.addEventListener('click', () => setMeasure(m));
            box.append(b);
        });
    }

    function buildPillarList() {
        $('ri-pillars').replaceChildren(...data.pillars.map(p => {
            const li = el('li');
            li.append(el('strong', '', t(MEASURES[p.key].label)), document.createTextNode(' — ' +
                t('{what} до {km}', { what: t(MEASURES[p.key].desc), km: km(p.km) })));
            return li;
        }));
    }

    // --- Map -------------------------------------------------------------------------------
    function buildMap() {
        map = L.map('ri-map', { renderer: MapStyle.renderer(), scrollWheelZoom: false, zoomSnap: 0.25 });
        MapStyle.basemap(map);

        // Grid hexagons, drawn from one corner template (metres north/east of the centre)
        const hexes = data.grid.map(([lat, lng, pop, , share]) => {
            const kx = 111320 * Math.cos(lat * Math.PI / 180);
            const corners = data.hexagon.map(([n, e]) => [lat + n / 110574, lng + e / kx]);
            const poly = L.polygon(corners, { stroke: false, fillOpacity: 0 });
            poly.cell = { pop, share };
            poly.bindTooltip(() => hexTip(poly.cell), { sticky: true, className: 'ri-leaflet-tip', direction: 'top', offset: [0, -6] });
            return poly;
        });
        hexLayer = L.featureGroup(hexes);

        districtLayers = shapes.map((shape, i) => {
            const rings = shape.polygons.map(p => p.map(r => r.map(([lng, lat]) => [lat, lng])));
            const poly = L.polygon(rings, { color: '#0A0C0F', weight: 1, fillOpacity: 0.62 });
            poly.bindTooltip(() => districtTip(i), { sticky: true, className: 'ri-leaflet-tip', direction: 'top', offset: [0, -6] });
            poly.on('click', () => {
                const d = SofiaDistrict.list[i];
                SofiaDistrict.set(SofiaDistrict.get() === d ? '' : d.slug);
            });
            poly.on('mouseover', () => poly.setStyle({ weight: 2, color: '#E6E9ED' }));
            poly.on('mouseout', () => poly.setStyle({ weight: view === 'people' ? 0.8 : 1, color: view === 'people' ? '#2A323C' : '#0A0C0F' }));
            return poly.addTo(map);
        });
        // Fit to where people live, not to the districts' mountain edges
        cityBounds = L.latLngBounds(data.grid.filter(c => c[2] >= 300).map(c => [c[0], c[1]]));
        map.fitBounds(cityBounds, { padding: [8, 8] });
        paintMap();
    }

    const shareOf = (cell, m) => {
        const at = k => { const c = cell.share[order.indexOf(k)]; return c === 'A' ? 1 : Number(c) / 10; };
        return m === 'index' ? pillars.reduce((s, k) => s + at(k), 0) / pillars.length : at(m);
    };

    function hexTip(cell) {
        const s = shareOf(cell, measure);
        const head = measure === 'index' ? t('Средно покритие') : t(MEASURES[measure].label);
        return `<strong>${num(cell.pop)}</strong> ${t('жители')}<br>${head}: ${Math.round(100 * s)}%`;
    }

    function districtTip(i) {
        const d = data.districts[i];
        const v = value(d), ref = value(data.city);
        const diff = Math.round(v - ref);
        return `<strong>${I18N.districtName(d.name)}</strong><br>${label(measure)}: ${Math.round(v)}` +
            ` <span class="ri-tip-dim">(${diff >= 0 ? '+' : '−'}${Math.abs(diff)} ${t('спрямо София')})</span>`;
    }

    function paintMap() {
        const ref = value(data.city);
        const people = view === 'people';
        districtLayers.forEach((poly, i) => {
            const c = classOf(value(data.districts[i]), ref);
            poly.setStyle(people
                ? { fillOpacity: 0, color: '#2A323C', weight: 0.8 }
                : { fillColor: c.colour, fillOpacity: 0.62, color: '#0A0C0F', weight: 1 });
        });
        if (people) {
            hexLayer.eachLayer(h => {
                const missing = (1 - shareOf(h.cell, measure)) * h.cell.pop;
                h.setStyle(missing < 1
                    ? { fillColor: '#8B95A1', fillOpacity: 0.12 }
                    : { fillColor: GAP, fillOpacity: Math.min(0.9, 0.18 + 0.72 * Math.sqrt(missing / 2000)) });
            });
            if (!map.hasLayer(hexLayer)) hexLayer.addTo(map);
            hexLayer.bringToFront();
        } else if (map.hasLayer(hexLayer)) {
            map.removeLayer(hexLayer);
        }
        if (focus) focus.bringToFront();
        showPoints();
        buildLegend();
    }

    // The resource points of the chosen pillar, shown over the population view
    async function showPoints() {
        if (pointLayer) { map.removeLayer(pointLayer); pointLayer = null; }
        if (view !== 'people' || measure === 'index') return;
        if (!karta) {
            try { karta = await fetch('data/karta.json').then(r => r.json()); } catch { return; }
        }
        if (view !== 'people' || measure === 'index' || pointLayer) return;
        const group = L.layerGroup();
        MEASURES[measure].layers.forEach(key => {
            const layer = MapStyle.LAYERS.find(l => l.key === key);
            (karta.layers[key] || [])
                .filter(p => key !== 'fountains' || !p[3].includes('Не работи'))
                .forEach(p => MapStyle.marker(layer, p).bindPopup(() => MapStyle.popupFor(layer, p)).addTo(group));
        });
        pointLayer = group.addTo(map);
    }

    function buildLegend() {
        const box = $('ri-legend');
        box.replaceChildren();
        if (view === 'districts') {
            box.append(el('span', 'ri-legend-title', t('{m} спрямо София ({v})', { m: label(measure), v: Math.round(value(data.city)) })));
            const scale = el('span', 'ri-legend-scale');
            CLASSES.forEach(c => {
                const item = el('span', 'ri-legend-item');
                const sw = el('i', 'ri-swatch');
                sw.style.background = c.colour;
                item.append(sw, document.createTextNode(t(c.label)));
                scale.append(item);
            });
            box.append(scale);
        } else {
            box.append(el('span', 'ri-legend-title', measure === 'index'
                ? t('Жители извън обхват, средно за петте стълба')
                : t('Жители без {what} до {km}', { what: t(MEASURES[measure].desc).toLowerCase(), km: km(data.pillars.find(p => p.key === measure).km) })));
            const scale = el('span', 'ri-legend-scale');
            const covered = el('span', 'ri-legend-item');
            const csw = el('i', 'ri-swatch');
            csw.style.background = 'rgba(139,149,161,0.35)';
            covered.append(csw, document.createTextNode(t('всички в обхват')));
            scale.append(covered);
            [100, 500, 2000].forEach(n => {
                const item = el('span', 'ri-legend-item');
                const sw = el('i', 'ri-swatch');
                sw.style.background = GAP;
                sw.style.opacity = String(Math.min(0.9, 0.18 + 0.72 * Math.sqrt(n / 2000)));
                item.append(sw, document.createTextNode(n === 2000 ? t('{n}+ на шестоъгълник', { n: num(n) }) : num(n)));
                scale.append(item);
            });
            box.append(scale);
            if (measure !== 'index') box.append(el('span', 'ri-legend-note', t('Точките са обектите от този вид.')));
        }
    }

    function setMeasure(m) {
        measure = m;
        document.querySelectorAll('#ri-measures button').forEach(b => {
            b.classList.toggle('on', b.dataset.measure === m);
            b.setAttribute('aria-pressed', String(b.dataset.measure === m));
        });
        paintMap();
    }

    function setView(v) {
        view = v;
        document.querySelectorAll('.ri-view button').forEach(b => {
            b.classList.toggle('on', b.dataset.view === v);
            b.setAttribute('aria-pressed', String(b.dataset.view === v));
        });
        paintMap();
    }

    // --- Selection (follows the navbar district) ------------------------------------------
    function select(fit) {
        const d = SofiaDistrict.get();
        if (focus) { map.removeLayer(focus); focus = null; }
        if (d) {
            focus = MapStyle.districtOverlay(shapes[d.index]).addTo(map);
            if (fit) map.fitBounds(focus.getBounds(), { padding: [24, 24] });
        } else if (fit) {
            map.fitBounds(cityBounds, { padding: [8, 8] });
        }
        buildDossier(d ? data.districts[d.index] : null);
        document.querySelectorAll('#ri-table tbody tr').forEach(tr => tr.classList.toggle('on', !!d && tr.dataset.slug === d.slug));
    }

    // --- Dossier ---------------------------------------------------------------------------
    function buildDossier(row) {
        const box = $('ri-dossier');
        const city = data.city;
        const r = row || city;
        const head = el('div', 'panel-head');
        head.append(el('h2', '', row ? t('Профил на района') : t('Профил · цяла София')));
        if (row) {
            const close = el('button', 'ri-link', t('Цяла София'));
            close.type = 'button';
            close.addEventListener('click', () => SofiaDistrict.set(''));
            head.append(close);
        }

        const body = el('div', 'ri-dossier-body');
        body.append(el('div', 'ri-dossier-name', row ? I18N.district(row.name) : t('Столична община')));

        const score = el('div', 'ri-score');
        const big = el('span', 'ri-score-value', String(Math.round(r.score)));
        big.append(el('small', '', '/100'));
        const side = el('div', 'ri-score-side');
        if (row) {
            const diff = Math.round(row.score - city.score);
            const c = classOf(row.score, city.score);
            const tag = el('span', 'ri-tag', `${diff >= 0 ? '+' : '−'}${Math.abs(diff)} ${t('спрямо София')}`);
            tag.style.setProperty('--c', c.colour);
            side.append(el('span', 'ri-rank', t('№ {r} от {n} района', { r: rankOf.get(row.name), n: data.districts.length })), tag);
        } else {
            side.append(el('span', 'ri-rank', t('Индекс на готовност')), el('span', 'ri-score-note', t('средно от {n} стълба', { n: pillars.length })));
        }
        score.append(big, side);
        body.append(score);

        const facts = el('dl', 'ri-facts');
        const area = row ? row.area : data.districts.reduce((s, d) => s + d.area, 0);
        [[t('Жители'), num(r.population)], [t('Площ'), `${num(area)} ${t('км²')}`],
            [t('Гъстота'), `${num(r.population / area)} ${t('на км²')}`]].forEach(([k, v]) => {
            const f = el('div');
            f.append(el('dt', '', k), el('dd', '', v));
            facts.append(f);
        });
        body.append(facts);

        // Pillars: the district's share (bar) against all of Sofia (tick)
        const list = el('div', 'ri-pillar-rows');
        data.pillars.forEach(p => {
            const v = r.cover[p.key];
            const item = el('div', 'ri-prow');
            const top = el('div', 'ri-prow-top');
            top.append(el('span', 'ri-prow-label', t(MEASURES[p.key].label)), el('span', 'ri-prow-value', `${Math.round(v)}%`));
            const bar = el('div', 'ri-bullet');
            const fill = el('i');
            fill.style.width = `${v}%`;
            fill.style.background = row ? classOf(v, city.cover[p.key]).colour : '#8B95A1';
            bar.append(fill);
            if (row) {
                const tick = el('b');
                tick.style.left = `${city.cover[p.key]}%`;
                tick.title = t('София: {v}%', { v: Math.round(city.cover[p.key]) });
                bar.append(tick);
            }
            const count = r.counts[p.key];
            const sub = el('div', 'ri-prow-sub', [
                t('{n} обекта', { n: num(count) }),
                row && row.median_km ? t('половината жители са до {km}', { km: km(row.median_km[p.key]) }) : t('в обхват: до {km}', { km: km(p.km) })
            ].join(' · '));
            item.append(top, bar, sub);
            list.append(item);
        });
        body.append(list);
        if (row) {
            const key = el('div', 'ri-bullet-key');
            key.append(el('b'), document.createTextNode(t('средно за София')));
            body.append(key);
        }

        // Biggest gaps, in residents
        const gaps = data.pillars
            .map(p => ({ p, n: r.uncovered[p.key] }))
            .filter(g => g.n >= 100)
            .sort((a, b) => b.n - a.n)
            .slice(0, 3);
        const gapBox = el('div', 'ri-gaps');
        gapBox.append(el('h3', '', t('Основни пропуски')));
        if (gaps.length) {
            const ul = el('ul');
            gaps.forEach(g => ul.append(el('li', '', t(MEASURES[g.p.key].gap, { n: num(g.n), km: km(g.p.km) }))));
            gapBox.append(ul);
        } else {
            gapBox.append(el('p', 'ri-note', t('Всички жители имат всеки вид обект наблизо.')));
        }
        if (!row) {
            const weakest = [...data.districts].sort((a, b) => a.score - b.score).slice(0, 3);
            gapBox.append(el('h3', '', t('Най-слаби райони')));
            const ul = el('ul', 'ri-weak');
            weakest.forEach(d => {
                const li = el('li');
                const b = el('button', 'ri-link', I18N.districtName(d.name));
                b.type = 'button';
                b.addEventListener('click', () => SofiaDistrict.set(SofiaDistrict.list[data.districts.indexOf(d)].slug));
                li.append(b, el('span', '', String(Math.round(d.score))));
                ul.append(li);
            });
            gapBox.append(ul);
        }
        body.append(gapBox);

        const extra = el('div', 'ri-extra');
        data.extra.forEach(p => {
            extra.append(el('span', '', `${t(MEASURES[p.key].label)} ${t('до {km}', { km: km(p.km) })}: ${Math.round(r.cover[p.key])}%`));
        });
        body.append(extra);

        box.replaceChildren(head, body);
    }

    // --- Ranking table ---------------------------------------------------------------------
    function buildTable() {
        const table = $('ri-table');
        const cols = [
            { key: 'rank', label: '№', num: true },
            { key: 'name', label: 'Район' },
            { key: 'population', label: 'Жители', num: true },
            { key: 'score', label: 'Индекс', num: true, bar: true },
            ...pillars.map(k => ({ key: k, label: MEASURES[k].label, num: true, bar: true }))
        ];
        const get = (d, k) => (k === 'rank' ? rankOf.get(d.name) : k === 'name' ? I18N.districtName(d.name)
            : k === 'population' ? d.population : k === 'score' ? d.score : d.cover[k]);

        const thead = el('thead');
        const hr = el('tr');
        cols.forEach(c => {
            const th = el('th', c.num ? 'num' : '');
            th.scope = 'col';
            const b = el('button', '', t(c.label));
            b.type = 'button';
            b.addEventListener('click', () => {
                sort = { key: c.key, dir: sort.key === c.key ? -sort.dir : (c.key === 'name' || c.key === 'rank' ? 1 : -1) };
                render();
            });
            th.append(b);
            th.dataset.key = c.key;
            hr.append(th);
        });
        thead.append(hr);
        const tbody = el('tbody');
        const tfoot = el('tfoot');
        table.replaceChildren(thead, tbody, tfoot);

        const cell = (c, v, ref) => {
            const td = el('td', c.num ? 'num' : '');
            if (!c.bar) { td.textContent = typeof v === 'number' ? num(v) : v; return td; }
            const wrap = el('span', 'ri-cell');
            const bar = el('span', 'ri-cbar');
            const fill = el('i');
            fill.style.width = `${v}%`;
            fill.style.background = ref === undefined ? '#8B95A1' : classOf(v, ref).colour;
            bar.append(fill);
            wrap.append(el('span', 'ri-cnum', String(Math.round(v))), bar);
            td.append(wrap);
            return td;
        };
        const refOf = k => (k === 'score' ? data.city.score : data.city.cover[k]);

        function render() {
            const rows = [...data.districts].sort((a, b) => {
                const x = get(a, sort.key), y = get(b, sort.key);
                return (typeof x === 'string' ? x.localeCompare(y, LOCALE) : x - y) * sort.dir;
            });
            const current = SofiaDistrict.get();
            tbody.replaceChildren(...rows.map(d => {
                const i = data.districts.indexOf(d);
                const slug = SofiaDistrict.list[i].slug;
                const tr = el('tr');
                tr.dataset.slug = slug;
                tr.tabIndex = 0;
                if (current && current.slug === slug) tr.classList.add('on');
                cols.forEach(c => tr.append(cell(c, get(d, c.key), c.bar ? refOf(c.key) : undefined)));
                const pick = () => SofiaDistrict.set(SofiaDistrict.get()?.slug === slug ? '' : slug);
                tr.addEventListener('click', pick);
                tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
                return tr;
            }));
            const fr = el('tr');
            cols.forEach(c => {
                if (c.key === 'rank') fr.append(el('td', 'num', ''));
                else if (c.key === 'name') fr.append(el('td', '', t('София')));
                else if (c.key === 'population') fr.append(el('td', 'num', num(data.city.population)));
                else fr.append(cell(c, c.key === 'score' ? data.city.score : data.city.cover[c.key]));
            });
            tfoot.replaceChildren(fr);
            thead.querySelectorAll('th').forEach(th => {
                th.setAttribute('aria-sort', th.dataset.key === sort.key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none');
            });
        }
        render();
    }

    // --- Shelter concentration ---------------------------------------------------------------
    function buildBars() {
        const total = data.city.counts.shelter;
        const rows = data.districts
            .map(d => ({ d, pop: 100 * d.population / data.city.population, shel: 100 * d.counts.shelter / total }))
            .sort((a, b) => b.pop - a.pop);
        const max = Math.max(...rows.map(r => Math.max(r.pop, r.shel)));
        const top = [...rows].sort((a, b) => b.shel - a.shel)[0];
        const none = rows.filter(r => r.d.counts.shelter === 0);
        const nonePop = none.reduce((s, r) => s + r.d.population, 0);
        $('ri-conc-note').textContent = t('{d} има {p}% от жителите на София и {s}% от укритията. {n} района с {people} жители нямат нито едно укритие на своя територия.', {
            d: I18N.district(top.d.name), p: NF1.format(top.pop), s: NF1.format(top.shel),
            n: none.length, people: num(nonePop)
        });

        const tip = $('ri-tip');
        $('ri-bars').replaceChildren(...rows.map(r => {
            const row = el('div', 'ri-bar-row');
            row.tabIndex = 0;
            const name = el('span', 'ri-bar-name', I18N.districtName(r.d.name));
            const bars = el('span', 'ri-bar-pair');
            [['pop', r.pop], ['shel', r.shel]].forEach(([cls, v]) => {
                const line = el('span', 'ri-bar-line');
                const b = el('i', cls);
                b.style.width = `${(v / max) * 100}%`;
                line.append(b, el('span', 'ri-bar-val', `${NF1.format(v)}%`));
                bars.append(line);
            });
            row.append(name, bars);
            const text = t('{d}: {p}% от жителите · {s}% от укритията ({n} от {total})', {
                d: I18N.districtName(r.d.name), p: NF1.format(r.pop), s: NF1.format(r.shel), n: r.d.counts.shelter, total
            });
            row.setAttribute('aria-label', text);
            const show = e => {
                tip.textContent = text;
                tip.hidden = false;
                const box = row.getBoundingClientRect();
                const x = e && e.clientX ? e.clientX : box.left + box.width / 2;
                tip.style.left = `${Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, x - tip.offsetWidth / 2))}px`;
                tip.style.top = `${box.top - tip.offsetHeight - 6}px`;
            };
            row.addEventListener('mousemove', show);
            row.addEventListener('focus', () => show());
            row.addEventListener('mouseleave', () => { tip.hidden = true; });
            row.addEventListener('blur', () => { tip.hidden = true; });
            row.addEventListener('click', () => SofiaDistrict.set(SofiaDistrict.list[data.districts.indexOf(r.d)].slug));
            return row;
        }));
        window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
    }

    init();
})();
