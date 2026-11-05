// The layer list, marker shapes and basemap are shared with the home page (map-style.js)
const { LAYERS, SOFIA, marker, swatch, popupFor, directionsLink } = MapStyle;
const layerByKey = Object.fromEntries(LAYERS.map(l => [l.key, l]));
const groups = {};
const visible = new Set();
const chips = {};
const chipCounts = {};
let data = {};
let outline = null;
let userPos = null;
let userMarker = null;

const map = L.map('map', { renderer: MapStyle.renderer() }).setView(SOFIA, 12);
MapStyle.basemap(map);
MapStyle.autoScale(map);

// Rows of a layer limited to the district picked in the navbar (all of Sofia if none)
function rowsFor(key) {
    const d = SofiaDistrict.get();
    return (data[key] || []).filter(p => !d || p[5] === d.index);
}

function buildLayer(layer) {
    if (groups[layer.key]) map.removeLayer(groups[layer.key]);
    const group = L.layerGroup();
    rowsFor(layer.key).forEach(p => {
        marker(layer, p).bindPopup(() => popupFor(layer, p)).addTo(group);
    });
    groups[layer.key] = group;
    if (visible.has(layer.key)) group.addTo(map);
    if (chipCounts[layer.key]) chipCounts[layer.key].textContent = String(rowsFor(layer.key).length);
}

async function applyDistrict(d, fit = true) {
    LAYERS.forEach(buildLayer);
    if (outline) map.removeLayer(outline);
    outline = null;
    document.getElementById('district-note').textContent = d
        ? I18N.t('Показани са обектите в {district}. „Намери най-близкия“ търси в цяла София.', { district: I18N.district(d.name) })
        : '';
    if (!d) {
        if (fit) map.setView(SOFIA, 12);
        return;
    }
    const shape = (await SofiaDistrict.shapes())[d.index];
    if (SofiaDistrict.get() !== d) return;  // changed again while loading
    outline = MapStyle.districtOverlay(shape).addTo(map);
    if (fit) map.fitBounds(outline.getBounds(), { padding: [20, 20] });
}

function setVisible(key, on) {
    if (on) {
        visible.add(key);
        groups[key].addTo(map);
    } else {
        visible.delete(key);
        map.removeLayer(groups[key]);
    }
    chips[key].classList.toggle('active', on);
    chips[key].setAttribute('aria-pressed', String(on));
    if (userPos) showNearest();
}

function buildFilters() {
    const box = document.getElementById('type-filters');
    LAYERS.forEach(layer => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'type-chip';
        btn.setAttribute('aria-pressed', 'false');
        const name = document.createElement('span');
        name.className = 'type-name';
        name.textContent = I18N.t(layer.label);
        chipCounts[layer.key] = document.createElement('span');
        chipCounts[layer.key].className = 'type-count';
        chipCounts[layer.key].textContent = String(rowsFor(layer.key).length);
        btn.append(swatch(layer), name, chipCounts[layer.key]);
        btn.addEventListener('click', () => setVisible(layer.key, !visible.has(layer.key)));
        chips[layer.key] = btn;
        box.appendChild(btn);
    });
    document.getElementById('all-on').addEventListener('click', () => LAYERS.forEach(l => setVisible(l.key, true)));
    document.getElementById('all-off').addEventListener('click', () => LAYERS.forEach(l => setVisible(l.key, false)));
}

// Haversine distance in km
function distanceKm(lat1, lng1, lat2, lng2) {
    const r = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * r / 2) ** 2 +
        Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lng2 - lng1) * r / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a));
}

function formatDistance(km) {
    return km < 1 ? I18N.t('{n} м', { n: Math.round(km * 1000) }) : I18N.t('{n} км', { n: km.toFixed(1) });
}

function showNearest() {
    const box = document.getElementById('nearest');
    box.innerHTML = '';
    const [lat, lng] = userPos;
    const shown = LAYERS.filter(l => visible.has(l.key));
    if (!shown.length) return;

    const heading = document.createElement('h3');
    heading.textContent = I18N.t('Най-близо до вас');
    const list = document.createElement('div');
    list.className = 'nearest-list';

    shown.forEach(layer => {
        let best = null;
        (data[layer.key] || []).forEach(p => {
            const d = distanceKm(lat, lng, p[0], p[1]);
            if (!best || d < best.d) best = { p, d };
        });
        if (!best) return;
        const [plat, plng, name] = best.p;

        const item = document.createElement('div');
        item.className = 'nearest-item';
        const type = document.createElement('div');
        type.className = 'nearest-type';
        type.append(swatch(layer), I18N.t(layer.label));
        const title = document.createElement('div');
        title.className = 'nearest-name';
        title.textContent = I18N.text(name) || I18N.t(layer.label);
        const meta = document.createElement('div');
        meta.className = 'nearest-meta';
        meta.textContent = `${formatDistance(best.d)} · `;
        meta.appendChild(directionsLink(plat, plng));
        item.append(type, title, meta);
        item.addEventListener('click', e => {
            if (e.target.tagName === 'A') return;
            map.setView([plat, plng], 17);
            document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        list.appendChild(item);
    });
    box.append(heading, list);
}

document.getElementById('locate-btn').addEventListener('click', () => {
    const btn = document.getElementById('locate-btn');
    if (!navigator.geolocation) {
        alert(I18N.t('Браузърът ви не поддържа определяне на местоположение.'));
        return;
    }
    btn.textContent = I18N.t('Търсене...');
    navigator.geolocation.getCurrentPosition(pos => {
        userPos = [pos.coords.latitude, pos.coords.longitude];
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.circleMarker(userPos, {
            radius: 8, color: '#0A0C0F', weight: 3, fillColor: '#F2A93B', fillOpacity: 1
        }).bindPopup(I18N.t('Вие сте тук')).addTo(map);
        map.setView(userPos, 15);
        showNearest();
        btn.textContent = I18N.t('Намери най-близкия');
    }, () => {
        alert(I18N.t('Не успяхме да определим местоположението ви. Проверете дали сте разрешили достъп до локацията.'));
        btn.textContent = I18N.t('Намери най-близкия');
    }, { enableHighAccuracy: true, timeout: 15000 });
});

// Initial layers: ?layers=shelters,fountains in the URL, otherwise every layer not marked off
function initialLayers() {
    const param = new URLSearchParams(location.search).get('layers');
    const requested = param ? param.split(',').filter(k => layerByKey[k]) : [];
    return requested.length ? requested : LAYERS.filter(l => !l.off).map(l => l.key);
}

fetch('data/karta.json')
    .then(r => r.json())
    .then(json => {
        data = json.layers;
        LAYERS.forEach(buildLayer);
        buildFilters();
        initialLayers().forEach(k => setVisible(k, true));
        if (SofiaDistrict.get()) applyDistrict(SofiaDistrict.get());
        SofiaDistrict.onChange(d => applyDistrict(d));
        const dates = Object.values(json.updated || {}).sort();
        if (dates.length) {
            const [y, m, d] = dates[0].split('-');
            document.getElementById('updated').textContent = I18N.t(' (последно: {date})', { date: `${d}.${m}.${y}` });
        }
    })
    .catch(() => {
        document.getElementById('nearest').textContent = I18N.t('Неуспешно зареждане на данните.');
    });
