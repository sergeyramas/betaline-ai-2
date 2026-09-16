# betaline-ai-2 — agent context

## 1. Identity

- **Что это:** сайт Betaline AI «AI-интегратор полного цикла» — одностраничник, собранный 1:1 из утверждённого партнёром макета `mockups/blueprint-v2/` (вариант 1, оранжевый «Чертёж»; выбор Андрея 26.08, решение оператора о сборке 07.09) + serverless-обвязка лидов. Прежняя версия v3 («продукт-герой», 11 секций) — в истории git до 07.09.
- **Зачем:** жить на поддоменах **custom.betaline-ai.ru** и **custom2.betaline-ai.ru**; принимать лиды в тот же Telegram/Sheets/CRM/почту, что и боевой сайт. 🔴 **Реклама (Директ) запущена 15.09 и ведёт на custom2** — любая правка сначала туда, потом на custom.
- **Статус:** active — **в `master` с 15.09 (PR #10)**, живёт на https://custom.betaline-ai.ru (схема в hero) и https://custom2.betaline-ai.ru (топокарта в hero), у каждого свой счётчик Метрики. Следующий шаг — реклама (Мастер кампаний на custom2 — 15.09).
- **Дедлайн / милейстоны:** DNS → счётчик → деплой на поддомен → реклама (договорённость с Андреем: первые числа сентября, просрочено).
- **Vault:** `~/Documents/Jarvis/wiki/projects/betaline-ai-2/index.md` — заведена 2026-08-25

## 2. External IDs & URLs

| Что | Где |
|---|---|
| GitHub repo | `sergeyramas/betaline-ai-2` |
| Production URL | будущий: `https://betaline-ai.ru` (сейчас там старый сайт из репо betaline-landing) |
| Prod-превью | `https://betaline-ai-2.vercel.app` — живой с 2026-08-25 |
| Поддомен | **`https://custom.betaline-ai.ru` — работает с 09.09** (A `custom` → 76.76.21.21 и TXT `_vercel` заведены через Beget API, домен verified, сертификат до 08.12.2026) |
| Поддомен-2 | **`https://custom2.betaline-ai.ru` — работает с 15.09**, тот же сайт, но hero-картинка — исходная топокарта макета вместо инлайн-SVG-схемы (единственное отличие). Отдельный Vercel-проект `betaline-ai-2-custom2` (`prj_6MnG6pIBY1SLHPTBKTIPpaOmnss2`), та же команда npz-avod. Свой счётчик Метрики **`112650916`** «Betaline AI — custom2.betaline-ai.ru» (заведён 15.09 в том же `gowindo-elama1`, те же 4 цели; генератор подменяет YM_ID сам). Генерируется скриптом `tools/build-custom2.py` из корневого `index.html` — не отдельная ветка, см. §5 |
| Vercel project | `betaline-ai-2` (`prj_s1I5SEpy9qq8WWj2Lmq8ToTzDfOf`), с 07.09 в команде **npz-avod** `team_N2rwwC7BNrzVq09nBDmle5EB` (старая `sergeyramas-projects` отключена за неуплату, 402) |
| Боевой API | `https://betaline-ai.ru/api/lead`, `/api/chat-ai` (CORS `*`; превью постит кросс-доменно) |
| External APIs | Telegram Bot API, Google Sheets, PocketBase CRM, Resend, OpenAI (см. `api/`) |
| Operator / клиент | Сергей — TG `@Sergeyramas`; партнёр-заказчик правок: Андрей — TG `@Andrei_Stanislavovich` (см. `docs/agents/ANDREY.md`) |
| DNS | Beget, аккаунт `fantroue`, зона `betaline-ai.ru`. **Есть API** (вкл. «Управление DNS»): `https://api.beget.com/api/<метод>?login=…&passwd=…&output_format=json`, креды у оператора. 🔴 `dns/changeRecords` ЗАМЕНЯЕТ весь набор записей FQDN — сначала `dns/getData`, и никогда не вызывать на апексе `betaline-ai.ru` (там MX beget + SPF: снесёшь почту). `dns/getData` на несуществующем поддомене отдаёт `METHOD_FAILED` — это норма, проверять надо через `dig @ns1.beget.com` |
| Яндекс.Директ | агентский аккаунт `gowindo.elama1` (eLama), клиентский логин `ulogin=e-16571744`. Образец — кампания `708929168` (betaline-ai.ru, остановлена). **Мастер кампаний на custom2 — `714447865`, черновик с 15.09**: Россия, макс. целевых действий, средняя CPA (фикс. недоступна — у нового счётчика нет истории), бюджет 10 000 ₽/нед, 4 цели счётчика 112650916 (доступ «Просмотр» выдан e-16571744), креативы `assets/img/ads/*-text.jpg` (`tools/ad-creatives.py`). Запущена оператором 15.09. **API: у `gowindo-elama1` программный доступ ОТКРЫТ** (не только песочница), OAuth-приложения в списке: «Нейро директолог», Директ Коммандер. Мониторинг и пороги — `docs/ads/MONITORING.md`. **API-скрипт `tools/direct-monitor.py`** (с 16.09, launchd `ru.betaline.direct-monitor` 09:30 ежедневно → tg-send оператору). OAuth-приложение «Нейро директолог» `client_id 33d228f2243c4c97b24b8f8ad9124ebc` (oauth.yandex.ru под gowindo-elama1, scopes direct:api + metrika:read), токен — `~/.config/betaline-ai-2/.env` (`YANDEX_DIRECT_TOKEN`), в git не кладём. 🔴 «Программный доступ: открыт» — это про аккаунт; у *приложения* — только **тестовый** доступ (песочница), боевой API отвечает error 58 «Незавершённая регистрация». **Заявка на полный доступ подана 16.09.2026** (статус «новая», Настройки API → Мои заявки) — до одобрения скрипт даёт только Метрику. Изменения стратегии/бюджета/статуса — только оператор |
| RamOS | проект **«Betaline»** (slug `betaline-ai-2`, id `55a40cfe-b7ee-465a-92ac-24ec293c91cd`) на ramos-ai.ru. Члены: Сергей — owner, **Андрей — editor**, **Дмитрий — viewer** (+ Олег, Грок — viewer с прежних задач). Агент проекта «Betaline-правки (Sonnet)» (`default_model: sonnet`, промпт v2 от 16.09 — под текущий CLAUDE.md: без партиалов, приоритет custom2, DoD §6). Контекст агента — `memory/index.md` (RamOS подаёт его в системный промпт). Клон `/srv/ramos/projects/betaline-ai-2` (RW-deploy-key с 2026-08-26, push `andrey/*` работает; ветку каталога двигает только сам RamOS — ручной merge запирает все чаты проекта) |
| Аналитика | Яндекс.Метрика **`112421910`** «Betaline AI — custom.betaline-ai.ru», заведён 09.09 в аккаунте `gowindo-elama1` — аккаунт под Директ, подтверждён оператором 15.09 (боевой счётчик живёт в другом аккаунте, это намеренно). Вебвизор включён. Цели: `audit_lead`, `chat_message`, `chat_lead`, `callback_chat` — ровно те, что стреляют на этом сайте. Для custom2 — отдельный `112650916` с теми же целями (см. Поддомен-2). Боевой `108480715` остаётся у betaline-ai.ru и не тронут |

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
├── ecosystem.js        # связка сайтов (полоска продуктов + кнопка «вернуться»). ИСТОЧНИК; копии лежат в betaline-voice-ai/ и betaline-landing (апекс) — после правки копировать туда и деплоить все три
├── api/                # серверлесс: lead.js (fan-out), chat-ai.js, close-stale.js, _lib/ — на поддомене НЕ используется, фронт ходит на боевой API
├── bot/betaline_kb.txt # база знаний chat-ai.js — путь менять НЕЛЬЗЯ (process.cwd()/bot/…)
├── assets/             # fonts/ (woff2-сабсеты), img/ (process-band.webp, og-image, favicon)
├── memory/index.md     # карта памяти для RamOS: подаётся в системный промпт агента (trust: internal)
├── mockups/blueprint-v2/  # ИСТОЧНИК сайта — утверждённый макет; остальное в mockups/ — архив
└── .github/workflows/deploy-vercel.yml  # прод-деплой по push в master (ждёт VERCEL_TOKEN)
```

**Не трогать без разрешения оператора:**
- `api/_lib/sheets.js`, схема колонок «Лиды» A–K — на неё завязаны отчёты
- Цены (0 ₽ аудит, от 150 000 / 600 000 / 700 000 / 800 000 / 1 000 000 ₽ — из макета), цифры hero-статистики (15+ / 4 / 40+ / 5) и кейсов — только оператор
- **Кейсы (переписаны 15.09, источники проверены):** Ташкент — «18 из 20» из `mpoto/pcmarket-ai-seller/docs/client/analiz-obrashcheniy-2026-07-31.html`, «11 из 19 вне графика» — снято с боевой операторской консоли `agata.46-8-225-223.sslip.io/admin` 11.09; Чебоксары — цены студий из `clients/Fundament21/smeta-rynok-fundament21.html` (с источниками), «было» — Wayback 2018 (подписано датой); салон красоты и eBay — дословно с боевого betaline-ai.ru. 🔴 Не сравнивать подписку 8 900 ₽/мес с Пульс Цен 73 500 ₽/год — оператор объяснил 11.09: Пульс Цен был только размещением, подписка — заказываемая работа, сайт остаётся клиенту при отказе. Скриншоты — `assets/img/cases/`
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
| мониторинг Директа | `python3 tools/direct-monitor.py --dry-run` (без `--dry-run` шлёт оператору). Копия для launchd — `~/.local/bin/betaline-direct-monitor.py`, после правки скрипта: `cp tools/direct-monitor.py ~/.local/bin/betaline-direct-monitor.py`. Лог: `~/Library/Logs/betaline-direct-monitor.log` |
| синхронизировать связку сайтов | после правки `ecosystem.js`: `cp ecosystem.js ~/Documents/betaline/betaline-voice-ai/ && cp ecosystem.js ~/Documents/betaline/worktrees/betaline-master/`, затем коммит+деплой в каждом репо (zvonok: `vercel deploy --prod --yes --scope npz-avod` из его каталога, CI мёртв; апекс: то же из worktree `betaline-master`, потом `git push origin HEAD:master`) |
| перелить custom → custom2 | `python3 tools/build-custom2.py && (cd dist-custom2 && vercel deploy --prod --yes --scope npz-avod)` — после каждого прод-деплоя custom предложить оператору перелить в custom2. 🔴 `dist-custom2/.vercel/project.json` обязан существовать (скрипт его сохраняет); без него deploy заводит дубль-проект `dist-custom2` |

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
- ❌ менять цены, тарифы, цифры кейсов, юрреквизиты (ИП/ИНН/ОГРНИП), телефон **+7 987 760-97-09** (мобильный Андрея; заменил 8 800 200-18-49 по его просьбе и «Ок» оператора в TG 15.09 — в шапке, контактах, футере, оферте, JSON-LD, main.js)
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

- **`.env` не был в `.gitignore` до 16.09** (CLAUDE.md утверждал обратное) — теперь `.env`/`.env.*` игнорируются; перед первым `.env` в любом клоне — `git check-ignore .env`.
- **Direct API: доступ у аккаунта ≠ доступ у приложения.** Один OAuth-токен работает в песочнице и на бою, но боевой хост требует одобренной заявки «полный доступ» на конкретный `client_id`. Метрика: scope `metrika:write` не включает чтение — нужен `metrika:read`, после смены scopes токен перевыпускать (`oauth.yandex.ru/authorize?response_type=token&client_id=…`).
- **Партиалов больше нет (упразднены 07.09).** `index.html`/`style.css`/`main.js` — единственные файлы, правятся напрямую. `mockups/blueprint-v2/` — источник, из которого сайт собран; после сборки правда = сайт, макет не синхронизируется.
- **`API_BASE` в main.js — точное совпадение хоста, не `endsWith`.** `custom.betaline-ai.ru` тоже оканчивается на `betaline-ai.ru`, а своих env у проекта нет — с `endsWith` формы постили бы в пустой локальный `/api/lead` и лиды терялись молча. Same-origin только на апексе.
- **Поле «Email или телефон» уходит в `phone`.** Боевой `/api/lead` требует непустой `phone` и других контактных полей не знает; email придёт в Telegram как `📱 user@mail.ru` и в колонку C «Контакт». Отдельное поле — только с правкой `api/` на боевом (guardrail).
- **Метрика вынесена в `window.YM_ID` в `<head>`** — `main.js` читает его и молчит при 0. Менять счётчик — в двух местах: `window.YM_ID` и `<noscript>`-пиксель. `goal()` не стреляет при `YM_ID = 0`, так что превью-деплои статистику не пачкают.
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
- **`_vercel.betaline-ai.ru` TXT держит ДВЕ записи разом** — по одной на каждый поддомен-проект (custom и custom2). `dns/changeRecords` заменяет набор целиком, поэтому при добавлении/смене домена читать текущие через `dig +short @ns1.beget.com _vercel.betaline-ai.ru TXT` и переписывать обе строки, иначе верификация другого поддомена слетает.

- **Связка сайтов `ecosystem.js` (с 16.09, v1.1.0).** Полоска 36px `position:fixed`, закреплена и не прячется (решение оператора 16.09) + `body{padding-top:var(--eco-h)!important}`; fixed-шапка сайта обязана иметь `top:var(--eco-h,0)` (у custom — `.nav` и `.m-menu`, `scroll-padding-top` 92→128). Резерв 36px остаётся всегда, полоска прячется только визуально (иначе CLS). Кнопка «назад» показывается только по `?from=custom|custom2` (allowlist, сохраняется в sessionStorage) и только на `data-site="voice|main"`; её позицию сайт задаёт переменными `--eco-back-top` (десктоп, под шапкой) и `--eco-back-bottom` (мобайл, выше своих sticky-элементов). Инлайн-`<style>` скрипта вставляется последним и перебивает CSS сайта — переопределять только через эти переменные.
- **Апекс betaline-ai.ru = ветка `master` репо `sergeyramas/betaline-landing`** (`~/Documents/betaline/Betaline NEW V1`, worktree `~/Documents/betaline/worktrees/betaline-master`), `index.html` закоммичен готовым (собирается локально `build_full.py` из партиалов — правки дублировать в партиал). Vercel-проект `tildastorybrandblocks` (`prj_koV0LBViET4ikiBEYDQQdx4V0w9P`) в **npz-avod**. 🔴 Главный каталог репо залинкован на старый проект в отключённой команде, а `project.json` с чужим `orgId` Vercel молча игнорирует и **заводит дубль по имени каталога** (16.09 так появился и был удалён `betaline-master`). Перед деплоем: `cat .vercel/project.json` — `orgId` обязан быть `team_N2rwwC7BNrzVq09nBDmle5EB`.
- **CI zvonok (`betaline-voice-ai`, «Deploy to Vercel») мёртв с июля** — `VERCEL_TOKEN` отклонён (токен старой команды). Пока секрет не обновлён, деплой — руками `vercel deploy --prod --yes --scope npz-avod` из каталога репо (проект `betaline-voice-ai`, `prj_IHpjSserMKKNoahuvqUfaXoAlIu8`, перелинкован 16.09).

## 10. Skills routing

- вёрстка/новые секции → `.agent/skills/frontend-design/SKILL.md`; проверка на «ИИ-шаблонность» → скилл `impeccable` (поставлен глобально 07.09, `/impeccable`)
- генерация графики (og, иллюстрации) → `.agent/skills/canvas-design/SKILL.md` + `mockups/design/generate-prod.py`
- ревью диффа → `/code-review`

## 11. Pointers

- **Досье сайта (ссылки, структура, макеты, gap-анализы — всё в одном месте):** [`docs/SITE-DOSSIER.md`](docs/SITE-DOSSIER.md)
- **Карта памяти проекта (её читает агент RamOS в каждом задании):** [`memory/index.md`](memory/index.md)
- **Координация агентов:** [`AGENT_ACTIVITY.md`](AGENT_ACTIVITY.md)
- **Инциденты:** [`docs/agents/incidents.md`](docs/agents/incidents.md)
- **Правки от партнёра Андрея:** [`docs/agents/ANDREY.md`](docs/agents/ANDREY.md)
- **Контент-канон:** `mockups/design/CONTENT.md` (устаревший бриф «Чертежа») + план v3 в PR #6
- **Vault page:** `~/Documents/Jarvis/wiki/projects/betaline-ai-2/index.md` (vault = Jarvis, не obsidian-ramos)
