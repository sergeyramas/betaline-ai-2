---
title: "Memory v3 — единая память парка: решение и план"
summary: "Одна память для Mac, всех VPS, RamOS и облачных сессий: jarvis-wiki как единственный store, двусторонняя синхронизация с любого активного хоста через GitHub-хаб, memory-MCP как единый путь записи/чтения, ежедневный архив в Google Drive, доктор с алертом в Telegram."
type: decision
status: proposed — ждёт ревью Codex и «да» оператора
created: 2026-09-22
updated: 2026-09-22
author: claude-web-fable5 (облачная сессия betaline-ai-2)
related:
  - "[[projects/karpathy-vault/2026-05-01-memory-architecture-design]]"
  - "[[projects/karpathy-vault/MEMORY]]"
  - "[[journal/2026-05-11-handoff-agent-coordination-system]]"
  - "[[projects/jarvis-assistant/index]]"
  - "[[journal/2026-09-22-codex-review-brief-memory-v3]]"
tags: [meta, memory, architecture, decision, fleet]
---

# Memory v3 — единая память парка

## 1. Диагноз (аудит 22.09.2026)

Спека v2 (01.05) констатировала «три параллельные системы памяти без связности». К сентябрю их шесть,
и три из них создавались как «единая»:

| Канал | Пишет | Читает | Состояние 22.09 |
|---|---|---|---|
| jarvis-wiki (494 стр.) | Mac руками + `[auto] синк`; RamOS — 2 коммита за всё время | Mac-агенты, Obsidian | последний коммит 05.09; автосинк «стоял с 09.08»; VPS-партиция с 04.07; страница betaline-ai-2 описывает сайт, которого нет с 07.09 |
| agent-fleet ledger (18 002 строки) | хук SessionStart Mac/VPS | никто | 86 % START без DONE, 56 % проект `unknown`, тема = id сессии |
| проектный слой (CLAUDE.md, AGENT_ACTIVITY, incidents) | агенты в репо | все, кто открыл репо | лучший контент в системе; CLAUDE.md разрастается в досье, потому что это единственный файл с гарантированным чтением |
| RamOS memory (memory/index.md, снапшоты промптов) | оператор + RamOS | агенты RamOS | 03.09 агент считал сайт «Landing v3 с тарифами 45/90/145» |
| Claude auto-memory | Claude на каждой машине | та же машина | не синхронизируется |
| memory-compiler (`~/.claude-memory-compiler`) | хуки Mac, 913 запусков за лето | ? | в мае flush падал молча; статус неизвестен |
| jarvis-assistant (base-vps) | rsync 6 002 сессий → дайджест Haiku | дашборд, бот | самая полная память событий, но в vault не попадает |
| облачные сессии | — | только git проекта | вне всего |

Корневые причины: нет единого пути записи (шесть мест, хуки деградируют молча); нет пути чтения
(ничто не подаёт знание в контекст при старте на VPS/облаке/RamOS); vault физически привязан к Mac
(iCloud-путь, `cd $HOME/Documents/Jarvis` в хуках); смешаны типы памяти (события, факты, правила,
состояние — в одинаковых структурах); знание оседает там, где его читают, а не где должно лежать.

## 2. Решение

**Не строить седьмую систему.** Свести к одной с тремя обязательными свойствами:

1. **Один store — `jarvis-wiki`** (уже есть, контракт LLM-Wiki, 33 проекта). GitHub — хаб.
2. **Один путь записи и чтения — `memory` MCP** на hermes, одинаковый на Mac, VPS, RamOS и в облаке.
   Хуки становятся тонкими вызовами, а не четырьмя скриптами на четырёх машинах.
3. **Синхронизация с любого активного хоста** через GitHub-хаб демоном + хуками, без ручных шагов;
   **ежедневный архив в Google Drive** и **доктор**, который сообщает в Telegram, когда что-то молчит.

Ключевой инженерный трюк, снимающий конфликты: **у каждого хоста свой каталог для того, что пишет только
он** (`journal/events/<host>/`, `fleet/heartbeat/<host>.md`); общие страницы правит либо человек на Mac,
либо memory-MCP (один писатель на сервере). Merge-конфликт возможен только на странице, которую
одновременно правили человек и MCP, — и он обрабатывается автоматически (см. §4).

