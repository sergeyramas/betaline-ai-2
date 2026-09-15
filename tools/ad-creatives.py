#!/usr/bin/env python3
"""Overlay headline + CTA button on Codex-generated backgrounds → assets/img/ads/*-text.jpg.

Backgrounds: assets/img/ads/0N-*.png (image_gen via Codex, no text by design —
Cyrillic in generated buttons comes out garbled, so typography is laid here).
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ADS = ROOT / "assets" / "img" / "ads"
FONTS = ROOT / "mockups" / "blueprint-v2" / "assets" / "fonts"
ORANGE, INK, CREAM = (232, 99, 43), (43, 43, 43), (244, 239, 230)

# (background, headline lines, subline, cta, panel box as fractions of W/H)
CREATIVES = [
    ("01-agent-desk-16x9.png", ["ИИ-агент для бизнеса", "под ключ"],
     "Заявки 24/7, запись клиентов, интеграция с CRM", "Получить аудит — 0 ₽", (0.04, 0.40, 0.58, 0.96)),
    ("02-agent-desk-1x1.png", ["Внедрим ИИ-агента", "в ваш бизнес"],
     "Отвечает клиентам 24/7 и передаёт заявки в CRM", "Получить аудит — 0 ₽", (0.05, 0.62, 0.72, 0.95)),
    ("03-blueprint-16x9.png", ["Заявки 24/7", "без менеджера"],
     "ИИ-агент записывает клиентов и разгружает продажи", "Бесплатный аудит", (0.04, 0.45, 0.58, 0.96)),
    ("04-blueprint-1x1.png", ["ИИ-ассистент", "для бизнеса"],
     "Автоматизируем общение с клиентами", "Получить аудит — 0 ₽", (0.05, 0.05, 0.62, 0.36)),
]


def font(weight, size):
    return ImageFont.truetype(str(FONTS / f"GolosText-{weight}.ttf"), size)


def render(bg, lines, sub, cta, box):
    im = Image.open(ADS / bg).convert("RGBA")
    W, H = im.size
    x0, y0, x1, y1 = (int(v * s) for v, s in zip(box, (W, H, W, H)))
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    d.rounded_rectangle((x0, y0, x1, y1), radius=int(H * 0.025), fill=CREAM + (225,))
    im = Image.alpha_composite(im, overlay)
    d = ImageDraw.Draw(im)

    k = H * (1.25 if W > H else 1.0)  # landscape: H is short side, type needs a boost
    pad = int(H * 0.035)
    x, y = x0 + pad, y0 + pad
    avail = x1 - x0 - 2 * pad
    h_size = int(k * 0.075)
    while max(d.textlength(t, font=font(700, h_size)) for t in lines) > avail:
        h_size -= 2
    for t in lines:
        d.text((x, y), t, font=font(700, h_size), fill=INK)
        y += int(h_size * 1.12)
    y += int(H * 0.012)
    s_size = int(k * 0.032)
    while d.textlength(sub, font=font(400, s_size)) > avail:
        s_size -= 1
    d.text((x, y), sub, font=font(400, s_size), fill=(90, 90, 90))
    y += int(s_size * 1.5) + int(H * 0.015)
    b_font = font(600, int(k * 0.036))
    bw = int(d.textlength(cta, font=b_font)) + 2 * int(H * 0.04)
    bh = int(k * 0.085)
    d.rounded_rectangle((x, y, x + bw, y + bh), radius=int(bh * 0.28), fill=ORANGE)
    d.text((x + bw / 2, y + bh / 2), cta, font=b_font, fill="white", anchor="mm")
    out = ADS / (bg.rsplit(".", 1)[0] + "-text.jpg")
    im.convert("RGB").save(out, quality=90)
    return out


if __name__ == "__main__":
    for c in CREATIVES:
        print(render(*c))
