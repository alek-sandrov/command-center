// Live city status panel on the homepage. Data comes from /api/status (functions/api/status.js).
// Water, heating and air follow the district chosen in the navbar (district.js);
// earthquakes and weather warnings are city-wide.

const REFRESH_MS = 10 * 60 * 1000;
const PARTS = ['warnings', 'earthquakes', 'air', 'water', 'heating'];
const LEVELS = { 2: ['yellow', 'Жълт код'], 3: ['orange', 'Оранжев код'], 4: ['red', 'Червен код'] };
// European Air Quality Index bands for PM2.5 (µg/m³)
const AIR_BANDS = [
    [10, 'green', 'Добро'], [20, 'green', 'Задоволително'], [25, 'yellow', 'Умерено'],
    [50, 'orange', 'Лошо'], [75, 'red', 'Много лошо'], [Infinity, 'red', 'Изключително лошо']
];
const MIN_DISTRICT_SENSORS = 3;

let openTile = null;
let details = {};
let lastData = null;
let shape = null;  // polygons of the selected district, or null for the whole city

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}

function link(href, text) {
    const a = el('a', null, text);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
}

function ago(ms) {
    const min = Math.round((Date.now() - ms) / 60000);
    if (min < 1) return 'току-що';
    if (min < 60) return `преди ${min} мин`;
    const h = Math.round(min / 60);
    if (h < 24) return `преди ${h} ч`;
    const d = Math.round(h / 24);
    return `преди ${d} ${d === 1 ? 'ден' : 'дни'}`;
}

