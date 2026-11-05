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
        list.after(actions);
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
            map.setView(SOFIA, 12);
            return;
        }
        const shape = (await SofiaDistrict.shapes())[d.index];
        if (SofiaDistrict.get() !== d) return;  // changed again while loading
        overlay = MapStyle.districtOverlay(shape).addTo(map);
        // Leave room on the left for the layer panel when the map is wide enough
        const wide = box.clientWidth > 640;
        map.fitBounds(overlay.getBounds(), { paddingTopLeft: [wide ? 290 : 20, 20], paddingBottomRight: [20, 60] });
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
