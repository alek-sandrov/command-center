// Shows only the selected district's PDF maps on rayoni.html, with a button to show all.
(function () {
    const items = [...document.querySelectorAll('.map-gallery .map-item')];
    const groupBits = document.querySelectorAll('.map-gallery .section-letter, .map-gallery .section-anchor, .quick-nav');
    const note = document.getElementById('district-note');
    let showAll = false;

    // Original (Bulgarian) labels, read before any translation of the page text
    const labels = new Map(items.map(item => [item, (item.getAttribute('onclick').match(/'(Район [^']+)'\)/) || [])[1] || '']));

    function belongsTo(item, name) {
        const label = labels.get(item);
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
        const district = I18N.district(d.name);
        note.append(filter
            ? I18N.t(shown ? 'Показани са картите за {district}. ' : 'Няма отделна карта за {district}. ', { district })
            : I18N.t('Показани са всички райони. '));
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'link-button';
        btn.textContent = filter ? I18N.t('Покажи всички райони') : I18N.t('Само {district}', { district });
        btn.addEventListener('click', () => { showAll = !showAll; apply(); });
        note.append(btn);
    }

    SofiaDistrict.onChange(() => { showAll = false; apply(); });
    apply();
})();
