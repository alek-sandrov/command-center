// Map layers in display order. Keys match data/karta.json; rows are
// [lat, lng, name, info, extra, districtIndex] (districtIndex matches district.js, -1 = outside)
const LAYERS = [
    { key: 'shelters', icon: '🛡️', label: 'Бомбоубежища', colour: '#6366f1', radius: 8 },
    { key: 'evac', icon: '🏫', label: 'Сгради за настаняване', colour: '#3b82f6' },
    { key: 'iodine', icon: '💊', label: 'Йодни таблетки', colour: '#f59e0b' },
    { key: 'tents', icon: '⛺', label: 'Палатки', colour: '#22c55e' },
    { key: 'fountains', icon: '💧', label: 'Чешмите', colour: '#06b6d4' },
    { key: 'springs', icon: '♨️', label: 'Минерални извори', colour: '#14b8a6' },
    { key: 'metro', icon: '🚇', label: 'Метро', colour: '#a855f7' },
    { key: 'hospitals', icon: '🏥', label: 'Болници', colour: '#ef4444' },
    { key: 'pharmacies', icon: '⚕️', label: 'Аптеки', colour: '#ec4899', radius: 4, off: true }
];

const SOFIA = [42.6977, 23.3219];
const layerByKey = Object.fromEntries(LAYERS.map(l => [l.key, l]));
const groups = {};
const visible = new Set();
const chips = {};
const chipCounts = {};
let data = {};
let outline = null;
let userPos = null;
let userMarker = null;

const map = L.map('map', { preferCanvas: true }).setView(SOFIA, 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

function directionsLink(lat, lng) {
    const a = document.createElement('a');
    a.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = '🧭 Маршрут';
    return a;
}

// Popups are built from DOM nodes so text from the data sources is never parsed as HTML
function popupFor(layer, [lat, lng, name, info, extra]) {
    const div = document.createElement('div');
    const kind = document.createElement('div');
    kind.className = 'popup-kind';
    kind.textContent = `${layer.icon} ${layer.label}`;
    const title = document.createElement('strong');
    title.textContent = name || layer.label;
    div.append(kind, title);
    [info !== name ? info : '', extra === 'вход' ? '' : extra].filter(Boolean).forEach(text => {
        div.appendChild(document.createElement('br'));
        div.appendChild(document.createTextNode(text));
    });
    div.appendChild(document.createElement('br'));
    div.appendChild(directionsLink(lat, lng));
    return div;
}

// Rows of a layer limited to the district picked in the navbar (all of Sofia if none)
function rowsFor(key) {
    const d = SofiaDistrict.get();
    return (data[key] || []).filter(p => !d || p[5] === d.index);
}

function buildLayer(layer) {
    if (groups[layer.key]) map.removeLayer(groups[layer.key]);
    const group = L.layerGroup();
    rowsFor(layer.key).forEach(p => {
        const small = p[4] === 'вход';
        L.circleMarker([p[0], p[1]], {
            radius: small ? 4 : (layer.radius || 6),
            color: '#0f172a',
            weight: 1,
            fillColor: layer.colour,
            fillOpacity: 0.9
        }).bindPopup(() => popupFor(layer, p)).addTo(group);
    });
    groups[layer.key] = group;
    if (visible.has(layer.key)) group.addTo(map);
    if (chipCounts[layer.key]) chipCounts[layer.key].textContent = `${layer.icon} ${layer.label} (${rowsFor(layer.key).length})`;
}

async function applyDistrict(d, fit = true) {
    LAYERS.forEach(buildLayer);
    if (outline) map.removeLayer(outline);
    outline = null;
    document.getElementById('district-note').textContent = d
        ? `Показани са обектите в Район ${d.name}. „Намери най-близкия“ търси в цяла София.`
        : '';
    if (!d) {
        if (fit) map.setView(SOFIA, 12);
        return;
    }
    const shape = (await SofiaDistrict.shapes())[d.index];
    if (SofiaDistrict.get() !== d) return;  // changed again while loading
    outline = L.polygon(shape.polygons.map(poly => poly.map(ring => ring.map(([lng, lat]) => [lat, lng]))), {
        color: '#6366f1', weight: 3, fill: true, fillOpacity: 0.04, interactive: false
    }).addTo(map);
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
    if (userPos) showNearest();
}

function buildFilters() {
    const box = document.getElementById('type-filters');
    LAYERS.forEach(layer => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'type-chip';
        const dot = document.createElement('span');
        dot.className = 'type-dot';
        dot.style.background = layer.colour;
        chipCounts[layer.key] = document.createTextNode(`${layer.icon} ${layer.label} (${rowsFor(layer.key).length})`);
        btn.append(dot, chipCounts[layer.key]);
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
    return km < 1 ? `${Math.round(km * 1000)} м` : `${km.toFixed(1)} км`;
}

function showNearest() {
    const box = document.getElementById('nearest');
    box.innerHTML = '';
    const [lat, lng] = userPos;
    const shown = LAYERS.filter(l => visible.has(l.key));
    if (!shown.length) return;

    const heading = document.createElement('h3');
    heading.textContent = 'Най-близо до вас';
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
        item.style.borderLeftColor = layer.colour;
        const type = document.createElement('div');
        type.className = 'nearest-type';
        type.textContent = `${layer.icon} ${layer.label}`;
        const title = document.createElement('div');
        title.className = 'nearest-name';
        title.textContent = name || layer.label;
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
        alert('Браузърът ви не поддържа определяне на местоположение.');
        return;
    }
    btn.textContent = '⏳ Търсене...';
    navigator.geolocation.getCurrentPosition(pos => {
        userPos = [pos.coords.latitude, pos.coords.longitude];
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.circleMarker(userPos, {
            radius: 9, color: '#fff', weight: 3, fillColor: '#0ea5e9', fillOpacity: 1
        }).bindPopup('Вие сте тук').addTo(map);
        map.setView(userPos, 15);
        showNearest();
        btn.textContent = '📍 Намери най-близкия';
    }, () => {
        alert('Не успяхме да определим местоположението ви. Проверете дали сте разрешили достъп до локацията.');
        btn.textContent = '📍 Намери най-близкия';
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
            document.getElementById('updated').textContent = ` (последно: ${d}.${m}.${y})`;
        }
    })
    .catch(() => {
        document.getElementById('nearest').textContent = 'Неуспешно зареждане на данните.';
    });
