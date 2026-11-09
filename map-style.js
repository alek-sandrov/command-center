// Shared look of the Leaflet maps (home page and karta.html): the layer list with a marker
// shape and colour per layer, a dark basemap, the district outline and the popups.
// Markers are drawn on one canvas (renderer()), so the whole city stays fast.
(function () {
    // Keys match data/karta.json; rows are [lat, lng, name, info, extra, districtIndex]
    const LAYERS = [
        { key: 'shelters', label: 'Бомбоубежища', shape: 'square', colour: '#E6E9ED', radius: 7 },
        { key: 'evac', label: 'Сгради за настаняване', shape: 'square', colour: '#0D1014', stroke: '#E6E9ED', radius: 6 },
        { key: 'iodine', label: 'Йодни таблетки', shape: 'diamond', colour: '#F2A93B', radius: 6.5 },
        { key: 'tents', label: 'Палатки', shape: 'triangle', colour: '#4CC38A', radius: 7 },
        { key: 'fountains', label: 'Чешмите', shape: 'circle', colour: '#5FD4E6', radius: 6 },
        { key: 'springs', label: 'Минерални извори', shape: 'circle', colour: '#0D1014', stroke: '#5FD4E6', radius: 6 },
        { key: 'metro', label: 'Метро', shape: 'square', colour: '#7FB2FF', radius: 5 },
        { key: 'hospitals', label: 'Болници', shape: 'cross', colour: '#FF6B6B', radius: 7.5 },
        { key: 'pharmacies', label: 'Аптеки', shape: 'circle', colour: '#D29BFF', radius: 4.5, off: true }
    ];
    const SOFIA = [42.6977, 23.3219];
    const ACCENT = '#F2A93B';
    const YOU = '#3B82F6';  // the visitor's own position

    // Outline of a shape centred on (x, y) with "radius" s, as a list of points
    function outline(shape, x, y, s) {
        const t = s * 0.38;
        switch (shape) {
            case 'square': return [[x - s, y - s], [x + s, y - s], [x + s, y + s], [x - s, y + s]];
            case 'diamond': return [[x, y - s * 1.3], [x + s * 1.3, y], [x, y + s * 1.3], [x - s * 1.3, y]];
            case 'triangle': return [[x, y - s * 1.2], [x + s * 1.15, y + s * 0.85], [x - s * 1.15, y + s * 0.85]];
            case 'cross': return [[x - t, y - s], [x + t, y - s], [x + t, y - t], [x + s, y - t], [x + s, y + t], [x + t, y + t],
                [x + t, y + s], [x - t, y + s], [x - t, y + t], [x - s, y + t], [x - s, y - t], [x - t, y - t]];
            default: return null;
        }
    }

    // A circle marker that can also be drawn as a square, diamond, triangle or cross on canvas
    const ShapeMarker = L.CircleMarker.extend({
        options: { shape: 'circle' },
        _updatePath() {
            const r = this._renderer;
            const pts = outline(this.options.shape, this._point.x, this._point.y, this._radius);
            if (!pts || !(r instanceof L.Canvas)) return L.CircleMarker.prototype._updatePath.call(this);
            if (!r._drawing || this._empty()) return;
            const ctx = r._ctx;
            ctx.beginPath();
            pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.closePath();
            r._fillStroke(ctx, this);
        }
    });

    // Markers grow as you zoom in, so they are easy to see and tap up close
    let scale = 1;
    function scaleFor(zoom) {
        return zoom >= 16 ? 1.6 : zoom >= 15 ? 1.4 : zoom >= 14 ? 1.2 : 1;
    }

    // Canvas renderer with a generous hit area around each marker
    function renderer() {
        return L.canvas({ padding: 0.5, tolerance: L.Browser.mobile ? 10 : 6 });
    }

    // Keep marker sizes in step with the zoom level of this map
    function autoScale(map) {
        scale = scaleFor(map.getZoom());
        map.on('zoomend', () => {
            const next = scaleFor(map.getZoom());
            if (next === scale) return;
            scale = next;
            map.eachLayer(l => { if (l.options.baseRadius) l.setRadius(l.options.baseRadius * scale); });
        });
    }

    function marker(layer, p) {
        const small = p[4] === 'вход';
        const base = small ? Math.max(4, layer.radius - 1) : layer.radius;
        return new ShapeMarker([p[0], p[1]], {
            shape: layer.shape,
            baseRadius: base,
            radius: base * scale,
            color: layer.stroke || '#0A0C0F',
            weight: layer.stroke ? 1.5 : 1,
            fillColor: layer.colour,
            fillOpacity: 1
        });
    }

    // Small inline SVG legend swatch matching the marker
    function swatch(layer) {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width', '14');
        svg.setAttribute('height', '14');
        svg.setAttribute('viewBox', '0 0 14 14');
        svg.setAttribute('aria-hidden', 'true');
        svg.classList.add('swatch');
        const pts = outline(layer.shape, 7, 7, layer.shape === 'cross' ? 6 : 4.5);
        const el = document.createElementNS(ns, pts ? 'polygon' : 'circle');
        if (pts) el.setAttribute('points', pts.map(p => p.join(',')).join(' '));
        else { el.setAttribute('cx', 7); el.setAttribute('cy', 7); el.setAttribute('r', 4.5); }
        el.setAttribute('fill', layer.colour);
        el.setAttribute('stroke', layer.stroke || 'none');
        el.setAttribute('stroke-width', '1.5');
        svg.append(el);
        return svg;
    }

    // OpenStreetMap tiles, darkened with a CSS filter (.tiles-dark in style.css)
    function basemap(map) {
        return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            className: 'tiles-dark',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);
    }

    // Dashed outline of a district with everything outside it dimmed. Returns a layer group whose
    // getBounds() is the district's.
    function districtOverlay(shape) {
        const rings = shape.polygons.map(poly => poly.map(ring => ring.map(([lng, lat]) => [lat, lng])));
        const world = [[85, -180], [85, 180], [-85, 180], [-85, -180]];
        const line = L.polygon(rings, { color: ACCENT, weight: 1.6, dashArray: '7 5', fillColor: ACCENT, fillOpacity: 0.03, interactive: false });
        const group = L.featureGroup([
            L.polygon([world, ...rings.map(p => p[0])], { stroke: false, fillColor: '#05070A', fillOpacity: 0.55, interactive: false }),
            line
        ]);
        group.getBounds = () => line.getBounds();  // the dimmed mask covers the world; fit to the district
        return group;
    }

    function directionsLink(lat, lng) {
        const a = document.createElement('a');
        a.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = I18N.t('Маршрут') + ' ↗';
        return a;
    }

    // Built from DOM nodes so text from the data sources is never parsed as HTML
    function popupFor(layer, [lat, lng, name, info, extra]) {
        const div = document.createElement('div');
        const kind = document.createElement('div');
        kind.className = 'popup-kind';
        kind.textContent = I18N.t(layer.label);
        const title = document.createElement('strong');
        title.textContent = I18N.text(name) || I18N.t(layer.label);
        div.append(kind, title);
        [info !== name ? info : '', extra === 'вход' ? '' : extra].filter(Boolean).forEach(text => {
            const line = document.createElement('div');
            line.textContent = I18N.text(text);
            div.append(line);
        });
        const coords = document.createElement('div');
        coords.className = 'popup-coords';
        coords.textContent = `${lat.toFixed(4)}°N ${lng.toFixed(4)}°E`;
        div.append(coords, directionsLink(lat, lng));
        return div;
    }

    // The visitor's own position: a white person in a blue circle with a soft pulse, so it can't be
    // mistaken for any of the map's points (all of which are plain shapes)
    function personIcon() {
        const ns = 'http://www.w3.org/2000/svg';
        const wrap = document.createElement('div');
        wrap.className = 'you-marker';
        const pulse = document.createElement('span');
        pulse.className = 'you-pulse';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 32 32');
        svg.setAttribute('aria-hidden', 'true');
        [['circle', { cx: 16, cy: 16, r: 14, fill: YOU, stroke: '#FFFFFF', 'stroke-width': 2.5 }],
            ['circle', { cx: 16, cy: 10.5, r: 3.6, fill: '#FFFFFF' }],
            ['path', { d: 'M9.5 24.5c0-4.4 2.9-7.6 6.5-7.6s6.5 3.2 6.5 7.6z', fill: '#FFFFFF' }]].forEach(([tag, attrs]) => {
            const el = document.createElementNS(ns, tag);
            Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
            svg.append(el);
        });
        wrap.append(pulse, svg);
        return L.divIcon({ html: wrap, className: 'you-icon', iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -17] });
    }

    // "Show my location" button for a map. Nothing is asked until the visitor presses it; then the
    // browser asks for permission and, once allowed, a dot with an accuracy circle follows them as
    // they move. Pressing it again stops. If permission was already given on an earlier visit the
    // dot comes back by itself (without moving the map). The position never leaves the browser.
    // onUpdate([lat, lng]) runs on every fix; returns { start(centre) } so a page can start it too.
    function locateControl(map, { position = 'topleft', onUpdate } = {}) {
        const t = I18N.t;
        let watchId = null;
        let dot = null;
        let ring = null;
        let centreNext = false;
        let wanted = false;   // tracking switched on by the visitor (kept while the tab is hidden)
        let btn = null;

        function setActive(on) {
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-pressed', String(on));
            btn.title = on ? t('Скрий местоположението ми') : t('Покажи местоположението ми');
            btn.setAttribute('aria-label', btn.title);
        }

        function clear() {
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            watchId = null;
            [dot, ring].forEach(l => l && map.removeLayer(l));
            dot = ring = null;
        }

        function onFix(pos) {
            const at = [pos.coords.latitude, pos.coords.longitude];
            const accuracy = Math.min(pos.coords.accuracy || 0, 2000);
            if (!dot) {
                // The familiar blue "you are here" dot, so it can't be mistaken for a map point
                ring = L.circle(at, { radius: accuracy, color: YOU, weight: 1, opacity: 0.6, fillColor: YOU, fillOpacity: 0.15, interactive: false }).addTo(map);
                dot = L.marker(at, { icon: personIcon(), zIndexOffset: 1000, keyboard: false, title: t('Вие сте тук') })
                    .bindPopup(t('Вие сте тук')).addTo(map);
            } else {
                ring.setLatLng(at).setRadius(accuracy);
                dot.setLatLng(at);
            }
            if (centreNext) {
                centreNext = false;
                map.setView(at, Math.max(map.getZoom(), 15));
            }
            if (onUpdate) onUpdate(at);
        }

        function onError(err) {
            const firstTry = !dot;
            if (!firstTry && err && err.code !== 1) return;  // a slow fix while already tracking: keep the last dot
            stop();
            // A refusal or failure on the automatic restart stays silent; only a press gets a message
            if (firstTry && centreNext) {
                alert(err && err.code === 1
                    ? t('Не успяхме да определим местоположението ви. Проверете дали сте разрешили достъп до локацията.')
                    : t('Местоположението ви не може да бъде определено в момента. Опитайте отново.'));
            }
            centreNext = false;
        }

        function watch() {
            if (watchId === null) {
                watchId = navigator.geolocation.watchPosition(onFix, onError, { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 });
            }
        }

        function start(centre = true) {
            if (!navigator.geolocation) {
                alert(t('Браузърът ви не поддържа определяне на местоположение.'));
                return;
            }
            wanted = true;
            setActive(true);
            if (dot && centre) map.setView(dot.getLatLng(), Math.max(map.getZoom(), 15));
            centreNext = centre && !dot;
            watch();
        }

        function stop() {
            wanted = false;
            clear();
            setActive(false);
        }

        const Control = L.Control.extend({
            options: { position },
            onAdd() {
                const bar = L.DomUtil.create('div', 'leaflet-bar leaflet-control locate-control');
                btn = L.DomUtil.create('a', 'locate-btn', bar);
                btn.href = '#';
                btn.setAttribute('role', 'button');
                const ns = 'http://www.w3.org/2000/svg';
                const svg = document.createElementNS(ns, 'svg');
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('aria-hidden', 'true');
                [['circle', { cx: 12, cy: 12, r: 4 }], ['circle', { cx: 12, cy: 12, r: 8 }],
                    ['path', { d: 'M12 1v3M12 20v3M1 12h3M20 12h3' }]].forEach(([tag, attrs]) => {
                    const el = document.createElementNS(ns, tag);
                    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
                    svg.append(el);
                });
                btn.append(svg);
                setActive(false);
                L.DomEvent.disableClickPropagation(bar);
                L.DomEvent.on(btn, 'click', e => {
                    L.DomEvent.preventDefault(e);
                    if (btn.classList.contains('active')) stop(); else start(true);
                });
                return bar;
            }
        });
        new Control().addTo(map);

        // Save the battery while the tab is in the background; resume when it's back
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) clear();
            else if (wanted) watch();
        });

        // Permission given on an earlier visit: show the dot again without asking or moving the map
        if (navigator.permissions && navigator.geolocation) {
            navigator.permissions.query({ name: 'geolocation' })
                .then(p => { if (p.state === 'granted') start(false); })
                .catch(() => { /* not supported for geolocation in this browser */ });
        }

        return { start, stop, position: () => (dot ? [dot.getLatLng().lat, dot.getLatLng().lng] : null) };
    }

    window.MapStyle = { LAYERS, SOFIA, marker, renderer, autoScale, swatch, basemap, districtOverlay, directionsLink, popupFor, locateControl };
})();
