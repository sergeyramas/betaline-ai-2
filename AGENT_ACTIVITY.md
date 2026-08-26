# Agent Activity Log

Координация агентов в этом проекте. Цель: не перетирать работу друг друга.

> Глобальный fleet-ledger (что делается прямо сейчас на всём парке Mac+VPS) — в репо `sergeyramas/agent-fleet`. Этот файл — детальный проектный журнал.

## Active

_Свободно._

## Recently Completed

- [2026-08-26 08:10 UTC] **claude-mac-opus5** (Mac) — topic: `verify-handoff-ci` — DONE @ 563c690
  Перепроверка хендоффа MAC_TASK.md (задачи 1–3 были закрыты 2026-08-25) + починка CI-воркфлоу.
  **Задача 1 — деплой:** жив. `betaline-ai-2.vercel.app`: title/og-image/style.css/main.js — 200; `api/lead` → 400 на пустой
  body (функция жива, env нет — как задумано). Прод-деплой 1-дневной давности актуален: после него в master менялись только
  AGENT_ACTIVITY.md / CLAUDE.md / docs/handoff — код страницы не трогали. Визуальный DoD пройден заново на 1440 и 390:
  горизонтального скролла нет (scrollW == clientW), все 44 `.rv` видимы после failsafe на обоих ширинах, console errors — 0,
  hero-мокап amoCRM и оранжевая кнопка чата на месте, 4 формы в DOM.
  **Задача 2 — vault:** подтверждена. `~/Documents/Jarvis/wiki/projects/betaline-ai-2/index.md` есть, строка в `wiki/index.md`
  → Projects есть, запись в `wiki/log.md` есть. TODO `wiki-registration` в Active отсутствует.
  **Задача 3 — пост в тему:** подтверждён вычиткой из Telegram. msg `151` в группе `-1004397085324`, `reply_to_msg_id=9`
  (топик 9), 2026-08-25 08:37 UTC, последняя строка «Живое превью: https://betaline-ai-2.vercel.app» на месте.
  ⚠️ В MAC_TASK.md ssh-хост указан как `root@hermes` — на Mac такого алиаса нет, рабочий: `hermes-vps` (104.252.77.253).
  Сессия telethon называется `personal`, не `session` (`SESSION = os.path.join(TG_DATA_DIR, "personal")`).
  **Починено (новое):** `.vercel/` лежит в `.gitignore`, поэтому в CI не было project-линка — `vercel deploy --prod --yes`
  линковался по имени каталога и мог завести ДУБЛЬ Vercel-проекта вместо `betaline-ai-2`. В шаг деплоя проставлены
  `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` (не секреты, уже публично в CLAUDE.md §2). Прогон 32945738691: YAML парсится,
  джоб есть, env инжектится, падение ровно на штатном «Секрет VERCEL_TOKEN не задан».
  🔴 **CI по-прежнему ждёт Сергея** и это подтверждено независимо, а не переписано из прошлой записи: `POST /v3/user/tokens`
  токеном CLI → `forbidden: Cannot create tokens for this app`; `vercel git connect` → `Failed to connect… to project`;
  `GET /user/installations` → 403 (OAuth-токен gh не авторизован для App). Плюс новый факт: **ни один** из ~40 проектов
  команды `team_IQe20O57hTH99URRYtc0FvFt` не имеет git-линка — весь аккаунт живёт на схеме «Actions + VERCEL_TOKEN»
  (так же сделаны npz-tactical-map и betaline-voice-ai), так что путь с токеном — не костыль, а конвенция аккаунта.
  Готового токена нигде на Mac нет (grep по `~/Documents` — пусто), из GH-секретов чужих репо значение не читается.
  Остаётся один ручной шаг: vercel.com/account/tokens → Create Token → `gh secret set VERCEL_TOKEN --repo sergeyramas/betaline-ai-2`.
  **Задача 4 (утёкший bot-токен в `08_audit_form.html` боевого betaline-landing) — не выполнялась, передана Сергею.**

- [2026-08-25 07:50 UTC] **claude-mac-opus5** (Mac) — topic: `tg-post-sites` — DONE @ https://t.me/c/4397085324/151
  Пост о макетах отправлен в топик 9 «Сайт наш „Бета линия"» группы `-1004397085324` (аккаунт @ramassist с hermes-vps).
  🔴 Из текста по решению Сергея убран ценовой абзац («консалтинг от 150 000 ₽, пилоты 600 000–1 000 000 ₽»): он противоречил
  тарифам на самом лендинге, куда пост теперь ведёт (45 000 / 90 000 / 145 000 ₽). Цены ни в посте, ни на странице не менялись — §7.
  `tg_send_topic.py` из хендоффа не запускался: два бага под telethon 1.44 — `GetForumTopicsRequest` импортируется из
  `functions.messages` (не `channels`) и принимает `peer=`/`q=` (не `channel=`). Починен в репо и залит на hermes-vps
  (`/root/tg-recon/`, старая 852-байтная версия сохранена как `.bak-2026-08-25`). Запуск требует
  `TG_DATA_DIR=/root/tg-recon/instances/personal` + `.env` оттуда же.

