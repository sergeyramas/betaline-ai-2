// Атрибуция лидов: очистка полей с сайта, fallback из заголовков Origin/Referer, строки для Telegram, строка для журнала.
// Копия лежит в betaline-master/api/_lib/attr.js и betaline-voice-ai/api/_lib/attr.js — менять вместе.
// Фронт: blLeadAttr в main.js (betaline-ai-2), index.html (апекс), script.js (zvonok).

const ATTR_KEYS = [
  'host', 'counter', 'yclid', 'ym_uid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'landing', 'page', 'referrer',
  'first_landing', 'first_referrer', 'first_utm_source', 'first_utm_medium', 'first_utm_campaign', 'first_yclid',
];
const ATTR_MAX = {
  host: 80, counter: 12, yclid: 64, ym_uid: 32, utm_source: 80, utm_medium: 80, utm_campaign: 120, utm_content: 120, utm_term: 120,
  landing: 400, page: 400, referrer: 300,
  first_landing: 400, first_referrer: 300, first_utm_source: 80, first_utm_medium: 80, first_utm_campaign: 120, first_yclid: 64,
};
// Поля, наличие которых говорит, что фронт вообще прислал атрибуцию
const SIGNAL_KEYS = ['host', 'landing', 'page', 'referrer', 'yclid', 'utm_source', 'utm_campaign', 'first_landing'];

function hostOf(url) {
  try { return new URL(String(url)).hostname.toLowerCase(); } catch (e) { return ''; }
}
function pathOf(url) {
  try { const u = new URL(String(url)); return u.pathname + (u.search ? '?…' : ''); } catch (e) { return ''; }
}

// body — тело запроса, req — http-запрос (для Origin/Referer). Возвращает атрибуцию + служебные _hostFrom, _noAttr
function cleanAttr(body, req) {
  body = body || {};
  const out = {};
  for (const k of ATTR_KEYS) {
    let v = body[k];
    if (typeof v !== 'string' && typeof v !== 'number') continue;
    v = String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, ATTR_MAX[k]);
    if (!v) continue;
    if ((k === 'yclid' || k === 'first_yclid') && !/^[\w.-]{1,64}$/.test(v)) continue;
    if ((k === 'ym_uid' || k === 'counter') && !/^\d+$/.test(v)) continue;
    if (k === 'host' && !/^[a-z0-9.-]+$/i.test(v)) continue;
    out[k] = v;
  }
  out._noAttr = !SIGNAL_KEYS.some((k) => out[k]);
  out._hostFrom = out.host ? 'frontend' : '';
  const h = (req && req.headers) || {};
  if (!out.host) {
    const oh = hostOf(h.origin);
    const rh = hostOf(h.referer);
    const fb = oh || rh;
    if (fb && /^[a-z0-9.-]+$/.test(fb)) { out.host = fb.slice(0, 80); out._hostFrom = oh ? 'Origin' : 'Referer'; }
  }
  if (!out.page && h.referer && hostOf(h.referer)) out.page = String(h.referer).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 400);
  return out;
}

const dash = (v) => v || '—';
const refDomain = (r) => (r ? hostOf(r) || String(r).slice(0, 60) : '');
const ycShort = (y) => (y ? `${y.slice(0, 8)}${y.length > 8 ? '…' : ''}` : '');

// Строки для Telegram-карточки (простой текст, экранирует вызывающий)
function attrLines(attr) {
  if (attr._noAttr) {
    return [`⚠️ источник не передан (host из ${attr._hostFrom || 'Origin'}: ${attr.host || 'нет Origin/Referer'}) — вероятно, старая вкладка/кэш или блокировщик`];
  }
  const lines = [];
  lines.push(`🔎 Сайт: ${dash(attr.host)} · страница: ${dash(pathOf(attr.page || attr.landing) || '')}`);
  lines.push(`↩️ Referrer: ${refDomain(attr.referrer) || 'прямой / не передан'}`);
  const utm = [attr.utm_source, attr.utm_medium, attr.utm_campaign, attr.utm_term].map(dash).join(' / ');
  lines.push(`🏷 utm (source/medium/campaign/term): ${utm}`);
  lines.push(`📣 Кампания: ${dash(attr.utm_campaign)} · yclid: ${attr.yclid ? `да (${ycShort(attr.yclid)})` : 'нет'}`);
  // first-touch показываем только если отличается от текущего визита
  const ft = {
    ref: refDomain(attr.first_referrer),
    src: attr.first_utm_source || '',
    camp: attr.first_utm_campaign || '',
    yc: attr.first_yclid || '',
    land: pathOf(attr.first_landing),
  };
  const differs =
    (ft.ref && ft.ref !== refDomain(attr.referrer)) ||
    (ft.src && ft.src !== (attr.utm_source || '')) ||
    (ft.camp && ft.camp !== (attr.utm_campaign || '')) ||
    (ft.yc && ft.yc !== (attr.yclid || '')) ||
    (ft.land && attr.landing && ft.land !== pathOf(attr.landing));
  if (differs) {
    lines.push(`🥇 Первый визит: ${ft.ref || 'прямой'} · ${dash(ft.src)} / ${dash(attr.first_utm_medium)} / ${dash(ft.camp)} · yclid: ${ft.yc ? `да (${ycShort(ft.yc)})` : 'нет'} · ${dash(ft.land)}`);
  }
  return lines;
}

// Одна строка в journald на лид — БЕЗ телефона и имени
function logLine(source, attr) {
  const p = [
    'lead',
    `source=${source}`,
    `host=${attr.host || '-'}(${attr._hostFrom || 'none'})`,
    `noattr=${attr._noAttr ? 1 : 0}`,
    `utm=${[attr.utm_source, attr.utm_medium, attr.utm_campaign, attr.utm_term].map((v) => (v || '-').replace(/\s+/g, '_')).join('/')}`,
    `campaign=${(attr.utm_campaign || '-').replace(/\s+/g, '_')}`,
    `yclid=${attr.yclid ? attr.yclid.slice(0, 8) : '-'}`,
    `ref=${refDomain(attr.referrer) || '-'}`,
    `first_ref=${refDomain(attr.first_referrer) || '-'}`,
  ];
  return p.join(' ');
}

// Поля для JSONL / Sheets / CRM: без служебных _*
function publicAttr(attr) {
  const o = {};
  for (const k of Object.keys(attr)) if (!k.startsWith('_')) o[k] = attr[k];
  if (attr._hostFrom && attr._hostFrom !== 'frontend') o.host_from = attr._hostFrom;
  if (attr._noAttr) o.no_attr = true;
  return o;
}

module.exports = { ATTR_KEYS, cleanAttr, attrLines, logLine, publicAttr, hostOf };
