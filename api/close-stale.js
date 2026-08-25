const { getOpenTopics, markTopicClosed } = require('./_lib/sheets');

const STALE_HOURS = 48;

module.exports = async function handler(req, res) {
  // Only allow GET (Vercel cron) or POST with secret
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify this is a legitimate cron call or authorized request
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'];
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(500).json({ error: 'Bot not configured' });

  try {
    const topics = await getOpenTopics();
    const now = Date.now();
    const staleMs = STALE_HOURS * 60 * 60 * 1000;

    let closed = 0;
    let errors = 0;

    for (const topic of topics) {
      const createdAt = new Date(topic.createdAt).getTime();
      if (now - createdAt < staleMs) continue; // not stale yet

      try {
        const resp = await fetch(`https://api.telegram.org/bot${token}/closeForumTopic`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: topic.chatId || chatId,
            message_thread_id: topic.threadId,
          }),
        });

        if (resp.ok || (await resp.text()).includes('TOPIC_CLOSED')) {
          await markTopicClosed(topic.rowIndex);
          closed++;
        } else {
          errors++;
        }
      } catch (e) {
        console.error(`Failed to close topic ${topic.threadId}:`, e);
        errors++;
      }
    }

    return res.status(200).json({
      ok: true,
      total: topics.length,
      closed,
      errors,
      staleHours: STALE_HOURS,
    });
  } catch (err) {
    console.error('Close-stale error:', err);
    return res.status(500).json({ error: 'Failed to process topics' });
  }
};
