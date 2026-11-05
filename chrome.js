// Shared page chrome: the notice strip above the navbar, the Sofia clock in the navbar
// and the footer text. Loaded on every page after i18n.js and district.js.
(function () {
    const { t } = I18N;

    const strip = document.createElement('div');
    strip.className = 'notice-strip';
    strip.textContent = t('Отворени източници // публична информация');
    document.body.prepend(strip);

    const nav = document.querySelector('.nav-container');
    if (nav) {
        const clock = document.createElement('span');
        clock.className = 'nav-clock';
        clock.setAttribute('aria-hidden', 'true');
        const fmt = new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Sofia', timeZoneName: 'short'
        });
        const tick = () => { clock.textContent = fmt.format(new Date()).replace('GMT+2', 'EET').replace('GMT+3', 'EEST'); };
        tick();
        setInterval(tick, 1000);
        nav.append(clock);
    }

    const footer = document.querySelector('body > footer, .container > footer');
    if (footer) {
        const left = document.createElement('span');
        left.textContent = t('sofia-prepping.com · независим граждански ресурс');
        const right = document.createElement('span');
        right.textContent = t('Данни от отворени източници · без гаранция за точност · спешни случаи 112');
        const inner = document.createElement('div');
        inner.className = 'footer-inner';
        inner.append(left, right);
        footer.replaceChildren(inner);
    }
})();
