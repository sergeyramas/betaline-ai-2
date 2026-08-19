#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Betaline AI — продакшен-версия чертежей (фирменная тёплая гамма).
Генерация диаграмм: изолинии, сетки узлов, траектории данных, гравюра.
Тёплый графит + фирменный оранжевый на кремовой бумаге #FFFBF5.
PIL + numpy, без внешних зависимостей.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

BG      = (255, 251, 245)   # фирменная кремовая бумага #FFFBF5
INK     = (26, 26, 26)      # тёплый графит #1a1a1a
GRAY    = (158, 148, 134)   # тёплый служебный серый
FAINT   = (240, 231, 218)   # тёплые линии сетки
FAINT2  = (224, 213, 197)
COBALT  = (249, 115, 22)    # единственный акцент — фирменный оранжевый #F97316
SS      = 2                 # суперсэмплинг

FONT_DIR = "/home/user/betaline-ai-2/mockups/assets/fonts"

def mono(size):
    return ImageFont.truetype(f"{FONT_DIR}/IBMPlexMono-400.ttf", size * SS)

def mono5(size):
    return ImageFont.truetype(f"{FONT_DIR}/IBMPlexMono-500.ttf", size * SS)

def canvas(w, h):
    img = Image.new("RGB", (w * SS, h * SS), BG)
    return img, ImageDraw.Draw(img)

def save(img, path, w, h):
    img = img.resize((w, h), Image.LANCZOS)
    img = img.convert("P", palette=Image.ADAPTIVE, colors=96)
    img.save(path, optimize=True)
    print(path)

def L(v):  # scale to supersampled px
    return v * SS

# ---------------------------------------------------------------- marching squares
def marching_squares(F, level):
    """Возвращает список отрезков ((x1,y1),(x2,y2)) в координатах ячеек сетки."""
    segs = []
    h, w = F.shape
    for i in range(h - 1):
        row0, row1 = F[i], F[i + 1]
        for j in range(w - 1):
            a, b, c, d = row0[j], row0[j + 1], row1[j + 1], row1[j]  # tl tr br bl
            idx = (a > level) * 8 | (b > level) * 4 | (c > level) * 2 | (d > level) * 1
            if idx == 0 or idx == 15:
                continue
            def ip(p1, p2, v1, v2):
                t = (level - v1) / (v2 - v1 + 1e-12)
                return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))
            top    = ip((j, i), (j + 1, i), a, b)
            right  = ip((j + 1, i), (j + 1, i + 1), b, c)
            bottom = ip((j, i + 1), (j + 1, i + 1), d, c)
            left   = ip((j, i), (j, i + 1), a, d)
            table = {
                1: [(left, bottom)],   14: [(left, bottom)],
                2: [(bottom, right)],  13: [(bottom, right)],
                3: [(left, right)],    12: [(left, right)],
                4: [(top, right)],     11: [(top, right)],
                6: [(top, bottom)],     9: [(top, bottom)],
                7: [(left, top)],       8: [(left, top)],
                5: [(left, top), (bottom, right)],
                10: [(left, bottom), (top, right)],
            }
            segs.extend(table[idx])
    return segs

def draw_isolines(dr, F, levels, box, color, width=1, dash=None):
    """box = (x0, y0, x1, y1) в конечных (не SS) координатах."""
    x0, y0, x1, y1 = box
    h, w = F.shape
    sx = (x1 - x0) / (w - 1)
    sy = (y1 - y0) / (h - 1)
    for lv in levels:
        for (p1, p2) in marching_squares(F, lv):
            ax, ay = x0 + p1[0] * sx, y0 + p1[1] * sy
            bx, by = x0 + p2[0] * sx, y0 + p2[1] * sy
            dr.line([L(ax), L(ay), L(bx), L(by)], fill=color, width=width * SS)

# ---------------------------------------------------------------- helpers
def cross(dr, x, y, r, color, width=1):
    dr.line([L(x - r), L(y), L(x + r), L(y)], fill=color, width=width * SS)
    dr.line([L(x), L(y - r), L(x), L(y + r)], fill=color, width=width * SS)

