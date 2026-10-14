// News card on the homepage (from /api/status?part=news), with two tabs:
// latest news from BTA (default) and official announcements (ГДПБЗН + Sofia municipality)
(function () {
    const SHOW = 5;
    const NEW_DAYS = 3;
    const { t } = I18N;
    const locale = I18N.lang === 'en' ? 'en-GB' : 'bg-BG';
    const list = document.getElementById('news-list');
    const more = document.getElementById('news-more');
    const note = document.getElementById('news-source');
    const tabs = document.querySelectorAll('.news-tab');
    const NOTES = {
        latest: 'Последни новини от БТА (Българска телеграфна агенция) – разделите България, Свят и Балкани. Заглавията се показват дословно с връзка към оригинала.',
        official: 'От ГДПБЗН (пожарна безопасност и защита на населението) и Столична община (раздел „Сигурност“). Съобщенията се показват дословно с връзка към оригинала.'
    };
    let tab = 'latest';
    let chosen = false;  // the visitor picked a tab themselves
    let expanded = false;
    let data = null;

    function stamp(item) {
        const d = new Date(item.date);
        if (!item.timed) {
            return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
        }
        const today = new Date().toDateString() === d.toDateString();
        return today
            ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
            : d.toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    function badge(cls, text) {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = text;
        return span;
    }

    function render() {
        const items = data ? data[tab] || [] : [];
        list.replaceChildren();
        note.textContent = t(NOTES[tab]);
        const down = (data?.failed || []).map(f => I18N.text(f.source));
        if (down.length) note.textContent += ' ' + t('В момента не отговаря: {sources}.', { sources: down.join(', ') });
        if (!items.length) {
            list.textContent = data ? t('Няма съобщения в момента.') : t('Зареждане...');
            more.hidden = true;
            return;
        }
        const now = Date.now();
        (expanded ? items : items.slice(0, SHOW)).forEach(item => {
            const a = document.createElement('a');
            a.className = 'news-item';
            a.href = item.url;
            a.target = '_blank';
            a.rel = 'noopener';
            const meta = document.createElement('div');
            meta.className = 'news-meta';
            meta.append(badge('news-source', I18N.text(item.source)));
            if (item.section) meta.append(badge('news-section', t(item.section)));
            meta.append(badge('news-date', stamp(item)));
            if (!item.timed && now - item.date < NEW_DAYS * 86400e3) meta.append(badge('news-new', t('Ново')));
            const title = document.createElement('div');
            title.className = 'news-title-text';
            title.textContent = item.title;
            a.append(meta, title);
            list.append(a);
        });
        more.hidden = items.length <= SHOW;
        more.textContent = expanded ? t('Покажи по-малко') : t('Покажи още ({n})', { n: items.length - SHOW });
    }

    function select(name) {
        tab = name;
        expanded = false;
        tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
        render();
    }

    tabs.forEach(btn => btn.addEventListener('click', () => {
        chosen = true;
        select(btn.dataset.tab);
    }));

    more.addEventListener('click', () => {
        expanded = !expanded;
        render();
    });

    async function load() {
        try {
            const res = await fetch('/api/status?part=news&v=3');
            const json = await res.json();
            if (!json.ok) throw new Error(json.error);
            // Older response format had a single "items" list of official announcements
            data = { latest: json.latest || [], official: json.official || json.items || [], failed: json.failed || [] };
            // If BTA is unavailable, open on the official announcements rather than an empty list
            if (!chosen && !data.latest.length && data.official.length) select('official');
            else render();
        } catch {
            if (!data) list.textContent = t('Неуспешно зареждане на съобщенията. Ще опитаме отново.');
        }
    }

    render();
    load();
    setInterval(load, 10 * 60 * 1000);
})();
