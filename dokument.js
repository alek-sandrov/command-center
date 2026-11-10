// PDF viewer (dokument.html?f=/planove/plan-radiacia.pdf&t=Title) for the installed app, where a
// PDF opened directly has no way back. Only the site's own PDFs are shown. Pages are drawn with
// PDF.js as they come near the screen and cleared again far away, so 100-page plans stay light
// on phones. Works offline when the visitor saved the documents (sw.js serves them).
(async function () {
    const { t } = I18N;
    const params = new URLSearchParams(location.search);
    const message = document.getElementById('doc-message');
    const pagesBox = document.getElementById('doc-pages');
    const pageNo = document.getElementById('doc-page-no');

    document.getElementById('doc-back').addEventListener('click', () => {
        if (history.length > 1) history.back(); else location.href = '/dokumenti';
    });
    document.getElementById('doc-back').textContent = '← ' + t('Назад');

    let file;
    try {
        file = new URL(params.get('f') || '', location.origin);
    } catch {
        file = null;
    }
    if (!file || file.origin !== location.origin || !file.pathname.endsWith('.pdf')) {
        message.textContent = t('Документът не е намерен.');
        return;
    }
    const title = params.get('t') || decodeURIComponent(file.pathname.split('/').pop());
    document.getElementById('doc-title').textContent = title;
    document.title = `${title} - Sofia Prepping`;

    // PDF.js comes with the saved documents: offline without them it can't load
    if (!window.pdfjsLib) {
        message.textContent = t('Документът не е запазен за ползване без интернет. Запазете документите от страница „Документи“, когато има интернет.');
        return;
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.js?v=3.11.174';
    let pdf;
    try {
        pdf = await pdfjsLib.getDocument({
            url: file.pathname,
            disableRange: true, disableStream: true,   // one whole file, which the service worker can serve offline
            isEvalSupported: false,                    // the site's Content-Security-Policy forbids eval
            standardFontDataUrl: '/vendor/pdfjs/standard_fonts/'
        }).promise;
    } catch {
        message.textContent = navigator.onLine
            ? t('Документът не може да бъде отворен.')
            : t('Документът не е запазен за ползване без интернет. Запазете документите от страница „Документи“, когато има интернет.');
        return;
    }
    message.remove();

    // One box per page, sized from the page's shape so the scroll bar is right before drawing
    const slots = [];
    for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const { width, height } = page.getViewport({ scale: 1 });
        const slot = document.createElement('div');
        slot.className = 'doc-page';
        slot.style.aspectRatio = `${width} / ${height}`;
        slot.dataset.n = n;
        slot.setAttribute('aria-label', t('Страница {n} от {total}', { n, total: pdf.numPages }));
        pagesBox.append(slot);
        slots.push({ slot, page, canvas: null, task: null });
    }

    async function draw(s) {
        if (s.canvas || s.task) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = s.page.getViewport({ scale: (s.slot.clientWidth * dpr) / s.page.getViewport({ scale: 1 }).width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        s.task = s.page.render({ canvasContext: canvas.getContext('2d'), viewport });
        try {
            await s.task.promise;
            s.slot.replaceChildren(canvas);
            s.canvas = canvas;
        } catch { /* cancelled */ }
        s.task = null;
    }

    function clear(s) {
        s.task?.cancel();
        if (s.canvas) { s.canvas.width = s.canvas.height = 0; s.slot.replaceChildren(); s.canvas = null; }
    }

    const near = new IntersectionObserver(entries => {
        for (const e of entries) {
            const s = slots[e.target.dataset.n - 1];
            if (e.isIntersecting) draw(s); else clear(s);
        }
    }, { rootMargin: '150% 0px' });
    slots.forEach(s => near.observe(s.slot));

    const onScreen = new Set();
    const showing = new IntersectionObserver(entries => {
        for (const e of entries) onScreen[e.isIntersecting ? 'add' : 'delete'](+e.target.dataset.n);
        if (onScreen.size) pageNo.textContent = `${Math.min(...onScreen)} / ${pdf.numPages}`;
    }, { threshold: 0.3 });
    slots.forEach(s => showing.observe(s.slot));
    pageNo.textContent = `1 / ${pdf.numPages}`;
})();
