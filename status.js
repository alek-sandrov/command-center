// Live city status panel on the homepage. Weather comes straight from Open-Meteo; everything
// else from /api/status (functions/api/status.js).
// Water, heating and air follow the district chosen in the navbar (district.js);
// weather, earthquakes and weather warnings are city-wide.

const REFRESH_MS = 10 * 60 * 1000;
const PARTS = ['warnings', 'earthquakes', 'air', 'water', 'heating'];
const LEVELS = { 2: ['yellow', 'Жълт код'], 3: ['orange', 'Оранжев код'], 4: ['red', 'Червен код'] };
// European Air Quality Index bands for PM2.5 (µg/m³)
const AIR_BANDS = [
    [10, 'green', 'Добро'], [20, 'green', 'Задоволително'], [25, 'yellow', 'Умерено'],
    [50, 'orange', 'Лошо'], [75, 'red', 'Много лошо'], [Infinity, 'red', 'Изключително лошо']
];
const MIN_DISTRICT_SENSORS = 3;
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=42.6977&longitude=23.3219' +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m' +
    '&wind_speed_unit=kmh&timezone=auto';
// WMO weather codes
const WEATHER_CODES = {
    0: 'Ясно', 1: 'Предимно ясно', 2: 'Разкъсана облачност', 3: 'Облачно',
    45: 'Мъгла', 48: 'Мъгла', 51: 'Слаб ръмеж', 53: 'Ръмеж', 55: 'Силен ръмеж',
    61: 'Слаб дъжд', 63: 'Дъжд', 65: 'Силен дъжд', 71: 'Слаб сняг', 73: 'Сняг',
    75: 'Силен снеговалеж', 77: 'Снежни зърна', 80: 'Слаби превалявания', 81: 'Превалявания',
    82: 'Пороен дъжд', 85: 'Слаби снежни превалявания', 86: 'Силни снежни превалявания',
    95: 'Гръмотевична буря', 96: 'Буря с градушка', 99: 'Буря с градушка'
};
const { t } = I18N;
const LOCALE = I18N.lang === 'en' ? 'en-GB' : 'bg-BG';

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

// Links come from other sites via /api/status; only https ones are used, never javascript: and the like
function httpsOnly(href) {
    try { return new URL(href, location.href).protocol === 'https:' ? href : '#'; } catch { return '#'; }
}

function link(href, text) {
    const a = el('a', null, text);
    a.href = httpsOnly(href);
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
}

function ago(ms) {
    const min = Math.round((Date.now() - ms) / 60000);
    if (min < 1) return t('току-що');
    if (min < 60) return t('преди {n} мин', { n: min });
    const h = Math.round(min / 60);
    if (h < 24) return t('преди {n} ч', { n: h });
    const d = Math.round(h / 24);
    return d === 1 ? t('преди 1 ден') : t('преди {n} дни', { n: d });
}

