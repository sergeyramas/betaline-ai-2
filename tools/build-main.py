#!/usr/bin/env python3
"""Build dist-main/ — main.betaline-ai.ru, хаб «Три способа внедрить AI в бизнес» (макет C2, тёмное бенто).

Шапка, форма, футер, модалки, чат-виджет берутся из корневого index.html (custom),
середина страницы (первый экран-бенто: 3 продукта + бесплатный аудит + цифры) — из main/body.html.
Стиль — main/main.css поверх style.css: тёмная тема токенами, шрифты Golos Text / IBM Plex Mono
(self-hosted, из корневого fonts.css — не подменяются). Цен на продуктах нет (решение оператора).
Перезапускать после правок index.html или main/*.
"""
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist-main"

# Счётчик Метрики main — 113360297 «Betaline AI — main.betaline-ai.ru» (gowindo.elama1, 03.10.2026, те же 4 цели).
YM_OLD = "112421910"
YM_NEW = "113360297"

NAV_OLD = re.compile(r'<a href="#services">Услуги</a>.*?<a href="#pricing">Цены</a>', re.S)
NAV_NEW = '<a href="#products">Продукты</a>\n      <a href="#contact">Контакт</a>'


def cut(html: str, start: str, end: str) -> tuple[int, int]:
    a, b = html.find(start), html.find(end)
    if a == -1 or b == -1 or b < a:
        sys.exit(f"ERROR: markers {start!r} / {end!r} not found — update tools/build-main.py")
    return a, b


def main():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    body = (ROOT / "main" / "body.html").read_text(encoding="utf-8")

    # середина: от <main id="top"> до секции контактов
    a, b = cut(html, '<main id="top">', "<!-- ================= CTA / ФОРМА")
    html = html[:a] + '<main id="top">\n\n' + body + "  " + html[b:]

    html = NAV_OLD.sub(NAV_NEW, html, count=2)
    if html.count('href="#products">Продукты') != 2:
        sys.exit("ERROR: nav links not replaced (desktop + mobile)")

    html = html.replace("custom.betaline-ai.ru", "main.betaline-ai.ru")
    html = html.replace(f"window.YM_ID = {YM_OLD};", f"window.YM_ID = {YM_NEW};")
    html = html.replace(f"mc.yandex.ru/watch/{YM_OLD}", f"mc.yandex.ru/watch/{YM_NEW}")
    html = html.replace("<title>Betaline — AI-интегратор полного цикла</title>",
                        "<title>Betaline AI — три способа внедрить AI в бизнес</title>")
    html = html.replace('<link rel="stylesheet" href="/style.css">',
                        '<link rel="stylesheet" href="/style.css">\n<link rel="stylesheet" href="/main.css">')
    # контакт: номер секции «07 /» из длинной страницы custom здесь не нужен
    html, n = re.subn(r'<p class="sec-mark rv"><b>\d+</b> / Контакт</p>', '<p class="sec-mark rv">Контакт</p>', html, count=1)
    if n != 1:
        sys.exit("ERROR: contact mark not replaced")
    # форма: плашка выбранной задачи + скрытое поле plan (уходит в /api/lead как «Тариф»)
    html = html.replace('<form class="form" id="lead-form" novalidate>',
                        '<form class="form" id="lead-form" novalidate>\n'
                        '            <p class="cta-plan" id="cta-plan"><span>Задача: <b></b></span>'
                        '<button type="button" aria-label="Сбросить задачу">&times;</button></p>\n'
                        '            <input type="hidden" id="f-plan" name="plan" value="">', 1)
    if 'id="f-plan"' not in html or YM_OLD in html:
        sys.exit("ERROR: form or YM swap failed")

    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    (DIST / "index.html").write_text(html, encoding="utf-8")
    shutil.copy(ROOT / "main" / "main.css", DIST / "main.css")
    for item in ["style.css", "main.js", "ecosystem.js", "kp.html"]:
        shutil.copy(ROOT / item, DIST / item)
    shutil.copytree(ROOT / "assets", DIST / "assets")
    print(f"built {DIST}")


if __name__ == "__main__":
    main()
