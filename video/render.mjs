// Renders video/shelters.html to MP4 with Playwright + ffmpeg.
//   node video/render.mjs landscape|portrait [out.mp4] [--stills 2,8,14] [--audio track.mp3]
// Serves the repository root on a local port so the page can read data/ and fonts/.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const format = args[0] === 'portrait' ? 'portrait' : 'landscape';
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const out = args[1] && !args[1].startsWith('--') ? args[1] : `video/shelters-${format}.mp4`;
const stills = opt('--stills');
const audio = opt('--audio');
const FPS = 30;

const TYPES = { '.html': 'text/html', '.json': 'application/json', '.woff2': 'font/woff2', '.js': 'text/javascript' };
const server = createServer(async (req, res) => {
    try {
        const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
        if (!p.startsWith(ROOT)) throw 0;
        res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' });
        res.end(await readFile(p));
    } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch();
const [w, h] = format === 'portrait' ? [1080, 1920] : [1920, 1080];
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => { console.error(e); process.exit(1); });
await page.goto(`http://127.0.0.1:${port}/video/shelters.html?f=${format}`);
await page.evaluate(() => window.ready);
const duration = await page.evaluate(() => window.DURATION);
const grab = () => page.evaluate(() => document.getElementById('c').toDataURL('image/png').split(',')[1]);

if (stills) {
    const { writeFile } = await import('node:fs/promises');
    for (const t of stills.split(',').map(Number)) {
        await page.evaluate(t => window.renderAt(t), t);
        await writeFile(out.replace(/\.mp4$/, '') + `-${format}-${t}.png`, Buffer.from(await grab(), 'base64'));
    }
} else {
    const ff = ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-'];
    if (audio) ff.push('-i', audio);
    ff.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
    if (audio) ff.push('-c:a', 'aac', '-b:a', '192k', '-af', `afade=t=out:st=${duration - 3}:d=3`, '-shortest');
    ff.push(out);
    const proc = spawn('ffmpeg', ff, { stdio: ['pipe', 'ignore', 'inherit'] });
    const frames = Math.round(duration * FPS);
    for (let i = 0; i < frames; i++) {
        await page.evaluate(t => window.renderAt(t), i / FPS);
        const buf = Buffer.from(await grab(), 'base64');
        if (!proc.stdin.write(buf)) await new Promise(r => proc.stdin.once('drain', r));
        if (i % 150 === 0) console.log(`${format}: frame ${i}/${frames}`);
    }
    proc.stdin.end();
    await new Promise(r => proc.on('close', r));
    console.log('wrote', out);
}
await browser.close();
server.close();
