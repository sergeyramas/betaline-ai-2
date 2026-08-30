# Конструктор ИИ-ботов BetaLine — исходники

Зеркало продакшн-сайта **https://betaline-saas-deploy.vercel.app** (Vercel-проект
`betaline-saas-deploy`, scope `sergeyramas-projects`), снятое 2026-08-20.

## Зачем зеркало

Проект заливался на Vercel из локальной папки через CLI — репозитория на GitHub у него
не было, исходники существовали в единственном экземпляре на рабочей машине. Теперь они в git.

## Структура

| Путь | Что это |
|---|---|
| `index.html` | Лендинг «Бот, который продаёт за тебя» — single-file, инлайн CSS/JS |
| `cabinet/index.html` | Личный кабинет с визардом сборки бота |
| `cabinet/cabinet.css`, `cabinet/cabinet.js` | Логика и стили кабинета |
| `platform/index.html` | Страница-переадресация |
| `legal/policy.html` | Политика конфиденциальности |
| `legal/oferta.html` | Публичный договор-оферта |
| `legal/legal.css` | Стили правовых страниц |
| `assets/css/saas-tokens.css` | Дизайн-токены |
| `images/`, `assets/` | Иллюстрации |

## Что изменено относительно продакшна

### Футер лендинга

Пересобран по структуре подвала `betaline-ai.ru`: три колонки сверху и отдельная нижняя
строка с копирайтом и реквизитами (аналог `.ft-bottom` на основном сайте).

| Колонка | Содержимое |
|---|---|
| Бренд | Логотип + короткий тэглайн |
| Меню | Конструктор · Тарифы · FAQ |
| Контакты | Телефон, email, Telegram оператора, часы работы |

Нижняя строка:

```
© 2024–2026 Betaline AI. Все права защищены.
ИП Ромащенко Сергей Николаевич · ИНН 143302699808 · ОГРНИП 316213000103371
```

справа — ссылки на политику и оферту.

Раньше на этом месте стояла чужая заглушка `ИП Кртин Андрей Станиславович · ИНН 7700000000 ·
support@betaline-ai.ru`, а телефон с почтой отсутствовали в подвале вовсе.

### Сопутствующие правила CSS

- `.bl-footer-title`, `.bl-footer-tagline`, `.bl-footer-phone`, `.bl-footer-hours`,
  `.bl-footer-bottom`, `.bl-footer-links` — новые классы под структуру выше.
- `.bl-footer-legal a` — ссылки наследуют цвет подвала, иначе браузер рисует их синим
  с подчёркиванием на тёмном фоне.
- `.bl-footer` — `padding-bottom: 96px` (на мобильном `128px`): подвал уходил под липкую
  оранжевую CTA-полосу.
- `.bl-footer-bottom` — `padding-right: 96px` от 601px: плавающая кнопка чата в правом
  нижнем углу накрывала ссылку «Оферта».

## Правовые страницы

Ссылки `/legal/policy.html` и `/legal/oferta.html` в футере раньше отдавали **404** — страниц
не существовало. Тексты перенесены с `betaline-ai.ru`, где они лежат модалками внутри
`index.html` (`#ft-modal-policy`, `#ft-modal-oferta`), и развёрнуты в отдельные страницы
в оранжевой дизайн-системе конструктора (`saas-tokens.css` + `legal/legal.css`).

Формулировки перенесены дословно. Единственная содержательная правка — область действия
политики: было «на сайте betaline-ai.ru», стало «на сайте betaline-ai.ru и его поддоменах,
включая конструктор ИИ-ботов constructor.betaline-ai.ru», иначе документ не покрывал бы
домен, на котором лежит.

Реквизиты в обоих документах и в подвалах — ИП Ромащенко Сергей Николаевич,
ИНН 143302699808, ОГРНИП 316213000103371.

## Локальный запуск

```bash
cd constructor && python3 -m http.server 8899
# http://127.0.0.1:8899/
```

## Деплой

Проект на Vercel уже существует и связан — деплоить из этой папки.

| Параметр | Значение |
|---|---|
| Vercel-проект | `betaline-saas-deploy` |
| `VERCEL_PROJECT_ID` | `prj_c7AUARnK1yw8JEq8Xcb1hCKVRblv` |
| `VERCEL_ORG_ID` (scope) | `team_IQe20O57hTH99URRYtc0FvFt` (`sergeyramas-projects`) |
| Продакшн-домены | `betaline-saas-deploy.vercel.app`, `constructor.betaline-ai.ru` |

ID проекта и команды — не секрет, их можно держать в репозитории. Секрет только токен.

```bash
cd constructor
export VERCEL_TOKEN=...        # см. «Где лежит токен» ниже
export VERCEL_ORG_ID=team_IQe20O57hTH99URRYtc0FvFt
export VERCEL_PROJECT_ID=prj_c7AUARnK1yw8JEq8Xcb1hCKVRblv
npx --yes vercel@latest deploy --prod --yes
```

### Где лежит токен

**Единственное место — секрет репозитория `VERCEL_TOKEN`:**
GitHub → `sergeyramas/betaline-ai-2` → Settings → Secrets and variables → Actions.

Оттуда его берёт готовый workflow `.github/workflows/deploy-vercel.yml`, который деплоит
на каждый push в `master`. Ничего больше настраивать не нужно — агентам достаточно знать
это имя и путь.

**Токен не хранится в файлах репозитория и не должен туда попадать.** В git его коммитить
нельзя: он остаётся в истории навсегда, даже если файл потом удалить.

### Домен constructor.betaline-ai.ru

Домен уже добавлен в проект `betaline-saas-deploy` и подтверждён (`verified: true`).
Осталась одна DNS-запись в зоне `betaline-ai.ru` (NS у Beget, Vercel зоной не управляет —
`serviceType: external`):

```
Тип A · Имя constructor · Значение 76.76.21.21
```

`76.76.21.21` выбран для единообразия — на него уже указывают `crm`, `zvonok` и апекс
`betaline-ai.ru`. Vercel сейчас рекомендует также `216.198.79.1` / `64.29.17.1`, но старый
адрес поддерживается и в этой зоне проверен.

Грабли панели Beget (из `betaline-voice-ai/AGENT_ACTIVITY.md`, при заведении `zvonok`):
поле **Name** в «Быстром добавлении» — Vuetify-combobox. `Escape` стирает введённое,
нужно кликнуть пункт выпадашки, иначе форма уйдёт с пустым Name. Остальные записи зоны
(`www`, `crm`, `autoconfig`, `autodiscover`, MX) не трогать.
