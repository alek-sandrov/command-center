// Official announcements feed on the homepage (from /api/status?part=news)
(function () {
    const SHOW = 5;
    const NEW_DAYS = 3;
    const list = document.getElementById('news-list');
    const more = document.getElementById('news-more');
    let expanded = false;
    let items = [];

    function render() {
        list.replaceChildren();
        const now = Date.now();
        (expanded ? items : items.slice(0, SHOW)).forEach(item => {
            const a = document.createElement('a');
            a.className = 'news-item';
            a.href = item.url;
            a.target = '_blank';
            a.rel = 'noopener';
            const meta = document.createElement('div');
            meta.className = 'news-meta';
            const source = document.createElement('span');
            source.className = 'news-source';
            source.textContent = item.source;
            const date = document.createElement('span');
            date.textContent = new Date(item.date).toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
            meta.append(source, date);
            if (now - item.date < NEW_DAYS * 86400e3) {
                const badge = document.createElement('span');
                badge.className = 'news-new';
                badge.textContent = 'Ново';
                meta.append(badge);
            }
            const title = document.createElement('div');
            title.className = 'news-title-text';
            title.textContent = item.title;
            a.append(meta, title);
            list.append(a);
        });
        more.hidden = items.length <= SHOW;
        more.textContent = expanded ? 'Покажи по-малко' : `Покажи още (${items.length - SHOW})`;
    }

    more.addEventListener('click', () => {
        expanded = !expanded;
        render();
    });

    async function load() {
        try {
            const res = await fetch('/api/status?part=news');
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            items = data.items;
            render();
        } catch {
            if (!items.length) list.textContent = 'Неуспешно зареждане на съобщенията. Ще опитаме отново.';
        }
    }

    load();
    setInterval(load, 15 * 60 * 1000);
})();
