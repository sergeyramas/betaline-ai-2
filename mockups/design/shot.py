#!/usr/bin/env python3
"""Full-page screenshot helper: python3 shot.py <file.html> <out.png> [width]"""
import sys, glob
from playwright.sync_api import sync_playwright

html, out = sys.argv[1], sys.argv[2]
width = int(sys.argv[3]) if len(sys.argv) > 3 else 1440

exe = None
for pat in ["/opt/pw-browsers/chromium-*/chrome-linux/chrome",
            "/opt/pw-browsers/chromium/chrome-linux/chrome"]:
    m = glob.glob(pat)
    if m:
        exe = m[0]
        break

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=exe, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": width, "height": 900})
    page.goto("file://" + html, wait_until="networkidle")
    page.wait_for_timeout(2500)
    page.screenshot(path=out, full_page=True)
    browser.close()
print("saved", out)
