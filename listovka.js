// Fills the printable A4 district sheet (listovka.html) from data/karta.json for the district
// chosen in the navbar. Sets window.sheetReady once the map tiles and QR code are drawn,
// so scripts/build_sheets.cjs knows when to save the PDF.
(function () {
    const { t } = I18N;
    const SITE = 'https://sofia-prepping.com';
    // Layer → colour and how many items fit on the page (the rest are on the live map)
    const LISTS = {
        shelters: { colour: '#4f46e5', max: 13 },
        iodine: { colour: '#d97706', max: 14 },
        evac: { colour: '#2563eb', max: 10 },
        hospitals: { colour: '#dc2626', max: 6 }
    };
    // Shelters and hospitals: when a district has fewer than 2 of its own, add the nearest from neighbouring districts
    const NEIGHBOURS = { shelters: 3, hospitals: 3 };

    let map = null;
    let dataPromise = null;

    function loadData() {
        return (dataPromise ||= Promise.all([
            fetch('data/karta.json').then(r => r.json()),
            SofiaDistrict.shapes()
        ]));
    }

    function distanceKm(lat1, lng1, lat2, lng2) {
        const r = Math.PI / 180;
        const a = Math.sin((lat2 - lat1) * r / 2) ** 2 +
            Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lng2 - lng1) * r / 2) ** 2;
        return 12742 * Math.asin(Math.sqrt(a));
    }

    function marker(colour, n) {
        const size = n > 9 ? 19 : 17;
        return L.divIcon({
            className: '',
            html: `<div class="sheet-marker" style="background:${colour};width:${size}px;height:${size}px">${n}</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        });
    }

    function item(colour, n, text, extra) {
        const li = document.createElement('li');
        const num = document.createElement('span');
        num.className = 'num';
        num.style.background = colour;
        num.textContent = n;
        const label = document.createElement('span');
        label.textContent = text;
        if (extra) {
            const near = document.createElement('span');
            near.className = 'near';
            near.textContent = ` ${extra}`;
            label.append(near);
        }
        li.append(num, label);
        return li;
    }

    function note(cls, text) {
        const li = document.createElement('li');
        li.className = cls;
        li.textContent = text;
        return li;
    }

    async function build(d) {
        const sheet = document.getElementById('sheet');
        const empty = document.getElementById('sheet-empty');
        window.sheetReady = false;
        if (!d) {
            sheet.hidden = true;
            empty.hidden = false;
            return;
        }
        empty.hidden = true;
        sheet.hidden = false;

        const [{ layers, updated }, shapes] = await loadData();
        if (SofiaDistrict.get() !== d) return;  // changed while loading
        const shape = shapes[d.index];
        const [s, w, n, e] = shape.bbox;
        const centre = [(s + n) / 2, (w + e) / 2];
        const inDistrict = key => (layers[key] || []).filter(p => p[5] === d.index);

        document.getElementById('sheet-title').textContent = I18N.district(d.name);
        document.title = `${I18N.district(d.name)} – ${t('листовка')} - sofia-prepping.com`;

        if (map) map.remove();
        map = L.map('sheet-map', {
            zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false,
            doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, zoomSnap: 0.25
        });
        const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
        const outline = L.polygon(shape.polygons.map(poly => poly.map(ring => ring.map(([lng, lat]) => [lat, lng]))), {
            color: '#4f46e5', weight: 2.5, fillOpacity: 0.05, interactive: false
        }).addTo(map);
        const bounds = outline.getBounds();

        for (const [key, { colour, max }] of Object.entries(LISTS)) {
            const ol = document.querySelector(`.sheet-list[data-layer="${key}"] ol`);
            ol.replaceChildren();
            let rows = inDistrict(key).map(p => ({ p }));
            if (NEIGHBOURS[key] && rows.length < 2) {
                const outside = (layers[key] || []).filter(p => p[5] !== d.index)
                    .map(p => ({ p, km: distanceKm(centre[0], centre[1], p[0], p[1]) }))
                    .sort((a, b) => a.km - b.km)
                    .slice(0, NEIGHBOURS[key]);
                rows = rows.concat(outside);
            }
            if (!rows.length) {
                ol.append(note('none', t('Няма в района – вижте актуалната карта.')));
                continue;
            }
            rows.slice(0, max).forEach(({ p, km }, i) => {
                const extra = km !== undefined ? t('(съседен район, {km} км)', { km: km.toFixed(1) }) : '';
                ol.append(item(colour, i + 1, I18N.text(p[2]), extra));
                L.marker([p[0], p[1]], { icon: marker(colour, i + 1), interactive: false }).addTo(map);
                if (km !== undefined) bounds.extend([p[0], p[1]]);
            });
            if (rows.length > max) ol.append(note('more', t('+ още {n} – на актуалната карта (QR кода)', { n: rows.length - max })));
        }
        map.fitBounds(bounds, { padding: [14, 14] });

        const count = key => inDistrict(key).length;
        document.getElementById('sheet-summary').textContent = t(
            'Също в района: ⛺ палатъчни лагери: {tents} · 💧 чешми: {fountains} · ♨️ минерални извори: {springs} · 🚇 метро (станции и входове): {metro}',
            { tents: count('tents'), fountains: count('fountains'), springs: count('springs'), metro: count('metro') });

        const dates = Object.values(updated || {}).sort();
        const [y, m, day] = (dates[0] || '').split('-');
        document.getElementById('sheet-sources').textContent = t(
            'Данни: Столична община (отворени данни), ГДПБЗН, OpenStreetMap · към {date} · Проверявайте актуалната информация на sofia-prepping.com',
            { date: dates[0] ? `${day}.${m}.${y}` : '' });

        const qr = document.getElementById('qr');
        qr.replaceChildren();
        const target = `${SITE}/karta.html?rayon=${d.slug}${I18N.lang === 'en' ? '&lang=en' : ''}`;
        new QRCode(qr, { text: target, width: 240, height: 240, correctLevel: QRCode.CorrectLevel.M });

        // Ready once the visible tiles have loaded (or after a timeout, so a slow tile never blocks printing)
        await Promise.race([
            new Promise(resolve => tiles.once('load', resolve)),
            new Promise(resolve => setTimeout(resolve, 10000))
        ]);
        if (SofiaDistrict.get() === d) window.sheetReady = true;
    }

    document.getElementById('print-btn').addEventListener('click', () => window.print());
    SofiaDistrict.onChange(build);
    build(SofiaDistrict.get());
})();
