const fs = require('fs');
const { appendRow } = require('./_lib/sheets');
const admin = require('./_lib/admin');

// --- Атрибуция: yclid / utm / ym_uid / host приходят с сайта (см. blLeadAttr в main.js и index.html апекса).
// Нужна, чтобы лид можно было засчитать Директу офлайн-конверсией, даже если Метрика заблокирована у посетителя.
const ATTR_KEYS = ['host', 'counter', 'yclid', 'ym_uid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'landing', 'page'];
const ATTR_MAX = { host: 80, counter: 12, yclid: 64, ym_uid: 32, utm_source: 80, utm_medium: 80, utm_campaign: 120, utm_content: 120, utm_term: 120, landing: 200, page: 300 };

function cleanAttr(body) {
  const out = {};
  for (const k of ATTR_KEYS) {
    let v = body[k];
    if (typeof v !== 'string' && typeof v !== 'number') continue;
    v = String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, ATTR_MAX[k]);
    if (!v) continue;
    if (k === 'yclid' && !/^[\w.-]{1,64}$/.test(v)) continue;
    if ((k === 'ym_uid' || k === 'counter') && !/^\d+$/.test(v)) continue;
    if (k === 'host' && !/^[a-z0-9.-]+$/i.test(v)) continue;
    out[k] = v;
  }
  return out;
}

const escHtml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unescHtml = (t) => t.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');

// «yclid: да (12345678…)» — полный идентификатор в Telegram не печатаем
function sourceLine(attr) {
  const camp = attr.utm_campaign || '—';
  const yc = attr.yclid ? `да (${attr.yclid.slice(0, 8)}${attr.yclid.length > 8 ? '…' : ''})` : 'нет';
  return `🔎 Источник: ${attr.host || '—'} · кампания: ${camp} · yclid: ${yc}`;
}

// Ссылка на КП лежит на том же сайте, откуда пришёл лид (только наши домены)
function kpUrl(attr) {
  const host = attr.host && /^(?:[a-z0-9-]+\.)?betaline-ai\.ru$/i.test(attr.host) ? attr.host.toLowerCase() : 'betaline-ai.ru';
  return `https://${host}/kp.html`;
}

// Готовая ссылка для менеджера: телефон -> WhatsApp, email -> mailto. Сервер ничего лиду не отправляет.
function kpSendLink(contact, attr) {
  const kp = kpUrl(attr);
  const msg = `Здравствуйте! Это BetaLine AI, спасибо за заявку. Коммерческое предложение: ${kp}\nЕсли появятся вопросы, просто ответьте на это сообщение.`;
  const c = String(contact || '').trim();
  if (c.includes('@')) {
    if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(c)) return null;
    return { label: 'Отправить КП по почте', url: `mailto:${c}?subject=${encodeURIComponent('Коммерческое предложение BetaLine AI')}&body=${encodeURIComponent(msg)}` };
  }
  let d = c.replace(/\D/g, '');
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  else if (d.length === 10) d = '7' + d;
  if (d.length < 11 || d.length > 15) return null;
  return { label: 'Отправить КП в WhatsApp', url: `https://wa.me/${d}?text=${encodeURIComponent(msg)}` };
}

// Лиды в JSONL для tools/metrika-offline-conversions.py — только если задан LEADS_JSONL_PATH
async function appendLeadJsonl(source, phone, fields, attr) {
  const file = process.env.LEADS_JSONL_PATH;
  if (!file) return;
  const rec = { ts: Math.floor(Date.now() / 1000), source, contact: phone, name: fields.name || '', plan: fields.plan || '', ...attr };
  await fs.promises.appendFile(file, JSON.stringify(rec) + '\n', { mode: 0o600 });
}

module.exports = async function handler(req, res) {
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { source, phone, name, niche, task, platform, speed, price, date, time, plan } = req.body || {};
  const attr = cleanAttr(req.body || {});

  if (!source || !phone) return res.status(400).json({ error: 'Missing required fields' });
  if (!['quiz', 'audit', 'callback', 'pricing'].includes(source)) return res.status(400).json({ error: 'Invalid source' });

  // Fan out to all destinations in parallel
  const results = await Promise.allSettled([
    sendLeadCard(source, phone, { name, niche, task, platform, speed, price, date, time, plan }, attr),
    appendLeadSheet(source, phone, { name, niche, task, platform, speed, price, date, time, plan }, attr),
    sendToCRM(source, phone, { name, niche, task, platform, speed, price, date, time, plan }, attr),
    sendEmail(source, phone, { name, niche, task, platform, speed, price, date, time, plan }, attr),
    appendLeadJsonl(source, phone, { name, plan }, attr),
    sendToAdmin(req, source, phone, { name, niche, task, platform, speed, price, date, time, plan }, attr),
  ]);

  // Log failures
  const labels = ['Telegram', 'Sheets', 'CRM', 'Email', 'JSONL', 'Admin'];
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`${labels[i]} failed:`, r.reason);
  });

  // Успех — заявка реально легла в Telegram или в админку. Раньше хватало любого «fulfilled», а CRM/почта
  // без настроенных ключей возвращают без ошибки — заявка могла потеряться молча при падении Telegram.
  const anySuccess = results[0].status === 'fulfilled' || results[5].status === 'fulfilled';
  if (!anySuccess) return res.status(500).json({ error: 'All delivery channels failed' });

  return res.status(200).json({ ok: true });
};