Что сохраняем как есть: структуру и контракт vault, паттерн «карта памяти, а не память» (`memory/index.md`),
шаблон CLAUDE.md на 11 секций, длинные DONE-разборы в проектных AGENT_ACTIVITY, jarvis-assistant как
сборщик сырья, скрипты Pinecone.

## 3. Архитектура

```
                    GitHub: sergeyramas/jarvis-wiki  (хаб, первая копия-архив)
                       ▲  pull/push 5 мин + хуки           ▲
   Mac ~/Jarvis  ──────┘   (Obsidian смотрит сюда)         │
   base-vps /root/jarvis ──┘                               │
   hermes   /root/jarvis ──┘── memory MCP (HTTP) ──────────┤   ← Mac, VPS, RamOS, облако
   pe12     /root/jarvis ──┘   recall/remember/claim       │      подключают один и тот же сервер
   RamOS    /srv/ramos/jarvis (pull-only)                  │
   облако   add_repo при старте сессии (pull-only) ────────┘
                       │
      hermes cron 03:00: git bundle + tar → rclone → Google Drive «Jarvis-Memory-Backups»
      hermes cron */60:  doctor → @ramassist → Сергею
```

### 3.1. Раскладка в vault (добавляется к существующей)

```
wiki/fleet/HOSTS.md                 карта машин: что где живёт, пути клонов, кто хаб (переезжает из RULES.md)
wiki/fleet/RULES.md                 правила координации (переезжает из agent-fleet; там остаются только скрипты и шаблоны)
wiki/fleet/projects.json            cwd-паттерны → slug проекта (спека v2 §3.2), общий для всех хостов
wiki/fleet/heartbeat/<host>.md      «я синхронизировался в HH:MM» — пишет только этот хост
wiki/decisions/YYYY-MM-DD-<slug>.md решения оператора, один файл = одно решение, append-only
wiki/journal/events/<host>/YYYY-MM-DD-<slug>-<HHMM>.md   события (замена ledger-строк), пишет только хост
wiki/projects/<slug>/index.md       карта проекта + раздел «Состояние» (обновляет jarvis-assistant через MCP)
wiki/projects/<slug>/facts.md       короткие факты с источником и датой; компактируется раз в неделю
wiki/projects/<slug>/claims.md      захваты файлов с TTL (пишет только memory-MCP)
```

Типы памяти разделены физически: событие ≠ факт ≠ решение ≠ состояние. Ledger `agent-fleet/AGENT_ACTIVITY.md`
замораживается как архив, новые события — только файлами.

### 3.2. Синхронизация (то, что «происходит с любого активного хоста»)

Один скрипт `jarvis-sync` (bash, ~40 строк) на всех хостах, три режима:

- `jarvis-sync pull` — `git pull --rebase --autostash`; вызывается хуком **SessionStart** любого агента
  (Claude Code, Codex через AGENTS.md, RamOS pre-flight).
- `jarvis-sync push` — `git add -A && git commit -m "[auto] <host> <UTC>" && pull --rebase && push`,
  затем обновляет `fleet/heartbeat/<host>.md`; вызывается хуком **Stop/SessionEnd** и таймером
  (launchd `StartInterval 300` на Mac, `systemd` timer `OnUnitActiveSec=5min` на VPS).
- `jarvis-sync doctor` — локальная самопроверка (см. §5).

Правила, которые делают это безопасным:
- клон на Mac — **вне iCloud** (`~/Jarvis`), Obsidian открывает его как папку; iCloud и git вместе дают
  «файл-конфликт (2)» и разъезд — это одна из причин, почему автосинк вставал. iPhone — чтение через
  Working Copy или Obsidian Sync поверх той же папки, не через iCloud Drive.
- при конфликте rebase скрипт не останавливается: локальную версию файла сохраняет как
  `<file>.conflict-<host>.md`, берёт версию хаба, продолжает, и **пишет об этом в Telegram** через `tg-send`.
  Конфликт возможен только на общих страницах; событийные каталоги хостов не пересекаются никогда.
- хуки запускаются со stripped PATH и без TCC-доступа к `~/Documents` (грабля из MEMORY.md компилятора) —
  поэтому клон в `~/Jarvis`, а боевые копии скриптов в `~/.local/bin/`.

