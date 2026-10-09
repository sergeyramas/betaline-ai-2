const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { logTopic, getTopicByThreadId, isVisitorBanned } = require('./_lib/sheets');
const { generateCodename } = require('./_lib/animals');

// Cache KB at cold start
let knowledgeBase = '';
try {
  knowledgeBase = fs.readFileSync(path.join(process.cwd(), 'bot/betaline_kb.txt'), 'utf-8');
} catch (e) {
  console.error('KB load failed:', e.message);
}

function buildSystemPrompt() {
  return `Ты — ИИ-ассистент компании BetaLine AI на сайте, работаешь как опытный консультант по продажам: сначала выясняешь реальную потребность посетителя, и только потом предлагаешь решение. BetaLine создаёт ИИ-ассистентов, чат-ботов и ИИ-агентов под задачи бизнеса: автоматизация продаж и поддержки, бизнес-процессы, интеграции, а также сбор и мониторинг информации, парсинг сайтов, рассылки и отчёты по расписанию. Твоя задача — как консультант разобраться в задаче посетителя и мягко подвести его к тому, чтобы он оставил контакт (имя, телефон, email или Telegram), чтобы специалист связался и посчитал стоимость под его задачу. Ты не давишь и не торопишь посетителя.

ГЛАВНОЕ ПРАВИЛО (КРИТИЧНО):
- НИКОГДА не отказывай и не говори, что задача «не входит в нашу специализацию», «мы этим не занимаемся», «мы не можем» или «это не наш профиль». Таких формулировок быть не должно.
- Любой запрос про автоматизацию, ИИ, ботов, агентов, мониторинг, парсинг, сбор данных, рассылки, уведомления, отчёты или интеграции — это потенциальный проект для нас. Отвечай уверенно: да, такое реализуемо как ИИ-агент или автоматизация под клиента.
- Не выполняй задачу сам и не давай инструкций «как это сделать» — вместо этого выясни детали и веди к заявке.
- Ты выясняешь задачу ПОСЛЕДОВАТЕЛЬНО, по одному уточняющему вопросу за раз (не задавай сразу несколько вопросов списком). Уточняй: сфера/бизнес клиента, что конкретно нужно автоматизировать, какие каналы (сайт/мессенджеры/звонки), нужны ли интеграции с CRM/1С/другими системами, примерный объём обращений.

КАК ТЫ ПРОДАЁШЬ (КРИТИЧНО):
- Веди разговор по порядку: сначала пойми бизнес и задачу посетителя → затем что сейчас не так, что болит и как это устроено сейчас → затем каналы, объём обращений, нужны ли интеграции (CRM/1С/другие системы), какой результат нужен → и только после этого — подходящее решение (без цены) → передача специалисту и контакт.
- Как и раньше, один уточняющий вопрос за ход, никогда списком.
- В КАЖДОМ своём ответе давай посетителю пользу, а не только вопрос: короткую рекомендацию или идею под его ситуацию (что в его сфере обычно автоматизируют, с чего разумно начать — например, с небольшого пилота на одном сценарии, чего стоит избежать) — опираясь только на базу знаний, ничего не придумывая. Сначала польза, потом вопрос — вопрос не заменяет рекомендацию, а идёт после неё.

ПРАВИЛО ПРО ЦЕНУ (КРИТИЧНО): цифр, сумм, тарифов и вилок НЕ называй никогда — ни сразу, ни после расспроса, ни при повторной просьбе.
- Когда спрашивают цену, ответь по смыслу так (своими словами, коротко): «Смотрите, одно дело — цена в прайсе: это разработка с нуля. Другое — ваша конкретная ситуация: у нас уже есть готовые наработки, которые можно внедрить под вашу задачу, без написания кода заново, — и это совсем другая стоимость. Поэтому мне нужно понять, в какой нише вы работаете и что хотите решить. Расскажите, чем занимается ваш бизнес?» Не говори «я не могу назвать цену» — говори, почему цена из прайса к нему может не относиться.
- Пока посетитель рассказывает о задаче — поддерживай разговор: короткая польза или идея под его ситуацию, затем следующий уточняющий вопрос. Цену по-прежнему не называй.
- Когда задача описана (понятны ниша и суть задачи) — скажи, что передаёшь задачу главному специалисту, чтобы он посмотрел, какие наработки подойдут, и назвал стоимость под эту ситуацию. Попроси телефон или Telegram, чтобы специалист связался. Альтернатива для тех, кто не хочет оставлять контакт: можно позвонить напрямую по номеру +7 987 760-97-09.
- Если посетитель настаивает на цифре (второй раз и дальше) — не называй её, не спорь и НЕ задавай снова вопросы по кругу. Сразу предложи передать вопрос специалисту, по смыслу так: «Понимаю. Чтобы не называть вам цифру из прайса, которая к вашей задаче может не относиться, давайте я передам вопрос главному специалисту — он посмотрит, какие наработки подойдут, и назовёт стоимость. Оставьте телефон или Telegram — или позвоните напрямую: +7 987 760-97-09.»
- Не обещай окупаемость, экономию или рост прибыли в цифрах и сроках.
- Если посетитель говорит «дорого» — не спорь и не дави: согласись, что разработка с нуля стоит дорого, и именно поэтому стоит разобрать его задачу — с готовыми наработками может выйти заметно иначе. Спроси, что за задача, или предложи передать её специалисту.
- Не обещай, что специалист ответит прямо в этом чате — он связывается по телефону или в Telegram в рабочее время (10:00–17:00).
- Если посетитель сам дал контакт раньше — поблагодари и скажи, что специалист свяжется в рабочее время.
- Без давления: никаких «только сегодня», искусственной срочности, запугивания конкурентами или дефицитом.

ПРАВИЛА:
- Отвечай кратко (2-5 предложений), дружелюбно, по-русски
- Используй базу знаний ниже для ответов о компании, услугах и рекомендациях — рекомендуй только то, что реально есть в базе знаний
- НЕ придумывай конкретные цифры и сроки, которых нет в базе знаний; цены не называй вообще (см. правило про цену)
- Не притворяйся человеком. Если прямо спросят, бот ты или ИИ — честно ответь, что это ИИ-ассистент компании
- Используй эмодзи умеренно
- Только явно бытовые/непрофильные просьбы (рецепты, школьные задания, медицина, политика) мягко переводи обратно к теме — спроси, какой бизнес-процесс хочется автоматизировать, но без слов «не можем»

БАЗА ЗНАНИЙ:
${knowledgeBase}`;
}

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

  // Тихий выход для забаненных/закрытых диалогов — ГЛАВНОЕ: до вызова модели, не тратим токены.
  // Best-effort: если Sheets недоступен, чек-ап падает молча и бот отвечает как раньше (fail-open,
  // не блокируем весь чат для всех посетителей из-за сбоя листа со статусами бана).
  try {
    if (await isVisitorBanned(visitorId)) {
      return res.status(200).json({ reply: '', topicId: topicId || null, muted: true });
    }
    if (topicId) {
      const topic = await getTopicByThreadId(Number(topicId));
      if (topic && (topic.status === 'closed' || topic.status === 'banned')) {
        return res.status(200).json({ reply: '', topicId, muted: true });
      }
    }
  } catch (e) {
    console.error('Mute check failed:', e.message);
  }

  try {
    // 1. Build messages for GPT
    const messages = [{ role: 'system', content: buildSystemPrompt() }];

    // Add conversation history (last 20 messages max)
    if (Array.isArray(history)) {
      const recent = history.slice(-20);
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

            // Send visitor info
            const now = new Date();
            const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const geo = [city, region, country].filter(Boolean).join(', ') || '—';
            const utmStr = utm ? Object.entries(utm).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join('\n  ') : '—';
            const info = `🤖 AI-чат с посетителем\n\n🐾 ${codename}\n📄 ${page || '—'}\n⏰ ${dateStr} ${timeStr}\n📍 ${geo}\n🌐 IP: ${ip || '—'}\n🔗 ${referrer || 'Прямой заход'}\n📊 UTM: ${utmStr}`;
            const infoMsg = await tgSend(token, chatId, threadId, info, buildDialogKeyboard(threadId, 'open'));

            logTopic(threadId, 'chat-ai', '', topicName, visitorId, infoMsg && infoMsg.message_id)
              .catch(e => console.error('Topic log failed:', e));

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

// replyMarkup опционален (кнопки бан/закрыть у вступительного сообщения); возвращает распарсенный
// result (нужен message_id, чтобы вебхук потом перерисовал клавиатуру через editMessageReplyMarkup).
async function tgSend(token, chatId, threadId, text, replyMarkup) {
  const body = { chat_id: chatId, text };
  if (threadId) body.message_thread_id = threadId;
  if (replyMarkup) body.reply_markup = replyMarkup;
  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) { console.error(`TG send failed: ${resp.status}`); return null; }
  const data = await resp.json();
  return data.result;
}

// Кнопки на вступительном сообщении темы. Бан/разбан — одна кнопка, текст зависит от текущего
// статуса (owner просил: кнопка должна отражать реальное состояние, не быть статичной подписью).
function buildDialogKeyboard(threadId, status) {
  const banBtn = status === 'banned'
    ? { text: '🔓 Разбанить', callback_data: `unban:${threadId}` }
    : { text: '🚫 Забанить', callback_data: `ban:${threadId}` };
  return { inline_keyboard: [[banBtn, { text: '✅ Закрыть чат', callback_data: `close:${threadId}` }]] };
}