// --- Telegram: lead card to shared "Все лиды" topic ---
async function sendLeadCard(source, phone, fields, attr) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const leadsTopicId = process.env.LEADS_TOPIC_ID;
  if (!token || !chatId) throw new Error('Telegram not configured');

  const sourceLabels = { quiz: 'Квиз', audit: 'Аудит', callback: 'Звонок', pricing: 'Тариф' };
  const sourceIcons = { quiz: '🧮', audit: '🎯', callback: '📞', pricing: '💰' };
  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Moscow' });
  const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });

  // Build card lines
  const lines = [`━━━━━━━━━━━━━━━━━━`, `${sourceIcons[source]} НОВЫЙ ЛИД — ${sourceLabels[source]}`, `━━━━━━━━━━━━━━━━━━`];
  if (fields.name) lines.push(`👤 ${fields.name}`);
  lines.push(`📱 ${phone}`);
  if (fields.niche) lines.push(`🏢 ${fields.niche}`);
  if (fields.task) lines.push(`🎯 ${fields.task}`);
  if (fields.platform) lines.push(`🌐 ${fields.platform}`);
  if (fields.speed) lines.push(`⏱ ${fields.speed}`);
  if (fields.price) lines.push(`💰 ${fields.price}`);
  if (fields.plan) lines.push(`📦 Тариф: ${fields.plan}`);
  if (fields.date || fields.time) lines.push(`📅 ${[fields.date, fields.time].filter(Boolean).join(' ')}`);
  lines.push(`🕐 ${dateStr} ${timeStr}`);
  lines.push(escHtml(sourceLine(attr)));
  const kp = kpSendLink(phone, attr);
  if (kp) lines.push(`📄 <a href="${escHtml(kp.url)}">${kp.label}</a> (проверьте текст и нажмите «отправить»)`);
  lines.push(`━━━━━━━━━━━━━━━━━━`);

  const send = (text, parseMode) => {
    const body = { chat_id: chatId, text, disable_web_page_preview: true };
    if (parseMode) body.parse_mode = parseMode;
    if (leadsTopicId) body.message_thread_id = Number(leadsTopicId);
    return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };
  const html = lines.join('\n');
  let resp = await send(html, 'HTML');
  if (resp.status === 400) {
    // Telegram не разобрал разметку/ссылку — отправляем простым текстом, лид важнее вёрстки
    const plain = unescHtml(html.replace(/<a href="([^"]*)">[^<]*<\/a>/g, '$1'));
    resp = await send(plain, null);
  }
  if (!resp.ok) throw new Error(`Telegram API ${resp.status}: ${await resp.text()}`);
}

// --- Google Sheets (Лиды tab) ---
async function appendLeadSheet(source, phone, fields, attr) {
  const dateStr = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  const row = [
    dateStr,                                          // A: Дата
    fields.name || '—',                               // B: Имя
    phone,                                            // C: Контакт
    fields.niche || '',                               // D: Ниша
    fields.task || '',                                // E: Масштаб / Задача
    source,                                           // F: UTM / Источник
    fields.platform || '',                            // G: Процессы / Площадка
    fields.speed || '',                               // H: ПО / Сроки
    fields.price || '',                               // I: Поддержка / Оценка
    [fields.date, fields.time].filter(Boolean).join(' ') || '',  // J: Срок
    fields.plan || '',                                // K: Тариф
    // L..V — атрибуция, новые колонки только в конец
    attr.host || '',                                  // L: Хост
    attr.utm_source || '',                            // M: utm_source
    attr.utm_medium || '',                            // N: utm_medium
    attr.utm_campaign || '',                          // O: utm_campaign
    attr.utm_content || '',                           // P: utm_content
    attr.utm_term || '',                              // Q: utm_term
    attr.yclid || '',                                 // R: yclid
    attr.ym_uid || '',                                // S: _ym_uid
    attr.landing || '',                               // T: Первая страница
    attr.page || '',                                  // U: Страница заявки
    attr.counter || '',                               // V: Счётчик Метрики
  ];
  const sheetName = process.env.GOOGLE_SHEET_NAME || 'Лиды';
  await appendRow(sheetName, row);
}