def node(dr, x, y, r, color, fill=None, width=1):
    bb = [L(x - r), L(y - r), L(x + r), L(y + r)]
    dr.ellipse(bb, fill=fill if fill else BG, outline=color, width=width * SS)

def dotted(dr, pts, color, r=1.1, step=7.0):
    """Точечная линия вдоль полилинии pts (конечные координаты)."""
    acc = 0.0
    for k in range(len(pts) - 1):
        (x1, y1), (x2, y2) = pts[k], pts[k + 1]
        seg = math.hypot(x2 - x1, y2 - y1)
        if seg < 1e-9:
            continue
        t = acc
        while t < seg:
            u = t / seg
            x, y = x1 + u * (x2 - x1), y1 + u * (y2 - y1)
            dr.ellipse([L(x - r), L(y - r), L(x + r), L(y + r)], fill=color)
            t += step
        acc = t - seg

def qcurve(p0, p1, p2, n=28):
    out = []
    for k in range(n + 1):
        t = k / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
        out.append((x, y))
    return out

def polyline(dr, pts, color, width=1):
    dr.line([(L(x), L(y)) for x, y in pts], fill=color, width=width * SS, joint="curve")

def arrow_head(dr, p_from, p_to, color, size=5):
    ang = math.atan2(p_to[1] - p_from[1], p_to[0] - p_from[0])
    for da in (2.65, -2.65):
        x = p_to[0] + size * math.cos(ang + da)
        y = p_to[1] + size * math.sin(ang + da)
        dr.line([L(p_to[0]), L(p_to[1]), L(x), L(y)], fill=color, width=SS)

def ruler(dr, x0, y0, x1, y1, color, tick=4, step=24, major_every=5, label_font=None,
          label_color=None, side="bottom", start=0):
    """Линейка с засечками вдоль горизонтали или вертикали."""
    horiz = abs(y1 - y0) < 1e-9
    dr.line([L(x0), L(y0), L(x1), L(y1)], fill=color, width=SS)
    n = int((max(x1 - x0, y1 - y0)) / step)
    for k in range(n + 1):
        big = (k % major_every == 0)
        t = tick * (1.7 if big else 1.0)
        if horiz:
            x = x0 + k * step
            dy = t if side == "bottom" else -t
            dr.line([L(x), L(y0), L(x), L(y0 + dy)], fill=color, width=SS)
            if big and label_font and k % (major_every * 2) == 0:
                dr.text((L(x + 3), L(y0 + (t + 2 if side == "bottom" else -t - 11))),
                        f"{start + k * step:d}", font=label_font, fill=label_color or color)
        else:
            y = y0 + k * step
            dx = t if side == "right" else -t
            dr.line([L(x0), L(y), L(x0 + dx), L(y)], fill=color, width=SS)
            if big and label_font and k % (major_every * 2) == 0:
                dr.text((L(x0 + (t + 3 if side == "right" else -t - 26)), L(y + 2)),
                        f"{start + k * step:d}", font=label_font, fill=label_color or color)

def field(w, h, bumps, seed=0):
    rng = np.random.default_rng(seed)
    ys, xs = np.mgrid[0:h, 0:w]
    xs = xs / (w - 1)
    ys = ys / (h - 1)
    F = np.zeros((h, w))
    for (cx, cy, s, a) in bumps:
        F += a * np.exp(-(((xs - cx) ** 2 + (ys - cy) ** 2) / (2 * s * s)))
    F += 0.16 * np.sin(xs * 5.1 + 0.7) * np.cos(ys * 4.3 - 0.4)
    return F

