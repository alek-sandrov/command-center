// Shows only the selected district's PDF maps on rayoni.html, with a button to show all.
(function () {
    const items = [...document.querySelectorAll('.map-gallery .map-item')];
    const groupBits = document.querySelectorAll('.map-gallery .section-letter, .map-gallery .section-anchor, .quick-nav');
    const note = document.getElementById('district-note');
    let showAll = false;

    function belongsTo(item, name) {
        const label = item.querySelector('.map-label').textContent.trim();
        return label === `Район ${name}` || label.startsWith(`Район ${name} `);
    }

    function apply() {
        const d = SofiaDistrict.get();
        const filter = d && !showAll;
        let shown = 0;
        items.forEach(item => {
            const on = !filter || belongsTo(item, d.name);
            item.hidden = !on;
            shown += on;
        });
        groupBits.forEach(el => { el.hidden = filter; });
        note.replaceChildren();
        if (!d) return;
        note.append(filter
            ? (shown ? `Показани са картите за Район ${d.name}. ` : `Няма отделна карта за Район ${d.name}. `)
            : `Показани са всички райони. `);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'link-button';
        btn.textContent = filter ? 'Покажи всички райони' : `Само Район ${d.name}`;
        btn.addEventListener('click', () => { showAll = !showAll; apply(); });
        note.append(btn);
    }

    SofiaDistrict.onChange(() => { showAll = false; apply(); });
    apply();
})();
