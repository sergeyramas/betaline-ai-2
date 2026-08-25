# betaline-ai-2 — agent context

## 1. Identity

- **Что это:** Landing v3 компании Betaline AI — конверсионный одностраничник «продукт-герой» + serverless-обвязка лидов. Собран по исследованию landing-v2-v3 (pain-driven затыки, диагностика в @BetalineAI_bot, кейсы metrics-first).
- **Зачем:** заменить текущий betaline-ai.ru; принимать лиды в Telegram/Sheets/CRM/почту.
- **Статус:** active — превью-деплой на Vercel, после одобрения оператора переезд на betaline-ai.ru.
- **Дедлайн / милейстоны:** превью → правки партнёра → замена боевого index.html.
- **Vault:** [[wiki/projects/betaline-ai-2/index]] (страницу в obsidian-ramos ещё НЕ завели — TODO для mac-агента)

## 2. External IDs & URLs

| Что | Где |
|---|---|
| GitHub repo | `sergeyramas/betaline-ai-2` |
| Production URL | будущий: `https://betaline-ai.ru` (сейчас там старый сайт из репо betaline-landing) |
| Staging URL | Vercel-проект из этого репо (создаётся workflow'ом при наличии секрета `VERCEL_TOKEN`) |
| Vercel project | создаёт `vercel deploy --prod --yes` при первом запуске workflow |
| Боевой API | `https://betaline-ai.ru/api/lead`, `/api/chat-ai` (CORS `*`; превью постит кросс-доменно) |
| External APIs | Telegram Bot API, Google Sheets, PocketBase CRM, Resend, OpenAI (см. `api/`) |
| Operator / клиент | Сергей — TG `@Sergeyramas`; партнёр-заказчик правок: Андрей — TG `@Andrei_Stanislavovich` (см. `docs/agents/ANDREY.md`) |
| Аналитика | Яндекс.Метрика `108480715` (webvisor; цели — см. §8) |

## 3. Stack

- **Язык / runtime:** статичный HTML/CSS/vanilla JS; serverless — Node 22, CommonJS (`api/*.js`)
- **Фреймворк:** нет; zero-config Vercel static + `/api` functions
- **Package manager:** npm (`package.json` только для serverless: `google-auth-library`, `openai`)
- **БД / хранилище:** Google Sheets («Лиды», «Топики»), PocketBase CRM, localStorage (чат-виджет)
- **Шрифты:** Inter self-hosted woff2 (cyrillic+latin сабсеты) в `assets/fonts/`

## 4. Layout

```
betaline-ai-2/
├── index.html          # СБОРКА из partials (см. gotcha #1) — 11 секций v3
├── style.css           # токены (§ «Токены — КОНТРАКТ») + база + партиалы
├── main.js             # формы, чат-виджет, Метрика, reveal (+failsafe)
├── partials/           # ИСТОЧНИК правды секций: top/bottom/widgets .html+.css
├── api/                # серверлесс: lead.js (fan-out), chat-ai.js, close-stale.js, _lib/
├── bot/betaline_kb.txt # база знаний chat-ai.js — путь менять НЕЛЬЗЯ (process.cwd()/bot/…)
├── assets/             # fonts/, img/ (og-image, QR, фото инженера, favicon)
├── mockups/            # архив итераций (blueprint-v2, концепты A/B/C) + design/shot.py
└── .github/workflows/deploy-vercel.yml  # прод-деплой по push в master
```

**Не трогать без разрешения оператора:**
- `api/_lib/sheets.js`, схема колонок «Лиды» A–K — на неё завязаны отчёты
- Цены (тарифы 45/90/145 тыс, «кастом по проекту») и цифры кейсов — только оператор
- id счётчика Метрики и имена целей — не переименовывать, рвётся история

## 5. Commands

| Задача | Команда |
|---|---|
| локальный просмотр | `python3 -m http.server 8077` (пути в html абсолютные — file:// не работает) |
| скриншот QA | `python3 mockups/design/shot.py <file.html> <out.png> [width]` |
| js-синтаксис | `node --check main.js && node --check api/lead.js` |
| сборка из partials | заменить фрагменты между маркерами `<!-- built from partials/... -->` (см. gotcha #1) |
| deploy prod | push в `master` → GitHub Actions → Vercel (нужен секрет `VERCEL_TOKEN`) |
| тест лид-пайплайна | `curl -X POST https://betaline-ai.ru/api/lead -H 'Content-Type: application/json' -d '{"source":"callback","name":"ТЕСТ — не звонить","phone":"70000000000"}'` |

## 6. Verification — Definition of Done

Перед заявлением «готово» агент ОБЯЗАН:

- [ ] `node --check` по всем изменённым js — зелёный
- [ ] полностраничные скриншоты 1440 и 390 через локальный http-сервер; глазами: без наложений, без горизонтального скролла (`document.documentElement.scrollWidth == viewport`)
- [ ] если менялись формы — тестовый лид с именем «ТЕСТ … — не звонить» дошёл (`{"ok":true}`), оператор предупреждён
- [ ] после мержа в master — проверить что Vercel-деплой поднялся (workflow summary / curl прод-URL)
- [ ] обновить `AGENT_ACTIVITY.md` (перенести строку в Recently Completed с SHA)

Никаких «должно работать» без выполненной проверки.

## 7. Guardrails — NEVER без явного подтверждения оператора

- ❌ `git push --force` на master
- ❌ менять цены, тарифы, цифры кейсов, юрреквизиты (ИП/ИНН/ОГРНИП), телефон 8 800 200-18-49
- ❌ переименовывать/удалять цели Метрики и поля payload `/api/lead` (source, plan, …)
- ❌ добавлять внешние CDN/скрипты (страница self-hosted; исключения: Метрика, CallbackFire)
- ❌ коммитить секреты; env только в Vercel/`.env` (gitignored)
- ❌ таймеры обратного отсчёта, exit-попапы, FOMO-блоки — запрещены редполитикой

## 8. Domain rules

- **Язык: «агент/система/решение», НЕ «бот»** (кроме контекста @BetalineAI_bot).
  Why: исследование landing-v2-v3, вердикт 3 ревьюеров. How: grep «бот» перед коммитом копирайта.
- **Каждая цифра кейса несёт легенду «кейс · период · метод».**
  Why: «цифры без источника токсичны для B2B» (исследование). How: карточки в `partials/top.html` → cases.
- **Цели Метрики:** quiz_lead, audit_lead, callback_lead, chat_message, chat_lead, callback_chat, pricing_lead + diag_bot_click, pains_expand. Новые CTA в бот — `data-goal="diag_bot_click"` + deep-link `?start=diag_<секция>`.
- **API_BASE в main.js:** превью-домены постят на боевой `/api/lead`; при переезде на betaline-ai.ru работает same-origin. Не хардкодить URL в обход.
- **Согласие ПДн** со ссылкой на модалку политики — у каждой формы.

## 9. Known gotchas

- **index.html/style.css — сборные.** Источник секций — `partials/*`; финальные файлы содержат вставленные копии. Правишь секцию → правь И партиал, И сборку (или пересобери заменой блока между маркерами `<!-- built from … -->`). Рассинхрон = следующий агент перетрёт твою правку.
- **Workflow падал с 0 джобов** — было двоеточие в неквотированном echo YAML. Симптом «failure, jobs: []» = YAML parse error, чинить файл, не секреты. (fix: bf3a253→…)
- **Reveal-гонка:** .rv контент мог оставаться невидимым (печать, якоря, боты) — стоит failsafe: через 5 с после load всё принудительно visible. Не удалять.
- **file:// не работает** — пути абсолютные (/style.css). QA только через http.server.
- **На боевом репо betaline-landing:** `08_audit_form.html` содержит утёкший bot-токен и деплоится статикой. При переезде v3 — исключить файл и отозвать токен через BotFather.
- **chat-ai.js читает `bot/betaline_kb.txt`** по жёсткому пути — файл обязан деплоиться (не добавлять bot/ целиком в .vercelignore).

## 10. Skills routing

- вёрстка/новые секции → `.agent/skills/frontend-design/SKILL.md`
- генерация графики (og, иллюстрации) → `.agent/skills/canvas-design/SKILL.md` + `mockups/design/generate-prod.py`
- ревью диффа → `/code-review`

## 11. Pointers

- **Координация агентов:** [`AGENT_ACTIVITY.md`](AGENT_ACTIVITY.md)
- **Инциденты:** [`docs/agents/incidents.md`](docs/agents/incidents.md)
- **Правки от партнёра Андрея:** [`docs/agents/ANDREY.md`](docs/agents/ANDREY.md)
- **Контент-канон:** `mockups/design/CONTENT.md` (устаревший бриф «Чертежа») + план v3 в PR #6
- **Vault page:** `obsidian-ramos/projects/betaline-ai-2/` — НЕ создана, TODO mac-агенту
