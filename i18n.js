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
        'Карти - Sofia Prepping': 'Maps - Sofia Prepping',
        'Документи - Sofia Prepping': 'Documents - Sofia Prepping',
        'Сигнали - Sofia Prepping': 'Sirens - Sofia Prepping',
        'Райони - Sofia Prepping': 'Districts - Sofia Prepping',
        'Бомбоубежища - Sofia Prepping': 'Bomb shelters - Sofia Prepping',
        'Чешмите - Sofia Prepping': 'Drinking fountains - Sofia Prepping',
        'Интерактивна карта - Sofia Prepping': 'Interactive map - Sofia Prepping',
        'sofia-prepping.com - София': 'sofia-prepping.com - Sofia',
        'sofia-prepping.com - София · обновено:': 'sofia-prepping.com - Sofia · updated:',
        '← Карти': '← Maps', '← Документи': '← Documents', 'Към началото': 'Back to top',
        'Зареждане...': 'Loading...',
        'Цяла София': 'All of Sofia', 'Изберете район': 'Choose a district',

        // Homepage
        'Състояние – цяла София': 'Status – all of Sofia',
        'Официални съобщения': 'Official announcements',
        'Покажи още': 'Show more',
        'От ГДПБЗН (пожарна безопасност и защита на населението) и Столична община (раздел „Сигурност“). Съобщенията се показват дословно с връзка към оригинала.':
            'From the Fire Safety and Civil Protection Directorate (ГДПБЗН) and Sofia Municipality (“Security” section). Announcements are shown in Bulgarian exactly as published, with a link to the original.',
        'Времето - София': 'Weather - Sofia',
        'Бързи Линкове': 'Quick links',
        'Интерактивна карта': 'Interactive map', 'Бомбоубежища': 'Bomb shelters', 'Чешмите': 'Drinking fountains',
        'Новини': 'News',
        'Аварии и мониторинг': 'Outages and monitoring',
        'Радиация (EURDEP)': 'Radiation (EURDEP)', 'Софийска вода': 'Sofiyska Voda',
        'ЕРМ Запад': 'ERM Zapad', 'Топлофикация': 'District heating',
        'Публични Камери': 'Public cameras', 'Орлов Мост': 'Orlov Most', 'ж.к. Лагера': 'Lagera',

        // Sirens page
        'Сигнали за тревога': 'Alarm signals',
        'Чуйте как звучат сирените': 'Hear what the sirens sound like',
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
        'BG-ALERT на телефона': 'BG-ALERT on your phone',
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
        'Интерактивна карта – убежища, вода, евакуация, йод, болници':
            'Interactive map – shelters, water, evacuation, iodine, hospitals',
        'Бомбоубежища': 'Bomb shelters', 'Чешмите': 'Drinking fountains',
        'Отвори в Google Maps': 'Open in Google Maps',
        'Бомбоубежища в София': 'Bomb shelters in Sofia', 'Чешми в София': 'Drinking fountains in Sofia',
        'Намери най-близкия': 'Find the nearest',
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
        'Маршрут': 'Directions', 'Най-близо до вас': 'Nearest to you', 'Търсене...': 'Locating...', 'Търсене на адреса...': 'Searching...',
        'Вие сте тук': 'You are here',
        'Районът е сменен на {district} според местоположението ви.': 'Switched to {district}, where you are now.',
        'Покажи местоположението ми': 'Show my location',
        'Центрирай върху мен': 'Centre on me',
        'Местоположението ви не може да бъде определено в момента. Опитайте отново.': 'Your location can\'t be found right now. Please try again.',
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
        'Планове за защита на населението на Столична Община': 'Sofia Municipality civil protection plans',
        'СО - План за защита при наводнения': 'Sofia Municipality – flood protection plan',
        'СО - План за защита при земетресения': 'Sofia Municipality – earthquake protection plan',
        'СО - План за защита при ядрени и радиационни заплахи': 'Sofia Municipality – nuclear and radiation protection plan',
        'Пунктове по райони': 'Protection points by district',
        'PDF с пунктове за защита на населението при бедствия и аварии': 'PDF maps of civil protection points',
        'Пунктове за защита на населението при бедствия и аварии': 'Civil protection points for disasters and accidents',
        'Пунктове по райони': 'Protection points by district', 'Пунктове за защита': 'Protection points',
        'Виж в Drive': 'View in Drive', 'Изтегли': 'Download',
        'Показани са картите за {district}. ': 'Showing the maps for {district}. ',
        'Няма отделна карта за {district}. ': 'There is no separate map for {district}. ',
        'Показани са всички райони. ': 'Showing all districts. ',
        'Покажи всички райони': 'Show all districts', 'Само {district}': 'Only {district}',
        // Letters of the district index (Bulgarian initials → Latin)
        'В': 'V', 'И': 'I', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'С': 'S', 'Т': 'T',

        // Analyses and the readiness index (analizi.html, gotovnost.html)
        'Анализи': 'Analyses', '← Анализи': '← Analyses', 'Анализи - Sofia Prepping': 'Analyses - Sofia Prepping',
        'Индекс на готовност - Sofia Prepping': 'Readiness index - Sofia Prepping',
        'Индекс на готовност': 'Readiness index', 'Анализ на защитата по райони': 'Civil protection by district',
        'Обобщения от отворените данни на сайта: къде в София хората са добре защитени и къде има пропуски.':
            'Summaries of the open data on this site: where in Sofia people are well covered and where the gaps are.',
        'Колко жители имат укритие, болница, вода и йод наблизо – по райони':
            'How many residents have a shelter, hospital, water and iodine nearby – by district',
        'Анализ 01 · отворени данни': 'Analysis 01 · open data',
        'Колко от жителите на всеки район живеят на пешеходно разстояние от укритие, сграда за временно настаняване, болница, питейна вода и пункт за йодни таблетки.':
            'How many residents of each district live within walking distance of a shelter, a temporary housing building, a hospital, drinking water and an iodine tablet point.',
        'Основни показатели': 'Key figures', 'Карта': 'Map', 'Изглед': 'View', 'Райони': 'Districts', 'Жители': 'Residents',
        'Показател': 'Measure', 'Класиране по райони': 'District ranking',
        '% от жителите в обхват · цвят спрямо средното за София': '% of residents within reach · colour against the Sofia average',
        'Къде са укритията': 'Where the shelters are',
        'Дял от жителите на София': 'Share of Sofia\'s residents', 'Дял от укритията': 'Share of shelters',
        'Методика и източници': 'Method and sources', 'Как се изчислява': 'How it is calculated',
        'Населението на всеки район е разпределено върху мрежа от шестоъгълници с площ около 0,7 км² според модела Kontur Population и е приведено към броя жители от преброяването през 2021 г. За всяко място се измерва разстоянието по права линия до най-близкия обект от всеки вид.':
            'Each district\'s population is spread over a grid of hexagons of about 0.7 km² following the Kontur Population model, and scaled to the number of residents in the 2021 census. For every place, the straight-line distance to the nearest point of each kind is measured.',
        'Оценката на района по всеки стълб е делът от жителите му в обхват. Индексът е средното от петте стълба, с еднаква тежест. 100 означава, че всички жители имат такъв обект наблизо.':
            'A district\'s score on each pillar is the share of its residents within reach. The index is the average of the five pillars, weighted equally. 100 means every resident has such a place nearby.',
        'Ограничения': 'Limitations',
        'Разстоянието е по права линия; пешеходният път обикновено е с 20–40% по-дълъг.':
            'Distances are in a straight line; the walking route is usually 20–40% longer.',
        'Не се отчита капацитетът: едно укритие се брои като обхват за всички жители около него.':
            'Capacity is not taken into account: one shelter counts as cover for all residents around it.',
        'Списъкът с укрития е от публична карта и вероятно е непълен. Официален регистър на укритията не е публикуван.':
            'The shelter list comes from a public map and is probably incomplete. No official shelter register has been published.',
        '„Болници“ включва болници и здравни центрове от OpenStreetMap.': '“Hospitals” includes hospitals and health centres from OpenStreetMap.',
        'Разпределението на жителите в района е по модел (сгради и сателитни снимки), не по адресна регистрация.':
            'Where residents live within a district is modelled (from buildings and satellite images), not taken from address registrations.',
        'Индексът е независима оценка от отворени данни и не е официална позиция на институциите.':
            'The index is an independent assessment from open data, not an official position of any institution.',
        'Източници': 'Sources', 'НСИ – Преброяване 2021': 'National Statistical Institute – Census 2021',
        '(население по райони)': '(population by district)',
        '(разпределение на населението, CC BY 4.0)': '(population distribution, CC BY 4.0)',
        'Интерактивната карта': 'The interactive map',
        'на сайта: Столична община – отворени данни, Google My Maps, OpenStreetMap': 'on this site: Sofia Municipality open data, Google My Maps, OpenStreetMap',
        'Индекс': 'Index', 'Укритие': 'Shelter', 'Настаняване': 'Housing', 'Медицина': 'Medical', 'Вода': 'Water', 'Йод': 'Iodine',
        'Аптека': 'Pharmacy', 'Палатков лагер': 'Tent camp', 'Район': 'District', '№': '#',
        'Противорадиационно укритие или скривалище': 'Anti-radiation shelter or bomb shelter',
        'Сграда за временно настаняване при бедствие': 'Building for temporary housing in a disaster',
        'Болница или здравен център': 'Hospital or health centre',
        'Работеща чешма или минерален извор': 'Working drinking fountain or mineral spring',
        'Пункт за йодни таблетки': 'Iodine tablet point',
        '{n} жители на над {km} от укритие': '{n} residents more than {km} from a shelter',
        '{n} жители на над {km} от сграда за настаняване': '{n} residents more than {km} from a housing building',
        '{n} жители на над {km} от болница': '{n} residents more than {km} from a hospital',
        '{n} жители на над {km} от работеща чешма': '{n} residents more than {km} from a working fountain',
        '{n} жители на над {km} от пункт за йодни таблетки': '{n} residents more than {km} from an iodine tablet point',
        '−20 и по-малко': '−20 or less', '−20 до −7': '−20 to −7', '±7': '±7', '+7 до +20': '+7 to +20', '+20 и повече': '+20 or more',
        '{d} има {p}% от жителите на София и {s}% от укритията. {n} района с {people} жители нямат нито едно укритие на своя територия.':
            '{d} has {p}% of Sofia\'s residents and {s}% of its shelters. {n} districts with {people} residents have no shelter at all.',
        '{d}: {p}% от жителите · {s}% от укритията ({n} от {total})': '{d}: {p}% of residents · {s}% of shelters ({n} of {total})',
        '{m} спрямо София ({v})': '{m} against all of Sofia ({v})',
        '{n} обекта': '{n} places', '{n} района · {p} жители': '{n} districts · {p} residents',
        '{n}+ на шестоъгълник': '{n}+ per hexagon', '{p}% от жителите на София': '{p}% of Sofia\'s residents',
        '{what} до {km}': '{what} within {km}', 'Без укритие до {km}': 'No shelter within {km}',
        'Всички жители имат всеки вид обект наблизо.': 'Every resident has each kind of place nearby.',
        'Гъстота': 'Density', 'Профил · цяла София': 'Profile · all of Sofia', 'Профил на района': 'District profile',
        'Жители без {what} до {km}': 'Residents with no {what} within {km}',
        'Жители извън обхват, средно за петте стълба': 'Residents out of reach, averaged over the five pillars',
        'Индекс · цяла София': 'Index · all of Sofia', 'Най-нисък индекс': 'Lowest index', 'Най-слаби райони': 'Weakest districts',
        'Население: преброяване {c} · модел Kontur {g}': 'Population: census {c} · Kontur model {g}',
        'Обекти към {date}': 'Places as of {date}', 'Основни пропуски': 'Main gaps', 'Площ': 'Area',
        'Райони без нито едно укритие': 'Districts with no shelter', 'София: {v}%': 'Sofia: {v}%',
        'Средно покритие': 'Average coverage', 'Столична община': 'Sofia Municipality',
        'Точките са обектите от този вид, кръгът около всеки е {km}.': 'The points are the places of this kind; the circle around each is {km}.',
        'в обхват: до {km}': 'within reach: up to {km}', 'всички в обхват': 'all within reach', 'до {km}': 'within {km}',
        'жители': 'residents', 'км²': 'km²', 'на км²': 'per km²',
        'половината жители са до {km}': 'half of residents within {km}', 'спрямо София': 'vs Sofia',
        'средно за София': 'Sofia average', 'средно от {n} стълба': 'average of {n} pillars',
        '№ {r} от {n} района': 'No. {r} of {n} districts',

        // Operations wall (obstanovka.html)
        'Оперативна обстановка - Sofia Prepping': 'Live operations picture - Sofia Prepping',
        'Оперативна обстановка': 'Live operations picture', 'На живо': 'Live',
        'Оперативна обстановка · София': 'Live operations picture · Sofia',
        'Всички източници на живо на един екран – за монитор или стена': 'Every live source on one screen – for a monitor or wall display',
        'Ниво –': 'Level –', 'Ниво {level}': 'Level {level}', 'Обновяване': 'Refresh', 'Цял екран': 'Full screen', 'Изход': 'Exit',
        'Показатели': 'Indicators', 'Гама-фон · станции в София': 'Gamma background · stations in Sofia',
        'Карта на събитията': 'Event map', 'Слоеве': 'Layers', 'Дневник на събитията': 'Event log',
        'Вода · топлофикация · PM2.5': 'Water · heating · PM2.5', 'Последни новини': 'Latest news',
        'Данни от отворени източници: НИМХ/MeteoAlarm, EMSC, sensor.community, Агенция за ядрено регулиране, Софийска вода, Топлофикация София, Open-Meteo, БТА, ГДПБЗН, Столична община. Източниците се проверяват на всеки 10 минути. При спешен случай: 112.':
            'Open data from: НИМХ/MeteoAlarm, EMSC, sensor.community, Nuclear Regulatory Agency, Sofiyska Voda, Toplofikatsia Sofia, Open-Meteo, BTA, ГДПБЗН, Sofia Municipality. Sources are checked every 10 minutes. In an emergency: 112.',
        'PM2.5 {v} µg/m³ · {n} сензора': 'PM2.5 {v} µg/m³ · {n} sensors',
        '{km} км от центъра · дълбочина {depth} км': '{km} km from the centre · depth {depth} km',
        '{n} записа': '{n} entries', '{ok}/{n} в норма · {time}': '{ok}/{n} normal · {time}',
        'Няма активни събития.': 'No active events.', 'авария/ремонт на топлофикация': 'heating fault/repair',
        'бюлетин {time}': 'bulletin {time}', 'вода': 'water', 'топлофикация': 'heating', 'вятър {v} км/ч': 'wind {v} km/h',
        'горна граница на естествения фон ({v} µSv/h)': 'upper limit of natural background ({v} µSv/h)',
        'до {until}': 'until {until}', 'от {from}': 'from {from}', 'дълбочина {depth} км': 'depth {depth} km',
        'земетресение': 'earthquake', 'няма достатъчно сензори': 'not enough sensors', 'район със спряна вода': 'district with water cut off',
        'Въздух (PM2.5)': 'Air (PM2.5)', 'добро': 'good', 'умерено': 'moderate', 'лошо': 'poor', 'много лошо': 'very poor',
        'в': 'w', 'т': 'h', 'Оперативен екран →': 'Operations screen →', 'МЕТЕО': 'METEO', 'ВиК': 'WATER', 'ТОПЛО': 'HEAT',
        '{n} спиране на водата': '{n} water outage', '{n} спирания на водата': '{n} water outages',

        // Address search (homepage) and place page (okolo.html)
        'Sofia Prepping – обстановка и готовност при бедствия в София': 'Sofia Prepping – emergency status and readiness in Sofia',
        'Търсене по адрес': 'Search by address',
        'Данни от отворени източници': 'Data from open sources',
        'Какво има около вас?': 'What is around you?',
        'Най-близкото укритие, болница, питейна вода и пункт за йодни таблетки – и обстановката в района в момента.': 'The nearest shelter, hospital, drinking water and iodine tablet point – and the current situation in your district.',
        'Адрес, блок или място': 'Address, block or place',
        'Адрес, блок или място в София': 'Address, block or place in Sofia',
        'Използвай местоположението ми': 'Use my location',
        'Търси': 'Search',
        'Например:': 'For example:',
        'Обстановка в София: зареждане...': 'Situation in Sofia: loading...',
        'Обстановка в София: {word} · ниво {level}': 'Situation in Sofia: {word} · level {level}',
        'Обстановка в София: няма връзка с източниците': 'Situation in Sofia: sources not reachable',
        'Бърз достъп': 'Quick access',
        'Местоположението ви остава в браузъра. Адресът се търси в OpenStreetMap чрез сайта.': 'Your location stays in your browser. Addresses are looked up in OpenStreetMap through this site.',
        'Не намерихме „{q}“ в София. Опитайте с улица и номер или блок и квартал.': 'We could not find “{q}” in Sofia. Try a street and number, or a block and neighbourhood.',
        'Търсенето на адрес изисква интернет. Без интернет използвайте бутона за местоположение.': 'Address search needs the internet. Offline, use the location button.',
        'Търсенето не отговаря в момента. Опитайте отново или използвайте местоположението си.': 'Search is not responding right now. Try again or use your location.',
        'Около вас - Sofia Prepping': 'Around you - Sofia Prepping',
        'Около вас': 'Around you',
        'Друг адрес, блок или място': 'Another address, block or place',
        'Справка за място': 'Place report',
        'Справка за адрес': 'Address report',
        'Справка за вашето местоположение': 'Report for your location',
        'Вашето местоположение': 'Your location',
        'Избрано място': 'Selected place',
        'извън Столична община': 'outside Sofia Municipality',
        'Пълната карта →': 'Full map →',
        'по права линия': 'straight line',
        'Тук': 'Here',
        'Посочете място': 'Pick a place', 'Къде сте?': 'Where are you?',
        'Посочено място': 'Place on the map', 'Справка за място на картата': 'Report for a place on the map',
        'Плъзнете, за да уточните мястото': 'Drag to set the exact place',
        'Посочете мястото на картата →': 'Pick the place on the map →',
        'Не намирате адреса? Посочете го на картата →': "Can't find the address? Pick it on the map →",
        'Докоснете картата там, където сте или където искате да проверите. После можете да плъзнете маркера, за да уточните.': 'Tap the map where you are or where you want to check. You can then drag the pin to adjust it.',
        'Не е точно? Плъзнете маркера „Тук“ до точното място. Пунктираните линии водят до най-близкия обект от всеки вид, кръгът е 1 км.': 'Not exact? Drag the "Here" pin to the right spot. The dotted lines lead to the nearest place of each kind; the circle is 1 km.',
        'Сграда за временно настаняване': 'Temporary shelter building',
        'Питейна вода': 'Drinking water',
        'Място за палатков лагер': 'Tent camp site',
        '~{n} мин пеша': '~{n} min on foot',
        '{n} в радиус 1 км': '{n} within 1 km',
        'Готовност на района': 'District readiness',
        '{district} · София: {c}': '{district} · Sofia: {c}',
        'Това място: {n} от {total} в обхват': 'This place: {n} of {total} within reach',
        '{v}% от района': '{v}% of district',
        '„% от района“ е делът на жителите на района, които имат такъв обект на това разстояние.': '“% of district” is the share of the district\'s residents who have such a place within that distance.',
        'Мястото е извън Столична община, затова няма оценка на района.': 'This place is outside Sofia Municipality, so there is no district assessment.',
        'Индекс на готовност →': 'Readiness index →',
        'Досие на района →': 'District dossier →',

        // Feedback form (kontakt.html)
        'Обратна връзка - Sofia Prepping': 'Feedback - Sofia Prepping',
        'Обратна връзка': 'Feedback',
        'Контакти': 'Contact', 'Контакти - Sofia Prepping': 'Contact - Sofia Prepping',
        'Видяхте грешка – затворено укритие, чешма, която не работи, грешен адрес? Или имате идея какво да добавим? Пишете ни. Всяко съобщение се чете.': 'Spotted a mistake – a closed shelter, a fountain that doesn\'t work, a wrong address? Or have an idea for something to add? Write to us. Every message is read.',
        'За какво пишете': 'What is it about',
        'Грешка в данните': 'Mistake in the data',
        'Предложение': 'Suggestion',
        'Друго': 'Other',
        'Съобщение': 'Message',
        'Имейл за отговор': 'Email for a reply',
        '(по желание)': '(optional)',
        'Какво не е наред или какво предлагате? Ако е за конкретно място – адрес или име.': 'What is wrong, or what do you suggest? If it is about a specific place – its address or name.',
        'Уебсайт': 'Website',
        'Изпрати': 'Send',
        'Благодарим!': 'Thank you!',
        'Съобщението е изпратено. Ако сте оставили имейл, ще ви отговорим там.': 'Your message has been sent. If you left an email, we will reply there.',
        'Изпрати още едно': 'Send another',
        'Съобщението отива само до екипа на сайта. Имейлът ви е по желание, използва се само за отговор и не се публикува. При опасност за живота се обадете на 112 – тази форма не е за спешни случаи.': 'Your message goes only to the site\'s team. Your email is optional, used only to reply and never published. If life is in danger, call 112 – this form is not for emergencies.',
        'Ще добавим към съобщението страницата, от която идвате: {page}': 'The page you came from will be added to the message: {page}',
        'Съобщението трябва да е поне 10 знака.': 'The message needs at least 10 characters.',
        'Проверете имейл адреса – изглежда непълен.': 'Please check the email address – it looks incomplete.',
        'Изпратихте няколко съобщения за кратко. Опитайте отново след час.': 'You sent several messages in a short time. Please try again in an hour.',
        'Формата още не е настроена. Опитайте по-късно.': 'The form is not set up yet. Please try later.',
        'Съобщението не можа да бъде изпратено. Опитайте отново след малко.': 'The message could not be sent. Please try again shortly.',
        'Изпращане...': 'Sending...',
        'Няма интернет. Съобщението ще остане тук – изпратете го, когато връзката се възстанови.': 'No internet. Your message stays here – send it when you are back online.',
        'Нещо не е наред? Съобщете ни →': 'Something wrong? Tell us →',

        // District dossier (dosie.html)
        'Досие на район - Sofia Prepping': 'District dossier - Sofia Prepping',
        'Досиета на районите': 'District dossiers',
        'Документ за печат за всеки район: карта на ресурсите за защита на цяла страница, карта на обхвата на укритията, оценка на готовността и пълен регистър на обектите. Изберете район:': 'A printable document for every district: a full-page map of protection resources, a map of shelter reach, the readiness assessment and a complete register of places. Choose a district:',
        'Документ за печат за всеки район: карти на цяла страница, оценка и регистър на обектите': 'A printable document for every district: full-page maps, assessment and register of places',
        'Подготвяне на досието...': 'Preparing the dossier...',
        'Досие': 'Dossier',
        'досие': 'dossier',
        '(продължение)': '(continued)',
        'Отворени данни // за обществено ползване': 'Open data // for public use',
        'Досие на район': 'District dossier',
        'Обобщение': 'Summary',
        'Карта 1 · Ресурси за защита': 'Map 1 · Protection resources',
        'Карта 2 · Обхват на укритията': 'Map 2 · Shelter reach',
        'Оценка на готовността': 'Readiness assessment',
        'Регистър на обектите': 'Register of places',
        'Регистър на обектите (продължение)': 'Register of places (continued)',
        'Методика и източници': 'Method and sources',
        'Раздел 3': 'Section 3',
        'Раздел 4': 'Section 4',
        'Раздел 5': 'Section 5',
        'Карта 1': 'Map 1',
        'Карта 2': 'Map 2',
        'стр. {i} / {n}': 'p. {i} / {n}',
        '{n} страници A4': '{n} A4 pages',
        'Съдържание': 'Contents',
        'Защита на населението при бедствия и аварии: ресурси, обхват и пропуски по отворени данни': 'Civil protection in disasters and emergencies: resources, reach and gaps from open data',
        'Актуална версия онлайн': 'Current version online',
        'Документ №': 'Document no.',
        'Изготвен': 'Prepared',
        'Данни към': 'Data as of',
        'Класификация': 'Classification',
        'Публично': 'Public',
        'преброяване 2021': 'census 2021',
        '{n} жители на км²': '{n} residents per km²',
        'Укрития в района': 'Shelters in the district',
        '№ {r} от {n} · София {c}': 'No. {r} of {n} · Sofia {c}',
        '{p}% от жителите до {km}': '{p}% of residents within {km}',
        'Основни изводи': 'Key findings',
        'На територията на района няма нито едно укритие. {n} жители ({p}%) са на над {km} от най-близкото.': 'There is no shelter in the district. {n} residents ({p}%) live more than {km} from the nearest one.',
        '{c} укрития в района; {p}% от жителите имат укритие до {km} (София: {city}%).': '{c} shelters in the district; {p}% of residents have one within {km} (Sofia: {city}%).',
        'Най-голям пропуск спрямо София: {what} – {v}% от жителите в обхват срещу {c}% средно.': 'Biggest gap against Sofia: {what} – {v}% of residents within reach against {c}% on average.',
        'Най-силна страна: {what} – {v}% от жителите в обхват (София: {c}%).': 'Strongest point: {what} – {v}% of residents within reach (Sofia: {c}%).',
        'Индекс на готовност {s} от 100 – № {r} от {n} района (София: {c}).': 'Readiness index {s} out of 100 – no. {r} of {n} districts (Sofia: {c}).',
        'Ресурси за защита на населението': 'Civil protection resources',
        'Легенда': 'Legend',
        'Укрития': 'Shelters',
        'Болници и здравни центрове': 'Hospitals and health centres',
        'Пунктове за йодни таблетки': 'Iodine tablet points',
        'Питейна вода: чешми и извори': 'Drinking water: fountains and springs',
        'Места за палатъчни лагери': 'Tent camp sites',
        '„+“ – най-близките в съседни райони, защото в района има по-малко от 2. Номерата съвпадат с регистъра.': '“+” – the nearest in neighbouring districts, because the district has fewer than 2. Numbers match the register.',
        'Номерата съвпадат с регистъра на обектите.': 'Numbers match the register of places.',
        'граница на района': 'district boundary',
        'Обхват на укритията ({km})': 'Shelter reach ({km})',
        'Жители извън обхват': 'Residents out of reach',
        '{p}% от района · София: {c}%': '{p}% of the district · Sofia: {c}%',
        'Половината жители са до {km} от укритие': 'Half of residents live within {km} of a shelter',
        'Жители на шестоъгълник (~0,7 км²) без укритие до {km}': 'Residents per hexagon (~0.7 km²) with no shelter within {km}',
        'в обхват': 'within reach',
        'укритие и кръг с радиус {km}': 'shelter and its {km} radius',
        'Разпределението на жителите е по модела Kontur Population, приведено към преброяване 2021. Разстоянията са по права линия.': 'Residents are placed by the Kontur Population model, scaled to the 2021 census. Distances are in a straight line.',
        '{d} пункта спрямо средното за София ({c})': '{d} points against the Sofia average ({c})',
        'Индексът е средното от петте стълба по-долу. Всеки стълб е делът от жителите на района, които имат такъв обект в рамките на посоченото разстояние.': 'The index is the average of the five pillars below. Each pillar is the share of the district\'s residents who have such a place within the given distance.',
        'Стълб': 'Pillar',
        'В обхват': 'Within reach',
        'Извън обхват': 'Out of reach',
        'Половината до': 'Half within',
        'Обекти': 'Places',
        'укритие': 'shelter',
        'сграда за настаняване': 'housing building',
        'болница или здравен център': 'hospital or health centre',
        'работеща чешма или извор': 'working fountain or spring',
        'пункт за йодни таблетки': 'iodine tablet point',
        '7+ пункта под средното': '7+ points below average',
        '7+ пункта над средното': '7+ points above average',
        '{what} до {km}: {v}% от жителите (София: {c}%)': '{what} within {km}: {v}% of residents (Sofia: {c}%)',
        'Мястото на района сред всички {n}': 'Where the district stands among all {n}',
        'София {c}': 'Sofia {c}',
        'Най-висок индекс: {a} ({av}). Най-нисък: {b} ({bv}).': 'Highest index: {a} ({av}). Lowest: {b} ({bv}).',
        'Пропуски в брой жители': 'Gaps in residents',
        'жители на над {km} от {what}': 'residents more than {km} from the nearest {what}',
        'Всички обекти от карта 1 с номерата от картата. Обекти в съседни райони са отбелязани с разстоянието от средищната точка на населението на района.': 'Every place on map 1, with its number from the map. Places in neighbouring districts show their distance from the district\'s population centre.',
        'Име': 'Name',
        'Вид / бележка': 'Type / note',
        'Координати': 'Coordinates',
        'Няма в района.': 'None in the district.',
        'съседен район ({district}), {km}': 'neighbouring district ({district}), {km}',
        'Също в района (не са изброени): аптеки: {ph} · метростанции и входове: {m}. Вижте ги на интерактивната карта.': 'Also in the district (not listed): pharmacies: {ph} · metro stations and entrances: {m}. See them on the interactive map.',
        'Как е изчислено': 'How it is calculated',
        'Населението на района (преброяване 2021, НСИ) е разпределено върху мрежа от шестоъгълници с площ около 0,7 км² по модела Kontur Population.': 'The district\'s population (2021 census, NSI) is spread over a grid of hexagons of about 0.7 km² following the Kontur Population model.',
        'За всяко място е измерено разстоянието по права линия до най-близкия обект от всеки вид. Стълбът е делът от жителите в рамките на прага (1 км, за болници 2 км).': 'For every place, the straight-line distance to the nearest place of each kind is measured. A pillar is the share of residents within the threshold (1 km; 2 km for hospitals).',
        'Индексът на готовност е средното от петте стълба с еднаква тежест: укритие, настаняване, медицина, вода, йод.': 'The readiness index is the average of the five pillars, weighted equally: shelter, housing, medical, water, iodine.',
        'Когато в района има по-малко от 2 укрития или болници, досието показва и 3-те най-близки в съседни райони.': 'When a district has fewer than 2 shelters or hospitals, the dossier also shows the 3 nearest in neighbouring districts.',
        'Пешеходният път обикновено е с 20–40% по-дълъг от разстоянието по права линия.': 'The walking route is usually 20–40% longer than the straight-line distance.',
        'Капацитетът на укритията не е известен и не е отчетен.': 'Shelter capacity is not known and is not taken into account.',
        'Списъкът с укрития е от публична карта и вероятно е непълен; официален регистър не е публикуван.': 'The shelter list comes from a public map and is probably incomplete; no official register has been published.',
        'Досието е независима оценка от отворени данни и не е официален документ на институциите.': 'The dossier is an independent assessment from open data, not an official document of any institution.',
        'Столична община – отворени данни (urbandata.sofia.bg): сгради за настаняване, пунктове за йодни таблетки, места за палатъчни лагери, минерални извори.': 'Sofia Municipality open data (urbandata.sofia.bg): housing buildings, iodine tablet points, tent camp sites, mineral springs.',
        'Google My Maps „Скривалища и ПРУ“ и „Чешмите в България 2024“: укрития и чешми.': 'Google My Maps “Скривалища и ПРУ” and “Чешмите в България 2024”: shelters and fountains.',
        'OpenStreetMap: болници и здравни центрове, аптеки, основна карта.': 'OpenStreetMap: hospitals and health centres, pharmacies, base map.',
        'НСИ – Преброяване 2021; Kontur Population (CC BY 4.0): население.': 'NSI – Census 2021; Kontur Population (CC BY 4.0): population.',
        'Единен европейски номер за спешна помощ. При бедствие следвайте указанията на властите и BG-ALERT.': 'The single European emergency number. In a disaster, follow the authorities\' instructions and BG-ALERT.',
        'Онлайн: интерактивна карта – sofia-prepping.com/karta · индекс на готовност – sofia-prepping.com/gotovnost · оперативна обстановка – sofia-prepping.com/obstanovka': 'Online: interactive map – sofia-prepping.com/karta · readiness index – sofia-prepping.com/gotovnost · live operations picture – sofia-prepping.com/obstanovka',

        // Weather
        'София': 'Sofia', 'България': 'Bulgaria',
        'Влажност: {v}%': 'Humidity: {v}%', 'Усеща се: {v}°C': 'Feels like: {v}°C',
        'Вятър: {v} км/ч': 'Wind: {v} km/h', 'Валежи: {v} мм': 'Precipitation: {v} mm',
        'Неуспешно зареждане на времето. Опитайте по-късно.': 'Could not load the weather. Please try again later.',
        'Ясно': 'Clear', 'Предимно ясно': 'Mostly clear', 'Разкъсана облачност': 'Partly cloudy',
        'Облачно': 'Overcast', 'Мъгла': 'Fog', 'Слаб ръмеж': 'Light drizzle', 'Ръмеж': 'Drizzle',
        'Силен ръмеж': 'Heavy drizzle', 'Слаб дъжд': 'Light rain', 'Дъжд': 'Rain',
        'Силен дъжд': 'Heavy rain', 'Слаб сняг': 'Light snow', 'Сняг': 'Snow',
        'Силен снеговалеж': 'Heavy snow', 'Снежни зърна': 'Snow grains',
        'Слаби превалявания': 'Light showers', 'Превалявания': 'Showers', 'Пороен дъжд': 'Torrential rain',
        'Слаби снежни превалявания': 'Light snow showers', 'Силни снежни превалявания': 'Heavy snow showers',
        'Гръмотевична буря': 'Thunderstorm', 'Буря с градушка': 'Thunderstorm with hail', 'Няма данни': 'No data',

        // Live status
        'Състояние – {place}': 'Status – {place}', 'цяла София': 'all of Sofia',
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
        // Radiation stations as the Nuclear Regulatory Agency names them (ОА = district administration)
        'АЯР': 'Nuclear Regulatory Agency', 'Мин. на енергетиката': 'Ministry of Energy', 'ул. Бенковски': 'Benkovski St',
        'ОА Витоша': 'Vitosha district admin.', 'ОА Кремиковци': 'Kremikovtsi district admin.', 'ОА Нови Искър': 'Novi Iskar district admin.',
        'ОА Панчарево': 'Pancharevo district admin.', 'Банкя': 'Bankya', 'сервиз': 'under maintenance',
        'Радиация': 'Radiation',
        'Няма интернет · показваме запазеното копие на сайта. При спешен случай: 112': 'No internet · showing the copy saved on this device. Emergency: 112',
        'Затвори': 'Close', 'Инсталирай': 'Install',
        'Без интернет: „Сподели“ → „Добави към началния екран“': 'Offline: “Share” → “Add to Home Screen”',
        'Инсталирайте сайта, за да работи и без интернет': 'Install the site to use it offline',
        'Без интернет': 'Without internet', 'Спри свалянето': 'Stop downloading', 'Изтрий': 'Delete',
        'Карта на улиците': 'Street map', 'Запази ({mb} MB)': 'Save ({mb} MB)',
        '{n} документа, {mb} MB': '{n} documents, {mb} MB',
        'Улиците, сградите и имената по картите на сайта.': 'The streets, buildings and names on the site’s maps.',
        'Плановете за защита на Столична община.': 'Sofia Municipality\'s protection plans.',
        'Сваляне: {done} от {total} файла. Оставете страницата отворена.': 'Downloading: {done} of {total} files. Keep the page open.',
        'Запазено на това устройство · работи без интернет. Новите версии се свалят автоматично.': 'Saved on this device · works without internet. New versions download automatically.',
        'Не успяхме да проверим какво е запазено.': 'Could not check what is saved.',
        'Няма интернет · картата на улиците не е запазена на това устройство, затова части от нея може да липсват. При спешен случай: 112':
            'No internet · the street map is not saved on this device, so parts of it may be missing. Emergency: 112',
        'Назад': 'Back', 'Документът не е намерен.': 'Document not found.', 'Документът не може да бъде отворен.': 'The document could not be opened.',
        'Документът не е запазен за ползване без интернет. Запазете документите от страница „Документи“, когато има интернет.':
            'The document is not saved for use without internet. Save the documents on the Documents page when you are online.',
        'Страница {n} от {total}': 'Page {n} of {total}',
        'Проверяваме кои документи са запазени...': 'Checking which documents are saved...',
        'Този браузър не може да запази сайта за ползване без интернет.': 'This browser cannot save the site for use without internet.',
        'На iPhone добавете сайта към началния екран, иначе Safari може да изтрие запазеното копие.': 'On iPhone, add the site to the Home Screen, or Safari may delete the saved copy.',
 'Източникът не отговаря в момента. Ще опитаме отново след няколко минути.': 'The source is not responding right now. We will try again in a few minutes.', 'вашият район': 'your district', 'няма данни ({note})': 'no data ({note})',
        'Радиационен гама-фон – София ({n} станции)': 'Gamma background radiation – Sofia ({n} stations)',
        'Бюлетинът не е обновяван от {date} – стойностите може да не са актуални.': 'The bulletin has not been updated since {date}; the values may be out of date.',
        'над естествения фон': 'above natural background',
        'Естественият гама-фон в България е между {low} и {high} µSv/h. Стойностите са средни за последните 24 часа.':
            'Natural gamma background in Bulgaria is between {low} and {high} µSv/h. Values are averages over the last 24 hours.',
        '30-км зона на АЕЦ „Козлодуй“': '30 km zone of Kozloduy nuclear plant', 'Цяла България': 'All of Bulgaria',
        'най-висока стойност {v} ({n} станции)': 'highest {v} ({n} stations)',
        'Източник: Агенция за ядрено регулиране, система „Катрин“{at} · ': 'Source: Nuclear Regulatory Agency, KATRIN system{at} · ',
        ', към {time}': ', as of {time}', 'Бюлетин за гама-фона': 'Gamma background bulletin',
        'в границите на естествения фон': 'within natural background',
        'над естествения фон – следете официалните съобщения': 'above natural background – follow official announcements',
        'Аварийно спиране': 'Emergency stop', 'Планирано спиране': 'Planned stop', 'Непланирано спиране': 'Unplanned stop',
        'Осигурена водоноска': 'Water tanker provided', 'Промяна на водоснабдаването': 'Change in water supply',
        'Местата и адресите са на български, както ги публикуват източниците.': 'Places and addresses are in Bulgarian, as published by the sources.',

        // Announcements
        'Ново': 'New', 'Покажи по-малко': 'Show less', 'Покажи още ({n})': 'Show more ({n})',
        'Неуспешно зареждане на съобщенията. Ще опитаме отново.': 'Could not load the announcements. We will try again.',
        'Столична община': 'Sofia Municipality',
        'Новини и съобщения': 'News and announcements',
        'Последни новини': 'Latest news', 'Официални съобщения': 'Official announcements',
        'БТА': 'BTA', 'Свят': 'World', 'Балкани': 'Balkans',
        'Няма съобщения в момента.': 'No items right now.',
        'В момента не отговаря: {sources}.': 'Currently not responding: {sources}.',
        'Печат / PDF': 'Print / PDF',
        'Сгради за временно настаняване': 'Temporary shelter buildings',
        '{n} без данни': '{n} without data',
        'Норма': 'Normal', 'Внимание': 'Caution', 'Опасност': 'Danger', 'Тревога': 'Alarm', 'Активно': 'Active', 'Инфо': 'Info',
        'P-01 / Карта': 'P-01 / Map', 'P-02 / Укрития': 'P-02 / Shelters', 'P-03 / Вода': 'P-03 / Water',
        'P-04 / Сигнали': 'P-04 / Sirens', 'P-05 / Планове': 'P-05 / Plans', 'P-06 / Печат': 'P-06 / Print',
        'Документ за печат за всеки район': 'A printable document for every district',
        'Информационен поток': 'Information feed', 'Източници': 'Sources',
        '⌘ + колелце за увеличаване': 'Use ⌘ + scroll to zoom the map',
        'Ctrl + колелце за увеличаване': 'Use Ctrl + scroll to zoom the map'
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
