# betaline-ai-2 — agent context

## 1. Identity

- **Что это:** сайт Betaline AI «AI-интегратор полного цикла» — одностраничник, собранный 1:1 из утверждённого партнёром макета `mockups/blueprint-v2/` (вариант 1, оранжевый «Чертёж»; выбор Андрея 26.08, решение оператора о сборке 07.09) + serverless-обвязка лидов. Прежняя версия v3 («продукт-герой», 11 секций) — в истории git до 07.09.
- **Зачем:** жить на поддомене **custom.betaline-ai.ru**; принимать лиды в тот же Telegram/Sheets/CRM/почту, что и боевой сайт.
- **Статус:** active — собран, ждёт DNS (A `custom` → 76.76.21.21 + TXT `_vercel` в Beget) и ID нового счётчика Метрики.
- **Дедлайн / милейстоны:** DNS → счётчик → деплой на поддомен → реклама (договорённость с Андреем: первые числа сентября, просрочено).
- **Vault:** `~/Documents/Jarvis/wiki/projects/betaline-ai-2/index.md` — заведена 2026-08-25

## 2. External IDs & URLs

| Что | Где |
|---|---|
| GitHub repo | `sergeyramas/betaline-ai-2` |
| Production URL | будущий: `https://betaline-ai.ru` (сейчас там старый сайт из репо betaline-landing) |
| Prod-превью | `https://betaline-ai-2.vercel.app` — живой с 2026-08-25 |
| Поддомен | `https://custom.betaline-ai.ru` — прицеплен к проекту 07.09, ждёт DNS в Beget (A `custom` → 76.76.21.21, TXT `_vercel` — значение в Vercel → Domains) |
| Vercel project | `betaline-ai-2` (`prj_s1I5SEpy9qq8WWj2Lmq8ToTzDfOf`), с 07.09 в команде **npz-avod** `team_N2rwwC7BNrzVq09nBDmle5EB` (старая `sergeyramas-projects` отключена за неуплату, 402) |
| Боевой API | `https://betaline-ai.ru/api/lead`, `/api/chat-ai` (CORS `*`; превью постит кросс-доменно) |
| External APIs | Telegram Bot API, Google Sheets, PocketBase CRM, Resend, OpenAI (см. `api/`) |
| Operator / клиент | Сергей — TG `@Sergeyramas`; партнёр-заказчик правок: Андрей — TG `@Andrei_Stanislavovich` (см. `docs/agents/ANDREY.md`) |
| RamOS | проект `betaline-ai-2` (id `55a40cfe-b7ee-465a-92ac-24ec293c91cd`) на ramos-ai.ru; Андрей — editor; агент «Betaline-правки (Sonnet)»; клон `/srv/ramos/projects/betaline-ai-2` (RW-deploy-key с 2026-08-26, push `andrey/*` работает) |
| Аналитика | Яндекс.Метрика: под поддомен решено завести **отдельный** счётчик (07.09), ID ещё нет — в `index.html` стоит `window.YM_ID = 0` и счётчик не грузится. Боевой `108480715` остаётся у betaline-ai.ru |

## 3. Stack

- **Язык / runtime:** статичный HTML/CSS/vanilla JS; serverless — Node 22, CommonJS (`api/*.js`)
- **Фреймворк:** нет; zero-config Vercel static + `/api` functions
- **Package manager:** npm (`package.json` только для serverless: `google-auth-library`, `openai`)
- **БД / хранилище:** Google Sheets («Лиды», «Топики»), PocketBase CRM, localStorage (чат-виджет)
- **Шрифты:** Golos Text 400–700 + IBM Plex Mono 400/500, self-hosted woff2-сабсеты (cyrillic+latin+пунктуация+₽) в `assets/fonts/`; исходные TTF — `mockups/blueprint-v2/assets/fonts/`

## 4. Layout

```
betaline-ai-2/
├── index.html          # ЕДИНСТВЕННЫЙ html: 7 секций макета + модалки + чат-виджет (партиалов нет с 07.09)
├── style.css           # стили макета как есть + блок «ОБВЯЗКА» в конце (формы, модалки, чат)
├── main.js             # reveal, бургер, форма → /api/lead, модалки, чат-виджет, цели Метрики
├── api/                # серверлесс: lead.js (fan-out), chat-ai.js, close-stale.js, _lib/ — на поддомене НЕ используется, фронт ходит на боевой API
├── bot/betaline_kb.txt # база знаний chat-ai.js — путь менять НЕЛЬЗЯ (process.cwd()/bot/…)
├── assets/             # fonts/ (woff2-сабсеты), img/ (process-band.webp, og-image, favicon)
├── mockups/blueprint-v2/  # ИСТОЧНИК сайта — утверждённый макет; остальное в mockups/ — архив
└── .github/workflows/deploy-vercel.yml  # прод-деплой по push в master (ждёт VERCEL_TOKEN)
```

