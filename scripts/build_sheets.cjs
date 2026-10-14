#!/usr/bin/env node
// Builds the printable district PDFs (pechat/rayon-<slug>.pdf) from listovka.html.
// Serves the site locally, opens each district's sheet in headless Chromium and prints it to A4.
//
// Usage: node scripts/build_sheets.cjs [slug,slug,...]
// Needs Playwright (npm i -g playwright, or set NODE_PATH to where it is installed).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'pechat');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.pdf': 'application/pdf' };

function serve() {
    const server = http.createServer((req, res) => {
        const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
        if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            res.writeHead(404).end();
            return;
        }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
    });
    return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

(async () => {
    const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'rayoni.json'), 'utf8')).map(d => d.slug);
    const slugs = process.argv[2] ? process.argv[2].split(',') : all;
    fs.mkdirSync(OUT, { recursive: true });

    const server = await serve();
    const base = `http://127.0.0.1:${server.address().port}`;
    // Map tiles and CDN scripts come from the internet; honour an HTTPS proxy if one is set
    const proxy = process.env.HTTPS_PROXY;
    const browser = await chromium.launch(proxy ? { args: [`--proxy-server=${proxy}`, '--proxy-bypass-list=127.0.0.1'] } : {});
    const page = await browser.newPage();
    let failed = 0;
    for (const slug of slugs) {
        try {
            await page.goto(`${base}/listovka.html?rayon=${slug}&lang=bg`, { waitUntil: 'networkidle' });
            await page.waitForFunction(() => window.sheetReady === true, null, { timeout: 45000 });
            const file = path.join(OUT, `rayon-${slug}.pdf`);
            await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true });
            console.log(`ok   ${slug} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
        } catch (err) {
            failed++;
            console.error(`FAIL ${slug}: ${err.message}`);
        }
    }
    await browser.close();
    server.close();
    process.exit(failed ? 1 : 0);
})();
