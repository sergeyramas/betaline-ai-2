/* Самостоятельный хост для api/*.js вне Vercel (base-vps, api.betaline-ai.ru).
   Даёт хендлерам ровно то, что они берут у Vercel: req.body (JSON), req.method,
   req.headers, res.setHeader, res.status(n).json()/end(). Ничего больше.
   Запуск: PORT=8790 node server.js (env — из .env рядом, см. deploy/betaline-api.service). */
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');

// ponytail: .env читаем сами — dotenv не нужен ради 6 строк
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n').forEach((l) => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  });
} catch (_) {}

const ROUTES = {};
for (const f of fs.readdirSync(path.join(__dirname, 'api'))) {
  if (f.endsWith('.js')) ROUTES['/api/' + f.slice(0, -3)] = require('./api/' + f);
}

function wrap(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const handler = ROUTES[url.pathname];
  wrap(res);
  if (!handler) return res.status(404).json({ error: 'Not found' });

  const chunks = [];
  req.on('data', (c) => { chunks.push(c); if (chunks.length > 512) req.destroy(); }); // ~ до 32 МБ, дальше рвём
  req.on('end', async () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    try { req.body = raw ? JSON.parse(raw) : {}; }
    catch (_) { return res.status(400).json({ error: 'Bad JSON' }); }
    try { await handler(req, res); }
    catch (e) { console.error(url.pathname, e); if (!res.headersSent) res.status(500).json({ error: 'Internal error' }); }
  });
}).listen(process.env.PORT || 8790, '127.0.0.1', () => {
  console.log('betaline api on', process.env.PORT || 8790, Object.keys(ROUTES).join(' '));
});