# ================================================================ 1. HERO
def hero():
    W, H = 1800, 1200
    img, dr = canvas(W, H)
    m = 90                      # поле чертежа
    x0, y0, x1, y1 = m, m, W - m, H - m

    # --- фоновая координатная сетка
    for gx in range(x0, x1 + 1, 48):
        dr.line([L(gx), L(y0), L(gx), L(y1)], fill=FAINT, width=SS)
    for gy in range(y0, y1 + 1, 48):
        dr.line([L(x0), L(gy), L(x1), L(gy)], fill=FAINT, width=SS)
    # крестики на каждом четвёртом пересечении
    for gx in range(x0, x1 + 1, 192):
        for gy in range(y0, y1 + 1, 192):
            cross(dr, gx, gy, 4, FAINT2)

    # --- изолинии скалярного поля (график «плотности автоматизации»)
    F = field(200, 134, [
        (0.24, 0.30, 0.19, 1.00),
        (0.66, 0.62, 0.23, 0.85),
        (0.82, 0.20, 0.13, 0.55),
        (0.14, 0.80, 0.15, 0.60),
        (0.50, 0.45, 0.30, -0.35),
    ], seed=3)
    levels = np.linspace(F.min() + 0.12, F.max() - 0.06, 13)
    draw_isolines(dr, F, levels, (x0, y0, x1, y1), (214, 204, 190))
    # две ключевые изолинии — чернилами и кобальтом
    draw_isolines(dr, F, [levels[7]], (x0, y0, x1, y1), (122, 115, 105))
    draw_isolines(dr, F, [levels[9]], (x0, y0, x1, y1), COBALT)

    # --- траектории данных: стримлайны поперёк градиента
    gy_, gx_ = np.gradient(F)
    hF, wF = F.shape
    def vel(px, py):
        j = min(max((px - x0) / (x1 - x0) * (wF - 1), 0), wF - 1.001)
        i = min(max((py - y0) / (y1 - y0) * (hF - 1), 0), hF - 1.001)
        i0, j0 = int(i), int(j)
        vx = -gy_[i0, j0]
        vy = gx_[i0, j0]
        n = math.hypot(vx, vy) + 1e-9
        return vx / n, vy / n
    rng = np.random.default_rng(11)
    for _ in range(26):
        px = rng.uniform(x0 + 40, x1 - 40)
        py = rng.uniform(y0 + 40, y1 - 40)
        pts = [(px, py)]
        for _s in range(90):
            vx, vy = vel(px, py)
            mx, my = px + vx * 3.4, py + vy * 3.4
            vx2, vy2 = vel(mx, my)
            px, py = px + vx2 * 6.8, py + vy2 * 6.8
            if not (x0 + 14 < px < x1 - 14 and y0 + 14 < py < y1 - 14):
                break
            pts.append((px, py))
        if len(pts) > 12:
            dotted(dr, pts, (190, 180, 165), r=0.9, step=8.5)

    # --- сетка узлов: агентная топология
    rng = np.random.default_rng(7)
    cols = [x0 + 150 + k * 240 for k in range(7)]
    rows = [y0 + 140 + k * 220 for k in range(5)]
    nodes = []
    for i, ry in enumerate(rows):
        for j, cx in enumerate(cols):
            if rng.random() < 0.44:
                nodes.append((cx + rng.uniform(-55, 55), ry + rng.uniform(-48, 48)))
    # рёбра к ближайшим соседям
    edges = set()
    for a, (ax, ay) in enumerate(nodes):
        d = sorted(range(len(nodes)),
                   key=lambda b: (nodes[b][0] - ax) ** 2 + (nodes[b][1] - ay) ** 2)
        for b in d[1:3]:
            edges.add((min(a, b), max(a, b)))
    f9 = mono(15)
    cobalt_edges = set(list(sorted(edges))[::7])
    for (a, b) in sorted(edges):
        pa, pb = nodes[a], nodes[b]
        midx = (pa[0] + pb[0]) / 2 + rng.uniform(-34, 34)
        midy = (pa[1] + pb[1]) / 2 + rng.uniform(-34, 34)
        pts = qcurve(pa, (midx, midy), pb)
        if (a, b) in cobalt_edges:
            polyline(dr, pts, COBALT, width=1)
            arrow_head(dr, pts[-6], pts[-1], COBALT, size=6)
        else:
            polyline(dr, pts, (112, 105, 96), width=1)
    hub = max(range(len(nodes)),
              key=lambda a: sum(1 for e in edges if a in e))
    for idx, (nx, ny) in enumerate(nodes):
        deg = sum(1 for e in edges if idx in e)
        if idx == hub:
            node(dr, nx, ny, 13, COBALT, width=2)
            node(dr, nx, ny, 5, COBALT, fill=COBALT)
            dr.text((L(nx + 18), L(ny - 26)), "A-00", font=mono5(15), fill=COBALT)
        elif deg >= 3:
            node(dr, nx, ny, 8, INK, width=2)
            node(dr, nx, ny, 2.6, INK, fill=INK)
        else:
            node(dr, nx, ny, 5, INK, width=1)
        if idx % 5 == 2 and idx != hub:
            dr.text((L(nx + 11), L(ny + 7)), f"n-{idx:02d}", font=f9, fill=GRAY)

    # --- рамка и линейки
    dr.rectangle([L(x0), L(y0), L(x1), L(y1)], outline=INK, width=SS)
    ruler(dr, x0, y1 + 14, x1, y1 + 14, GRAY, step=24, label_font=mono(13),
          label_color=GRAY, side="bottom")
    ruler(dr, x0 - 14, y0, x0 - 14, y1, GRAY, step=24, label_font=None, side="left")
    for (cx, cy) in [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]:
        cross(dr, cx, cy, 10, INK)

    # --- служебные подписи
    dr.text((L(x0), L(y0 - 44)), "BETALINE // ТОПОЛОГИЯ АГЕНТНОЙ СИСТЕМЫ",
            font=mono5(17), fill=INK)
    t = "РИС. 01 · ПОЛЕ ПЛОТНОСТИ ЗАДАЧ · N=40"
    tw = dr.textlength(t, font=mono(14)) / SS
    dr.text((L(x1 - tw), L(y0 - 40)), t, font=mono(14), fill=GRAY)
    dr.text((L(x0), L(y1 + 40)), "ИЗОЛИНИИ: ШАГ 0.08 · ТРАЕКТОРИИ ДАННЫХ ОТМЕЧЕНЫ ПУНКТИРОМ",
            font=mono(13), fill=GRAY)
    t2 = "МАСШТАБ 1:1"
    tw2 = dr.textlength(t2, font=mono(13)) / SS
    dr.text((L(x1 - tw2), L(y1 + 40)), t2, font=mono(13), fill=GRAY)

    save(img, "/home/user/betaline-ai-2/assets/hero-diagram.png", W, H)

