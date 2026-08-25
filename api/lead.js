const { appendRow } = require('./_lib/sheets');

module.exports = async function handler(req, res) {
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { source, phone, name, niche, task, platform, speed, price, date, time, plan } = req.body || {};

  if (!source || !phone) return res.status(400).json({ error: 'Missing required fields' });
  if (!['quiz', 'audit', 'callback', 'pricing'].includes(source)) return res.status(400).json({ error: 'Invalid source' });

  // Fan out to all destinations in parallel
  const results = await Promise.allSettled([
    sendLeadCard(source, phone, { name, niche, task, platform, speed, price, date, time, plan }),
    appendLeadSheet(source, phone, { name, niche, task, platform, speed, price, date, time, plan }),
    sendToCRM(source, phone, { name, niche, task, platform, speed, price, date, time, plan }),
    sendEmail(source, phone, { name, niche, task, platform, speed, price, date, time, plan }),
  ]);

  // Log failures
  const labels = ['Telegram', 'Sheets', 'CRM', 'Email'];
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`${labels[i]} failed:`, r.reason);
  });

  // Success if at least one channel delivered
  const anySuccess = results.some(r => r.status === 'fulfilled');
  if (!anySuccess) return res.status(500).json({ error: 'All delivery channels failed' });

  return res.status(200).json({ ok: true });
};

// --- Telegram: lead card to shared "Все лиды" topic ---
async function sendLeadCard(source, phone, fields) {
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
  lines.push(`━━━━━━━━━━━━━━━━━━`);

  const body = { chat_id: chatId, text: lines.join('\n'), parse_mode: 'HTML' };
  if (leadsTopicId) body.message_thread_id = Number(leadsTopicId);

  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Telegram API ${resp.status}: ${await resp.text()}`);
}

// --- Google Sheets (Лиды tab) ---
async function appendLeadSheet(source, phone, fields) {
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
  ];
  const sheetName = process.env.GOOGLE_SHEET_NAME || 'Лиды';
  await appendRow(sheetName, row);
}

// --- CRM (PocketBase) ---
async function sendToCRM(source, phone, fields) {
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
async function sendEmail(source, phone, fields) {
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