- [2026-08-25 07:45 UTC] **claude-mac-opus5** (Mac) — topic: `deploy-vercel` — DONE @ prod https://betaline-ai-2.vercel.app
  Прод-деплой с Mac: Vercel-проект `betaline-ai-2` (`prj_s1I5SEpy9qq8WWj2Lmq8ToTzDfOf`, team `team_IQe20O57hTH99URRYtc0FvFt`), alias `betaline-ai-2.vercel.app`. DoD пройден: title/og-image/шрифты/style.css/main.js — 200; 0 горизонтального скролла на 1440 и 390; все 44 `.rv` видимы (failsafe жив); модалка тарифа открывается, console errors — 0; `api/lead` отвечает 400 на пустой body (функция жива, env нет — как и задумано). Тест-лид НЕ слал: формы не менялись.
  🔴 CI-деплой НЕ включён. Токен CLI короткоживущий, `POST /v3/user/tokens` c ним → `forbidden`; обход «нативная Git-интеграция вместо секрета» тоже закрыт — `vercel git connect` падает, GitHub App Vercel в режиме «selected repositories» и этого репо не видит. Нужен токен с vercel.com/account/tokens руками → `gh secret set VERCEL_TOKEN`. Workflow до тех пор падает со своим явным сообщением — оставлен как маркер. `crons` в vercel.json не трогал: на превью падает безвредно, а при переезде на боевой домен он там нужен.

- [2026-08-25 07:45 UTC] **claude-mac-opus5** (Mac) — topic: `wiki-registration` — DONE (закрывает TODO из облачной сессии)
  Vault оказался НЕ `~/obsidian-ramos`, а `~/Documents/Jarvis/wiki/` — путь в MAC_TASK.md был устаревший. Заведена `wiki/projects/betaline-ai-2/index.md`, строка в `wiki/index.md` → Projects (сразу под материнским BetaLine), запись в `wiki/log.md`. Указатели на vault в CLAUDE.md §1/§11 и таблица External IDs синхронизированы с фактом.

- [2026-08-25 06:30 UTC] **claude-web-fable5** (claude.ai/code) — topic: `landing-v3` — DONE @ b4634db
  Landing v3 собран и замержен в master: 11 секций «продукт-герой» (hero с CSS-мокапом amoCRM, затыки 3+2, диагностика @BetalineAI_bot, кейсы metrics-first, два трека цен), api/ перенесён с боевого с фиксами lead.js (plan доходит до TG/Sheets/CRM/email), Метрика 108480715 + цели diag_bot_click/pains_expand, чат-виджет, Inter woff2. Caveats: index.html/style.css собраны из partials/ — правь оба; reveal-failsafe не удалять; деплой ждёт секрет VERCEL_TOKEN (workflow починен — было YAML-двоеточие в echo).

---

## Регламент

### 1. Перед стартом работы

1. `git pull --rebase`
2. Прочитать `## Active` — увидеть какие файлы заняты
3. Если твои файлы пересекаются с чужими — **остановиться**, написать оператору
4. Добавить запись в `## Active` (наверх):
   ```
   - [YYYY-MM-DD HH:MM UTC] **<agent-id>** (<host>) — topic: `<slug>` — branch: `<branch>` — files: `<paths>` — ETA: `<min>`
   ```
5. Закоммитить claim **отдельным коммитом**: `chore: claim work on <topic>`
6. `git push`

### 2. Во время работы

- Если scope расширился и трогаешь файлы которых не было в заявке — **обновить запись в Active ДО правки**
- Долгая работа (>30 мин) — периодически `git fetch && git rebase origin/master`
- Конфликт — откатиться и согласовать с оператором

### 3. После завершения

1. Перенести запись из `Active` в `Recently Completed`
2. Дописать SHA финального коммита и краткий технический разбор
3. Удалить из `Recently Completed` записи старше 7 дней
4. Закоммитить: `chore: release work on <topic>`
5. `git push`

### 4. Идентификация агента

Формат: `<tool>-<host>-<model>`. Примеры:
- `claude-local-opus47` — Claude Code на Mac, Opus 4.7
- `claude-vps-sonnet46` — Claude Code на VPS, Sonnet 4.6
- `claude-web-fable5` — Claude Code на claude.ai/code
- `codex-vps` — Codex CLI на VPS

### 5. Что считается «работой» (требует записи)

**Требует:**
- Любое редактирование кода / скриптов / docs / migrations
- Изменение `CLAUDE.md`, `AGENT_ACTIVITY.md`, `.claude/settings.json`
- Деплой / изменение секретов Vercel / workflow

**Не требует:**
- Чтение / grep / поиск
- Read-only скрипты
- Просмотр логов
- Ответы оператору без правок

### 6. Stale записи

Запись в `Active` старше 2 часов без коммитов = stale. Можно забрать:
1. Спросить оператора
2. Если ok — перенести запись зависшего агента в `Recently Completed` со статусом `(released by <твой-id> — stale)`
3. Создать свою запись стандартно

### 7. Связь с глобальным fleet-ledger

- При START агент дополнительно пишет одну строку в `~/Documents/agent-fleet/AGENT_ACTIVITY.md` (Mac) или `/root/agent-fleet/AGENT_ACTIVITY.md` (VPS) — формат там свой, проще. Облачные сессии (claude.ai/code) к fleet-ledger доступа не имеют — пишут только сюда.
- При DONE — аналогично
- Это отдельный шаг, не дублирует этот файл; глобальный нужен для cross-project visibility, локальный — для координации в коде

### 8. Правки от партнёра Андрея

Задачи от Андрея (@Andrei_Stanislavovich) — см. `docs/agents/ANDREY.md`. Коротко: агент делает правки в ветке `andrey/<slug>`, открывает PR, мержит в master **только оператор** (Сергей). Пункты из Guardrails CLAUDE.md §7 партнёрскими задачами не переопределяются.
