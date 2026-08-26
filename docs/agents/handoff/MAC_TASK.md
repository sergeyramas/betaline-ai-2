# Handoff для claude-mac: довести Betaline Landing v3 до людей

> **СТАТУС на 2026-08-26 — этот хендофф ОТРАБОТАН, не выполнять заново.**
> Задачи 1–3 закрыты 25.08 и перепроверены 26.08 (см. `AGENT_ACTIVITY.md` → Recently Completed).
> Прод: https://betaline-ai-2.vercel.app. Открыто ровно одно: секрет `VERCEL_TOKEN` для CI — только вручную Сергеем.
> Задача 4 (отзыв утёкшего bot-токена) — на Сергее, агентами не делается.
>
> Поправки к тексту ниже: ssh-хост — `hermes-vps` (не `hermes`); vault — `~/Documents/Jarvis/wiki/`
> (не `~/obsidian-ramos`); telethon-сессия называется `personal` (не `session`).

---

От: claude-web-fable5 (облачная сессия, 2026-08-25). Контекст проекта: `CLAUDE.md` и
`AGENT_ACTIVITY.md` в корне — прочитай их первыми, работай по регламенту claim/release.
Всё, что ниже, из облака недоступно (Vercel-auth, vault, hermes) — поэтому передаётся тебе.

Состояние: v3 полностью в `master` (страница + api с фиксами + workflow). Заблокировано
одно: деплой (нет Vercel-авторизации в облаке) и два побочных шага.

---

## Задача 1 — задеплоить на Vercel (главное)

Mac авторизован в Vercel (с него деплоится betaline-landing). Выполнить:

```bash
cd <клон sergeyramas/betaline-ai-2>   # если нет: git clone git@github.com:sergeyramas/betaline-ai-2.git
git checkout master && git pull
npx vercel deploy --prod --yes
```

При первом запуске CLI спросит про проект: **создать новый** (имя `betaline-ai-2`),
scope — личный, root `.` , build command пустой, output `.` — это статика без сборки.

Проверка (обязательно, DoD из CLAUDE.md §6):
```bash
curl -s https://<prod-url>/ | grep -o '<title>[^<]*</title>'   # ждём «BetaLine AI — агенты…»
curl -s -o /dev/null -w '%{http_code}\n' https://<prod-url>/assets/img/og-image.png  # 200
```
Открыть в браузере, глазами: hero-мокап amoCRM, оранжевая кнопка чата, формы открываются.

Затем, чтобы облачный CI деплоил сам при каждом мерже:
- vercel.com/account/tokens → Create Token →
- `gh secret set VERCEL_TOKEN --repo sergeyramas/betaline-ai-2` (или руками:
  GitHub → betaline-ai-2 → Settings → Secrets → Actions → `VERCEL_TOKEN`).
- Проверка: Actions → «Deploy to Vercel» → Run workflow → зелёный.

Примечание: serverless `api/*` на ЭТОМ проекте без env-переменных нерабочие — это ок,
фронт постит на боевой `https://betaline-ai.ru/api/lead` (API_BASE в main.js). Env сюда
переносить только при полном переезде домена. Cron close-stale будет падать — игнорировать
или удалить блок `crons` из vercel.json этого репо.

## Задача 2 — зарегистрировать проект в vault (obsidian-ramos)

По правилу RULES.md (регистрация — только Mac):
1. В `~/obsidian-ramos/index.md` → раздел Projects добавить строку `[[projects/betaline-ai-2/index]]`.
2. Создать `~/obsidian-ramos/projects/betaline-ai-2/index.md`:

```markdown
# betaline-ai-2 — Landing v3

Подпроект [[02_Projects/Betaline-AI-Operations]]. Конверсионный лендинг «продукт-герой»
(qwerty-каркас × pain-driven исследование landing-v2-v3) + serverless-обвязка лидов.

- Repo: sergeyramas/betaline-ai-2 (agent-context в CLAUDE.md)
- Prod: <vercel-url после Задачи 1> → цель: замена betaline-ai.ru
- Правки партнёра Андрея: docs/agents/ANDREY.md (ветки andrey/*, мерж только оператор)
- Деплой: push в master → GitHub Actions → Vercel (секрет VERCEL_TOKEN)
- Инциденты: docs/agents/incidents.md
```

3. Снять TODO `wiki-registration` в `AGENT_ACTIVITY.md` репо (перенести в Recently Completed).

## Задача 3 — пост в группу Betaline, тема «Сайты»

Адресат: группа `-1004397085324`, тема `9` (https://t.me/c/4397085324/9).
Штатный `tg_send.py` в темы не умеет (шлёт в General) — рядом лежит
`docs/agents/handoff/tg_send_topic.py` (темы через `reply_to`, `--list-topics`, `--files`).

```bash
scp docs/agents/handoff/tg_send_topic.py root@hermes:/root/tg-recon/
# текст: docs/agents/handoff/tg-message-sites.txt — ДОПИШИ в конец строку
#   «Живое превью: <vercel-url из Задачи 1>»
cat docs/agents/handoff/tg-message-sites.txt | ssh root@hermes \
  'cd /root/tg-recon && ./.venv/bin/python tg_send_topic.py --peer -1004397085324 --topic 9'
```
(или с картинками: `--files` + jpg из `mockups/screenshots/`; свежие скрины v3 сними сам:
`python3 mockups/design/shot.py index.html /tmp/v3.png 1440` через локальный http.server — см. CLAUDE.md §5.)

## Задача 4 — только для Сергея (передай ему, сам не делай)

⚠️ В боевом репо betaline-landing файл `08_audit_form.html` содержит **живой bot-токен**
и публично доступен на betaline-ai.ru. До переезда v3: BotFather → Revoke у этого бота,
новый токен → Vercel env боевого проекта + VPS бота, файл добавить в `.vercelignore`.

## По завершении

- `AGENT_ACTIVITY.md`: release своих записей с SHA/URL.
- Короткий отчёт Сергею: prod-URL, статус CI-секрета, отправлен ли пост в тему.
