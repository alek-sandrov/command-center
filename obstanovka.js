// Operations wall (obstanovka.html): every live source on one screen. Indicators and the overall
// level are graded by the same rules as the homepage panel (status-rules.js); the map, event log,
// district matrix and ticker show the events behind them. Refreshes itself every 5 minutes.
// ?wall=1 (or the "full screen" button) hides the site chrome for a display screen.
(function () {
    const { t } = I18N;
    const R = StatusRules;
    const { LOCALE } = R;
    const REFRESH_MS = 5 * 60 * 1000;
    const PARTS = [...R.PARTS, 'news'];
    const TONE_COLOURS = { green: '#4CC38A', yellow: '#F2A93B', orange: '#FF8A3D', red: '#FF5D5D', active: '#F2A93B', neutral: '#7FB2FF', na: '#76818E' };
    const WATER = '#5FD4E6';
    const HEAT = { shape: 'triangle', colour: '#D29BFF', radius: 6 };
    const QUAKE = '#FF5D5D';
    const MIN_SENSORS = 2;  // a district's air value needs at least this many sensors

    const $ = id => document.getElementById(id);
    const el = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    };
    const httpsOnly = href => { try { return new URL(href).protocol === 'https:' ? href : '#'; } catch { return '#'; } };
    const clock = (ms, opts) => new Date(ms).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Sofia', ...opts });

    let data = null;
    let shapes = [];
    let nextAt = 0;
    let map, focus;
    const layers = {};
    const visible = new Set(['air', 'heating', 'water', 'quakes']);

    // --- Wall mode ---------------------------------------------------------------------------
    const params = new URLSearchParams(location.search);
    if (params.get('wall') === '1') document.body.classList.add('ow-wall');
    const fullBtn = $('ow-full');
    fullBtn.addEventListener('click', async () => {
        const on = !document.body.classList.contains('ow-wall');
        if (on && document.documentElement.requestFullscreen && !document.fullscreenElement) {
            try { await document.documentElement.requestFullscreen(); } catch { /* still switch the layout */ }
        } else if (!on && document.fullscreenElement) {
            await document.exitFullscreen().catch(() => {});
        }
        setWall(on);
    });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) setWall(params.get('wall') === '1'); });
    function setWall(on) {
        document.body.classList.toggle('ow-wall', on);
        fullBtn.setAttribute('aria-pressed', String(on));
        fullBtn.querySelector('span').textContent = on ? t('Изход') : t('Цял екран');
        setTimeout(() => map && map.invalidateSize(), 50);
    }

    // --- Clocks ------------------------------------------------------------------------------
    function tick() {
        const now = Date.now();
        $('ow-time').textContent = clock(now, { second: '2-digit' });
        $('ow-date').textContent = new Date(now).toLocaleDateString(LOCALE, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Sofia' });
        $('ow-utc').textContent = new Date(now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
        const left = Math.max(0, nextAt - now);
        $('ow-next').textContent = nextAt ? `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}` : '--:--';
    }
    setInterval(tick, 1000);
    tick();

    // --- Grading (same rules as the homepage) -------------------------------------------------
    const failed = () => ({ tone: 'na', value: t('Няма данни'), note: t('източникът не отговаря') });

    function indicators(d) {
        const out = [];
        const w = d.weather;
        out.push(['01', 'Времето', w.ok ? { tone: 'neutral', value: `${w.temp}°C`, note: t(R.WEATHER_CODES[w.code] || 'Няма данни') + ` · ${t('вятър {v} км/ч', { v: w.wind })}` } : failed()]);

        const wr = d.warnings;
        out.push(['02', 'Опасно време', !wr.ok ? failed() : !wr.items.length ? { tone: 'green', value: t('Няма'), note: t('зелен код') } : {
            tone: R.warningTone(wr.items), value: t(R.LEVELS[wr.items[0].level][1]),
            note: wr.items[0].active ? wr.items[0].event : `${wr.items[0].event} · ${t('от {from}', { from: R.when(wr.items[0].onset) })}`
        }]);

        const q = d.earthquakes;
        const last = q.ok && q.items[0];
        out.push(['03', 'Земетресения', !q.ok ? failed() : !last ? { tone: 'green', value: t('Няма'), note: t('до {radius} км, {days} дни', { radius: q.radiusKm || 50, days: q.days || 30 }) } : {
            tone: R.quakeTone(q.items), value: `M${last.mag.toFixed(1)}`, note: t('{ago} · {km} км', { ago: R.ago(last.time), km: last.km })
        }]);

        const a = d.air;
        if (a.ok) {
            const pm = R.median(a.sensors.map(s => s[2]));
            const [, tone, band] = R.airBand(pm);
            out.push(['04', 'Въздух', { tone, value: t(band), note: t('PM2.5 {v} µg/m³ · {n} сензора', { v: pm, n: a.sensors.length }) }]);
        } else out.push(['04', 'Въздух', failed()]);

        const r = d.radiation;
        const readings = r.ok ? r.sofia.filter(s => s.value !== null) : [];
        if (readings.length) {
            const top = Math.max(...readings.map(s => s.value));
            const tone = R.radiationTone(top);
            out.push(['05', 'Радиация', { tone, value: `${top.toFixed(2)} µSv/h`, note: tone === 'green' ? t('в границите на естествения фон') : t('над естествения фон') }]);
        } else out.push(['05', 'Радиация', failed()]);

        const wa = d.water;
        out.push(['06', 'Вода', !wa.ok ? failed() : {
            tone: wa.current.length ? 'active' : 'green',
            value: wa.current.length ? t(wa.current.length === 1 ? '{n} спиране' : '{n} спирания', { n: wa.current.length }) : t('Няма спирания'),
            note: wa.planned.length ? t('+ {n} планирани', { n: wa.planned.length }) : t('в момента')
        }]);

        const h = d.heating;
        out.push(['07', 'Топлофикация', !h.ok ? failed() : {
            tone: h.items.length ? 'active' : 'green',
            value: h.items.length ? t('{n} активни', { n: h.items.length }) : t('Няма'), note: t('аварии и ремонти')
        }]);
        return out;
    }

    // --- Render ------------------------------------------------------------------------------
    function render() {
        const list = indicators(data);
        const tones = list.map(([, , x]) => x.tone);
        const level = R.levelOf(tones);

        const lv = $('ow-level');
        lv.className = `ow-level tone-${R.LEVEL_TONES[level]}`;
        lv.querySelector('.ow-level-code').textContent = t('Ниво {level}', { level });
        lv.querySelector('.ow-level-word').textContent = t(R.ASSESSMENT[level]);
        const bar = $('ow-readiness');
        [...bar.children].forEach((seg, i) => { seg.className = i < level ? `on tone-${R.LEVEL_TONES[level]}` : ''; });
        bar.setAttribute('aria-label', t('Ниво {level} от 4', { level }));

        $('ow-tiles').replaceChildren(...list.map(([code, label, x]) => {
            const tile = el('div', `ow-tile tone-${x.tone}`);
            const main = el('div', 'ow-tile-main');
            main.append(el('span', 'ow-tile-label', t(label)), el('span', 'ow-tile-note', x.note || ''));
            const side = el('div', 'ow-tile-side');
            side.append(el('span', 'ow-tile-value', x.value), el('span', 'status-tag', t(R.TAGS[x.tone] || R.TAGS.neutral)));
            tile.append(el('span', 'ow-tile-code', code), main, side);
            return tile;
        }));
        const ok = tones.filter(x => x === 'green').length;
        $('ow-ind-count').textContent = t('{ok}/{n} в норма · {time}', { ok, n: tones.length, time: clock(data.generated) });

        renderRadiation();
        renderMap();
        renderEvents();
        renderMatrix();
        renderOfficial();
        renderTicker();
    }

    function renderRadiation() {
        const r = data.radiation;
        const box = $('ow-rad');
        if (!r.ok) { box.replaceChildren(el('p', 'ow-empty', t('Няма данни'))); return; }
        const [, natural] = R.RADIATION_NATURAL;
        const max = Math.max(0.5, ...r.sofia.map(s => s.value || 0));
        const rows = r.sofia.map(s => {
            const row = el('div', 'ow-rad-row');
            const bar = el('span', 'ow-rad-bar');
            if (s.value !== null) {
                const fill = el('i');
                fill.style.width = `${(s.value / max) * 100}%`;
                fill.style.background = TONE_COLOURS[R.radiationTone(s.value)];
                bar.append(fill);
            }
            const limit = el('b');
            limit.style.left = `${(natural / max) * 100}%`;
            bar.append(limit);
            row.append(el('span', 'ow-rad-name', I18N.text(s.name)), bar, el('span', 'ow-rad-val', s.value === null ? '–' : s.value.toFixed(2)));
            return row;
        });
        const foot = el('div', 'ow-rad-foot');
        const key = el('span');
        key.append(el('b'), document.createTextNode(t('горна граница на естествения фон ({v} µSv/h)', { v: natural.toFixed(2) })));
        foot.append(key, el('span', '', r.updated ? t('бюлетин {time}', { time: R.when(r.updated) }) : ''));
        box.replaceChildren(...rows, foot);
    }

    // --- Map ---------------------------------------------------------------------------------
    function buildMap() {
        map = L.map('ow-map', { renderer: MapStyle.renderer(), zoomSnap: 0.25, attributionControl: true }).setView(MapStyle.SOFIA, 11.5);
        MapStyle.basemap(map);
        layers.districts = L.layerGroup(shapes.map(shape =>
            L.polygon(shape.polygons.map(p => p.map(r => r.map(([lng, lat]) => [lat, lng]))),
                { color: '#2A323C', weight: 1, fill: false, interactive: false }))).addTo(map);
        layers.water = L.layerGroup();
        layers.air = L.layerGroup();
        layers.heating = L.layerGroup();
        layers.quakes = L.layerGroup();

        const defs = [
            ['air', 'Въздух (PM2.5)'], ['heating', 'Топлофикация'], ['water', 'Вода'], ['quakes', 'Земетресения']
        ];
        $('ow-layers').replaceChildren(...defs.map(([key, label]) => {
            const b = el('button', visible.has(key) ? 'on' : '', t(label));
            b.type = 'button';
            b.setAttribute('aria-pressed', String(visible.has(key)));
            b.addEventListener('click', () => {
                if (visible.has(key)) visible.delete(key); else visible.add(key);
                b.classList.toggle('on', visible.has(key));
                b.setAttribute('aria-pressed', String(visible.has(key)));
                syncLayers();
            });
            return b;
        }));
        buildLegend();
    }

    function syncLayers() {
        ['water', 'air', 'heating', 'quakes'].forEach(k => {
            if (visible.has(k)) layers[k].addTo(map); else map.removeLayer(layers[k]);
        });
        if (focus) focus.bringToFront();
    }

    function buildLegend() {
        const item = (swatch, text) => {
            const s = el('span', 'ow-legend-item');
            s.append(swatch, document.createTextNode(text));
            return s;
        };
        const dot = colour => { const i = el('i', 'ow-dot'); i.style.background = colour; return i; };
        const items = [
            el('span', 'ow-legend-title', t('PM2.5')),
            ...[['green', 'добро'], ['yellow', 'умерено'], ['orange', 'лошо'], ['red', 'много лошо']].map(([tone, label]) => item(dot(TONE_COLOURS[tone]), t(label))),
            el('span', 'ow-legend-sep'),
            item(MapStyle.swatch(HEAT), t('авария/ремонт на топлофикация')),
            item((() => { const i = el('i', 'ow-area'); return i; })(), t('район със спряна вода')),
            item((() => { const i = el('i', 'ow-ring'); return i; })(), t('земетресение'))
        ];
        $('ow-legend').replaceChildren(...items);
    }

    function renderMap() {
        Object.values(layers).forEach(g => g !== layers.districts && g.clearLayers());

        // Water: no coordinates in the source, so the districts with an outage are shaded
        if (data.water.ok) {
            const count = {};
            data.water.current.forEach(x => { if (x.district) count[x.district] = (count[x.district] || 0) + 1; });
            shapes.forEach(shape => {
                const n = count[shape.name];
                if (!n) return;
                L.polygon(shape.polygons.map(p => p.map(r => r.map(([lng, lat]) => [lat, lng]))),
                    { color: WATER, weight: 1.2, dashArray: '4 4', fillColor: WATER, fillOpacity: 0.14 })
                    .bindTooltip(`${I18N.district(shape.name)}<br>${t(n === 1 ? '{n} спиране на водата' : '{n} спирания на водата', { n })}`, { sticky: true, className: 'ri-leaflet-tip' })
                    .addTo(layers.water);
            });
        }

        if (data.air.ok) {
            data.air.sensors.forEach(([lat, lng, pm25, pm10]) => {
                const [, tone, band] = R.airBand(pm25);
                L.circleMarker([lat, lng], { radius: 4.5, weight: 1, color: '#0A0C0F', fillColor: TONE_COLOURS[tone], fillOpacity: 0.9 })
                    .bindTooltip(`PM2.5 <strong>${pm25}</strong> µg/m³ · ${t(band)}${pm10 !== null ? `<br>PM10 ${pm10} µg/m³` : ''}`, { className: 'ri-leaflet-tip' })
                    .addTo(layers.air);
            });
        }

        if (data.heating.ok) {
            data.heating.items.filter(x => x.lat).forEach(x => {
                const m = MapStyle.marker(HEAT, [x.lat, x.lng]);
                m.bindPopup(() => {
                    const div = el('div');
                    div.append(el('div', 'popup-kind', t('Топлофикация')), el('strong', '', x.name));
                    if (x.addresses) div.append(el('div', '', x.addresses));
                    div.append(el('div', 'popup-coords', `${t('от {from}', { from: R.when(x.from) })}${x.until ? ' · ' + t('до {until}', { until: R.when(x.until) }) : ''}`));
                    return div;
                });
                m.addTo(layers.heating);
            });
        }

        if (data.earthquakes.ok) {
            data.earthquakes.items.filter(e => e.lat).forEach(e => {
                const fresh = Date.now() - e.time < 86400e3;
                L.circleMarker([e.lat, e.lng], { radius: 4 + e.mag * 3, weight: 2, color: QUAKE, fillColor: QUAKE, fillOpacity: fresh ? 0.35 : 0.08, className: fresh ? 'ow-pulse' : '' })
                    .bindTooltip(`M${e.mag.toFixed(1)} · ${e.region}<br>${R.when(e.time)} · ${t('дълбочина {depth} км', { depth: e.depth })}`, { className: 'ri-leaflet-tip' })
                    .addTo(layers.quakes);
            });
        }
        syncLayers();
    }

    // --- Event log ---------------------------------------------------------------------------
    function events() {
        const list = [];
        const d = data;
        if (d.warnings.ok) d.warnings.items.forEach(x => list.push({
            time: x.onset, src: t('МЕТЕО'), tone: R.LEVELS[x.level][0],
            title: `${t(R.LEVELS[x.level][1])}: ${x.event}`,
            sub: x.active ? t('В сила до {until}', { until: R.when(x.expires) }) : t('От {from} до {until}', { from: R.when(x.onset), until: R.when(x.expires) })
        }));
        if (d.earthquakes.ok) d.earthquakes.items.forEach(e => list.push({
            time: e.time, src: 'EMSC', tone: e.mag >= 4.5 ? 'red' : e.mag >= 3.5 ? 'yellow' : 'neutral',
            title: `M${e.mag.toFixed(1)} · ${e.region}`, sub: t('{km} км от центъра · дълбочина {depth} км', { km: e.km, depth: e.depth }),
            at: e.lat ? [e.lat, e.lng] : null
        }));
        if (d.water.ok) d.water.current.forEach(x => list.push({
            time: x.start, src: t('ВиК'), tone: 'water',
            title: `${I18N.text(x.type)}${x.district ? ' · ' + I18N.districtName(x.district) : ''}`,
            sub: `${x.location}${x.until ? t(' · до {until}', { until: x.until }) : ''}`, district: x.district
        }));
        if (d.heating.ok) d.heating.items.forEach(x => list.push({
            time: x.from, src: t('ТОПЛО'), tone: 'heat', title: x.name, sub: x.addresses.replace(/\s+/g, ' ').trim(),
            at: x.lat ? [x.lat, x.lng] : null
        }));
        return list.filter(e => e.time).sort((a, b) => b.time - a.time);
    }

    function renderEvents() {
        const list = events();
        $('ow-log-count').textContent = t('{n} записа', { n: list.length });
        if (!list.length) { $('ow-events').replaceChildren(el('li', 'ow-empty', t('Няма активни събития.'))); return; }
        $('ow-events').replaceChildren(...list.slice(0, 120).map(e => {
            const li = el('li', `ow-event ev-${e.tone}`);
            const time = el('div', 'ow-event-time');
            time.append(el('span', '', clock(e.time)), el('span', 'ow-event-day', new Date(e.time).toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', timeZone: 'Europe/Sofia' })));
            const body = el('div', 'ow-event-body');
            body.append(el('span', 'ow-event-src', e.src), el('span', 'ow-event-title', e.title));
            if (e.sub) body.append(el('span', 'ow-event-sub', e.sub));
            li.append(time, body);
            const target = e.at || e.district;
            if (target) {
                li.tabIndex = 0;
                li.classList.add('ow-go');
                const go = () => {
                    if (e.at) map.flyTo(e.at, 15, { duration: 0.8 });
                    else {
                        const i = SofiaDistrict.list.findIndex(x => x.name === e.district);
                        if (i >= 0) SofiaDistrict.set(SofiaDistrict.list[i].slug);
                    }
                    if (window.innerWidth < 1200) $('ow-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
                };
                li.addEventListener('click', go);
                li.addEventListener('keydown', ev => { if (ev.key === 'Enter') go(); });
            }
            return li;
        }));
    }

    // --- District matrix -----------------------------------------------------------------------
    function renderMatrix() {
        const d = data;
        const current = SofiaDistrict.get();
        $('ow-cells').replaceChildren(...SofiaDistrict.list.map((dist, i) => {
            const shape = shapes[i];
            const water = d.water.ok ? d.water.current.filter(x => x.district === dist.name).length : null;
            const heat = d.heating.ok ? d.heating.items.filter(x => x.lat && SofiaDistrict.contains(shape, x.lat, x.lng)).length : null;
            const sensors = d.air.ok ? d.air.sensors.filter(([lat, lng]) => SofiaDistrict.contains(shape, lat, lng)) : [];
            const pm = sensors.length >= MIN_SENSORS ? R.median(sensors.map(s => s[2])) : null;
            const airTone = pm === null ? null : R.airBand(pm)[1];
            const tone = airTone && R.SEVERITY[airTone] ? airTone : (water || heat) ? 'active' : pm === null ? 'na' : 'green';
            const cell = el('button', `ow-cell tone-${tone}${current && current.slug === dist.slug ? ' on' : ''}`);
            cell.type = 'button';
            cell.append(el('span', 'ow-cell-name', I18N.districtName(dist.name)));
            const nums = el('span', 'ow-cell-nums');
            const n = (label, v, cls) => {
                const s = el('span', `ow-n ${cls}${v ? ' hot' : ''}`);
                s.append(el('small', '', label), document.createTextNode(v === null ? '–' : String(v)));
                return s;
            };
            nums.append(n(t('в'), water, 'w'), n(t('т'), heat, 'h'), n('PM', pm === null ? null : Math.round(pm), 'p'));
            cell.append(nums);
            cell.title = `${I18N.district(dist.name)} · ${t('вода')}: ${water ?? '–'} · ${t('топлофикация')}: ${heat ?? '–'} · PM2.5: ${pm ?? t('няма достатъчно сензори')}`;
            cell.addEventListener('click', () => SofiaDistrict.set(current && current.slug === dist.slug ? '' : dist.slug));
            return cell;
        }));
    }

    function renderOfficial() {
        const n = data.news;
        if (!n.ok || !n.official.length) { $('ow-official').replaceChildren(el('li', 'ow-empty', t('Няма данни'))); return; }
        $('ow-official').replaceChildren(...n.official.slice(0, 12).map(x => {
            const li = el('li');
            const meta = el('span', 'ow-news-meta', `${new Date(x.date).toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', timeZone: 'UTC' })} · ${I18N.text(x.source)}`);
            const a = el('a', '', x.title);
            a.href = httpsOnly(x.url);
            a.target = '_blank';
            a.rel = 'noopener';
            li.append(meta, a);
            return li;
        }));
    }

    function renderTicker() {
        const n = data.news;
        const run = $('ow-ticker');
        if (!n.ok || !n.latest.length) { run.replaceChildren(el('span', 'ow-empty', t('Няма данни'))); return; }
        const items = n.latest.slice(0, 12).map(x => {
            const a = el('a', 'ow-tick');
            a.href = httpsOnly(x.url);
            a.target = '_blank';
            a.rel = 'noopener';
            a.append(el('span', 'ow-tick-time', clock(x.date)), document.createTextNode(x.title));
            return a;
        });
        // Two copies back to back so the loop is seamless
        run.replaceChildren(...items, ...items.map(a => { const c = a.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.tabIndex = -1; return c; }));
        run.style.animationDuration = `${Math.max(60, items.length * 9)}s`;
    }

    // --- Selection ---------------------------------------------------------------------------
    function select(fit) {
        const d = SofiaDistrict.get();
        if (focus) { map.removeLayer(focus); focus = null; }
        if (d) {
            focus = MapStyle.districtOverlay(shapes[d.index]).addTo(map);
            if (fit) map.fitBounds(focus.getBounds(), { padding: [24, 24] });
        } else if (fit) {
            map.setView(MapStyle.SOFIA, 11.5);
        }
        if (data) renderMatrix();
    }

    // --- Load --------------------------------------------------------------------------------
    async function load() {
        const [results, weather] = await Promise.all([Promise.all(PARTS.map(R.loadPart)), R.loadWeather()]);
        nextAt = Date.now() + REFRESH_MS;
        if (results.every(r => !r.ok) && data) return;  // keep showing the last good picture
        data = Object.fromEntries(PARTS.map((p, i) => [p, results[i]]));
        data.weather = weather;
        data.generated = Math.min(...results.filter(r => r.ok).map(r => r.generated), Date.now());
        render();
    }

    async function init() {
        shapes = await SofiaDistrict.shapes().catch(() => []);
        buildMap();
        SofiaDistrict.onChange(() => select(true));
        select(!!SofiaDistrict.get());
        await load();
        setInterval(load, REFRESH_MS);
    }

    init();
})();
