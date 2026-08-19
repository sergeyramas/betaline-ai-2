# -*- coding: utf-8 -*-
"""
Betaline AI — «Кабинет» (Quiet Capital).
Астрономический атлас частной обсерватории: тончайшие концентрические орбиты,
лучевые построения, созвездия связей, муар окружностей. Золото на чернильном.
Построено циркулем и терпением.

Выход:
  hero.png  1800x1200 — гравюра главного зала
  plate.png 1400x1400 — астролябия для раздела цен
  seal.png   700x700  — малая печать (вводный аудит)
"""
import math
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

INK      = (14, 22, 38)      # 0E1626
INK_DEEP = (9, 15, 28)
GOLD     = (201, 169, 106)   # C9A96A
IVORY    = (242, 237, 226)   # F2EDE2

SS = 2  # суперсэмплинг

FONT = "/home/user/betaline-ai-2/mockups/assets/fonts/CormorantGaramond-500.ttf"

rng = random.Random(7)


# ---------------------------------------------------------------- фон

def ink_ground(w, h, cx=0.5, cy=0.5, grain=2.2):
    """Чернильный фон: мягкая радиальная тень к краям + тонкое зерно."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    dx = (xx / w - cx)
    dy = (yy / h - cy)
    d = np.sqrt(dx * dx + dy * dy)
    d = np.clip(d / d.max(), 0, 1) ** 1.6
    img = np.zeros((h, w, 3), np.float32)
    for i in range(3):
        img[..., i] = INK[i] * (1 - d) + INK_DEEP[i] * d
    # зерно крупного помола (блочное, лёгкое в сжатии) — как бумага верже
    ns = np.random.RandomState(11).normal(0, grain, (h // 6, w // 6)).round()
    noise = np.array(Image.fromarray(ns.astype(np.float32), "F")
                     .resize((w, h), Image.NEAREST))
    img = np.clip(img + noise[..., None], 0, 255).astype(np.uint8)
    return Image.fromarray(img, "RGB")


# ---------------------------------------------------------------- примитивы

def ring(d, c, r, color, w=2, dash=None, gap=None, phase=0.0, start=0, end=360):
    bb = [c[0] - r, c[1] - r, c[0] + r, c[1] + r]
    if dash is None:
        d.arc(bb, start, end, fill=color, width=w)
    else:
        a = start + phase
        while a < end + phase:
            d.arc(bb, a, min(a + dash, end + phase), fill=color, width=w)
            a += dash + gap


def ticks(d, c, r, n, ln, color, w=2, major_every=None, major_ln=None, rot=0.0):
    for i in range(n):
        ang = 2 * math.pi * i / n + rot
        l = ln
        if major_every and i % major_every == 0:
            l = major_ln or ln * 2
        x1 = c[0] + r * math.cos(ang)
        y1 = c[1] + r * math.sin(ang)
        x2 = c[0] + (r + l) * math.cos(ang)
        y2 = c[1] + (r + l) * math.sin(ang)
        d.line([x1, y1, x2, y2], fill=color, width=w)


def rays(d, c, r0, r1, n, color, w=2, rot=0.0, skip=None):
    for i in range(n):
        if skip and i % skip == 0:
            continue
        ang = 2 * math.pi * i / n + rot
        d.line([c[0] + r0 * math.cos(ang), c[1] + r0 * math.sin(ang),
                c[0] + r1 * math.cos(ang), c[1] + r1 * math.sin(ang)],
               fill=color, width=w)


def node(d, p, r, color, open_=True, w=2):
    bb = [p[0] - r, p[1] - r, p[0] + r, p[1] + r]
    if open_:
        d.ellipse(bb, outline=color, width=w)
    else:
        d.ellipse(bb, fill=color)


def polar(c, r, deg):
    a = math.radians(deg)
    return (c[0] + r * math.cos(a), c[1] + r * math.sin(a))


def constellation(d, c, pts_polar, color_line, color_node, links, w=2):
    """pts_polar: [(r, deg, node_r, open)] ; links: [(i, j)]"""
    pts = [polar(c, r, a) for (r, a, _, _) in pts_polar]
    for i, j in links:
        d.line([pts[i], pts[j]], fill=color_line, width=w)
    for k, (r, a, nr, op) in enumerate(pts_polar):
        node(d, pts[k], nr, color_node, open_=op, w=w)
    return pts


def moire(d, c1, c2, r0, r1, step, color, w=1):
    """Муар: две семьи окружностей со смещёнными центрами."""
    r = r0
    while r <= r1:
        ring(d, c1, r, color, w=w)
        ring(d, c2, r, color, w=w)
        r += step


def stars(d, w, h, n, color_range=(26, 64), seed=3, box=None):
    rs = random.Random(seed)
    x0, y0, x1, y1 = box or (0, 0, w, h)
    for _ in range(n):
        x = rs.uniform(x0, x1)
        y = rs.uniform(y0, y1)
        a = rs.randint(*color_range)
        rr = rs.choice([1, 1, 1, 2, 2, 3])
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=IVORY + (a,))


def g(alpha):
    return GOLD + (alpha,)


def iv(alpha):
    return IVORY + (alpha,)


def finish(bg, overlay, w, h, colors=128):
    out = Image.alpha_composite(bg.convert("RGBA"), overlay)
    out = out.convert("RGB").resize((w, h), Image.LANCZOS)
    q = out.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE)
    return q


def roman(d, p, text, size, alpha, anchor="mm", tracking=False):
    f = ImageFont.truetype(FONT, size)
    d.text(p, text, font=f, fill=g(alpha), anchor=anchor)


# ---------------------------------------------------------------- HERO 1800x1200

def hero():
    W, H = 1800, 1200
    w, h = W * SS, H * SS
    C = (int(w * 0.640), int(h * 0.470))       # главный центр — смещён вправо
    bg = ink_ground(w, h, cx=0.64, cy=0.45)
    ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)

    stars(d, w, h, 340, seed=5)

    # --- дальний муар слева (тихое поле помех)
    moire(d, (int(w * 0.13), int(h * 0.80)), (int(w * 0.155), int(h * 0.83)),
          60, 620, 46, g(14), w=1)

    # --- главная система орбит
    radii = [90, 150, 210, 262, 330, 394, 470, 548, 640, 742, 850, 964]
    for i, r in enumerate(radii):
        a = 100 - i * 6
        if i in (3, 7):
            ring(d, C, r, g(max(a, 40)), w=3)                    # акцентные
        elif i in (1, 5, 9):
            ring(d, C, r, g(max(a, 30)), w=2, dash=3, gap=5)     # пунктирные
        else:
            ring(d, C, r, g(max(a, 26)), w=2)

    # градуировка астролябии на двух кольцах
    ticks(d, C, 548, 180, 10, g(52), w=2, major_every=15, major_ln=26)
    ticks(d, C, 850, 360, 8, g(30), w=1, major_every=30, major_ln=22)
    ticks(d, C, 262, 96, 8, g(58), w=2, major_every=8, major_ln=20)

    # лучевые построения
    rays(d, C, 96, 960, 24, g(16), w=1)
    rays(d, C, 214, 544, 8, g(40), w=2, rot=math.pi / 8)

    # --- эллиптические орбиты (наклонные), рисуем на слое и вращаем
    for (rx, ry, ang, alpha, dash) in [
        (700, 260, -18, 46, None),
        (880, 300, -18, 30, (4, 7)),
        (560, 210, 14, 34, None),
    ]:
        lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        dl = ImageDraw.Draw(lay)
        bb = [C[0] - rx, C[1] - ry, C[0] + rx, C[1] + ry]
        if dash:
            a0 = 0
            while a0 < 360:
                dl.arc(bb, a0, a0 + dash[0], fill=g(alpha), width=2)
                a0 += dash[0] + dash[1]
        else:
            dl.arc(bb, 0, 360, fill=g(alpha), width=2)
        lay = lay.rotate(ang, center=C, resample=Image.BICUBIC)
        ov = Image.alpha_composite(ov, lay)
        d = ImageDraw.Draw(ov)

    # --- ядро
    node(d, C, 7, g(235), open_=False)
    ring(d, C, 20, g(150), w=2)
    ring(d, C, 34, g(70), w=2, dash=4, gap=6)
    # перекрестие
    for a0 in (0, 90, 180, 270):
        p1 = polar(C, 44, a0)
        p2 = polar(C, 66, a0)
        d.line([p1, p2], fill=g(120), width=2)

    # --- планеты на орбитах
    for (r, a0, nr, op, halo) in [
        (210, 208, 9, False, True), (330, 305, 7, True, False),
        (470, 152, 11, False, True), (548, 22, 8, True, False),
        (640, 246, 6, False, False), (742, 118, 13, True, True),
        (850, 331, 7, False, False), (964, 196, 9, True, False),
    ]:
        p = polar(C, r, a0)
        node(d, p, nr, g(190 if not op else 120), open_=op, w=2)
        if halo:
            ring(d, p, nr + 12, g(64), w=2)
            ring(d, p, nr + 24, g(30), w=1, dash=3, gap=5)

    # --- созвездие связей (нейронный граф) — левый нижний квадрант системы
    pts = [(262, 138, 6, False), (394, 156, 8, True), (470, 190, 5, False),
           (548, 171, 7, True), (640, 205, 6, False), (742, 186, 9, True),
           (394, 122, 5, False), (548, 137, 6, False)]
    links = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (1, 3), (0, 6), (6, 7), (7, 3), (7, 5)]
    constellation(d, C, pts, g(66), g(170), links, w=2)

    # малое созвездие справа сверху
    pts2 = [(330, -55, 5, False), (470, -38, 7, True), (548, -66, 5, False),
            (640, -24, 6, False), (742, -50, 8, True)]
    links2 = [(0, 1), (1, 2), (1, 3), (3, 4), (2, 4)]
    constellation(d, C, pts2, g(52), g(150), links2, w=2)

    # --- муар второй системы (правый нижний угол, уходит за край)
    moire(d, (int(w * 0.94), int(h * 1.02)), (int(w * 0.965), int(h * 1.05)),
          80, 700, 54, g(16), w=1)

    # --- малая спутниковая система слева сверху
    c2 = (int(w * 0.16), int(h * 0.20))
    for r, a in [(60, 64), (104, 46), (150, 32), (198, 22)]:
        ring(d, c2, r, g(a), w=2)
    ring(d, c2, 150, g(48), w=2, dash=3, gap=6)
    ticks(d, c2, 104, 48, 7, g(44), w=1)
    node(d, c2, 4, g(190), open_=False)
    p = polar(c2, 150, 118)
    node(d, p, 6, g(160), open_=True)
    d.line([polar(c2, 198, 30), polar(C, 964, 210)], fill=g(22), width=1)

    # --- гравированные римские отметки у колец
    roman(d, polar(C, 292, -104), "II", 30 * SS // 2, 96)
    roman(d, polar(C, 500, -102), "IV", 30 * SS // 2, 88)
    roman(d, polar(C, 676, -101), "VI", 30 * SS // 2, 80)
    roman(d, polar(C, 886, -100), "VIII", 30 * SS // 2, 72)

    finish(bg, ov, W, H).save("/home/user/betaline-ai-2/mockups/c-kabinet/assets/hero.png",
                              optimize=True)


# ---------------------------------------------------------------- PLATE 1400x1400

def plate():
    W = H = 1400
    w = h = W * SS
    C = (w // 2, h // 2)
    bg = ink_ground(w, h, cx=0.5, cy=0.5, grain=1.5)
    ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)

    stars(d, w, h, 200, seed=9)

    # рамка пластины
    m = 120
    d.rectangle([m, m, w - m, h - m], outline=g(46), width=2)
    d.rectangle([m + 22, m + 22, w - m - 22, h - m - 22], outline=g(24), width=1)
    for (x, y) in [(m, m), (w - m, m), (m, h - m), (w - m, h - m)]:
        d.line([x - 34, y, x + 34, y], fill=g(90), width=2)
        d.line([x, y - 34, x, y + 34], fill=g(90), width=2)

    # орбиты
    radii = [110, 170, 236, 306, 380, 458, 540, 626, 716, 810, 908, 1010, 1116]
    for i, r in enumerate(radii):
        a = 88 - i * 5
        if i == 5:
            ring(d, C, r, g(96), w=3)
        elif i in (2, 8, 11):
            ring(d, C, r, g(max(a, 24)), w=2, dash=3, gap=5)
        else:
            ring(d, C, r, g(max(a, 20)), w=2)

    ticks(d, C, 458, 120, 10, g(64), w=2, major_every=10, major_ln=26)
    ticks(d, C, 810, 240, 8, g(36), w=1, major_every=20, major_ln=22)
    rays(d, C, 116, 1116, 36, g(14), w=1)
    rays(d, C, 236, 456, 12, g(44), w=2, rot=math.pi / 12)

    # муар: вторая семья, слегка смещённая
    moire(d, C, (C[0] + 26, C[1] + 34), 540, 1010, 470, g(0), w=1)  # noop guard
    c_off = (C[0] + 30, C[1] + 40)
    for r in range(560, 1120, 62):
        ring(d, c_off, r, g(13), w=1)

    # пять узлов-«номиналов» на главном кольце (пять решений)
    for i, a0 in enumerate([-90, -18, 54, 126, 198]):
        p = polar(C, 626, a0)
        node(d, p, 10 if i == 0 else 7, g(210 if i == 0 else 150), open_=(i % 2 == 1), w=2)
        ring(d, p, 22, g(60), w=2)
        if i == 0:
            ring(d, p, 36, g(36), w=1, dash=3, gap=5)
    # связи узлов через центр поле
    ppts = [polar(C, 626, a0) for a0 in [-90, -18, 54, 126, 198]]
    for i in range(5):
        d.line([ppts[i], ppts[(i + 2) % 5]], fill=g(28), width=1)

    # ядро
    node(d, C, 6, g(230), open_=False)
    ring(d, C, 18, g(150), w=2)
    ring(d, C, 32, g(70), w=2, dash=4, gap=6)

    # градусные римские метки
    roman(d, polar(C, 675, -90), "I", 44, 120)
    roman(d, polar(C, 675, -18), "II", 44, 104)
    roman(d, polar(C, 675, 54), "III", 44, 104)
    roman(d, polar(C, 675, 126), "IV", 44, 104)
    roman(d, polar(C, 675, 198), "V", 44, 104)

    finish(bg, ov, W, H, colors=80).save(
        "/home/user/betaline-ai-2/mockups/c-kabinet/assets/plate.png", optimize=True)


# ---------------------------------------------------------------- SEAL 700x700

def seal():
    W = H = 700
    w = h = W * SS
    C = (w // 2, h // 2)
    # прозрачный фон — печать ложится на любую поверхность
    ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)

    ring(d, C, 640, g(180), w=3)
    ring(d, C, 610, g(125), w=2, dash=3, gap=5)
    ring(d, C, 470, g(200), w=3)
    ring(d, C, 300, g(105), w=2)
    ticks(d, C, 470, 96, 16, g(180), w=2, major_every=8, major_ln=38)
    ticks(d, C, 640, 180, -14, g(80), w=1)
    rays(d, C, 90, 296, 12, g(125), w=2)
    ring(d, C, 160, g(125), w=2, dash=4, gap=7)
    node(d, C, 10, g(235), open_=False)
    ring(d, C, 34, g(180), w=2)
    for a0 in (45, 135, 225, 315):
        p = polar(C, 385, a0)
        node(d, p, 8, g(200), open_=(a0 % 90 == 45 and a0 > 180), w=2)
    for a0 in (0, 90, 180, 270):
        p1 = polar(C, 300, a0)
        p2 = polar(C, 470, a0)
        d.line([p1, p2], fill=g(95), width=2)

    out = ov.resize((W, H), Image.LANCZOS)
    out.save("/home/user/betaline-ai-2/mockups/c-kabinet/assets/seal.png", optimize=True)


if __name__ == "__main__":
    hero()
    plate()
    seal()
    print("done")
