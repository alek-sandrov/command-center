// Cloudflare Pages Function: POST /api/contact  (the feedback form on kontakt.html)
// Checks the message and forwards it by email through Resend (https://resend.com).
// Nothing personal is in this file: the address the messages go to and the Resend key are
// settings of the Cloudflare Pages project (Settings → Variables and secrets):
//   CONTACT_TO      where messages are delivered (kept secret; never shown on the site)
//   RESEND_API_KEY  the Resend API key (secret)
//   CONTACT_FROM    optional sender, e.g. "Sofia Prepping <forma@sofia-prepping.com>" once the domain
//                   is verified in Resend; without it Resend's test sender is used, which can only
//                   deliver to the address the Resend account was opened with
// The visitor's IP address is used only to slow down repeated sending and is not stored or sent.

const MAX_MESSAGE = 4000;
const MIN_MESSAGE = 10;
const MIN_SECONDS_ON_PAGE = 3;   // bots fill the form instantly
const PER_IP_PER_HOUR = 5;
const KINDS = { error: 'Грешка в данните', idea: 'Предложение', other: 'Друго' };
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

function reply(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
}

// A rough per-address limit kept in the edge cache: enough to stop someone flooding the inbox
async function tooMany(request) {
    const cache = globalThis.caches?.default;
    const ip = request.headers.get('CF-Connecting-IP');
    if (!cache || !ip) return false;
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip)))]
        .slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
    const key = new Request(`https://contact-limit.invalid/${hash}`);
    const hit = await cache.match(key);
    const count = hit ? Number(await hit.text()) || 0 : 0;
    if (count >= PER_IP_PER_HOUR) return true;
    await cache.put(key, new Response(String(count + 1), { headers: { 'Cache-Control': 'max-age=3600' } }));
    return false;
}

export async function onRequestPost(context) {
    const { request, env } = context;
    let form;
    try {
        form = await request.json();
    } catch {
        return reply({ ok: false, error: 'bad_request' }, 400);
    }
    const message = String(form.message || '').trim();
    const email = String(form.email || '').trim().slice(0, 200);
    const kind = Object.hasOwn(KINDS, form.kind) ? form.kind : 'other';
    const page = String(form.page || '').slice(0, 300);
    const lang = form.lang === 'en' ? 'en' : 'bg';

    // A hidden field people never see, and a form sent too fast: treat as sent, deliver nothing
    if (form.website || (Number(form.elapsed) || 0) < MIN_SECONDS_ON_PAGE) return reply({ ok: true });
    if (message.length < MIN_MESSAGE || message.length > MAX_MESSAGE) return reply({ ok: false, error: 'length' }, 400);
    if (email && !EMAIL_RE.test(email)) return reply({ ok: false, error: 'email' }, 400);
    if (!env.RESEND_API_KEY || !env.CONTACT_TO) return reply({ ok: false, error: 'not_configured' }, 503);
    if (await tooMany(request)) return reply({ ok: false, error: 'rate' }, 429);

    const when = new Intl.DateTimeFormat('bg-BG', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Sofia' }).format(new Date());
    const text = [
        message,
        '',
        '—',
        `Вид: ${KINDS[kind]}`,
        `Страница: ${page || '–'}`,
        `Отговор на: ${email || 'не е посочен'}`,
        `Изпратено: ${when} · език: ${lang}`
    ].join('\n');
    const subject = `[sofia-prepping] ${KINDS[kind]}: ${message.replace(/\s+/g, ' ').slice(0, 60)}${message.length > 60 ? '…' : ''}`;

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: env.CONTACT_FROM || 'Sofia Prepping <onboarding@resend.dev>',
                to: [env.CONTACT_TO],
                subject,
                text,
                ...(email ? { reply_to: email } : {})
            }),
            signal: AbortSignal.timeout(10000)
        });
        if (!res.ok) throw new Error(`resend ${res.status}`);
    } catch (err) {
        console.error('contact form:', err.message);
        return reply({ ok: false, error: 'send' }, 502);
    }
    return reply({ ok: true });
}