# ================================================================ 2. PROCESS BAND
def process_band():
    W, H = 2200, 700
    img, dr = canvas(W, H)
    m = 70
    x0, y0, x1, y1 = m, m, W - m, H - m
    midy = (y0 + y1) / 2 + 30

    # фоновая сетка
    for gx in range(x0, x1 + 1, 44):
        dr.line([L(gx), L(y0), L(gx), L(y1)], fill=FAINT, width=SS)
    for gy in range(y0, y1 + 1, 44):
        dr.line([L(x0), L(gy), L(x1), L(gy)], fill=FAINT, width=SS)

    # четыре станции
    stations = [x0 + (x1 - x0) * t for t in (0.09, 0.34, 0.62, 0.91)]
    names = ["АУДИТ", "ПРОЕКТИРОВАНИЕ", "РАЗРАБОТКА", "ЗАПУСК"]
    weeks = ["1–2 НЕД", "2–3 НЕД", "4–12 НЕД", "1–2 НЕД + SLA"]

    # огибающая «объём работ»: колокол с пиком на разработке
    rng = np.random.default_rng(5)
    xs = np.linspace(x0, x1, 260)
    env = (28 + 150 * np.exp(-((xs - stations[2]) / 340.0) ** 2)
           + 60 * np.exp(-((xs - stations[1]) / 260.0) ** 2))
    upper = [(x, midy - e) for x, e in zip(xs, env)]
    lower = [(x, midy + e * 0.42) for x, e in zip(xs, env)]
    polyline(dr, upper, (158, 148, 134), width=1)
    polyline(dr, lower, (214, 204, 190), width=1)
    # вертикальная штриховка между огибающими — гравюра
    for x in range(int(x0) + 8, int(x1) - 6, 13):
        i = int((x - x0) / (x1 - x0) * 259)
        e = env[i]
        dr.line([L(x), L(midy - e + 5), L(x), L(midy + e * 0.42 - 5)],
                fill=(242, 233, 219), width=SS)

    # главная траектория: восходящая лестница с плато на станциях
    main = []
    for k, sx in enumerate(stations):
        yy = midy + 46 - k * 34
        if k == 0:
            main.append((x0 + 6, midy + 96))
        main.append((sx - 46, yy))
        main.append((sx + 46, yy))
    main.append((x1 - 6, midy + 46 - 3 * 34 - 34))
    # сгладить через квадратичные сегменты
    smooth = [main[0]]
    for k in range(1, len(main) - 1):
        smooth.extend(qcurve(
            ((main[k - 1][0] + main[k][0]) / 2, (main[k - 1][1] + main[k][1]) / 2),
            main[k],
            ((main[k][0] + main[k + 1][0]) / 2, (main[k][1] + main[k + 1][1]) / 2),
            n=16))
    smooth.append(main[-1])
    polyline(dr, smooth, INK, width=2)
    arrow_head(dr, smooth[-4], smooth[-1], INK, size=8)

    # пунктирная ветка обратной связи (кобальт)
    fb = qcurve((stations[3] - 8, midy + 26), ((stations[1] + stations[3]) / 2, midy + 128),
                (stations[1] + 8, midy + 66), n=40)
    dotted(dr, fb, COBALT, r=1.5, step=9)
    arrow_head(dr, fb[4], fb[0], COBALT, size=7)
    lbl = "ОБРАТНАЯ СВЯЗЬ / ИТЕРАЦИИ"
    f_lbl = mono(14)
    tw = dr.textlength(lbl, font=f_lbl) / SS
    lx = (stations[1] + stations[3]) / 2 - tw / 2
    ly = midy + 96
    dr.rectangle([L(lx - 8), L(ly - 4), L(lx + tw + 8), L(ly + 20)], fill=BG)
    dr.text((L(lx), L(ly)), lbl, font=f_lbl, fill=COBALT)

    # станции: вертикаль, узел, подписи
    f_name = mono5(19)
    f_meta = mono(14)
    for k, sx in enumerate(stations):
        yy = midy + 46 - k * 34
        dr.line([L(sx), L(y0 + 26), L(sx), L(y1 - 24)], fill=FAINT2, width=SS)
        col = COBALT if k == 2 else INK
        node(dr, sx, yy, 11, col, width=2)
        node(dr, sx, yy, 3.6, col, fill=col)
        dr.text((L(sx - 14), L(y0 - 6)), f"0{k+1}", font=mono5(26), fill=col)
        nm_w = dr.textlength(names[k], font=f_name) / SS
        dr.text((L(sx - nm_w / 2), L(y1 - 66)), names[k], font=f_name, fill=INK)
        wk_w = dr.textlength(weeks[k], font=f_meta) / SS
        dr.text((L(sx - wk_w / 2), L(y1 - 38)), weeks[k], font=f_meta, fill=GRAY)
        # маленькие тики событий вокруг станции
        for t in range(-2, 3):
            ex = sx + t * 17
            dr.line([L(ex), L(yy + 22), L(ex), L(yy + 22 + (8 if t == 0 else 5))],
                    fill=GRAY, width=SS)

    # рамка + углы
    dr.rectangle([L(x0), L(y0), L(x1), L(y1)], outline=INK, width=SS)
    for (cx, cy) in [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]:
        cross(dr, cx, cy, 9, INK)
    ruler(dr, x0, y1 + 13, x1, y1 + 13, GRAY, step=22, side="bottom")

    dr.text((L(x0), L(y0 - 44)), "РИС. 02 · ТРАЕКТОРИЯ ВНЕДРЕНИЯ",
            font=mono5(17), fill=INK)
    t2 = "ОГИБАЮЩАЯ — ОБЪЁМ РАБОТ, НЕД."
    tw2 = dr.textlength(t2, font=mono(14)) / SS
    dr.text((L(x1 - tw2), L(y0 - 40)), t2, font=mono(14), fill=GRAY)

    save(img, "/home/user/betaline-ai-2/assets/process-band.png", W, H)

