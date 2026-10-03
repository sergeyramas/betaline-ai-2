#!/usr/bin/env node
'use strict';

/**
 * Прогон api/chat-ai.js без Telegram: проверка «сначала расспрос, потом цена по сайту»
 * на наборе кейсов (голосовой агент / чат-бот на custom2 и apex, диалог из 3 ходов).
 *
 * Использование:
 *   OPENAI_API_KEY=... node tools/chat-price-test.js [каталог]
 *   OPENAI_API_KEY=... node tools/chat-price-test.js --ref master   # снять "до" со старой версии
 *
 * По умолчанию каталог — текущий (process.cwd()).
 * С --ref <git-ref> старые api/chat-ai.js, api/_lib/*, bot/betaline_kb.txt берутся через
 * `git show <ref>:path` во временный каталог, который прогоняется вместо текущего и удаляется
 * после завершения.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const { execFileSync } = require('child_process');

function parseArgs(argv) {
  let ref = null;
  let dir = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ref') {
      ref = argv[i + 1];
      i++;
    } else if (!dir) {
      dir = argv[i];
    }
  }
  return { ref, dir };
}

// Вытаскивает файл из git-ref в указанный путь во временном каталоге. repoRoot — каталог,
// из которого нужно звать `git show` (тот, что реально является git-репозиторием).
function gitShowFile(repoRoot, ref, relPath, outPath) {
  let content;
  try {
    content = execFileSync('git', ['show', `${ref}:${relPath}`], { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 });
  } catch (e) {
    throw new Error(`git show ${ref}:${relPath} провалился: ${e.message}`);
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content);
}

function buildRefSnapshot(repoRoot, ref) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-price-test-'));
  const files = [
    'api/chat-ai.js',
    'api/_lib/sheets.js',
    'api/_lib/animals.js',
    'bot/betaline_kb.txt',
  ];
  for (const rel of files) {
    gitShowFile(repoRoot, ref, rel, path.join(tmpDir, rel));
  }
  return tmpDir;
}

function findRepoRoot(startDir) {
  try {
    const out = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: startDir }).toString().trim();
    return out;
  } catch (e) {
    return startDir;
  }
}

function mockSheets() {
  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (typeof request === 'string' && request.indexOf('_lib/sheets') !== -1) {
      return {
        isVisitorBanned: async () => false,
        getTopicByThreadId: async () => null,
        logTopic: async () => {},
        banVisitor: async () => {},
        unbanVisitor: async () => {},
        setTopicStatus: async () => {},
      };
    }
    return origLoad.apply(this, arguments);
  };
  return () => { Module._load = origLoad; };
}

function makeReq({ origin, body }) {
  return {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body,
  };
}

function makeRes() {
  const res = {
    _status: 200,
    _body: null,
    setHeader() {},
    status(code) {
      res._status = code;
      return res;
    },
    json(obj) {
      res._body = obj;
      return res;
    },
    end() {
      return res;
    },
  };
  return res;
}

async function runCase(handler, label, { origin, message, history }) {
  const visitorId = `test-${label.replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;
  const req = makeReq({
    origin,
    body: {
      visitorId,
      message,
      history: history || [],
      page: origin + '/',
    },
  });
  const res = makeRes();
  await handler(req, res);
  return res;
}

async function main() {
  const { ref, dir: dirArg } = parseArgs(process.argv.slice(2));

  if (!process.env.OPENAI_API_KEY) {
    console.error('Ошибка: нужен OPENAI_API_KEY в окружении. Пример:');
    console.error('  OPENAI_API_KEY=sk-... node tools/chat-price-test.js');
    process.exit(1);
  }

  // Убираем Telegram из env — без токена весь блок форварда в TG молча пропускается.
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.LEADS_TOPIC_ID;

  let dir = dirArg ? path.resolve(dirArg) : process.cwd();
  let tmpDir = null;
  let unmock = null;

  try {
    if (ref) {
      const repoRoot = findRepoRoot(dir);
      console.log(`Снимаю снимок api/chat-ai.js, api/_lib/*, bot/betaline_kb.txt на ref "${ref}" из ${repoRoot}...`);
      tmpDir = buildRefSnapshot(repoRoot, ref);
      dir = tmpDir;
    }

    const chatAiPath = path.join(dir, 'api', 'chat-ai.js');
    if (!fs.existsSync(chatAiPath)) {
      console.error(`Не найден ${chatAiPath}`);
      process.exit(1);
    }

    unmock = mockSheets();

    const prevCwd = process.cwd();
    process.chdir(dir); // chat-ai.js читает bot/betaline_kb.txt от process.cwd()
    let handler;
    try {
      delete require.cache[require.resolve(chatAiPath)];
      handler = require(chatAiPath);
    } finally {
      process.chdir(prevCwd);
    }

    const ORIGIN_CUSTOM2 = 'https://custom2.betaline-ai.ru';
    const ORIGIN_CUSTOM = 'https://custom.betaline-ai.ru';
    const ORIGIN_APEX = 'https://betaline-ai.ru';

    const cases = [
      { label: 'a) custom2 — голосовой агент', origin: ORIGIN_CUSTOM2, message: 'сколько стоит голосовой агент?' },
      { label: 'b) custom2 — ваш бот', origin: ORIGIN_CUSTOM2, message: 'сколько стоит ваш бот?' },
      { label: 'c) custom2 — тест аудита', origin: ORIGIN_CUSTOM2, message: 'Тест аудита: сколько стоит голосовой агент?' },
      { label: 'd) apex — чат-бот', origin: ORIGIN_APEX, message: 'сколько стоит чат-бот?' },
    ];

    for (const c of cases) {
      console.log('\n=== Кейс', c.label, '===');
      console.log('Сайт:', c.origin === ORIGIN_APEX ? 'apex' : 'custom', `(origin: ${c.origin})`);
      console.log('Вопрос:', c.message);
      const res = await runCase(handler, c.label, { origin: c.origin, message: c.message });
      if (res._status !== 200) {
        console.log('HTTP', res._status, JSON.stringify(res._body));
        continue;
      }
      console.log('Ответ:', res._body.reply);
    }

    // Диалог из 3 ходов
    console.log('\n=== Кейс e) custom2 — диалог из 3 ходов ===');
    console.log('Сайт: custom (origin:', ORIGIN_CUSTOM2 + ')');
    const turns = [
      'сколько стоит бот?',
      'у меня автосервис, хочу чтобы записывал клиентов и отвечал на вопросы',
      'пишут в WhatsApp и звонят, учёт в 1С',
    ];
    const history = [];
    for (let i = 0; i < turns.length; i++) {
      console.log(`\n--- Ход ${i + 1} ---`);
      console.log('Вопрос:', turns[i]);
      const res = await runCase(handler, `e-turn${i + 1}`, {
        origin: ORIGIN_CUSTOM2,
        message: turns[i],
        history,
      });
      if (res._status !== 200) {
        console.log('HTTP', res._status, JSON.stringify(res._body));
        break;
      }
      console.log('Ответ:', res._body.reply);
      history.push({ role: 'user', content: turns[i] });
      history.push({ role: 'assistant', content: res._body.reply });
    }
    // Диалог: повторная просьба назвать цифру без расспроса
    console.log('\n=== Кейс f) custom2 — настаивает на цифре ===');
    console.log('Сайт: custom (origin:', ORIGIN_CUSTOM2 + ')');
    const turnsF = [
      'сколько стоит бот?',
      'просто скажите цифру',
    ];
    const historyF = [];
    for (let i = 0; i < turnsF.length; i++) {
      console.log(`\n--- Ход ${i + 1} ---`);
      console.log('Вопрос:', turnsF[i]);
      const res = await runCase(handler, `f-turn${i + 1}`, {
        origin: ORIGIN_CUSTOM2,
        message: turnsF[i],
        history: historyF,
      });
      if (res._status !== 200) {
        console.log('HTTP', res._status, JSON.stringify(res._body));
        break;
      }
      console.log('Ответ:', res._body.reply);
      historyF.push({ role: 'user', content: turnsF[i] });
      historyF.push({ role: 'assistant', content: res._body.reply });
    }
  } finally {
    if (unmock) unmock();
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

main().catch((e) => {
  console.error('Ошибка прогона:', e.stack || e.message);
  process.exit(1);
});