function when(ms) {
    return new Date(ms).toLocaleString('bg-BG', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function median(values) {
    if (!values.length) return null;
    const a = [...values].sort((x, y) => x - y);
    const m = a.length >> 1;
    return Math.round((a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2) * 10) / 10;
}

function detailRow(title, sub, extra) {
    const row = el('div', 'status-row');
    row.append(el('div', 'status-row-title', title));
    if (sub) row.append(el('div', 'status-row-sub', sub));
    if (extra) row.append(extra);
    return row;
}

function source(text, href, linkText) {
    const p = el('p', 'status-source', text);
    if (href) p.append(link(href, linkText));
    return p;
}

function tile(key, icon, label, { tone = 'neutral', value, note, href }) {
    const t = el(href ? 'a' : 'button', `status-tile tone-${tone}`);
    if (href) {
        t.href = href;
        t.target = '_blank';
        t.rel = 'noopener';
    } else {
        t.type = 'button';
        t.dataset.key = key;
        t.addEventListener('click', () => toggle(key, t));
    }
    t.append(el('div', 'status-label', `${icon} ${label}`), el('div', 'status-value', value));
    if (note) t.append(el('div', 'status-note', note));
    return t;
}

function toggle(key, tileEl) {
    const panel = document.getElementById('status-detail');
    document.querySelectorAll('.status-tile.open').forEach(t => t.classList.remove('open'));
    if (openTile === key) {
        openTile = null;
        panel.hidden = true;
        return;
    }
    openTile = key;
    tileEl.classList.add('open');
    panel.replaceChildren(...details[key]);
    panel.hidden = false;
}

function failed() {
    return { tone: 'neutral', value: 'Няма данни', note: 'източникът не отговаря' };
}

function inDistrict(lat, lng) {
    return !shape || (lat !== undefined && SofiaDistrict.contains(shape, lat, lng));
}

function districtLabel() {
    const d = SofiaDistrict.get();
    return d ? `Район ${d.name}` : 'София';
}

function earthquakes(q) {
    if (!q.ok) return failed();
    const radius = q.radiusKm || 50, days = q.days || 30;
    const dayAgo = Date.now() - 86400e3;
    const recent = q.items.filter(e => e.time > dayAgo);
    const last = q.items[0];
    details.quakes = [
        el('h3', null, `Земетресения до ${radius} км от София, последните ${days} дни`),
        ...(q.items.length ? q.items.map(e => detailRow(
            `M${e.mag.toFixed(1)} · ${e.region}`,
            `${when(e.time)} · ${e.km} км от центъра · дълбочина ${e.depth} км`,
            link(e.url, 'Детайли'))) : [el('p', 'status-empty', `Няма регистрирани земетресения в радиус ${radius} км.`)]),
        source('Източник: EMSC (Европейско-средиземноморски сеизмологичен център). Показват се трусове, достатъчно близо до София, за да бъдат усетени.')
    ];
    if (!last) return { tone: 'green', value: 'Няма', note: `до ${radius} км, ${days} дни` };
    return {
        tone: recent.some(e => e.mag >= 4.5) ? 'red' : recent.some(e => e.mag >= 3.5) ? 'yellow' : 'green',
        value: `M${last.mag.toFixed(1)}`,
        note: `${ago(last.time)} · ${last.km} км`
    };
}

function warnings(w) {
    if (!w.ok) return failed();
    details.warnings = [
        el('h3', null, 'Метео предупреждения за София-град'),
        ...(w.items.length ? w.items.map(x => {
            const row = detailRow(`${LEVELS[x.level][1]}: ${x.event}`,
                `${x.active ? 'В сила' : 'От ' + when(x.onset)} до ${when(x.expires)}`);
            row.classList.add(`level-${LEVELS[x.level][0]}`);
            if (x.description) row.append(el('div', 'status-row-sub', x.description));
            return row;
        }) : [el('p', 'status-empty', 'Няма активни предупреждения (зелен код).')]),
        source('Източник: НИМХ чрез MeteoAlarm. Предупрежденията се издават за цялата област София-град.')
    ];
    if (!w.items.length) return { tone: 'green', value: 'Няма', note: 'зелен код' };
    const top = w.items[0];
    return { tone: LEVELS[top.level][0], value: LEVELS[top.level][1], note: top.event };
}

function air(a) {
    if (!a.ok) return failed();
    let sensors = a.sensors.filter(([lat, lng]) => inDistrict(lat, lng));
    let note = '';
    if (shape && sensors.length < MIN_DISTRICT_SENSORS) {
        note = `В ${districtLabel()} има ${sensors.length ? 'само ' + sensors.length : 'няма'} активни сензора – показваме стойността за цяла София.`;
        sensors = a.sensors;
    }
    const pm25 = median(sensors.map(s => s[2]));
    const pm10 = median(sensors.map(s => s[3]).filter(v => v !== null));
    const [, tone, label] = AIR_BANDS.find(([max]) => pm25 < max);
    details.air = [
        el('h3', null, `Качество на въздуха – ${note ? 'София' : districtLabel()}`),
        ...(note ? [el('p', 'status-empty', note)] : []),
        detailRow(`PM2.5: ${pm25} µg/m³ – ${label}`, 'Фини прахови частици, най-вредни за здравето'),
        detailRow(`PM10: ${pm10 ?? '–'} µg/m³`, 'Прахови частици'),
        source(`Медиана от ${sensors.length} граждански сензора на sensor.community. `,
            'https://maps.sensor.community/#12/42.6977/23.3219', 'Карта на сензорите')
    ];
    return { tone, value: label, note: `PM2.5 ${pm25} µg/m³` };
}

function water(w) {
    if (!w.ok) return failed();
    const d = SofiaDistrict.get();
    const mine = list => d ? list.filter(x => x.district === d.name) : list;
    const current = mine(w.current), planned = mine(w.planned);
    const row = x => detailRow(`${x.type}${!d && x.district ? ' · Район ' + x.district : ''}`,
        `${x.location}${x.until ? ' · до ' + x.until : ''}`);
    details.water = [
        el('h3', null, `Текущи спирания на водата – ${districtLabel()} (${current.length})`),
        ...(current.length ? current.map(row) : [el('p', 'status-empty', 'Няма текущи спирания.')]),
        el('h3', null, `Планирани спирания (${planned.length})`),
        ...(planned.length ? planned.map(row) : [el('p', 'status-empty', 'Няма планирани спирания.')]),
        source('Източник: Софийска вода · ', 'https://www.sofiyskavoda.bg/water-stops', 'Пълна информация и карта')
    ];
    return {
        tone: current.length ? 'neutral' : 'green',
        value: current.length ? `${current.length} ${current.length === 1 ? 'спиране' : 'спирания'}` : 'Няма спирания',
        note: planned.length ? `+ ${planned.length} планирани` : 'в момента'
    };
}

function heating(h) {
    if (!h.ok) return failed();
    const items = h.items.filter(x => inDistrict(x.lat, x.lng));
    details.heating = [
        el('h3', null, `Активни аварии и ремонти – ${districtLabel()} (${items.length})`),
        ...(items.length ? items.slice(0, 15).map(x => detailRow(x.name, `${x.addresses}${x.until ? ' · до ' + when(x.until) : ''}`))
            : [el('p', 'status-empty', 'Няма активни аварии и ремонти.')]),
        ...(items.length > 15 ? [el('p', 'status-empty', `… и още ${items.length - 15}`)] : []),
        source('Източник: Топлофикация София · ', 'https://www.toplo.bg/accidents-and-maintenance', 'Карта и пълен списък')
    ];
    return {
        tone: items.length ? 'neutral' : 'green',
        value: items.length ? `${items.length} активни` : 'Няма',
        note: 'аварии и ремонти'
    };
}

function render() {
    if (!lastData) return;
    const data = lastData;
    details = {};
    document.getElementById('status-title').textContent = `📡 Състояние – ${SofiaDistrict.get() ? districtLabel() : 'цяла София'}`;
    const tiles = document.getElementById('status-tiles');
    tiles.replaceChildren(
        tile('warnings', '⚠️', 'Метео предупреждения', warnings(data.warnings)),
        tile('quakes', '🌍', 'Земетресения', earthquakes(data.earthquakes)),
        tile('air', '🌫️', 'Въздух', air(data.air)),
        tile('water', '🚰', 'Вода', water(data.water)),
        tile('heating', '🔥', 'Топлофикация', heating(data.heating)),
        tile('power', '⚡', 'Ток', { value: 'ЕРМ Запад', note: 'прекъсвания ↗', href: 'https://ermzapad.bg/bg/za-klienta/prekusvania/' })
    );
    if (openTile && details[openTile]) {
        const t = tiles.querySelector(`[data-key="${openTile}"]`);
        openTile = null;
        toggle(t.dataset.key, t);
    }
    document.getElementById('status-updated').textContent = `Обновено ${ago(data.generated)}`;
}

async function loadPart(part) {
    try {
        const res = await fetch(`/api/status?part=${part}`);
        if (!res.ok) throw new Error(res.status);
        return await res.json();
    } catch {
        return { ok: false, generated: Date.now() };
    }
}

async function loadStatus() {
    const results = await Promise.all(PARTS.map(loadPart));
    if (results.every(r => !r.ok)) {
        document.getElementById('status-updated').textContent = 'Неуспешно зареждане на данните. Ще опитаме отново.';
        if (!lastData) return;
    } else {
        lastData = Object.fromEntries(PARTS.map((p, i) => [p, results[i]]));
        lastData.generated = Math.min(...results.map(r => r.generated));
    }
    render();
}

async function useDistrict(d) {
    shape = d ? (await SofiaDistrict.shapes())[d.index] : null;
    render();
}

SofiaDistrict.onChange(useDistrict);
useDistrict(SofiaDistrict.get()).catch(() => {}).finally(loadStatus);
setInterval(loadStatus, REFRESH_MS);