# ================================================================ 3. FIELD STUDY (кейсы)
def field_study():
    W, H = 1400, 1000
    img, dr = canvas(W, H)
    m = 80
    x0, y0, x1, y1 = m, m, W - m, H - m

    for gx in range(x0, x1 + 1, 40):
        dr.line([L(gx), L(y0), L(gx), L(y1)], fill=FAINT, width=SS)
    for gy in range(y0, y1 + 1, 40):
        dr.line([L(x0), L(gy), L(x1), L(gy)], fill=FAINT, width=SS)

    F = field(170, 122, [
        (0.30, 0.62, 0.22, 1.0),
        (0.72, 0.30, 0.20, 0.9),
        (0.55, 0.78, 0.14, -0.45),
    ], seed=9)
    levels = np.linspace(F.min() + 0.10, F.max() - 0.05, 15)
    draw_isolines(dr, F, levels, (x0, y0, x1, y1), (216, 206, 192))
    draw_isolines(dr, F, [levels[10]], (x0, y0, x1, y1), (122, 115, 105))
    draw_isolines(dr, F, [levels[12]], (x0, y0, x1, y1), COBALT)

    # плотность точек-наблюдений пропорциональна полю
    rng = np.random.default_rng(21)
    hF, wF = F.shape
    Fn = (F - F.min()) / (F.max() - F.min())
    for _ in range(3400):
        px = rng.uniform(0, 1)
        py = rng.uniform(0, 1)
        v = Fn[int(py * (hF - 1)), int(px * (wF - 1))]
        if rng.random() < v ** 2.2:
            x = x0 + px * (x1 - x0)
            y = y0 + py * (y1 - y0)
            r = 0.9 + 0.9 * v
            dr.ellipse([L(x - r), L(y - r), L(x + r), L(y + r)], fill=(96, 90, 82))

    # измерительные кресты и отметки
    marks = [(0.30, 0.62, "M-1 · +34% SQL"), (0.72, 0.30, "M-2 · 11→2 МИН"),
             (0.20, 0.20, "M-3 · 18 000 ДОК/МЕС")]
    f_mark = mono5(16)
    for (mx, my, txt) in marks:
        x = x0 + mx * (x1 - x0)
        y = y0 + my * (y1 - y0)
        cross(dr, x, y, 14, COBALT, width=2)
        node(dr, x, y, 6, COBALT, width=2)
        tw = dr.textlength(txt, font=f_mark) / SS
        dr.rectangle([L(x + 14), L(y - 13), L(x + 26 + tw), L(y + 11)], fill=BG, outline=FAINT2, width=SS)
        dr.text((L(x + 20), L(y - 8)), txt, font=f_mark, fill=INK)

    dr.rectangle([L(x0), L(y0), L(x1), L(y1)], outline=INK, width=SS)
    for (cx, cy) in [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]:
        cross(dr, cx, cy, 9, INK)
    ruler(dr, x0, y1 + 13, x1, y1 + 13, GRAY, step=20, side="bottom")
    ruler(dr, x0 - 13, y0, x0 - 13, y1, GRAY, step=20, side="left")

    dr.text((L(x0), L(y0 - 42)), "РИС. 03 · КАРТА ИЗМЕРЕННЫХ ЭФФЕКТОВ",
            font=mono5(16), fill=INK)
    t2 = "ПЛОТНОСТЬ = НАБЛЮДЕНИЯ"
    tw2 = dr.textlength(t2, font=mono(13)) / SS
    dr.text((L(x1 - tw2), L(y0 - 38)), t2, font=mono(13), fill=GRAY)

    save(img, "/home/user/betaline-ai-2/assets/field-study.png", W, H)

if __name__ == "__main__":
    hero()
    process_band()
    field_study()
