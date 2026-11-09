// Map at the top of the homepage: the selected district (or all of Sofia) with the map layers
// from data/karta.json and a panel to switch them on and off. The full map is karta.html.
(function () {
    const box = document.getElementById('home-map');
    if (!box) return;
    const { LAYERS, SOFIA, marker, swatch, popupFor } = MapStyle;
    const { t } = I18N;

    const map = L.map(box, {
        renderer: MapStyle.renderer(),
        dragging: !L.Browser.mobile,     // on phones one finger scrolls the page; zoom with the buttons or pinch
        tap: false,
        zoomControl: false,
        attributionControl: false
    }).setView(SOFIA, 12);
    L.control.zoom({ position: 'topright' }).addTo(map);
    MapStyle.autoScale(map);

    // The scroll wheel scrolls the page, not the map, unless Ctrl/⌘ is held (a trackpad pinch
    // sends Ctrl too) or the visitor has clicked into the map; that lasts until the pointer leaves.
    // Runs in the capture phase on the container, before Leaflet's own wheel handler.
    const hint = document.getElementById('map-scroll-hint');
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    hint.textContent = t(mac ? '⌘ + колелце за увеличаване' : 'Ctrl + колелце за увеличаване');
    let engaged = false;
    let hintTimer = null;
    box.addEventListener('wheel', e => {
        if (engaged || e.ctrlKey || e.metaKey) return;
        e.stopPropagation();  // Leaflet never sees it, the page scrolls as usual
        hint.classList.add('show');
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => hint.classList.remove('show'), 1400);
    }, { capture: true });
    box.addEventListener('mousedown', () => {
        engaged = true;
        hint.classList.remove('show');
    });
    box.addEventListener('mouseleave', () => { engaged = false; });

    // The layer panel folds away when the visitor zooms the map, and opens again from its header.
    // Zooms the page makes itself (fitting a district) don't count.
    const panel = document.getElementById('map-layers');
    const toggleBtn = document.getElementById('map-layers-toggle');
    let autoZoom = false;
    function setOpen(open) {
        panel.classList.toggle('collapsed', !open);
        toggleBtn.setAttribute('aria-expanded', String(open));
    }
    toggleBtn.addEventListener('click', () => setOpen(panel.classList.contains('collapsed')));
    map.on('zoomstart', () => {
        // On phones the panel sits under the map rather than over it, so leave it alone there
        if (!autoZoom && getComputedStyle(panel).position === 'absolute') setOpen(false);
    });
    function moveMap(fn) {
        autoZoom = true;
        fn();
        setTimeout(() => { autoZoom = false; }, 400);
    }
    // The map box changes height with the status column next to it (opening an indicator's details)
    if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize({ pan: false })).observe(box);
    MapStyle.basemap(map);

    const list = document.getElementById('home-layers');
    const count = document.getElementById('home-layers-count');
    const groups = {};
    const counts = {};
    const inputs = {};
    const visible = new Set(LAYERS.filter(l => !l.off).map(l => l.key));
    let data = {};
    let overlay = null;

    function rowsFor(key) {
        const d = SofiaDistrict.get();
        return (data[key] || []).filter(p => !d || p[5] === d.index);
    }

    function updateCount() {
        count.textContent = `${visible.size} / ${LAYERS.length}`;
    }

    function build() {
        LAYERS.forEach(layer => {
            if (groups[layer.key]) map.removeLayer(groups[layer.key]);
            const group = L.layerGroup();
            const rows = rowsFor(layer.key);
            rows.forEach(p => marker(layer, p).bindPopup(() => popupFor(layer, p)).addTo(group));
            groups[layer.key] = group;
            counts[layer.key].textContent = String(rows.length);
            inputs[layer.key].closest('label').classList.toggle('empty', !rows.length);
            if (visible.has(layer.key)) group.addTo(map);
        });
    }

    function buildPanel() {
        LAYERS.forEach(layer => {
            const label = document.createElement('label');
            label.className = 'layer-row';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = visible.has(layer.key);
            input.addEventListener('change', () => setVisible(layer.key, input.checked));
            const name = document.createElement('span');
            name.className = 'layer-name';
            name.textContent = t(layer.label);
            const n = document.createElement('span');
            n.className = 'layer-count';
            label.append(input, swatch(layer), name, n);
            inputs[layer.key] = input;
            counts[layer.key] = n;
            list.append(label);
        });
        // "Show all" / "Hide all" under the layer list
        const actions = document.createElement('div');
        actions.className = 'map-layers-actions';
        [['Покажи всички', true], ['Скрий всички', false]].forEach(([text, on]) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = t(text);
            btn.addEventListener('click', () => LAYERS.forEach(l => setVisible(l.key, on)));
            actions.append(btn);
        });
        list.after(actions);  // inside #map-layers-body, so it folds away with the list
        updateCount();
    }

    function setVisible(key, on) {
        inputs[key].checked = on;
        if (on) visible.add(key); else visible.delete(key);
        if (groups[key]) {
            if (on) groups[key].addTo(map); else map.removeLayer(groups[key]);
        }
        updateCount();
    }

    async function applyDistrict(d) {
        build();
        if (overlay) map.removeLayer(overlay);
        overlay = null;
        if (!d) {
            moveMap(() => map.setView(SOFIA, 12));
            return;
        }
        const shape = (await SofiaDistrict.shapes())[d.index];
        if (SofiaDistrict.get() !== d) return;  // changed again while loading
        overlay = MapStyle.districtOverlay(shape).addTo(map);
        // Leave room on the left for the layer panel when the map is wide enough
        const wide = box.clientWidth > 640;
        moveMap(() => map.fitBounds(overlay.getBounds(), { paddingTopLeft: [wide ? 290 : 20, 20], paddingBottomRight: [20, 60] }));
    }

    buildPanel();
    fetch('data/karta.json')
        .then(r => r.json())
        .then(json => {
            data = json.layers;
            applyDistrict(SofiaDistrict.get());
            SofiaDistrict.onChange(applyDistrict);
        })
        .catch(() => { list.append(Object.assign(document.createElement('p'), { className: 'status-empty', textContent: t('Неуспешно зареждане на данните.') })); });
})();
