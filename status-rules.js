// Shared rules for the live city status: thresholds, how each source is graded (tone) and the
// overall assessment, plus loading /api/status and the weather. Used by the homepage status panel
// (status.js) and the operations wall (obstanovka.js), so both always grade the same way.
// Loaded after i18n.js.
(function () {
    const { t } = I18N;
    const LOCALE = I18N.lang === 'en' ? 'en-GB' : 'bg-BG';

    const PARTS = ['warnings', 'earthquakes', 'air', 'water', 'heating', 'radiation'];
    // Gamma background (µSv/h). The Nuclear Regulatory Agency gives 0.06–0.40 as the natural range in
    // Bulgaria; above it the tile asks visitors to follow official announcements. The 1 µSv/h step to
    // orange is this site's own, to separate a slight rise from a clear one.
    const RADIATION_NATURAL = [0.06, 0.40];
    const RADIATION_HIGH = 1.0;
    // The bulletin is daily; an older one is flagged as possibly out of date
    const RADIATION_STALE_MS = 48 * 3600e3;
    const LEVELS = { 2: ['yellow', 'Жълт код'], 3: ['orange', 'Оранжев код'], 4: ['red', 'Червен код'] };
    // European Air Quality Index bands for PM2.5 (µg/m³)
    const AIR_BANDS = [
        [10, 'green', 'Добро'], [20, 'green', 'Задоволително'], [25, 'yellow', 'Умерено'],
        [50, 'orange', 'Лошо'], [75, 'red', 'Много лошо'], [Infinity, 'red', 'Изключително лошо']
    ];
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

    // Tag shown for each tone, and how much each tone counts towards the overall assessment
    const TAGS = { green: 'Норма', yellow: 'Внимание', orange: 'Опасност', red: 'Тревога', active: 'Активно', neutral: 'Инфо', na: 'Няма данни' };
    const SEVERITY = { yellow: 2, orange: 3, red: 4 };
    const ASSESSMENT = ['стабилна', 'стабилна', 'повишено внимание', 'опасност', 'тревога'];
    const LEVEL_TONES = ['', 'green', 'yellow', 'orange', 'red'];

    function median(values) {
        if (!values.length) return null;
        const a = [...values].sort((x, y) => x - y);
        const m = a.length >> 1;
        return Math.round((a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2) * 10) / 10;
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

    // Always Sofia time, whatever the visitor's own time zone
    function when(ms) {
        return new Date(ms).toLocaleString(LOCALE, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Sofia' });
    }

    // [upper bound, tone, label] of the air quality band for a PM2.5 value
    const airBand = pm25 => AIR_BANDS.find(([max]) => pm25 < max);

    // Earthquakes in the last 24 hours decide the tone
    function quakeTone(items) {
        const recent = items.filter(e => e.time > Date.now() - 86400e3);
        return recent.some(e => e.mag >= 4.5) ? 'red' : recent.some(e => e.mag >= 3.5) ? 'yellow' : 'green';
    }

    // Items come sorted most severe first
    const warningTone = items => (items.length ? LEVELS[items[0].level][0] : 'green');

    const radiationTone = value => (value > RADIATION_HIGH ? 'orange' : value > RADIATION_NATURAL[1] ? 'yellow' : 'green');

    // Overall level 1-4: follows the most severe indicator
    const levelOf = tones => Math.max(1, ...tones.map(x => SEVERITY[x] || 1));

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

    window.StatusRules = {
        LOCALE, PARTS, RADIATION_NATURAL, RADIATION_HIGH, RADIATION_STALE_MS, LEVELS, AIR_BANDS, WEATHER_CODES,
        TAGS, SEVERITY, ASSESSMENT, LEVEL_TONES,
        median, ago, when, airBand, quakeTone, warningTone, radiationTone, levelOf, loadPart, loadWeather
    };
})();
