// Centres the embedded Google My Maps (and its "open in Google Maps" link) on the
// district picked in the navbar. The embedded map itself can't be filtered.
(function () {
    const frame = document.querySelector('.embed-map');
    const open = document.querySelector('.map-controls a');
    const note = document.getElementById('district-note');
    const defaults = { frame: frame.src, open: open.href };

    function centred(href, lat, lng, zoom) {
        const url = new URL(href);
        url.searchParams.set('ll', `${lat},${lng}`);
        url.searchParams.set('z', zoom);
        return url.toString();
    }

    async function apply(d) {
        if (!d) {
            frame.src = defaults.frame;
            open.href = defaults.open;
            note.textContent = '';
            return;
        }
        const [s, w, n, e] = (await SofiaDistrict.shapes())[d.index].bbox;
        const lat = ((s + n) / 2).toFixed(5), lng = ((w + e) / 2).toFixed(5);
        const zoom = Math.max(n - s, e - w) > 0.08 ? 13 : 14;
        frame.src = centred(defaults.frame, lat, lng, zoom);
        open.href = centred(defaults.open, lat, lng, zoom);
        note.textContent = `Картата е центрирана върху Район ${d.name}.`;
    }

    SofiaDistrict.onChange(apply);
    if (SofiaDistrict.get()) apply(SofiaDistrict.get());
})();