### 3.3. memory MCP (единый путь записи и чтения)

Сервис на hermes (`/root/jarvis-memory/`, Python `mcp` SDK, транспорт streamable-HTTP за nginx с TLS,
Bearer-токен), работает поверх собственного клона `/root/jarvis` + SQLite-индекса (факты, claims, полнотекст).
Никакой новой БД-службы: SQLite внутри процесса.

| Инструмент | Что делает |
|---|---|
| `recall(query, project?, k=8)` | ripgrep по vault + SQLite FTS; при ≥1000 страниц — `pinecone_query.py` |
| `remember(type, project, text, source)` | `type ∈ {event, fact, decision, incident, state}` → кладёт md в нужный каталог, коммитит, пушит |
| `context(project)` | готовый срез для SessionStart: index проекта (≤120 строк) + 5 решений + активные claims + факты за 7 дней |
| `claim(project, paths[], ttl=2h)` / `release(...)` | захват файлов с автоистечением — замена ручного «Active» |
| `status()` | здоровье: возраст heartbeat каждого хоста, очередь, последний push |

Подключение везде одинаковое: `claude mcp add --transport http memory https://memory.<hermes>/mcp
--header "Authorization: Bearer $JARVIS_MEMORY_TOKEN"`; в RamOS — как mcp-сервер агента; в облачной сессии —
в конфигурации Claude Code Remote (там уже подключены Gmail/Drive/GitHub, свой сервер подключается так же).

**Деградация, если hermes лежит:** хосты продолжают работать на локальном git-слое (pull/push напрямую в
GitHub), `remember` становится локальным файлом в `journal/events/<host>/`, а MCP при подъёме ничего не теряет,
потому что источник правды — git, а не сервис.

### 3.4. Путь чтения

SessionStart на каждом хосте (и RamOS pre-flight, и облако) вызывает `context(slug)`; slug — из cwd по
`fleet/projects.json` (это и чинит `unknown`). В контекст попадает ≤ ~4k токенов: карта проекта, решения,
claims, свежие факты. Ничего «всего vault сразу» — изоляция проектов из контракта LLM-Wiki сохраняется.
`memory/index.md` в RamOS больше не ведётся руками — генерируется из `wiki/projects/<slug>/index.md`;
снапшоты промптов чатов инвалидируются при изменении CLAUDE.md проекта.

## 4. Архив в Google Drive (и не только)

Три уровня, потому что «git на GitHub» — это не бэкап от `rm -rf` в vault, а только от потери машины:

1. **GitHub** — история и первая копия (есть).
2. **Google Drive — ежедневно, hermes cron 03:00 UTC** (`/root/jarvis-memory/backup.sh`):
   `git bundle create jarvis-YYYY-MM-DD.bundle --all` (полная история одним файлом) + `tar czf wiki-YYYY-MM-DD.tgz wiki raw`
   → `rclone copy … gdrive:Jarvis-Memory-Backups/daily/`. Ретенция: daily 30 дней, weekly (воскресенья) 26 недель,
   monthly (1-е число) — бессрочно; чистит `rclone delete --min-age`. rclone-remote настраивается один раз
   на Mac (`rclone config`, OAuth в браузере), `rclone.conf` копируется на hermes в `~/.config/rclone/` с правами 600.
   Drive-папка — **отдельный аккаунт или отдельная папка без общего доступа**; токен rclone = доступ ко всему Drive,
   поэтому лучше scope `drive.file` (rclone это умеет: `scope = drive.file`).
3. **pe12 offsite** — тот же bundle добавляется в существующий `offsite_backup.sh` (крон `45 0`).

**Ежемесячный тест восстановления** (без него архив не считается): `git clone jarvis-YYYY-MM-DD.bundle /tmp/restore
&& test -f /tmp/restore/wiki/index.md` — результат в Telegram. Архив, который ни разу не разворачивали, — не архив.

## 5. Доктор (чтобы не повторить смерть v2)

v2 умерла молча: flush падал, автосинк стоял месяц, ledger писал `unknown` — и никто не узнал.
`jarvis-memory doctor` на hermes раз в час проверяет и **пишет Сергею через @ramassist только при проблеме**:

