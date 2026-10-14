// "Материали за печат": one card per district with the ready PDF (pechat/rayon-<slug>.pdf)
// and a link to the live print page. The selected district is shown first.
(function () {
    const { t } = I18N;
    const box = document.getElementById('sheet-list');

    function card(d, mine) {
        const div = document.createElement('div');
        div.className = `sheet-card${mine ? ' mine' : ''}`;
        const name = document.createElement('div');
        name.className = 'sheet-card-name';
        name.textContent = I18N.district(d.name);
        if (mine) {
            const badge = document.createElement('span');
            badge.className = 'news-new';
            badge.textContent = t('Вашият район');
            name.append(' ', badge);
        }
        const actions = document.createElement('div');
        actions.className = 'sheet-card-actions';
        const pdf = document.createElement('a');
        pdf.href = `pechat/rayon-${d.slug}.pdf`;
        pdf.textContent = t('📄 PDF');
        pdf.setAttribute('download', '');
        const print = document.createElement('a');
        print.href = `listovka.html?rayon=${d.slug}`;
        print.textContent = t('🖨️ Отвори за печат');
        actions.append(pdf, print);
        div.append(name, actions);
        return div;
    }

    function render(current) {
        const list = [...SofiaDistrict.list];
        if (current) list.sort((a, b) => (b === current) - (a === current));
        box.replaceChildren(...list.map(d => card(d, d === current)));
    }

    SofiaDistrict.onChange(render);
    render(SofiaDistrict.get());
})();
