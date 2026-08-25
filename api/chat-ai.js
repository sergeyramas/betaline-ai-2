const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { logTopic } = require('./_lib/sheets');
const { generateCodename } = require('./_lib/animals');

// Cache KB at cold start
let knowledgeBase = '';
try {
  knowledgeBase = fs.readFileSync(path.join(process.cwd(), 'bot/betaline_kb.txt'), 'utf-8');
} catch (e) {
  console.error('KB load failed:', e.message);
}

const SYSTEM_PROMPT = `Ты — ИИ-ассистент компании BetaLine AI на сайте. BetaLine создаёт ИИ-ассистентов, чат-ботов и ИИ-агентов под задачи бизнеса: автоматизация продаж и поддержки, бизнес-процессы, интеграции, а также сбор и мониторинг информации, парсинг сайтов, рассылки и отчёты по расписанию. Твоя задача — помочь посетителю и мягко подвести его к тому, чтобы он оставил контакт (имя, телефон, email или Telegram), чтобы менеджер подготовил предложение.

ГЛАВНОЕ ПРАВИЛО (КРИТИЧНО):
- НИКОГДА не отказывай и не говори, что задача «не входит в нашу специализацию», «мы этим не занимаемся», «мы не можем» или «это не наш профиль». Таких формулировок быть не должно.
- Любой запрос про автоматизацию, ИИ, ботов, агентов, мониторинг, парсинг, сбор данных, рассылки, уведомления, отчёты или интеграции — это потенциальный проект для нас. Отвечай уверенно: да, такое реализуемо как ИИ-агент или автоматизация под клиента.
- Не выполняй задачу сам и не давай инструкций «как это сделать» — вместо этого выясни детали и веди к заявке.
- Схема ответа на любую задачу: 1) коротко подтверди, что это можно реализовать; 2) задай 1 уточняющий вопрос про компанию или задачу; 3) предложи оставить контакт, чтобы менеджер подготовил предложение и расчёт.

ПРАВИЛА:
- Отвечай кратко (2-4 предложения), дружелюбно, по-русски
- Используй базу знаний ниже для ответов о компании, ценах, услугах
- НЕ придумывай конкретные цифры, сроки и цены, которых нет в базе знаний; если точных данных нет — скажи, что менеджер уточнит их в предложении
- После 1-2 сообщений мягко предложи оставить контакт (телефон/Telegram/email), чтобы менеджер связался и подготовил предложение — не навязчиво
- Если клиент уже оставил контакт — поблагодари и скажи, что менеджер свяжется в рабочее время (10:00–17:00)
- НЕ упоминай что ты бот или ИИ — общайся как живой консультант
- Используй эмодзи умеренно
- Только явно бытовые/непрофильные просьбы (рецепты, школьные задания, медицина, политика) мягко переводи обратно к теме — спроси, какой бизнес-процесс хочется автоматизировать, но без слов «не можем»

БАЗА ЗНАНИЙ:
${knowledgeBase}`;

