// Feedback form (kontakt.html): sends the message to /api/contact (functions/api/contact.js),
// which forwards it by email. ?ref=<page> says which page the visitor came from.
(function () {
    const { t } = I18N;
    const form = document.getElementById('kt-form');
    const status = document.getElementById('kt-status');
    const send = document.getElementById('kt-send');
    const count = document.getElementById('kt-count');
    const opened = Date.now();

    // The page the visitor was looking at, so a report about "this place" makes sense
    const params = new URLSearchParams(location.search);
    let ref = params.get('ref') || '';
    if (!ref && document.referrer) {
        try {
            const r = new URL(document.referrer);
            if (r.origin === location.origin && !r.pathname.startsWith('/kontakt')) ref = r.pathname + r.search;
        } catch { /* ignore */ }
    }
    if (ref && !ref.startsWith('/')) ref = '';
    if (ref) {
        const p = document.getElementById('kt-ref');
        p.textContent = t('Ще добавим към съобщението страницата, от която идвате: {page}', { page: decodeURIComponent(ref) });
        p.hidden = false;
    }
    if (params.get('kind') && form.kind.value !== params.get('kind')) {
        const r = form.querySelector(`input[name="kind"][value="${CSS.escape(params.get('kind'))}"]`);
        if (r) r.checked = true;
    }

    const message = form.message;
    const updateCount = () => { count.textContent = `${message.value.length} / 4000`; };
    message.addEventListener('input', updateCount);
    updateCount();

    const ERRORS = {
        length: 'Съобщението трябва да е поне 10 знака.',
        email: 'Проверете имейл адреса – изглежда непълен.',
        rate: 'Изпратихте няколко съобщения за кратко. Опитайте отново след час.',
        not_configured: 'Формата още не е настроена. Опитайте по-късно.',
        send: 'Съобщението не можа да бъде изпратено. Опитайте отново след малко.'
    };

    form.addEventListener('submit', async e => {
        e.preventDefault();
        status.textContent = '';
        status.className = 'kt-status';
        const text = message.value.trim();
        if (text.length < 10) {
            status.textContent = t(ERRORS.length);
            status.classList.add('bad');
            message.focus();
            return;
        }
        if (form.email.value && !form.email.checkValidity()) {
            status.textContent = t(ERRORS.email);
            status.classList.add('bad');
            form.email.focus();
            return;
        }
        send.disabled = true;
        status.textContent = t('Изпращане...');
        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kind: form.kind.value, message: text, email: form.email.value.trim(),
                    website: form.website.value, page: ref, lang: I18N.lang,
                    elapsed: Math.round((Date.now() - opened) / 1000)
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!data.ok) throw new Error(data.error || 'send');
            form.hidden = true;
            document.getElementById('kt-done').hidden = false;
        } catch (err) {
            status.textContent = navigator.onLine === false
                ? t('Няма интернет. Съобщението ще остане тук – изпратете го, когато връзката се възстанови.')
                : t(ERRORS[err.message] || ERRORS.send);
            status.classList.add('bad');
        } finally {
            send.disabled = false;
        }
    });

    document.getElementById('kt-again').addEventListener('click', () => {
        form.reset();
        updateCount();
        status.textContent = '';
        document.getElementById('kt-done').hidden = true;
        form.hidden = false;
        message.focus();
    });
})();
