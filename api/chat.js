const { logTopic } = require('./_lib/sheets');
const { generateCodename } = require('./_lib/animals');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { visitorId, topicId, message, page, utm, referrer, userAgent, screen, lang } = req.body || {};
  if (!visitorId || !message) return res.status(400).json({ error: 'Missing required fields' });

  // Extract visitor geo from Vercel headers
  const city = req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : null;
  const country = req.headers['x-vercel-ip-country'] || null;
  const region = req.headers['x-vercel-ip-country-region'] || null;
  const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || null;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(500).json({ error: 'Bot not configured' });

  try {
    let threadId = topicId ? Number(topicId) : null;
    let isNewTopic = false;
    let codename = '';
    let geoTag = '';

    // Create new forum topic for new visitor
    if (!threadId) {
      isNewTopic = true;
      codename = generateCodename(visitorId);
      geoTag = city || country || '';
      const topicName = `⚪ ${codename}${geoTag ? ` — ${geoTag}` : ''}`;

      const createResp = await fetch(`https://api.telegram.org/bot${token}/createForumTopic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          name: topicName.slice(0, 128),
          icon_color: 9367192, // green for anonymous chat
        }),
      });

      if (!createResp.ok) {
        const errText = await createResp.text();
        console.error('createForumTopic failed:', errText);
        // Fallback: send without topic
        await sendMessage(token, chatId, null, `💬 Чат [${codename}]\n📄 ${page || '—'}\n\n${message}`);
        return res.status(200).json({ ok: true, topicId: null });
      }

      const topicData = await createResp.json();
      threadId = topicData.result.message_thread_id;

      // Log topic to Sheets for cron cleanup
      logTopic(threadId, 'chat', '', topicName).catch(e => console.error('Topic log failed:', e));

      // Send first message with visitor info + analytics
      const now = new Date();
      const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      const geo = [city, region, country].filter(Boolean).join(', ') || '—';
      const utmStr = utm ? Object.entries(utm).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join('\n  ') : '—';
      const device = userAgent || '—';
      const info = `🆕 Новый посетитель с сайта\n\n🐾 Кодовое имя: ${codename}\n🔑 ID: ${visitorId.slice(0, 6)}\n📄 Страница: ${page || '—'}\n⏰ ${dateStr} ${timeStr}\n\n📍 Гео: ${geo}\n🌐 IP: ${ip || '—'}\n🔗 Откуда: ${referrer || 'Прямой заход'}\n📱 Устройство: ${device}\n🖥 Экран: ${screen || '—'}\n🌍 Язык: ${lang || '—'}\n\n📊 UTM:\n  ${utmStr}`;
      await sendMessage(token, chatId, threadId, info);
    }

    // Send the visitor's message
    await sendMessage(token, chatId, threadId, `💬 Посетитель:\n${message}`);

    // Send lead card to shared "Все лиды" topic (only for new conversations)
    if (isNewTopic && threadId) {
      sendChatLeadCard(token, chatId, threadId, codename, geoTag, message, page).catch(e => console.error('Lead card failed:', e));
    }

    return res.status(200).json({ ok: true, topicId: threadId });
  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
};

// Send lead card to the shared "Все лиды" topic with link to chat topic
async function sendChatLeadCard(token, chatId, threadId, codename, geo, firstMessage, page) {
  const leadsTopicId = process.env.LEADS_TOPIC_ID;
  if (!leadsTopicId) return;

  // t.me/c/ link in message text (not button) opens topic inside Telegram app
  const chatIdNumeric = chatId.toString().replace(/^-100/, '');
  const topicLink = `https://t.me/c/${chatIdNumeric}/${threadId}`;

  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Moscow' });
  const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });

  const preview = firstMessage.length > 100 ? firstMessage.slice(0, 100) + '...' : firstMessage;

  const lines = [
    `💬 <b>НОВЫЙ ЧАТ</b>`,
    ``,
    `🐾 ${codename}`,
  ];
  if (geo) lines.push(`📍 ${geo}`);
  if (page) lines.push(`📄 ${page}`);
  lines.push(`💬 <i>"${preview}"</i>`);
  lines.push(`🕐 ${dateStr} ${timeStr}`);

  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_thread_id: Number(leadsTopicId),
      text: lines.join('\n'),
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '📖 История', url: topicLink }, { text: '✍️ Написать', url: topicLink }]] },
    }),
  });
  if (!resp.ok) console.error(`Lead card send failed: ${resp.status}`);
}

async function sendMessage(token, chatId, threadId, text) {
  const body = { chat_id: chatId, text };
  if (threadId) body.message_thread_id = threadId;

  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Telegram ${resp.status}: ${await resp.text()}`);
}
