// Принимает апдейты Telegram (сейчас только callback_query от кнопок бан/разбан/закрыть на теме
// AI-чата). Бот раньше только отправлял сообщения — этот файл делает его первым получателем
// апдейтов, поэтому вебхук нужно один раз зарегистрировать:
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<домен>/api/telegram-webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
const { getTopicByThreadId, setTopicStatus, banVisitor, unbanVisitor } = require('./_lib/sheets');

function buildDialogKeyboard(threadId, status) {
  const banBtn = status === 'banned'
    ? { text: '🔓 Разбанить', callback_data: `unban:${threadId}` }
    : { text: '🚫 Забанить', callback_data: `ban:${threadId}` };
  return { inline_keyboard: [[banBtn, { text: '✅ Закрыть чат', callback_data: `close:${threadId}` }]] };
}

async function callTelegram(token, method, body) {
  const resp = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) console.error(`TG ${method} failed: ${resp.status}`);
  return resp;
}

async function answerCallbackQuery(token, callbackQueryId, text, showAlert) {
  // Обязателен всегда, даже при ошибке ниже по коду — иначе кнопка у админа вечно крутит спиннер
  // (урок из похожего механизма в pcmarket-ai-seller/lib/telegramTopics.ts).
  await callTelegram(token, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
    ...(showAlert ? { show_alert: true } : {}),
  }).catch(e => console.error('answerCallbackQuery failed:', e.message));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'Bot not configured' });

  // secret_token задаётся при регистрации вебхука (см. комментарий выше) — Telegram присылает его
  // этим заголовком на каждый апдейт. Пока секрет не настроен (первый деплой) — не блокируем,
  // но это дыра: настроить TELEGRAM_WEBHOOK_SECRET нужно сразу после регистрации.
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret && req.headers['x-telegram-bot-api-secret-token'] !== expectedSecret) {
    return res.status(401).json({ error: 'Bad secret token' });
  }

  const update = req.body || {};
  const cb = update.callback_query;
  if (!cb || typeof cb.data !== 'string') return res.status(200).json({ ok: true }); // не наш апдейт

  const [action, threadIdRaw] = cb.data.split(':');
  const threadId = Number(threadIdRaw);
  if (!['ban', 'unban', 'close'].includes(action) || !threadId) {
    return res.status(200).json({ ok: true });
  }

  // Доступ — только владелец/админы, из env-списка ID (не всем, кто есть в группе). Свой список,
  // а не полагание на закрытость группы: в отличие от простого «закрыть тему» бан — необратимая
  // для посетителя штука, ставки выше. Fail-CLOSED, не fail-open: если TELEGRAM_ADMIN_IDS не
  // настроен, действие НЕ выполняется (а не «пропустить проверку для всех») — иначе до настройки
  // env любой, кто узнает URL вебхука, мог бы забанить/закрыть произвольную тему подделанным апдейтом.
  const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const fromId = cb.from && cb.from.id ? String(cb.from.id) : '';
  if (!adminIds.length || !adminIds.includes(fromId)) {
    await answerCallbackQuery(token, cb.id, adminIds.length ? 'Недоступно' : 'Бот не настроен (TELEGRAM_ADMIN_IDS)', true);
    return res.status(200).json({ ok: true });
  }

  try {
    const topic = await getTopicByThreadId(threadId);
    if (!topic) {
      await answerCallbackQuery(token, cb.id, 'Тема не найдена');
      return res.status(200).json({ ok: true });
    }

    let newStatus = topic.status;
    let answerText = '';

    if (action === 'ban') {
      await banVisitor(topic.visitorId, fromId);
      await setTopicStatus(topic.rowIndex, 'banned');
      newStatus = 'banned';
      answerText = 'Забанен';
    } else if (action === 'unban') {
      await unbanVisitor(topic.visitorId);
      await setTopicStatus(topic.rowIndex, 'open');
      newStatus = 'open';
      answerText = 'Разбанен';
    } else if (action === 'close') {
      await setTopicStatus(topic.rowIndex, 'closed');
      await callTelegram(token, 'closeForumTopic', { chat_id: topic.chatId, message_thread_id: threadId }).catch(() => {});
      newStatus = 'closed';
      answerText = 'Диалог закрыт';
    }

    // Перерисовываем кнопки под сообщением, чтобы «Забанить»/«Разбанить» отражали текущий статус.
    if (topic.infoMessageId) {
      await callTelegram(token, 'editMessageReplyMarkup', {
        chat_id: topic.chatId,
        message_id: Number(topic.infoMessageId),
        reply_markup: buildDialogKeyboard(threadId, newStatus),
      }).catch(e => console.error('editMessageReplyMarkup failed:', e.message));
    }

    await answerCallbackQuery(token, cb.id, answerText);
  } catch (e) {
    console.error('telegram-webhook error:', e.message);
    await answerCallbackQuery(token, cb.id, 'Ошибка, попробуйте ещё раз');
  }

  return res.status(200).json({ ok: true });
};
