# Handoff для claude-mac: единая память парка (Memory v3) — перепроверить, прогнать Codex, свести

От: claude-web-fable5 (облачная сессия betaline-ai-2), 2026-09-22.
Задача оператора: «нужна единая система памяти на Маке и на всех VPS: синхронизация с того хоста, где идёт
работа, постоянная архивация общей памяти (Google Drive), плюс аналитика/ревью через Codex».

Из облака сделан аудит и план; **не сделано то, что требует Mac/VPS/RamOS** (см. §4). Твоя работа —
перепроверить аудит там, куда у меня не было доступа, прогнать Codex-ревью, свести и доложить Сергею.
Старт внедрения — только после его «да».

---

## 1. Что уже есть (прочитай первым, в этом порядке)

Канон лежит в vault, ветка `claude/memory-v3-plan` репо `sergeyramas/jarvis-wiki`, PR #3 (черновик):

1. `wiki/journal/2026-09-22-memory-v3-decision.md` — аудит + решение + план в 5 шагов + открытые вопросы (§8).
2. `wiki/journal/2026-09-22-codex-review-brief-memory-v3.md` — бриф для адверсариального ревью Codex.

Копии этих двух файлов лежат рядом: `DECISION.md`, `CODEX-REVIEW-BRIEF.md` — **снимок на 22.09**, правки вноси
в vault-ветку, не в копии.

```bash
cd ~/Jarvis 2>/dev/null || cd ~/Documents/Jarvis
git fetch origin && git checkout claude/memory-v3-plan && git pull
```

Суть плана в трёх строках: единственный store — jarvis-wiki (GitHub — хаб); `jarvis-sync` (хуки + таймер 5 мин)
на всех хостах, у каждого хоста свой каталог событий → конфликтов нет; memory-MCP на hermes как единый путь
записи/чтения; ежедневный `git bundle` в Google Drive (rclone) и на pe12 с ежемесячным тестом восстановления;
доктор раз в час с алертом в Telegram. Старые системы не удаляются, а сводятся (таблица §6 решения).

## 2. Аудит из облака — цифры, которые ты можешь перепроверить

- `agent-fleet/AGENT_ACTIVITY.md`: 18 002 события 10.05–21.09; 15 575 START / 2 427 DONE; проект `unknown`
  в 10 049 строках; agent-id выродился в `claude-mac`/`claude-vps`; topic = id сессии; сессия `9862ac0e` дала 2 928 строк.
  Второй по частоте «проект» — `.claude-memory-compiler` (913 стартов).
- `jarvis-wiki`: 494 страницы; коммиты по месяцам апр 12 / май 37 / июн 16 / июл 22 / авг 3 / сен 9; последний — 05.09;
  в сообщении коммита 02.09: «автосинк стоял с 09.08»; авторы с VPS за всё время: `vps-hook` 1, `vps-migration` 1,
  `RamOS VPS` 2; `wiki/journal/vps/` последний раз менялся 04.07; `.manifest.json` — синхронизированы 2 проекта (07 и 08).
- Страница `wiki/projects/betaline-ai-2/index.md` описывает «Landing v3, задеплоен 25.08» — сайт другой с 07.09.
- RamOS-экспорт `docs/sessions/общее/2026-09-03.md`: агент RamOS 03.09 считал, что на сайте «тарифы 45/90/145».
- 05.09 коммит в vault «убрать учётные данные ATI из карточки проекта» — секреты в память уже попадали.

## 3. Задача 1 — независимая перепроверка на Маке и VPS (то, чего из облака не видно)

Заполни ответами файл `wiki/journal/2026-09-22-memory-v3-decision.md` §8 (открытые вопросы) и добавь раздел
«§10. Проверка на Маке 2026-09-2x». Проверить:

```bash
# где физически vault и не в iCloud ли он
readlink -f ~/Documents/Jarvis; ls -la ~/Library/Mobile\ Documents/iCloud~md~obsidian/Documents/ 2>/dev/null | head
# хуки, которые сейчас реально стоят
jq '.hooks' ~/.claude/settings.json; ls -la ~/.claude/hooks/
cat ~/.claude/hooks/agent-fleet-log.sh          # почему slug = unknown и почему нет DONE
# memory-compiler: жив ли flush и куда пишет
ls -la ~/.claude-memory-compiler/ ~/.claude-memory-compiler/daily ~/.claude-memory-compiler/knowledge 2>/dev/null | head -40
tail -50 ~/.claude-memory-compiler/*.log 2>/dev/null
# Claude auto-memory на Маке: сколько и что там
find ~/.claude/projects -path '*/memory/*' -name '*.md' | wc -l
# launchd/таймеры синка vault
launchctl list | grep -i -E 'jarvis|vault|fleet|memory'
# jarvis-assistant: свежесть карточек
ssh base-vps 'ls -la /root/jarvis/state/ && jq ".[]|.updated" /root/jarvis/state/projects.json | sort | tail -3'
# клоны vault на VPS: есть ли, когда pull
for h in base-vps hermes pe12; do echo "== $h"; ssh $h 'for d in /root/jarvis /root/karpathy-vault /root/jarvis-wiki; do [ -d $d ] && (cd $d && git log -1 --format="%ad %s" --date=short && git status -sb | head -2); done' ; done
# Codex
codex --version; ls ~/.codex/
```

