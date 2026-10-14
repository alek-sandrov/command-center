// Live city status panel on the homepage. Data comes from /api/status (functions/api/status.js)

const REFRESH_MS = 10 * 60 * 1000;
const LEVELS = { 2: ['yellow', 'Жълт код'], 3: ['orange', 'Оранжев код'], 4: ['red', 'Червен код'] };
// European Air Quality Index bands for PM2.5 (µg/m³)
const AIR_BANDS = [
    [10, 'green', 'Добро'], [20, 'green', 'Задоволително'], [25, 'yellow', 'Умерено'],
    [50, 'orange', 'Лошо'], [75, 'red', 'Много лошо'], [Infinity, 'red', 'Изключително лошо']
];

let openTile = null;
let details = {};

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

function detailRow(title, sub, extra) {
    const row = el('div', 'status-row');
    row.append(el('div', 'status-row-title', title));
    if (sub) row.append(el('div', 'status-row-sub', sub));
    if (extra) row.append(extra);
    return row;
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

function earthquakes(q) {
    if (!q.ok) return failed();
    const dayAgo = Date.now() - 86400e3;
    const recent = q.items.filter(e => e.time > dayAgo);
    const strong = recent.filter(e => e.mag >= 4.5 && e.km <= 150);
    const notable = recent.filter(e => e.mag >= 3.5 && e.km <= 200);
    const last = q.items[0];
    details.quakes = [
        el('h3', null, 'Земетресения до ~350 км от София, последните 7 дни (M2.5+)'),
        ...(q.items.length ? q.items.map(e => detailRow(
            `M${e.mag.toFixed(1)} · ${e.region}`,
            `${when(e.time)} · ${e.km} км от София · дълбочина ${e.depth} км`,
            link(e.url, 'Детайли'))) : [el('p', 'status-empty', 'Няма регистрирани земетресения.')]),
        el('p', 'status-source', 'Източник: EMSC (Европейско-средиземноморски сеизмологичен център)')
    ];
    if (!last) return { tone: 'green', value: 'Няма', note: 'през последните 7 дни' };
    return {
        tone: strong.length ? 'red' : notable.length ? 'yellow' : 'green',
        value: `M${last.mag.toFixed(1)}`,
        note: `${ago(last.time)} · ${last.km} км`
    };
}

function warnings(w) {
    if (!w.ok) return failed();
    details.warnings = [
        el('h3', null, 'Метео предупреждения за София-град'),
        ...(w.items.length ? w.items.map(x => {
            const [, name] = LEVELS[x.level];
            const row = detailRow(`${name}: ${x.event}`, `${x.active ? 'В сила' : 'От ' + when(x.onset)} до ${when(x.expires)}`);
            row.classList.add(`level-${LEVELS[x.level][0]}`);
            if (x.description) row.append(el('div', 'status-row-sub', x.description));
            return row;
        }) : [el('p', 'status-empty', 'Няма активни предупреждения (зелен код).')]),
        el('p', 'status-source', 'Източник: НИМХ чрез MeteoAlarm')
    ];
    if (!w.items.length) return { tone: 'green', value: 'Няма', note: 'зелен код' };
    const top = w.items[0];
    return { tone: LEVELS[top.level][0], value: LEVELS[top.level][1], note: top.event };
}

function air(a) {
    if (!a.ok) return failed();
    const [, tone, label] = AIR_BANDS.find(([max]) => a.pm25 < max);
    details.air = [
        el('h3', null, 'Качество на въздуха – медиана от сензорите до 8 км от центъра'),
        detailRow(`PM2.5: ${a.pm25} µg/m³ – ${label}`, 'Фини прахови частици, най-вредни за здравето'),
        detailRow(`PM10: ${a.pm10 ?? '–'} µg/m³`, 'Прахови частици'),
        el('p', 'status-source', `Данни от ${a.sensors} граждански сензора на sensor.community. `),
    ];
    details.air[details.air.length - 1].append(link('https://maps.sensor.community/#12/42.6977/23.3219', 'Карта на сензорите'));
    return { tone, value: label, note: `PM2.5 ${a.pm25} µg/m³` };
}

function water(w) {
    if (!w.ok) return failed();
    const row = x => detailRow(`${x.type}${x.district ? ' · Район ' + x.district : ''}`,
        `${x.location}${x.until ? ' · до ' + x.until : ''}`);
    details.water = [
        el('h3', null, `Текущи спирания на водата (${w.current.length})`),
        ...(w.current.length ? w.current.map(row) : [el('p', 'status-empty', 'Няма текущи спирания.')]),
        el('h3', null, `Планирани спирания (${w.planned.length})`),
        ...(w.planned.length ? w.planned.map(row) : [el('p', 'status-empty', 'Няма планирани спирания.')]),
        el('p', 'status-source', 'Източник: Софийска вода · ')
    ];
    details.water[details.water.length - 1].append(link('https://www.sofiyskavoda.bg/water-stops', 'Пълна информация и карта'));
    return {
        tone: 'neutral',
        value: `${w.current.length} спирания`,
        note: w.planned.length ? `+ ${w.planned.length} планирани` : 'в момента'
    };
}

function heating(h) {
    if (!h.ok) return failed();
    details.heating = [
        el('h3', null, `Активни аварии и ремонти на топлопреносната мрежа (${h.count}) – най-новите`),
        ...h.items.map(x => detailRow(x.name, `${x.addresses}${x.until ? ' · до ' + when(x.until) : ''}`)),
        el('p', 'status-source', 'Източник: Топлофикация София · ')
    ];
    details.heating[details.heating.length - 1].append(link('https://www.toplo.bg/accidents-and-maintenance', 'Карта и пълен списък'));
    return { tone: 'neutral', value: `${h.count} активни`, note: 'аварии и ремонти' };
}

function render(data) {
    const tiles = document.getElementById('status-tiles');
    details = {};
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

const PARTS = ['warnings', 'earthquakes', 'air', 'water', 'heating'];

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
    const data = Object.fromEntries(PARTS.map((p, i) => [p, results[i]]));
    if (results.every(r => !r.ok)) {
        document.getElementById('status-updated').textContent = 'Неуспешно зареждане на данните. Ще опитаме отново.';
        if (!document.querySelector('.status-tile')) return;
    }
    data.generated = Math.min(...results.map(r => r.generated));
    render(data);
}

loadStatus();
setInterval(loadStatus, REFRESH_MS);
