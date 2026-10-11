#!/usr/bin/env python3
"""Аудит-прогон прод-страниц: скриншоты 1440/390 + overflow/console/asset-проверки.

Отдельно: проверка срабатывания цели Яндекс.Метрики на форме.
Реальный лид НЕ отправляется — запрос к /api/lead перехватывается и обрывается.
"""
import glob
import json
import os
import sys
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)))
SITES = [
    ("custom", "https://custom.betaline-ai.ru/"),
    ("custom2", "https://custom2.betaline-ai.ru/"),
]
VIEWPORTS = [("1440", 1440, 900), ("390", 390, 844)]

EXE = None
for pat in [
    os.path.expanduser("~/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium"),
    os.path.expanduser("~/Library/Caches/ms-playwright/chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium"),
    "/opt/pw-browsers/chromium/chrome-linux/chrome",
]:
    m = sorted(glob.glob(pat))
    if m:
        EXE = m[-1]
        break

REPORT = {}


def probe(page):
    return page.evaluate(
        """() => {
      const de = document.documentElement;
      const vw = window.innerWidth;
      const out = {
        scrollWidth: de.scrollWidth,
        innerWidth: vw,
        bodyHeight: document.body.scrollHeight,
        overflowing: [],
        imagesBroken: [],
        imagesNoAlt: [],
        h1: document.querySelectorAll('h1').length,
        h2: document.querySelectorAll('h2').length,
        lang: de.lang,
        title: document.title,
        smallTargets: [],
        unnamedInteractive: [],
        fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family),
      };
      const seen = new Set();
      document.querySelectorAll('body *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.right > vw + 1 || r.left < -1) {
          const key = el.tagName + '.' + (el.className && el.className.toString().slice(0, 40));
          if (!seen.has(key)) {
            seen.add(key);
            out.overflowing.push({sel: key, left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width)});
          }
        }
      });
      document.querySelectorAll('img').forEach(img => {
        if (img.naturalWidth === 0) out.imagesBroken.push(img.currentSrc || img.src);
        if (!img.hasAttribute('alt')) out.imagesNoAlt.push(img.src);
      });
      document.querySelectorAll('a,button,input,textarea,select,[role=button]').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const name = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || el.placeholder || '').trim();
        if (!name) out.unnamedInteractive.push(el.tagName + '#' + (el.id || '') + '.' + (el.className || '').toString().slice(0, 30));
        if (vw < 500 && (r.height < 24 || r.width < 24)) {
          out.smallTargets.push({t: el.tagName, c: (el.className || '').toString().slice(0, 30), h: Math.round(r.height), w: Math.round(r.width), name: name.slice(0, 20)});
        }
      });
      return out;
    }"""
    )


def scroll_through(page):
    page.evaluate(
        """async () => {
      const step = Math.round(window.innerHeight * 0.8);
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 120));
      }
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 400));
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 300));
    }"""
    )


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=EXE, args=["--no-sandbox"])
    for name, url in SITES:
        for label, w, h in VIEWPORTS:
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            page = ctx.new_page()
            console, failed, responses = [], [], []
            page.on("console", lambda m: console.append({"type": m.type, "text": m.text[:200]}) if m.type in ("error", "warning") else None)
            page.on("requestfailed", lambda r: failed.append({"url": r.url, "err": r.failure}))
            page.on("response", lambda r: responses.append({"url": r.url, "status": r.status}) if r.status >= 400 else None)
            page.goto(url, wait_until="load", timeout=60000)
            page.wait_for_timeout(2500)
            scroll_through(page)
            data = probe(page)
            data["console"] = console
            data["requestfailed"] = failed
            data["httpErrors"] = responses
            shot = os.path.join(OUT, f"{name}-{label}.png")
            page.screenshot(path=shot, full_page=True)
            data["screenshot"] = shot
            REPORT[f"{name}-{label}"] = data
            ctx.close()

    # --- проверка целей Метрики: сеть перехватываем, реальный лид не уходит ---
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.route("**/api/lead", lambda route: route.abort())
    page.route("**/api/chat-ai", lambda route: route.abort())
    page.add_init_script(
        """window.__ym = [];
           window.ym = function(id, action, goal, params) { window.__ym.push({id, action, goal: goal || null, params: params || null}); };"""
    )
    page.goto("https://custom2.betaline-ai.ru/", wait_until="load", timeout=60000)
    page.wait_for_timeout(2000)
    page.fill("#f-name", "ТЕСТ-АУДИТ (в сеть не ушёл)")
    page.fill("#f-contact", "audit@example.com")
    page.fill("#f-task", "проверка аудита: реальный лид не отправлялся")
    page.click("#lead-form button[type=submit], #lead-form .btn")
    page.wait_for_timeout(2500)
    REPORT["metrika-goals"] = {
        "calls": page.evaluate("window.__ym"),
        "formStatus": page.evaluate(
            """() => { const f = document.querySelector('.form-status, .form__status, [data-form-status]');
                      return f ? f.innerText.trim().slice(0, 200) : null; }"""
        ),
    }
    ctx.close()
    browser.close()

print(json.dumps(REPORT, ensure_ascii=False, indent=1))