Отдельно проверь **Web Clipper**: он пишет в `raw/web-clipped/` по iCloud-пути — при переносе vault в `~/Jarvis`
его надо перенацелить (или оставить symlink). Это единственное место, где перенос может что-то сломать тихо.

Если какой-то факт из §2 не подтверждается — исправь в решении, не подгоняй план под мой аудит.

## 4. Задача 2 — прогнать Codex по брифу (то, что не запускается из облака)

Codex стоит на Маке и в RamOS; в облачном контейнере его нет и OpenAI-доступа тоже.

**Вариант A — Mac:**
```bash
cd ~/Jarvis && git checkout claude/memory-v3-plan && git pull
codex exec --cd . "$(cat wiki/journal/2026-09-22-codex-review-brief-memory-v3.md)" \
  > wiki/journal/2026-09-22-codex-memory-v3-review.md
git add wiki/journal/2026-09-22-codex-memory-v3-review.md && git commit -m "review: Codex по Memory v3" && git push
```
Флаги модели/сэндбокса — как в ревью RamOS 03.08 (`~/Documents/RAMOS/docs/reviews/2026-08-03-codex-memory-review.md`).

**Вариант B — RamOS** (проект «Betaline», slug `betaline-ai-2`): создать чат с моделью Codex и отдать ему
`docs/agents/handoff/memory-v3/CODEX-REVIEW-BRIEF.md` из клона проекта (эта ветка должна быть смержена в master
или подтянута в `/srv/ramos/projects/betaline-ai-2` — ручной merge там запрещён хуком, см. CLAUDE.md §2 RamOS).
Результат — в `docs/agents/handoff/memory-v3/REVIEW.md`, потом перенести в vault.

Формат вывода зафиксирован в брифе (вердикт GO / GO-WITH-CHANGES / NO-GO, 10 разделов, топ-3 правки).
Если Codex ответит не по формату — прогнать повторно с припиской «строго по формату из брифа».

По желанию оператора — второе мнение другой моделью (Kimi/Gemini через RamOS) тем же брифом.

## 5. Задача 3 — свести и доложить

1. Внести в решение топ-3 правки из ревью (или обосновать, почему нет) — в vault-ветке, отдельным коммитом.
2. Ответить на §8: memory-compiler (оставить/вывести из хуков), iCloud → `~/Jarvis` (да/нет), дашборд jarvis-assistant,
   аккаунт Google Drive под бэкапы, что такое «кодекс Астра/Терра» из задания 22.09 (в vault/репо/Drive не найдено).
3. Доклад Сергею через `tg-send 609952529` — 10 строк: вердикт Codex, три главные правки, рекомендация GO/NO-GO
   на шаг 1 плана и что нужно от него (ответы §8).
4. Release в `AGENT_ACTIVITY.md` этого репо и строка в fleet-ledger.

## 6. Чего НЕ делать без «да» оператора

- Не переносить vault из iCloud и не менять хуки/launchd — это шаг 1 плана, он стартует после решения.
- Не удалять `karpathy-vault`, ledger, memory-compiler, auto-memory — план их сводит, не стирает.
- Не класть токены (rclone, MCP, RamOS) ни в vault, ни в репо — только `~/.config`/env с правами 600.
- Не трогать боевые сайты и RamOS-каталог `/srv/ramos/projects/*` руками.

## 7. Чего не смог из облака (чтобы ты не искал)

Нет ssh к Mac/VPS, нет RamOS-токена, нет Telegram, нет Codex/OpenAI. Из облака доступны только git через
GitHub, Gmail/Drive (только чтение и черновики) и GitHub API. Поэтому всё, что выше, — документы и команды,
а не выполненные действия. Vault я клонировал в облако за минуту — это подтверждает, что git-транспорт для
облачных сессий работает (пункт плана про облако).

## Definition of Done

- [ ] §8 решения заполнен фактами с Мака/VPS, §10 «Проверка на Маке» добавлен
- [ ] `wiki/journal/2026-09-22-codex-memory-v3-review.md` в vault-ветке, формат по брифу
- [ ] правки по ревью внесены отдельным коммитом, PR #3 в jarvis-wiki переведён из черновика в ready
- [ ] Сергею отправлен доклад в TG; release в AGENT_ACTIVITY.md
