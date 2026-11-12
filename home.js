// Homepage: one line under the search box with the overall level for Sofia, graded by the same
// rules as the operations wall and the place page (status-rules.js). Links to the wall.
(function () {
    const { t } = I18N;
    const R = StatusRules;
    const box = document.getElementById('home-status');
    if (!box) return;

    async function load() {
        const [w, q, a, r] = await Promise.all(['warnings', 'earthquakes', 'air', 'radiation'].map(R.loadPart));
        if (![w, q, a, r].some(x => x.ok)) {
            box.querySelector('.home-status-text').textContent = t('Обстановка в София: няма връзка с източниците');
            box.className = 'home-status tone-na';
            return;
        }
        const tones = [];
        if (w.ok) tones.push(R.warningTone(w.items));
        if (q.ok) tones.push(R.quakeTone(q.items));
        if (a.ok && a.sensors.length) tones.push(R.airBand(R.median(a.sensors.map(s => s[2])))[1]);
        const readings = r.ok ? r.sofia.filter(s => s.value !== null) : [];
        if (readings.length) tones.push(R.radiationTone(Math.max(...readings.map(s => s.value))));
        const level = R.levelOf(tones);
        let text = t('Обстановка в София: {word} · ниво {level}', { word: t(R.ASSESSMENT[level]), level });
        if (w.ok && w.items.length) text += ` · ${t(R.LEVELS[w.items[0].level][1])}: ${w.items[0].event}`;
        box.querySelector('.home-status-text').textContent = text;
        box.className = `home-status tone-${R.LEVEL_TONES[level]}`;
    }

    load();
    setInterval(load, 10 * 60 * 1000);
})();
