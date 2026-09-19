#!/usr/bin/env python3
"""Build dist-custom2/ — the custom2.betaline-ai.ru variant of the site.

Same as custom.betaline-ai.ru, except the hero figure is the original
topo-map image (mockups/blueprint-v2 style) instead of the inline-SVG
schema. Everything else (incl. #cases, main.js, style.css) is
copied unchanged; YM_ID is swapped to the custom2 counter. Rerun after every change to the root site.
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist-custom2"

HERO_START = '<figure class="hero-fig dwg ld ld4">'
HERO_END = "</figure>"

HERO_REPLACEMENT = """<figure class="hero-fig ld ld4">
        <img src="/assets/img/hero-diagram.webp" alt="Чертёж: топология агентной системы — изолинии поля плотности задач, сеть узлов и траектории данных" width="1800" height="1200" fetchpriority="high">
        <figcaption class="fig-cap">
          <span><b>рис. 01</b> — топология агентной системы</span>
          <span>изолинии · узлы · траектории данных</span>
        </figcaption>
      </figure>"""

DOMAIN_OLD = "custom.betaline-ai.ru"
DOMAIN_NEW = "custom2.betaline-ai.ru"

# custom2 has its own Metrika counter (same 4 goals, created 2026-09-15);
# 112421910 stays on custom. Both the window.YM_ID and the <noscript> pixel.
YM_OLD = "112421910"
YM_NEW = "112650916"

# custom2: тарифы ужаты в 150–900 тыс. (решение оператора 19.09); на custom остаются макетные.
PRICES = {
    "<i>от</i>600&thinsp;000&nbsp;": "<i>от</i>450&thinsp;000&nbsp;",
    "<i>от</i>700&thinsp;000&nbsp;": "<i>от</i>600&thinsp;000&nbsp;",
    "<i>от</i>800&thinsp;000&nbsp;": "<i>от</i>750&thinsp;000&nbsp;",
    "<i>от</i>1&thinsp;000&thinsp;000&nbsp;": "<i>от</i>900&thinsp;000&nbsp;",
}

COPY_ITEMS = ["style.css", "main.js", "ecosystem.js", "vercel.json", "assets", "api", "bot", "package.json"]


def swap_hero(html: str) -> str:
    start = html.find(HERO_START)
    if start == -1:
        sys.exit(
            f"ERROR: hero marker {HERO_START!r} not found in index.html — "
            "markup changed, update tools/build-custom2.py"
        )
    end = html.find(HERO_END, start)
    if end == -1:
        sys.exit("ERROR: no closing </figure> found after hero marker")
    end += len(HERO_END)
    return html[:start] + HERO_REPLACEMENT + html[end:]


def main():
    src_html = (ROOT / "index.html").read_text(encoding="utf-8")

    html = swap_hero(src_html)
    n_domain = html.count(DOMAIN_OLD)
    html = html.replace(DOMAIN_OLD, DOMAIN_NEW)
    # ecosystem.js: сайт и метка возврата на плашках
    html = html.replace('data-site="custom"', 'data-site="custom2"').replace("?from=custom\"", "?from=custom2\"")
    n_ym = html.count(YM_OLD)
    if n_ym != 2:
        sys.exit(f"ERROR: expected YM_ID {YM_OLD} twice in index.html (script + noscript), found {n_ym}")
    html = html.replace(YM_OLD, YM_NEW)
    for old, new in PRICES.items():
        if html.count(old) != 1:
            sys.exit(f"ERROR: expected tariff {old!r} once in index.html, found {html.count(old)}")
        html = html.replace(old, new)

    # Keep the Vercel project link: without dist-custom2/.vercel/project.json
    # `vercel deploy` links by directory name and creates a duplicate project.
    link = DIST / ".vercel" / "project.json"
    link_json = link.read_text(encoding="utf-8") if link.exists() else None
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)
    if link_json:
        link.parent.mkdir()
        link.write_text(link_json, encoding="utf-8")

    (DIST / "index.html").write_text(html, encoding="utf-8")

    for item in COPY_ITEMS:
        src = ROOT / item
        dst = DIST / item
        if not src.exists():
            print(f"  skip (missing): {item}")
            continue
        if src.is_dir():
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)

    # hero-diagram.webp: removed from the working tree in 4f85e32, still in
    # git history — pull it from there rather than regenerating from the PNG.
    img_dir = DIST / "assets" / "img"
    img_dir.mkdir(parents=True, exist_ok=True)
    webp_path = img_dir / "hero-diagram.webp"
    result = subprocess.run(
        ["git", "-C", str(ROOT), "show", "4f85e32^:assets/img/hero-diagram.webp"],
        capture_output=True,
    )
    if result.returncode != 0 or not result.stdout:
        sys.exit("ERROR: could not extract hero-diagram.webp from git history (4f85e32^)")
    webp_path.write_bytes(result.stdout)

    print(f"built {DIST}/")
    print(f"  hero figure: dwg/SVG -> img hero-diagram.webp ({webp_path.stat().st_size} bytes)")
    print(f"  domain: {DOMAIN_OLD} -> {DOMAIN_NEW} ({n_domain} occurrences in head/JSON-LD)")
    print(f"  metrika: {YM_OLD} -> {YM_NEW} ({n_ym} occurrences)")
    print(f"  copied: {', '.join(COPY_ITEMS)}")


if __name__ == "__main__":
    main()
