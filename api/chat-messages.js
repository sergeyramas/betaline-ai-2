// Ответы оператора для виджета чата: GET ?token=<токен диалога>&after=<id последнего показанного>
// Токен выдаёт chat-ai.js; чужой или поддельный токен -> 404. Опрашивает виджет раз в ~5 с, пока чат открыт.
const { operatorMessages, validChatToken } = require('./_lib/admin');

const last = new Map(); // token -> время последнего запроса (rate-limit: не чаще раза в 2 с)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = new URL(req.url, 'http://x').searchParams;
  const token = q.get('token');
  if (!validChatToken(token)) return res.status(404).json({ error: 'Not found' });

  const now = Date.now();
  if (now - (last.get(token) || 0) < 2000) return res.status(429).json({ error: 'Too many requests' });
  last.set(token, now);
  if (last.size > 5000) for (const [k, t] of last) if (now - t > 60000) last.delete(k);

  try {
    const j = await operatorMessages(token, q.get('after'));
    return res.status(200).json({ messages: (j.messages || []).map((m) => ({ id: m.id, text: m.text, ts: m.ts, kind: m.kind === 'taken' || m.kind === 'released' ? m.kind : 'operator' })) });
  } catch (e) {
    return res.status(200).json({ messages: [] }); // админка недоступна — виджет просто ничего не покажет
  }
};
