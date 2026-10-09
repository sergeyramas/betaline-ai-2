// Связь с админкой Betaline (admin.betaline-ai.ru, localhost:3100 на том же base-vps).
// ADMIN_INGEST_URL (например http://127.0.0.1:3100) и ADMIN_INGEST_SECRET — в /srv/betaline/api/.env.
// Не заданы или админка не отвечает — функции кидают ошибку, вызывающий решает, критично ли это.
const crypto = require('crypto');

const base = () => (process.env.ADMIN_INGEST_URL || '').replace(/\/+$/, '');
const secret = () => process.env.ADMIN_INGEST_SECRET || '';

async function call(method, path, body, timeoutMs) {
  if (!base() || !secret()) throw new Error('admin not configured');
  const r = await fetch(base() + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Ingest-Secret': secret() },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs || 2500),
  });
  if (!r.ok) throw new Error(`admin ${r.status}`);
  return r.json();
}

const ingest = (evt, timeoutMs) => call('POST', '/api/ingest', { event_id: `${evt.channel}:${crypto.randomUUID()}`, ...evt }, timeoutMs);

// true — диалог у оператора, ИИ молчит. Админка не ответила — false (работаем как раньше).
async function isPaused(channel, externalId) {
  try {
    const j = await call('GET', `/api/ingest/state?channel=${channel}&external_id=${encodeURIComponent(externalId)}`, null, 1500);
    return !!j.paused;
  } catch (e) { return false; }
}

const operatorMessages = (externalId, after) =>
  call('GET', `/api/ingest/messages?channel=site_chat&external_id=${encodeURIComponent(externalId)}&after=${Number(after) || 0}`, null, 2000);

// Токен диалога: 16 случайных байт + HMAC — подделать или угадать нельзя, чужие диалоги не прочитать
const sig = (rnd) => crypto.createHmac('sha256', secret() || 'x').update('chat:' + rnd).digest('hex').slice(0, 16);
const newChatToken = () => { const r = crypto.randomBytes(16).toString('hex'); return `${r}.${sig(r)}`; };
function validChatToken(t) {
  if (typeof t !== 'string' || !/^[0-9a-f]{32}\.[0-9a-f]{16}$/.test(t) || !secret()) return false;
  const [r, s] = t.split('.');
  return crypto.timingSafeEqual(Buffer.from(s), Buffer.from(sig(r)));
}

// custom2.betaline-ai.ru -> custom2; betaline-ai.ru -> apex; прочее — как есть
function siteFrom(req, attr) {
  let h = '';
  try { h = new URL(req.headers.origin || req.headers.referer || '').hostname; } catch (e) { /* noop */ }
  h = h || (attr && attr.host) || '';
  if (!h) return null;
  if (h === 'betaline-ai.ru' || h === 'www.betaline-ai.ru') return 'apex';
  const m = h.match(/^([a-z0-9-]+)\.betaline-ai\.ru$/i);
  return (m ? m[1] : h).toLowerCase().slice(0, 40);
}

module.exports = { ingest, isPaused, operatorMessages, newChatToken, validChatToken, siteFrom };