**Не трогать без разрешения оператора:**
- `api/_lib/sheets.js`, схема колонок «Лиды» A–K — на неё завязаны отчёты
- Цены (0 ₽ аудит, от 150 000 / 600 000 / 700 000 / 800 000 / 1 000 000 ₽ — из макета), цифры hero-статистики (15+ / 4 / 40+ / 5) и кейсов — только оператор
- id счётчика Метрики и имена целей — не переименовывать, рвётся история

## 5. Commands

| Задача | Команда |
|---|---|
| локальный просмотр | `python3 -m http.server 8077` (пути в html абсолютные — file:// не работает) |
| скриншот QA | `python3 mockups/design/shot.py <file.html> <out.png> [width]` |
| js-синтаксис | `node --check main.js && node --check api/lead.js` |
| deploy prod | `vercel deploy --prod --yes` с Mac. CI (push в master) ждёт секрет `VERCEL_TOKEN` — см. gotcha про токен |
| тест лид-пайплайна | `curl -X POST https://betaline-ai.ru/api/lead -H 'Content-Type: application/json' -d '{"source":"audit","name":"ТЕСТ — не звонить","phone":"70000000000"}'` |
| линтер дизайна | `npx impeccable@latest detect style.css index.html` — разово; кремовый фон и трекинг моно-подписей — дизайн макета, не чинить |

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
  ⚠️ Утверждённый макет содержит «RAG-боты» (услуга 01) — перенесено 1:1, конфликт правила и макета решает оператор.
- **Цифры кейсов и hero-статистики — из макета, без легенды «кейс · период · метод».** Исследование считало такие цифры токсичными; на сайте они есть, потому что так утверждён макет. Менять — только оператор.
- **Цели Метрики (те же имена, что на боевом):** audit_lead (форма), chat_message, chat_lead, callback_chat (чат). Остальные из v3 (quiz_lead, callback_lead, pricing_lead, diag_bot_click, pains_expand) на этом сайте не стреляют — соответствующих форм нет.
- **API_BASE в main.js:** превью-домены постят на боевой `/api/lead`; при переезде на betaline-ai.ru работает same-origin. Не хардкодить URL в обход.
- **Согласие ПДн** со ссылкой на модалку политики — у каждой формы.

## 9. Known gotchas

- **Партиалов больше нет (упразднены 07.09).** `index.html`/`style.css`/`main.js` — единственные файлы, правятся напрямую. `mockups/blueprint-v2/` — источник, из которого сайт собран; после сборки правда = сайт, макет не синхронизируется.
- **`API_BASE` в main.js — точное совпадение хоста, не `endsWith`.** `custom.betaline-ai.ru` тоже оканчивается на `betaline-ai.ru`, а своих env у проекта нет — с `endsWith` формы постили бы в пустой локальный `/api/lead` и лиды терялись молча. Same-origin только на апексе.
- **Поле «Email или телефон» уходит в `phone`.** Боевой `/api/lead` требует непустой `phone` и других контактных полей не знает; email придёт в Telegram как `📱 user@mail.ru` и в колонку C «Контакт». Отдельное поле — только с правкой `api/` на боевом (guardrail).
- **Метрика: `window.YM_ID = 0` в `<head>`** — счётчик не грузится, пока оператор не заведёт отдельный ID под поддомен. Вписать число в `window.YM_ID` и раскомментировать `<noscript>` (заменить `__YM_ID__`).
- **Шрифты — сабсеты.** Диапазоны: Latin-1, кириллица, U+2000–206F, ₽, №, стрелки U+2190–21FF, U+2700–27BF. Символа вне диапазонов (или `✕` — его нет в самих шрифтах, используй `&times;`) в шрифте не будет — пересобрать `pyftsubset` из TTF в `mockups/blueprint-v2/assets/fonts/`.
- **Картинки ниже первого экрана — `loading="lazy"`.** В скриншот-QA перед full-page снимком прокрутить страницу до низа, иначе Playwright снимет пустые рамки (это не баг сайта).
- **Чертежи hero и кейсов — инлайн-SVG, не картинки** (решение оператора 08.09; декоративные топокарты `hero-diagram`/`field-study` удалены — это был шум с фиксированным seed, ничего не показывавший). У каждой фигуры ДВЕ версии в разметке: `.fig-d` (viewBox 1600×900) и `.fig-m` (вертикальная, ~520 шириной), переключаются CSS на 720px. Правишь схему — правь обе. Стили — блок «чертежи» в `style.css`, класс `.dwg` на `<figure>`. id внутри SVG обязаны быть уникальными между фигурами (`grid1`/`grid2`, `ar1`/`ar2`, `mgrid*`, `mar*`), иначе `url(#…)` схлопнется.
- **Workflow падал с 0 джобов** — было двоеточие в неквотированном echo YAML. Симптом «failure, jobs: []» = YAML parse error, чинить файл, не секреты. (fix: bf3a253→…)
- **Reveal:** как в макете — каскад по `setTimeout` после `load` (не по скроллу) + failsafe через 5 с (всё `.rv` принудительно `.on`). Не удалять.
- **file:// не работает** — пути абсолютные (/style.css). QA только через http.server.
- **На боевом репо betaline-landing:** `08_audit_form.html` содержит утёкший bot-токен и деплоится статикой. При переезде v3 — исключить файл и отозвать токен через BotFather.
- **`VERCEL_TOKEN` нельзя добыть с Mac автоматически.** Токен CLI (`com.vercel.cli/auth.json`) короткоживущий, и `POST /v3/user/tokens` c ним отдаёт `forbidden` — нужен токен с vercel.com/account/tokens руками. Обходной путь «нативная Git-интеграция вместо секрета» тоже закрыт: `vercel git connect` падает, GitHub App Vercel стоит в режиме «selected repositories» и этого репо не видит. До появления секрета workflow не падает, а пишет `::warning::` и выходит с 0 (2026-08-29: падение на каждый push слало письма «Run failed» на почту). Деплой прода до этого — только с Мака: `vercel deploy --prod --yes`.
- **`.vercel/` в .gitignore → в CI нет project-линка.** Поэтому в `deploy-vercel.yml` жёстко заданы
  `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` (не секреты, см. §2). Без них `vercel deploy --yes` линкуется по имени каталога
  и может завести ДУБЛЬ проекта вместо `betaline-ai-2`. Не убирать. (fix: 563c690; ORG_ID сменён на npz-avod 07.09)
- **Pro-команда npz-avod блокирует деплой, если автор HEAD-коммита не член команды** (readyState BLOCKED). Коммитить от `fantroms@gmail.com`. См. `wiki/howto/vercel-pro-team-migration-blocked-deploys.md`.
- **Cron `/api/close-stale` в vercel.json на поддомене будет падать 500 «Bot not configured»** — env нет, это ожидаемо и безвредно; нужен только при переезде на апекс.
- **chat-ai.js читает `bot/betaline_kb.txt`** по жёсткому пути — файл обязан деплоиться (не добавлять bot/ целиком в .vercelignore).

## 10. Skills routing

- вёрстка/новые секции → `.agent/skills/frontend-design/SKILL.md`; проверка на «ИИ-шаблонность» → скилл `impeccable` (поставлен глобально 07.09, `/impeccable`)
- генерация графики (og, иллюстрации) → `.agent/skills/canvas-design/SKILL.md` + `mockups/design/generate-prod.py`
- ревью диффа → `/code-review`

## 11. Pointers

- **Досье сайта (ссылки, структура, макеты, gap-анализы — всё в одном месте):** [`docs/SITE-DOSSIER.md`](docs/SITE-DOSSIER.md)
- **Координация агентов:** [`AGENT_ACTIVITY.md`](AGENT_ACTIVITY.md)
- **Инциденты:** [`docs/agents/incidents.md`](docs/agents/incidents.md)
- **Правки от партнёра Андрея:** [`docs/agents/ANDREY.md`](docs/agents/ANDREY.md)
- **Контент-канон:** `mockups/design/CONTENT.md` (устаревший бриф «Чертежа») + план v3 в PR #6
- **Vault page:** `~/Documents/Jarvis/wiki/projects/betaline-ai-2/index.md` (vault = Jarvis, не obsidian-ramos)