- возраст `fleet/heartbeat/<host>.md` > 24 ч для хоста, у которого за сутки были сессии (по событиям) → «хост X не синхронизируется»;
- последний коммит в GitHub старше 48 ч при наличии событий → «пуши не доходят»;
- доля событий без slug за сутки > 10 % → «projects.json не покрывает cwd …»;
- MCP не отвечает / бэкап за ночь не появился в Drive / тест восстановления не прошёл.

Плюс `gitleaks` в pre-commit на всех клонах — 05.09 в vault уже удаляли учётные данные ATI из карточки.

## 6. Что делать с существующими системами

| Система | Решение |
|---|---|
| agent-fleet ledger | заморозить файл как архив; хук переписать на `remember(event)`; репо оставить за скриптами/шаблонами |
| RULES.md / знание об эвакуации 25.07 | переезжает в `wiki/fleet/` — это память, не правила |
| memory-compiler | если flush мёртв — вывести из хуков (его `daily/<slug>` полностью покрывается `journal/events`); если жив — его вывод направить в `remember(fact)`. **Решает оператор после ответа на вопрос §8** |
| Claude auto-memory (на каждой машине) | оставить только личные предпочтения; первая строка `MEMORY.md`: «источник правды — ~/Jarvis, факты туда» |
| jarvis-assistant | дайджест сессий дополнительно пишет `remember(type=state)` в `projects/<slug>/index.md#Состояние` — замыкает петлю, страницы перестают устаревать |
| RamOS memory/index.md | генерируется из vault, руками не ведётся |
| облачные сессии | `add_repo jarvis-wiki` при старте (проверено: клон 494 стр. за минуту) + memory MCP |

## 7. План внедрения

| Шаг | Кто | Оценка | Definition of Done |
|---|---|---|---|
| 1. Vault вне iCloud + `jarvis-sync` на Mac + `fleet/projects.json` + перенос RULES/HOSTS + заморозка ledger | claude-mac | 2–3 ч | Obsidian открывает `~/Jarvis`; таймер пушит; heartbeat/mac.md обновляется; страница betaline-ai-2 в vault соответствует реальности |
| 2. `jarvis-sync` + хуки на base-vps, hermes, pe12; RamOS pull-only | claude-vps | 1 ч на хост | heartbeat каждого хоста < 10 мин после сессии; конфликт-тест (правка одной страницы с двух хостов) даёт `.conflict-*` и сообщение в TG |
| 3. memory MCP на hermes + подключение Mac/VPS/RamOS/облако | claude-vps (hermes) | полдня | `remember(fact)` с Mac виден в `recall` из облака ≤ 5 мин; `context(betaline-ai-2)` ≤ 4k токенов |
| 4. Архив в Drive + pe12 + доктор | claude-vps (hermes) | 1–2 ч | bundle в Drive за две ночи подряд; тест восстановления прошёл; доктор прислал тестовый алерт |
| 5. Петля jarvis-assistant → vault; RamOS index из vault; компакция facts раз в неделю | claude-mac | 1–2 ч | «Состояние» трёх проектов обновилось само после сессий |

Порядок важен: шаг 1 останавливает шум и чинит Mac-привязку, без него остальное копирует старые ошибки.
Только git-слой (шаги 1–2) уже даёт ~80 % пользы; MCP и доктор — то, что не даст системе умереть молча.

## 8. Открытые вопросы оператору

1. `.claude-memory-compiler` — жив ли `flush.py` и куда он сейчас пишет? (913 запусков за лето.)
2. Vault на Mac всё ещё физически в iCloud-пути? Согласен ли перенести в `~/Jarvis` (iPhone — через Working Copy/Obsidian Sync)?
3. Смотрит ли кто-то дашборд jarvis-assistant? Если нет — его дайджест направляем в vault, дашборд оставляем как есть.
4. Google Drive: отдельный аккаунт для бэкапов или папка в основном (`fantroms@`)? Рекомендация — scope `drive.file`, отдельная папка.
5. «Кодекс Astra» из задания 22.09 — что это? В vault, репо, Drive и почте не найдено (только AstraMine 2018).

## 9. Ревью

Перед стартом — адверсариальное ревью Codex по брифу [[journal/2026-09-22-codex-review-brief-memory-v3]];
результат — `wiki/journal/2026-09-22-codex-memory-v3-review.md`. Правки в этот документ — по итогам ревью,
решение о старте — оператор.
