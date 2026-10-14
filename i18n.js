// Bulgarian / English switch. Bulgarian is the default and is what the HTML and scripts are
// written in; English comes from the dictionary below, keyed by the Bulgarian text.
//   I18N.t('Текст с {n} неща', { n: 3 })  - translate a script string (with {placeholders})
//   I18N.text(s)                          - translate a fixed label if known, else return as is
//   I18N.district('Слатина')               - "Район Слатина" / "Slatina district"
// Content from official sources (news titles, outage addresses, place names) is not translated.
(function () {
    const KEY = 'sp-lang';

    const DISTRICTS = {
        'Банкя': 'Bankya', 'Витоша': 'Vitosha', 'Връбница': 'Vrabnitsa', 'Възраждане': 'Vazrazhdane',
        'Изгрев': 'Izgrev', 'Илинден': 'Ilinden', 'Искър': 'Iskar', 'Красна поляна': 'Krasna Polyana',
        'Красно село': 'Krasno Selo', 'Кремиковци': 'Kremikovtsi', 'Лозенец': 'Lozenets', 'Люлин': 'Lyulin',
        'Младост': 'Mladost', 'Надежда': 'Nadezhda', 'Нови Искър': 'Novi Iskar', 'Оборище': 'Oborishte',
        'Овча купел': 'Ovcha Kupel', 'Панчарево': 'Pancharevo', 'Подуяне': 'Poduyane', 'Сердика': 'Serdika',
        'Слатина': 'Slatina', 'Средец': 'Sredets', 'Студентски': 'Studentski', 'Триадица': 'Triaditsa'
    };

    const EN = {
        // Navigation, page titles, footer
        'Начало': 'Home', 'Карти': 'Maps', 'Сигнали': 'Sirens', 'Документи': 'Documents',
        'Карти - sofia-prepping.com': 'Maps - sofia-prepping.com',
        'Документи - sofia-prepping.com': 'Documents - sofia-prepping.com',
        'Сигнали - sofia-prepping.com': 'Sirens - sofia-prepping.com',
        'Райони - sofia-prepping.com': 'Districts - sofia-prepping.com',
        'Бомбоубежища - sofia-prepping.com': 'Bomb shelters - sofia-prepping.com',
        'Чешмите - sofia-prepping.com': 'Drinking fountains - sofia-prepping.com',
        'Интерактивна карта - sofia-prepping.com': 'Interactive map - sofia-prepping.com',
        'sofia-prepping.com - София': 'sofia-prepping.com - Sofia',
        'sofia-prepping.com - София · обновено:': 'sofia-prepping.com - Sofia · updated:',
        '← Карти': '← Maps', '← Документи': '← Documents', 'Към началото': 'Back to top',
        'Зареждане...': 'Loading...',
        '📍 Цяла София': '📍 All of Sofia', 'Изберете район': 'Choose a district',

        // Homepage
        '📡 Състояние – цяла София': '📡 Status – all of Sofia',
        '📢 Официални съобщения': '📢 Official announcements',
        'Покажи още': 'Show more',
        'От ГДПБЗН (пожарна безопасност и защита на населението) и Столична община (раздел „Сигурност“). Съобщенията се показват дословно с връзка към оригинала.':
            'From the Fire Safety and Civil Protection Directorate (ГДПБЗН) and Sofia Municipality (“Security” section). Announcements are shown in Bulgarian exactly as published, with a link to the original.',
        '🌤️ Времето - София': '🌤️ Weather - Sofia',
        '⚡ Бързи Линкове': '⚡ Quick links',
        'Интерактивна карта': 'Interactive map', 'Бомбоубежища': 'Bomb shelters', 'Чешмите': 'Drinking fountains',
        '📰 Новини': '📰 News',
        '⚠️ Аварии и мониторинг': '⚠️ Outages and monitoring',
        'Радиация (EURDEP)': 'Radiation (EURDEP)', 'Софийска вода': 'Sofiyska Voda',
        'ЕРМ Запад': 'ERM Zapad', 'Топлофикация': 'District heating',
        '📹 Публични Камери': '📹 Public cameras', 'Орлов Мост': 'Orlov Most', 'ж.к. Лагера': 'Lagera',

        // Sirens page
        'Сигнали за тревога': 'Alarm signals',
        '🔊 Чуйте как звучат сирените': '🔊 Hear what the sirens sound like',
        'Национален сигнал за тревога': 'National alarm signal',
        'Вой, който скача между 700 и 1000 Hz на всеки 8 секунди, 3 минути. При бедствие.':
            'A wail jumping between 700 and 1000 Hz every 8 seconds, for 3 minutes. Used in a disaster.',
        'Край на тревогата': 'End of alarm',
        'Равен тон (450 Hz), 2 минути.': 'Steady tone (450 Hz), 2 minutes.',
        'Въздушна опасност': 'Air raid danger',
        'Плавно вълнообразен вой през 15 секунди, 3 минути.': 'A smooth rising and falling wail every 15 seconds, for 3 minutes.',
        'Отбой от въздушна опасност': 'Air raid all-clear',
        'Тестове: първия работен ден на април и октомври. Сигнал „Въздушна опасност“ звучи и всяка година на 2 юни в 12:00 ч. Източник:':
            'Tests: the first working day of April and October. The “Air raid danger” signal also sounds every year on 2 June at 12:00. Source:',
        'ГДПБЗН': 'ГДПБЗН (Fire Safety and Civil Protection)',
        '📱 BG-ALERT на телефона': '📱 BG-ALERT on your phone',
        'BG-ALERT изпраща предупреждения директно на мобилните телефони в засегнатия район – без приложение и без регистрация. Уверете се, че аварийните известия са включени в настройките на телефона.':
            'BG-ALERT sends warnings straight to mobile phones in the affected area – no app or registration needed. Make sure emergency alerts are turned on in your phone settings.',
        'Настройки → Безопасност и спешни случаи → Безжични сигнали при спешни случаи':
            'Settings → Safety & emergency → Wireless emergency alerts',
        'Настройки → Известия → най-долу „Правителствени сигнали“':
            'Settings → Notifications → at the bottom, “Government alerts”',
        'За тестовите съобщения включете и канала „Тестови сигнали“':
            'To receive test messages, also turn on the “Test alerts” channel',
        'Правила за поведение': 'What to do (official guidance)',

        // Maps
        '🗺️ Интерактивна карта – убежища, вода, евакуация, йод, болници':
            '🗺️ Interactive map – shelters, water, evacuation, iodine, hospitals',
        '🛡️ Бомбоубежища': '🛡️ Bomb shelters', '💧 Чешмите': '💧 Drinking fountains',
        '↗️ Отвори в Google Maps': '↗️ Open in Google Maps',
        'Бомбоубежища в София': 'Bomb shelters in Sofia', 'Чешми в София': 'Drinking fountains in Sofia',
        '📍 Намери най-близкия': '📍 Find the nearest',
        'Покажи всички': 'Show all', 'Скрий всички': 'Hide all',
        'Източници:': 'Sources:',
        'Столична община – отворени данни': 'Sofia Municipality open data',
        '(центрове при бедствия, минерални извори, метро), Google My Maps („Скривалища и ПРУ“, „Чешмите в България 2024“),':
            '(disaster centres, mineral springs, metro), Google My Maps (“Скривалища и ПРУ”, “Чешмите в България 2024”),',
        '(болници, аптеки). Данните се обновяват ежеседмично': '(hospitals, pharmacies). The data is refreshed weekly',
        '. Местоположението ви се използва само в браузъра и не се изпраща никъде.':
            '. Your location is only used in your browser and is never sent anywhere.',
        'Сгради за настаняване': 'Shelter buildings', 'Йодни таблетки': 'Iodine tablets', 'Палатки': 'Tent camps',
        'Минерални извори': 'Mineral springs', 'Метро': 'Metro', 'Болници': 'Hospitals', 'Аптеки': 'Pharmacies',
        '🧭 Маршрут': '🧭 Directions', 'Най-близо до вас': 'Nearest to you', '⏳ Търсене...': '⏳ Locating...',
        'Вие сте тук': 'You are here',
        'Браузърът ви не поддържа определяне на местоположение.': 'Your browser does not support location.',
        'Не успяхме да определим местоположението ви. Проверете дали сте разрешили достъп до локацията.':
            'We could not find your location. Please check that location access is allowed.',
        'Неуспешно зареждане на данните.': 'Could not load the data.',
        ' (последно: {date})': ' (last: {date})',
        'Показани са обектите в {district}. „Намери най-близкия“ търси в цяла София.':
            'Showing places in {district}. “Find the nearest” searches all of Sofia.',
        'Картата е центрирана върху {district}.': 'The map is centred on {district}.',
        '{n} м': '{n} m', '{n} км': '{n} km',

        // Map point categories (fixed labels from the open data)
        'Учебно заведение': 'School', 'Детска градина': 'Kindergarten', 'Детска ясла': 'Nursery',
        'Административна сграда': 'Administrative building', 'Парк': 'Park', 'Читалище': 'Community centre (chitalishte)',
        'Спортно съоръжение': 'Sports facility', 'Лечебно заведение': 'Medical facility', 'Религиозен храм': 'Place of worship',
        'Сграда за култура': 'Cultural building', 'Палатков лагер': 'Tent camp',
        'Пункт за раздаване на йодни таблетки': 'Iodine tablet distribution point',
        'Основен пункт за доставка на йодни таблетки': 'Main iodine tablet supply point',
        'Резервен пункт за доставка на йодни таблетки': 'Backup iodine tablet supply point',
        'Скривалище': 'Shelter', 'Противорадиационно укритие': 'Anti-radiation shelter',
        'I-ва категория': 'Category I', 'II-ра категория': 'Category II',
        'Метростанция': 'Metro station', 'Минерален извор': 'Mineral spring',
        'Сондажни минерални водоизточници': 'Mineral water borehole', 'Естествени минерални водоизточници': 'Natural mineral spring',
        'Питейна вода (ВиК)': 'Drinking water (mains)', 'Изворна вода': 'Spring water', 'Минерална вода': 'Mineral water',
        'Гореща минерална вода': 'Hot mineral water', 'Работи': 'Working', 'Не работи': 'Not working',
        'Няма данни дали работи': 'Unknown whether working', 'Болница': 'Hospital', 'Аптека': 'Pharmacy',
        'Спешно отделение': 'Emergency department', 'Денонощна': 'Open 24/7', 'Чешма': 'Fountain',

        // Documents and district PDF maps
        '📋 Планове за защита на населението на Столична Община': '📋 Sofia Municipality civil protection plans',
        'СО - План за защита при наводнения': 'Sofia Municipality – flood protection plan',
        'СО - План за защита при земетресения': 'Sofia Municipality – earthquake protection plan',
        'СО - План за защита при ядрени и радиационни заплахи': 'Sofia Municipality – nuclear and radiation protection plan',
        '🗂️ Пунктове по райони': '🗂️ Protection points by district',
        '🛡️ PDF с пунктове за защита на населението при бедствия и аварии': '🛡️ PDF maps of civil protection points',
        '🛡️ Пунктове за защита на населението при бедствия и аварии': '🛡️ Civil protection points for disasters and accidents',
        'Пунктове по райони': 'Protection points by district', 'Пунктове за защита': 'Protection points',
        '👁️ Виж в Drive': '👁️ View in Drive', '⬇️ Изтегли': '⬇️ Download',
        'Показани са картите за {district}. ': 'Showing the maps for {district}. ',
        'Няма отделна карта за {district}. ': 'There is no separate map for {district}. ',
        'Показани са всички райони. ': 'Showing all districts. ',
        'Покажи всички райони': 'Show all districts', 'Само {district}': 'Only {district}',
        // Letters of the district index (Bulgarian initials → Latin)
        'В': 'V', 'И': 'I', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'С': 'S', 'Т': 'T',

        // Weather
        'София': 'Sofia', 'България': 'Bulgaria',
        '💧 Влажност: {v}%': '💧 Humidity: {v}%', '🌡️ Усеща се: {v}°C': '🌡️ Feels like: {v}°C',
        '💨 Вятър: {v} км/ч': '💨 Wind: {v} km/h', '🌧️ Валежи: {v} мм': '🌧️ Precipitation: {v} mm',
        'Неуспешно зареждане на времето. Опитайте по-късно.': 'Could not load the weather. Please try again later.',
        '☀️ Ясно': '☀️ Clear', '🌤️ Предимно ясно': '🌤️ Mostly clear', '⛅ Разкъсана облачност': '⛅ Partly cloudy',
        '☁️ Облачно': '☁️ Overcast', '🌫️ Мъгла': '🌫️ Fog', '🌦️ Слаб ръмеж': '🌦️ Light drizzle', '🌦️ Ръмеж': '🌦️ Drizzle',
        '🌦️ Силен ръмеж': '🌦️ Heavy drizzle', '🌧️ Слаб дъжд': '🌧️ Light rain', '🌧️ Дъжд': '🌧️ Rain',
        '🌧️ Силен дъжд': '🌧️ Heavy rain', '🌨️ Слаб сняг': '🌨️ Light snow', '🌨️ Сняг': '🌨️ Snow',
        '🌨️ Силен снеговалеж': '🌨️ Heavy snow', '❄️ Снежни зърна': '❄️ Snow grains',
        '🌦️ Слаби превалявания': '🌦️ Light showers', '🌧️ Превалявания': '🌧️ Showers', '🌧️ Пороен дъжд': '🌧️ Torrential rain',
        '🌨️ Слаби снежни превалявания': '🌨️ Light snow showers', '🌨️ Силни снежни превалявания': '🌨️ Heavy snow showers',
        '⛈️ Гръмотевична буря': '⛈️ Thunderstorm', '⛈️ Буря с градушка': '⛈️ Thunderstorm with hail', '🌡️ Няма данни': '🌡️ No data',

        // Live status
        '📡 Състояние – {place}': '📡 Status – {place}', 'цяла София': 'all of Sofia',
        'Опасно време': 'Severe weather', 'Земетресения': 'Earthquakes', 'Въздух': 'Air', 'Вода': 'Water', 'Ток': 'Power',
        'Жълт код': 'Yellow code', 'Оранжев код': 'Orange code', 'Червен код': 'Red code', 'зелен код': 'green code',
        'Добро': 'Good', 'Задоволително': 'Fair', 'Умерено': 'Moderate', 'Лошо': 'Poor', 'Много лошо': 'Very poor',
        'Изключително лошо': 'Extremely poor',
        'току-що': 'just now', 'преди {n} мин': '{n} min ago', 'преди {n} ч': '{n} h ago',
        'преди 1 ден': '1 day ago', 'преди {n} дни': '{n} days ago',
        'Няма данни': 'No data', 'източникът не отговаря': 'source not responding', 'Няма': 'None',
        'Обновено {ago}': 'Updated {ago}',
        'Неуспешно зареждане на данните. Ще опитаме отново.': 'Could not load the data. We will try again.',
        'Земетресения до {radius} км от София, последните {days} дни': 'Earthquakes within {radius} km of Sofia, last {days} days',
        '{when} · {km} км от центъра · дълбочина {depth} км': '{when} · {km} km from the centre · depth {depth} km',
        'Детайли': 'Details',
        'Няма регистрирани земетресения в радиус {radius} км.': 'No earthquakes recorded within {radius} km.',
        'Източник: EMSC (Европейско-средиземноморски сеизмологичен център). Показват се трусове, достатъчно близо до София, за да бъдат усетени.':
            'Source: EMSC (European-Mediterranean Seismological Centre). Shows quakes close enough to Sofia to be felt.',
        'до {radius} км, {days} дни': 'within {radius} km, {days} days', '{ago} · {km} км': '{ago} · {km} km',
        'Метео предупреждения за София-град': 'Weather warnings for Sofia city',
        'В сила до {until}': 'In force until {until}', 'От {from} до {until}': 'From {from} until {until}',
        'Няма активни предупреждения (зелен код).': 'No active warnings (green code).',
        'Източник: НИМХ чрез MeteoAlarm. Предупрежденията се издават за цялата област София-град.':
            'Source: National Institute of Meteorology (НИМХ) via MeteoAlarm. Warnings cover the whole Sofia city area. Warning texts are in Bulgarian.',
        'В {district} има само {n} активни сензора – показваме стойността за цяла София.':
            '{district} has only {n} active sensors – showing the value for all of Sofia.',
        'В {district} няма активни сензора – показваме стойността за цяла София.':
            '{district} has no active sensors – showing the value for all of Sofia.',
        'Качество на въздуха – {place}': 'Air quality – {place}',
        'Фини прахови частици, най-вредни за здравето': 'Fine particulate matter, the most harmful to health',
        'Прахови частици': 'Particulate matter',
        'Медиана от {n} граждански сензора на sensor.community. ': 'Median of {n} citizen sensors from sensor.community. ',
        'Карта на сензорите': 'Sensor map',
        'Текущи спирания на водата – {place} ({n})': 'Current water outages – {place} ({n})',
        'Планирани спирания ({n})': 'Planned outages ({n})',
        'Няма текущи спирания.': 'No current outages.', 'Няма планирани спирания.': 'No planned outages.',
        'Източник: Софийска вода · ': 'Source: Sofiyska Voda · ', 'Пълна информация и карта': 'Full details and map',
        '{n} спиране': '{n} outage', '{n} спирания': '{n} outages', 'Няма спирания': 'No outages',
        '+ {n} планирани': '+ {n} planned', 'в момента': 'right now', ' · до {until}': ' · until {until}',
        'Активни аварии и ремонти – {place} ({n})': 'Active faults and repairs – {place} ({n})',
        'Няма активни аварии и ремонти.': 'No active faults or repairs.', '… и още {n}': '… and {n} more',
        'Източник: Топлофикация София · ': 'Source: Toplofikatsia Sofia · ', 'Карта и пълен списък': 'Map and full list',
        '{n} активни': '{n} active', 'аварии и ремонти': 'faults and repairs', 'прекъсвания ↗': 'outages ↗',
        'Аварийно спиране': 'Emergency stop', 'Планирано спиране': 'Planned stop', 'Непланирано спиране': 'Unplanned stop',
        'Осигурена водоноска': 'Water tanker provided', 'Промяна на водоснабдаването': 'Change in water supply',
        'Местата и адресите са на български, както ги публикуват източниците.': 'Places and addresses are in Bulgarian, as published by the sources.',

        // Announcements
        'Ново': 'New', 'Покажи по-малко': 'Show less', 'Покажи още ({n})': 'Show more ({n})',
        'Неуспешно зареждане на съобщенията. Ще опитаме отново.': 'Could not load the announcements. We will try again.',
        'Столична община': 'Sofia Municipality'
    };

    // Fixed labels with a variable part (map popups, district map captions)
    const PATTERNS = [
        [/^Район (.+?)( \d)?$/, (m, name, n = '') => DISTRICTS[name] ? `${DISTRICTS[name]} district${n}` : m],
        [/^Метростанция „(.+)“$/, (m, s) => `Metro station “${s}”`],
        [/^Вход – метростанция „(.+)“$/, (m, s) => `Entrance – metro station “${s}”`],
        [/^Минерален извор (.+)$/, (m, s) => `Mineral spring ${s}`]
    ];

    function initialLang() {
        const fromUrl = new URLSearchParams(location.search).get('lang');
        if (fromUrl === 'en' || fromUrl === 'bg') {
            try { localStorage.setItem(KEY, fromUrl); } catch { /* ignore */ }
            return fromUrl;
        }
        try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'bg'; } catch { return 'bg'; }
    }

    const lang = initialLang();
    const en = lang === 'en';

    function fill(template, params) {
        return params ? template.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m)) : template;
    }

    function t(bg, params) {
        return fill(en && EN[bg] !== undefined ? EN[bg] : bg, params);
    }

    // Keeps the leading/trailing whitespace of s; inner whitespace (HTML line breaks) is ignored for matching
    function text(s) {
        if (!en || !s) return s;
        const key = s.replace(/\s+/g, ' ').trim();
        if (!key) return s;
        const [lead] = s.match(/^\s*/), [trail] = s.match(/\s*$/);
        if (EN[key] !== undefined) return lead + EN[key] + trail;
        for (const [re, fn] of PATTERNS) {
            if (re.test(key)) return lead + key.replace(re, fn) + trail;
        }
        if (key.includes(' · ')) return lead + key.split(' · ').map(text).join(' · ') + trail;
        return s;
    }

    function districtName(name) {
        return en ? (DISTRICTS[name] || name) : name;
    }

    function district(name) {
        return en ? `${DISTRICTS[name] || name} district` : `Район ${name}`;
    }

    // Translate the static page: text nodes, a few attributes and the title
    function translatePage() {
        document.documentElement.lang = lang;
        if (!en) return;
        document.title = text(document.title);
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: n => (/[а-яА-Я]/.test(n.nodeValue) && !n.parentElement.closest('script, style'))
                ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        });
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(n => { n.nodeValue = text(n.nodeValue); });
        document.querySelectorAll('[title], [alt], [aria-label], [placeholder]').forEach(el => {
            ['title', 'alt', 'aria-label', 'placeholder'].forEach(a => {
                if (el.hasAttribute(a)) el.setAttribute(a, text(el.getAttribute(a)));
            });
        });
    }

    function buildToggle() {
        const nav = document.querySelector('.nav-container');
        if (!nav) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lang-toggle';
        btn.textContent = en ? 'БГ' : 'EN';
        btn.title = en ? 'Превключи на български' : 'Switch to English';
        btn.setAttribute('aria-label', btn.title);
        btn.addEventListener('click', () => {
            const next = en ? 'bg' : 'en';
            try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
            const url = new URL(location.href);
            url.searchParams.set('lang', next);
            location.href = url.toString();
        });
        nav.querySelector('.nav-links').before(btn);
    }

    // Carry the language in links to our own pages, in case localStorage is unavailable
    function tagLinks() {
        if (!new URLSearchParams(location.search).has('lang')) return;
        document.querySelectorAll('a[href$=".html"], a[href*=".html?"]').forEach(a => {
            const url = new URL(a.getAttribute('href'), location.href);
            if (url.origin !== location.origin) return;
            url.searchParams.set('lang', lang);
            a.setAttribute('href', url.pathname.split('/').pop() + url.search + url.hash);
        });
    }

    window.I18N = { lang, t, text, district, districtName };

    // Loaded at the end of <body>, so the page is already parsed
    translatePage();
    buildToggle();
    tagLinks();
})();