// --- CRM (PocketBase) ---
async function sendToCRM(source, phone, fields, attr) {
  const pbUrl = process.env.PB_URL;
  const pbToken = process.env.PB_API_TOKEN;
  if (!pbUrl || !pbToken) return;

  const sourceLabelMap = { quiz: 'Quiz', audit: 'Аудит', callback: 'Звонок' };
  const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

  const body = {
    name: fields.name || phone,
    phone,
    email: '',
    company: fields.niche || '',
    source: sourceLabelMap[source] || source,
    stage: 'Новый',
    amount: 0,
    score: 50,
    sla_deadline: slaDeadline,
    archived: false,
    notes: [
      fields.task ? `Задача: ${fields.task}` : '',
      fields.platform ? `Площадка: ${fields.platform}` : '',
      fields.speed ? `Сроки: ${fields.speed}` : '',
      fields.price ? `Оценка: ${fields.price}` : '',
      fields.date ? `Дата аудита: ${fields.date} ${fields.time || ''}` : '',
      fields.plan ? `Тариф: ${fields.plan}` : '',
      `Источник: ${attr.host || '—'}, кампания: ${attr.utm_campaign || '—'}, yclid: ${attr.yclid ? 'да' : 'нет'}`,
      attr.yclid ? `yclid: ${attr.yclid}` : '',
      attr.ym_uid ? `ym_uid: ${attr.ym_uid}` : '',
    ].filter(Boolean).join('\n'),
    niche: fields.niche || '',
    task_description: fields.task || '',
    price_estimate: fields.price || '',
    reactivation_status: 'not_started',
    reactivation_step: 0,
  };

  const resp = await fetch(`${pbUrl}/api/collections/leads/records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': pbToken,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`PocketBase ${resp.status}: ${await resp.text()}`);

  const lead = await resp.json();
  await fetch(`${pbUrl}/api/collections/timeline/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': pbToken },
    body: JSON.stringify({
      lead: lead.id,
      type: 'create',
      text: `Лид создан из ${sourceLabelMap[source] || source}`,
      icon: '➕',
    }),
  }).catch(() => {});
}

// --- Email (Resend) ---
async function sendEmail(source, phone, fields, attr) {
  const apiKey = process.env.RESEND_API_KEY;
  const managerEmail = process.env.MANAGER_EMAIL;
  if (!apiKey || !managerEmail) return;

  const subjects = {
    quiz: `🧮 Новый расчёт из квиза — ${phone}`,
    audit: `🎯 Запись на аудит — ${fields.name || phone}`,
    callback: `📞 Обратный звонок — ${fields.name || phone}`,
    pricing: `💰 Заявка на тариф — ${fields.name || phone}`,
  };
  const linesBySource = {
    quiz: [`Телефон: ${phone}`, `Сфера: ${fields.niche}`, `Задача: ${fields.task}`, `Площадка: ${fields.platform}`, `Сроки: ${fields.speed}`, `Оценка: ${fields.price}`],
    audit: [`Имя: ${fields.name}`, `Телефон: ${phone}`, `Сфера: ${fields.niche}`, `Дата: ${fields.date}`, `Время: ${fields.time}`, `Задача: ${fields.task || '—'}`],
    callback: [`Имя: ${fields.name}`, `Телефон: ${phone}`],
    pricing: [`Имя: ${fields.name || '—'}`, `Телефон: ${phone}`, `Тариф: ${fields.plan || '—'}`],
  };
  const bodyLines = linesBySource[source] || [`Телефон: ${phone}`];

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'BetaLine AI <onboarding@resend.dev>',
      reply_to: 'betalineai@gmail.com',
      to: managerEmail,
      subject: subjects[source],
      text: bodyLines.join('\n'),
    }),
  });
  if (!resp.ok) throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
}

// --- Админка Betaline (admin.betaline-ai.ru): канал form, заявка -> лид в воронке ---
async function sendToAdmin(req, source, phone, f, attr) {
  const isMail = String(phone).includes('@');
  const labels = { quiz: 'Квиз', audit: 'Аудит', callback: 'Звонок', pricing: 'Тариф' };
  const text = [
    `Заявка с формы сайта (${labels[source] || source})`,
    f.niche && `Ниша: ${f.niche}`, f.task && `Задача: ${f.task}`, f.platform && `Площадка: ${f.platform}`,
    f.speed && `Сроки: ${f.speed}`, f.price && `Оценка: ${f.price}`,
    (f.date || f.time) && `Дата: ${[f.date, f.time].filter(Boolean).join(' ')}`,
  ].filter(Boolean).join('\n');
  const utm = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid', 'ym_uid']) if (attr[k]) utm[k] = attr[k];
  await admin.ingest({
    channel: 'form', name: f.name || null, contact: phone,
    phone: isMail ? null : phone, email: isMail ? phone : null,
    text, plan: f.plan || null, site: admin.siteFrom(req, attr), utm,
  }, 4000);
}