function when(ms) {
    return new Date(ms).toLocaleString(LOCALE, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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

// Tag shown on each indicator row, and how much each tone counts towards the overall assessment
const TAGS = { green: 'Норма', yellow: 'Внимание', orange: 'Опасност', red: 'Тревога', active: 'Активно', neutral: 'Инфо', na: 'Няма данни' };
const SEVERITY = { yellow: 2, orange: 3, red: 4 };
const ASSESSMENT = ['стабилна', 'стабилна', 'повишено внимание', 'опасност', 'тревога'];
const LEVEL_TONES = ['', 'green', 'yellow', 'orange', 'red'];

function tile(key, code, label, { tone = 'neutral', value, note, href }) {
    const t = el(href ? 'a' : 'button', `status-tile tone-${tone}`);
    if (href) {
        t.href = httpsOnly(href);
        t.target = '_blank';
        t.rel = 'noopener';
    } else {
        t.type = 'button';
        t.dataset.key = key;
        t.setAttribute('aria-expanded', 'false');
        t.setAttribute('aria-controls', 'status-detail');
        t.addEventListener('click', () => toggle(key, t));
    }
    const main = el('span', 'status-main');
    main.append(el('span', 'status-label', I18N.t(label)));
    if (note) main.append(el('span', 'status-note', note));
    const side = el('span', 'status-side');
    side.append(el('span', 'status-value', value), el('span', 'status-tag', I18N.t(TAGS[tone] || TAGS.neutral)));
    t.append(el('span', 'status-code', code), main, side);
    t.dataset.tone = tone;
    return t;
}

// The detail panel opens right under the indicator that was clicked (an accordion)
const detailPanel = document.getElementById('status-detail');

function toggle(key, tileEl) {
    document.querySelectorAll('.status-tile.open').forEach(t => {
        t.classList.remove('open');
        t.setAttribute('aria-expanded', 'false');
    });
    if (openTile === key) {
        openTile = null;
        detailPanel.hidden = true;
        return;
    }
    openTile = key;
    tileEl.classList.add('open');
    tileEl.setAttribute('aria-expanded', 'true');
    detailPanel.replaceChildren(...details[key]);
    detailPanel.scrollTop = 0;
    tileEl.after(detailPanel);
    detailPanel.hidden = false;
    detailPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function failed() {
    return { tone: 'na', value: t('Няма данни'), note: t('източникът не отговаря') };
}

function inDistrict(lat, lng) {
    return !shape || (lat !== undefined && SofiaDistrict.contains(shape, lat, lng));
}

function districtLabel() {
    const d = SofiaDistrict.get();
    return d ? I18N.district(d.name) : t('София');
}

function weather(w) {
    if (!w.ok) return failed();
    const sky = t(WEATHER_CODES[w.code] || 'Няма данни');
    details.weather = [
        el('h3', null, t('Времето в София')),
        detailRow(`${w.temp}°C · ${sky}`, t('Усеща се: {v}°C', { v: w.feels })),
        detailRow(t('Влажност: {v}%', { v: w.humidity }), t('Вятър: {v} км/ч', { v: w.wind })),
        detailRow(t('Валежи: {v} мм', { v: w.precip })),
        source(t('Източник: Open-Meteo'))
    ];
    return { tone: 'neutral', value: `${w.temp}°C`, note: sky };
}

function earthquakes(q) {
    if (!q.ok) return failed();
    const radius = q.radiusKm || 50, days = q.days || 30;
    const dayAgo = Date.now() - 86400e3;
    const recent = q.items.filter(e => e.time > dayAgo);
    const last = q.items[0];
    details.quakes = [
        el('h3', null, t('Земетресения до {radius} км от София, последните {days} дни', { radius, days })),
        ...(q.items.length ? q.items.map(e => detailRow(
            `M${e.mag.toFixed(1)} · ${e.region}`,
            t('{when} · {km} км от центъра · дълбочина {depth} км', { when: when(e.time), km: e.km, depth: e.depth }),
            link(e.url, t('Детайли')))) : [el('p', 'status-empty', t('Няма регистрирани земетресения в радиус {radius} км.', { radius }))]),
        source(t('Източник: EMSC (Европейско-средиземноморски сеизмологичен център). Показват се трусове, достатъчно близо до София, за да бъдат усетени.'))
    ];
    if (!last) return { tone: 'green', value: t('Няма'), note: t('до {radius} км, {days} дни', { radius, days }) };
    return {
        tone: recent.some(e => e.mag >= 4.5) ? 'red' : recent.some(e => e.mag >= 3.5) ? 'yellow' : 'green',
        value: `M${last.mag.toFixed(1)}`,
        note: t('{ago} · {km} км', { ago: ago(last.time), km: last.km })
    };
}

function warnings(w) {
    if (!w.ok) return failed();
    details.warnings = [
        el('h3', null, t('Метео предупреждения за София-град')),
        ...(w.items.length ? w.items.map(x => {
            const row = detailRow(`${t(LEVELS[x.level][1])}: ${x.event}`, x.active
                ? t('В сила до {until}', { until: when(x.expires) })
                : t('От {from} до {until}', { from: when(x.onset), until: when(x.expires) }));
            row.classList.add(`level-${LEVELS[x.level][0]}`);
            if (x.description) row.append(el('div', 'status-row-sub', x.description));
            return row;
        }) : [el('p', 'status-empty', t('Няма активни предупреждения (зелен код).'))]),
        source(t('Източник: НИМХ чрез MeteoAlarm. Предупрежденията се издават за цялата област София-град.'))
    ];
    if (!w.items.length) return { tone: 'green', value: t('Няма'), note: t('зелен код') };
    const top = w.items[0];
    return { tone: LEVELS[top.level][0], value: t(LEVELS[top.level][1]), note: top.event };
}

function air(a) {
    if (!a.ok) return failed();
    let sensors = a.sensors.filter(([lat, lng]) => inDistrict(lat, lng));
    let note = '';
    if (shape && sensors.length < MIN_DISTRICT_SENSORS) {
        note = sensors.length
            ? t('В {district} има само {n} активни сензора – показваме стойността за цяла София.', { district: districtLabel(), n: sensors.length })
            : t('В {district} няма активни сензора – показваме стойността за цяла София.', { district: districtLabel() });
        sensors = a.sensors;
    }
    const pm25 = median(sensors.map(s => s[2]));
    const pm10 = median(sensors.map(s => s[3]).filter(v => v !== null));
    const [, tone, band] = AIR_BANDS.find(([max]) => pm25 < max);
    const label = t(band);
    details.air = [
        el('h3', null, t('Качество на въздуха – {place}', { place: note ? t('София') : districtLabel() })),
        ...(note ? [el('p', 'status-empty', note)] : []),
        detailRow(`PM2.5: ${pm25} µg/m³ – ${label}`, t('Фини прахови частици, най-вредни за здравето')),
        detailRow(`PM10: ${pm10 ?? '–'} µg/m³`, t('Прахови частици')),
        source(t('Медиана от {n} граждански сензора на sensor.community. ', { n: sensors.length }),
            'https://maps.sensor.community/#12/42.6977/23.3219', t('Карта на сензорите'))
    ];
    return { tone, value: label, note: `PM2.5 ${pm25} µg/m³` };
}

function water(w) {
    if (!w.ok) return failed();
    const d = SofiaDistrict.get();
    const mine = list => d ? list.filter(x => x.district === d.name) : list;
    const current = mine(w.current), planned = mine(w.planned);
    const row = x => detailRow(`${I18N.text(x.type)}${!d && x.district ? ' · ' + I18N.district(x.district) : ''}`,
        `${x.location}${x.until ? t(' · до {until}', { until: x.until }) : ''}`);
    details.water = [
        el('h3', null, t('Текущи спирания на водата – {place} ({n})', { place: districtLabel(), n: current.length })),
        ...(current.length ? current.map(row) : [el('p', 'status-empty', t('Няма текущи спирания.'))]),
        el('h3', null, t('Планирани спирания ({n})', { n: planned.length })),
        ...(planned.length ? planned.map(row) : [el('p', 'status-empty', t('Няма планирани спирания.'))]),
        ...(I18N.lang === 'en' ? [el('p', 'status-empty', t('Местата и адресите са на български, както ги публикуват източниците.'))] : []),
        source(t('Източник: Софийска вода · '), 'https://www.sofiyskavoda.bg/water-stops', t('Пълна информация и карта'))
    ];
    return {
        tone: current.length ? 'active' : 'green',
        value: current.length ? t(current.length === 1 ? '{n} спиране' : '{n} спирания', { n: current.length }) : t('Няма спирания'),
        note: planned.length ? t('+ {n} планирани', { n: planned.length }) : t('в момента')
    };
}

function heating(h) {
    if (!h.ok) return failed();
    const items = h.items.filter(x => inDistrict(x.lat, x.lng));
    details.heating = [
        el('h3', null, t('Активни аварии и ремонти – {place} ({n})', { place: districtLabel(), n: items.length })),
        ...(items.length ? items.slice(0, 15).map(x => detailRow(x.name, `${x.addresses}${x.until ? t(' · до {until}', { until: when(x.until) }) : ''}`))
            : [el('p', 'status-empty', t('Няма активни аварии и ремонти.'))]),
        ...(items.length > 15 ? [el('p', 'status-empty', t('… и още {n}', { n: items.length - 15 }))] : []),
        source(t('Източник: Топлофикация София · '), 'https://www.toplo.bg/accidents-and-maintenance', t('Карта и пълен списък'))
    ];
    return {
        tone: items.length ? 'active' : 'green',
        value: items.length ? t('{n} активни', { n: items.length }) : t('Няма'),
        note: t('аварии и ремонти')
    };
}

function render() {
    if (!lastData) return;
    const data = lastData;
    details = {};
    const tiles = document.getElementById('status-tiles');
    detailPanel.hidden = true;
    tiles.after(detailPanel);  // park it outside the rows that are about to be replaced
    tiles.replaceChildren(
        tile('weather', '01', 'Времето', weather(data.weather)),
        tile('warnings', '02', 'Опасно време', warnings(data.warnings)),
        tile('quakes', '03', 'Земетресения', earthquakes(data.earthquakes)),
        tile('air', '04', 'Въздух', air(data.air)),
        tile('water', '05', 'Вода', water(data.water)),
        tile('heating', '06', 'Топлофикация', heating(data.heating))
    );
    assess([...tiles.children].map(x => x.dataset.tone), data.generated);
    if (openTile && details[openTile]) {
        const t = tiles.querySelector(`[data-key="${openTile}"]`);
        openTile = null;
        toggle(t.dataset.key, t);
    }
    document.getElementById('status-updated').textContent = t('Обновено {ago}', { ago: ago(data.generated) });
}

// Overall assessment above the indicators: the level follows the most severe indicator
function assess(tones, generated) {
    const level = Math.max(1, ...tones.map(x => SEVERITY[x] || 1));
    const n = tone => tones.filter(x => x === tone).length;
    const warned = tones.filter(x => SEVERITY[x]).length;
    const title = document.getElementById('status-title');
    const word = el('span', `assessment-word level-${level}`, t(ASSESSMENT[level]));
    title.replaceChildren(t('Обстановка: '), word);

    const parts = [t('{ok} от {n} показателя в норма', { ok: n('green'), n: tones.length })];
    if (warned) parts.push(t('{n} с предупреждение', { n: warned }));
    if (n('active')) parts.push(t('{n} с активни събития', { n: n('active') }));
    if (n('na')) parts.push(t('{n} без данни', { n: n('na') }));
    document.getElementById('status-summary').textContent = parts.join(' · ');

    const bar = document.getElementById('readiness');
    [...bar.children].forEach((seg, i) => { seg.className = i < level ? `on tone-${LEVEL_TONES[level]}` : ''; });
    bar.setAttribute('aria-label', t('Ниво {level} от 4', { level }));

    const time = new Date(generated).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Sofia' });
    document.getElementById('status-place').textContent = `${SofiaDistrict.get() ? districtLabel() : t('Цяла София')} · ${t('оценка')} ${time}`;
}

async function loadPart(part) {
    try {
        const res = await fetch(`/api/status?part=${part}&v=3`);
        if (!res.ok) throw new Error(res.status);
        return await res.json();
    } catch {
        return { ok: false, generated: Date.now() };
    }
}

async function loadWeather() {
    try {
        const c = (await (await fetch(WEATHER_URL)).json()).current;
        return {
            ok: true, temp: Math.round(c.temperature_2m), feels: Math.round(c.apparent_temperature),
            humidity: c.relative_humidity_2m, wind: Math.round(c.wind_speed_10m), precip: c.precipitation, code: c.weather_code
        };
    } catch {
        return { ok: false };
    }
}

async function loadStatus() {
    const [results, weatherData] = await Promise.all([Promise.all(PARTS.map(loadPart)), loadWeather()]);
    if (results.every(r => !r.ok)) {
        document.getElementById('status-updated').textContent = t('Неуспешно зареждане на данните. Ще опитаме отново.');
        if (!lastData) return;
    } else {
        lastData = Object.fromEntries(PARTS.map((p, i) => [p, results[i]]));
        lastData.weather = weatherData;
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