// Contact detection patterns
const CONTACT_PATTERNS = [
  /(?:\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/,  // Russian phone
  /\b\d{10,11}\b/,  // Raw digits phone
  /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/,  // Email
  /@[A-Za-z0-9_]{4,}/,  // Telegram username
];

function detectContact(text) {
  return CONTACT_PATTERNS.some(p => p.test(text));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { visitorId, topicId, message, history, page, utm, referrer, userAgent, screen, lang } = req.body || {};
  if (!visitorId || !message) return res.status(400).json({ error: 'Missing required fields' });

  const openaiKey = process.env.OPENAI_API_KEY;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!openaiKey) return res.status(500).json({ error: 'OpenAI not configured' });

  try {
    // 1. Build messages for GPT
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

    // Add conversation history (last 10 messages max)
    if (Array.isArray(history)) {
      const recent = history.slice(-10);
      for (const h of recent) {
        if (h.role === 'user' || h.role === 'assistant') {
          messages.push({ role: h.role, content: h.content });
        }
      }
    }
    messages.push({ role: 'user', content: message });

    // 2. Call GPT-4o-mini
    const openai = new OpenAI({ apiKey: openaiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 300,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || 'Извините, произошла ошибка. Попробуйте ещё раз.';

    // 3. Detect contact in user message
    const contactDetected = detectContact(message);

    // 4. Forward to Telegram topic (if configured)
    let threadId = topicId ? Number(topicId) : null;

    if (token && chatId) {
      try {
        if (!threadId) {
          // Create new topic
          const city = req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : null;
          const country = req.headers['x-vercel-ip-country'] || null;
          const region = req.headers['x-vercel-ip-country-region'] || null;
          const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || null;

          const codename = generateCodename(visitorId);
          const geoTag = city || country || '';
          const topicName = `🤖 ${codename}${geoTag ? ` — ${geoTag}` : ''}`;

          const createResp = await fetch(`https://api.telegram.org/bot${token}/createForumTopic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, name: topicName.slice(0, 128), icon_color: 7322096 }),
          });

          if (createResp.ok) {
            const topicData = await createResp.json();
            threadId = topicData.result.message_thread_id;

            logTopic(threadId, 'chat-ai', '', topicName).catch(e => console.error('Topic log failed:', e));

            // Send visitor info
            const now = new Date();
            const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const geo = [city, region, country].filter(Boolean).join(', ') || '—';
            const utmStr = utm ? Object.entries(utm).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join('\n  ') : '—';
            const info = `🤖 AI-чат с посетителем\n\n🐾 ${codename}\n📄 ${page || '—'}\n⏰ ${dateStr} ${timeStr}\n📍 ${geo}\n🌐 IP: ${ip || '—'}\n🔗 ${referrer || 'Прямой заход'}\n📊 UTM: ${utmStr}`;
            await tgSend(token, chatId, threadId, info);

            // Lead card
            sendAiChatLeadCard(token, chatId, threadId, codename, geoTag, message, page).catch(() => {});
          }
        }

        if (threadId) {
          // Send user message + AI reply to topic
          await tgSend(token, chatId, threadId, `💬 Посетитель:\n${message}`);
          await tgSend(token, chatId, threadId, `🤖 Бот:\n${reply}`);

          if (contactDetected) {
            await tgSend(token, chatId, threadId, `🎯 КОНТАКТ ОБНАРУЖЕН в сообщении!`);
          }
        }
      } catch (tgErr) {
        console.error('Telegram forward failed:', tgErr.message);
      }
    }

    return res.status(200).json({
      reply,
      topicId: threadId,
      contactDetected,
    });
  } catch (err) {
    console.error('Chat AI error:', err);
    return res.status(500).json({ error: 'AI response failed' });
  }
};

async function sendAiChatLeadCard(token, chatId, threadId, codename, geo, firstMessage, page) {
  const leadsTopicId = process.env.LEADS_TOPIC_ID;
  if (!leadsTopicId) return;

  const chatIdNumeric = chatId.toString().replace(/^-100/, '');
  const topicLink = `https://t.me/c/${chatIdNumeric}/${threadId}`;

  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Moscow' });
  const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
  const preview = firstMessage.length > 100 ? firstMessage.slice(0, 100) + '...' : firstMessage;

  const text = [
    `🤖 <b>AI-ЧАТ</b>`,
    ``,
    `🐾 ${codename}`,
    geo ? `📍 ${geo}` : null,
    page ? `📄 ${page}` : null,
    `💬 <i>"${preview}"</i>`,
    `🕐 ${dateStr} ${timeStr}`,
  ].filter(Boolean).join('\n');

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_thread_id: Number(leadsTopicId),
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '📖 История', url: topicLink }, { text: '✍️ Написать', url: topicLink }]] },
    }),
  });
}

async function tgSend(token, chatId, threadId, text) {
  const body = { chat_id: chatId, text };
  if (threadId) body.message_thread_id = threadId;
  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) console.error(`TG send failed: ${resp.status}`);
}
