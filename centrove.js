// Point types: [label, colour]. Index matches the third field of each row in data/centrove.json
const TYPES = [
    ['Сграда за временно настаняване', '#3b82f6'],
    ['Раздаване на йодни таблетки', '#f59e0b'],
    ['Палатков лагер', '#22c55e'],
    ['Доставка на йодни таблетки (основен/резервен)', '#ef4444']
];

const visibleTypes = new Set([0, 1, 2, 3]);
let points = [];
let selectedRayon = '';
let userMarker = null;

const map = L.map('map', { preferCanvas: true }).setView([42.6977, 23.3219], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
const layer = L.layerGroup().addTo(map);

// Build popup content with DOM nodes so names from the dataset are never parsed as HTML
function popupFor(p) {
    const div = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = p.name || p.fn || TYPES[p.type][0];
    div.appendChild(title);
    const lines = [TYPES[p.type][0] + (p.sub ? ' – ' + p.sub.toLowerCase() : ''), p.fn, p.rayon ? 'Район ' + p.rayon : ''];
    lines.filter(Boolean).forEach(text => {
        div.appendChild(document.createElement('br'));
        div.appendChild(document.createTextNode(text));
    });
    div.appendChild(document.createElement('br'));
    div.appendChild(directionsLink(p));
    return div;
}

function directionsLink(p) {
    const a = document.createElement('a');
    a.href = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = '🧭 Маршрут';
    return a;
}

function render() {
    layer.clearLayers();
    const shown = [];
    points.forEach(p => {
        if (!visibleTypes.has(p.type)) return;
        if (selectedRayon && p.rayon !== selectedRayon) return;
        L.circleMarker([p.lat, p.lng], {
            radius: p.type === 3 ? 8 : 6,
            color: '#0f172a',
            weight: 1,
            fillColor: TYPES[p.type][1],
            fillOpacity: 0.9
        }).bindPopup(() => popupFor(p)).addTo(layer);
        shown.push([p.lat, p.lng]);
    });
    if (selectedRayon && shown.length) map.fitBounds(shown, { padding: [30, 30] });
}

function buildFilters() {
    const box = document.getElementById('type-filters');
    TYPES.forEach(([label, colour], i) => {
        const count = points.filter(p => p.type === i).length;
        const btn = document.createElement('button');
        btn.className = 'type-chip active';
        btn.innerHTML = `<span class="type-dot" style="background:${colour}"></span>`;
        btn.appendChild(document.createTextNode(`${label} (${count})`));
        btn.addEventListener('click', () => {
            if (visibleTypes.has(i)) visibleTypes.delete(i); else visibleTypes.add(i);
            btn.classList.toggle('active');
            render();
        });
        box.appendChild(btn);
    });

    const select = document.getElementById('rayon-select');
    [...new Set(points.map(p => p.rayon).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'bg')).forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = 'Район ' + r;
        select.appendChild(opt);
    });
    select.addEventListener('change', () => {
        selectedRayon = select.value;
        render();
        if (!selectedRayon) map.setView([42.6977, 23.3219], 12);
    });
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

function showNearest(lat, lng) {
    const box = document.getElementById('nearest');
    box.innerHTML = '<h3>Най-близо до вас</h3>';
    const list = document.createElement('div');
    list.className = 'nearest-list';

    TYPES.forEach(([label, colour], i) => {
        let best = null;
        points.forEach(p => {
            if (p.type !== i) return;
            const d = distanceKm(lat, lng, p.lat, p.lng);
            if (!best || d < best.d) best = { p, d };
        });
        if (!best) return;

        const item = document.createElement('div');
        item.className = 'nearest-item';
        item.style.borderLeftColor = colour;
        const type = document.createElement('div');
        type.className = 'nearest-type';
        type.textContent = label;
        const name = document.createElement('div');
        name.className = 'nearest-name';
        name.textContent = best.p.name || best.p.fn;
        const meta = document.createElement('div');
        meta.className = 'nearest-meta';
        meta.textContent = `${formatDistance(best.d)}${best.p.rayon ? ' · Район ' + best.p.rayon : ''} · `;
        meta.appendChild(directionsLink(best.p));
        item.append(type, name, meta);
        item.addEventListener('click', e => {
            if (e.target.tagName === 'A') return;
            map.setView([best.p.lat, best.p.lng], 16);
        });
        list.appendChild(item);
    });
    box.appendChild(list);
}

document.getElementById('locate-btn').addEventListener('click', () => {
    const btn = document.getElementById('locate-btn');
    if (!navigator.geolocation) {
        alert('Браузърът ви не поддържа определяне на местоположение.');
        return;
    }
    btn.textContent = '⏳ Търсене...';
    navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.circleMarker([latitude, longitude], {
            radius: 9, color: '#fff', weight: 3, fillColor: '#6366f1', fillOpacity: 1
        }).bindPopup('Вие сте тук').addTo(map);
        map.setView([latitude, longitude], 14);
        showNearest(latitude, longitude);
        btn.textContent = '📍 Намери най-близкия';
    }, () => {
        alert('Не успяхме да определим местоположението ви. Проверете дали сте разрешили достъп до локацията.');
        btn.textContent = '📍 Намери най-близкия';
    }, { enableHighAccuracy: true, timeout: 15000 });
});

fetch('data/centrove.json')
    .then(r => r.json())
    .then(rows => {
        points = rows.map(([lat, lng, type, name, fn, rayon, sub]) => ({ lat, lng, type, name, fn, rayon, sub }));
        buildFilters();
        render();
    })
    .catch(() => {
        document.getElementById('nearest').textContent = 'Неуспешно зареждане на данните.';
    });
