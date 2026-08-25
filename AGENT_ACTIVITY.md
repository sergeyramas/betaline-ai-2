# Agent Activity Log

Координация агентов в этом проекте. Цель: не перетирать работу друг друга.

> Глобальный fleet-ledger (что делается прямо сейчас на всём парке Mac+VPS) — в репо `sergeyramas/agent-fleet`. Этот файл — детальный проектный журнал.

## Active

- [2026-08-25 06:40 UTC] **claude-mac-opus5** (Mac) — topic: `mac-handoff-1-3` — branch: `master` — files: `AGENT_ACTIVITY.md`, `CLAUDE.md`, `vercel.json`, `docs/agents/handoff/tg-message-sites.txt` + vault `Jarvis/wiki/` — ETA: `60` — выполняю MAC_TASK.md задачи 1–3: прод-деплой на Vercel + VERCEL_TOKEN в secrets, регистрация в vault, пост в тему «Сайты». Задача 4 (revoke токена) передана оператору.
- [2026-08-25 06:40 UTC] **TODO для claude-mac** — topic: `wiki-registration` — зарегистрировать проект в vault: запись в `obsidian-ramos/index.md` → Projects + папка `projects/betaline-ai-2/index.md` (из облачной сессии vault недоступен)

## Recently Completed

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
