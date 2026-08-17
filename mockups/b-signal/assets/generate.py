#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Betaline AI — «Сигнал» (Night Telemetry)
Генерация визуализаций потоков данных: мята/янтарь на угольном.
  hero-flow.png    1800x1200  — поле потоков: тысячи трасс частиц + волновые формы
  panel-modules.png 1800x640  — растровая карта повторяющихся модулей (процесс)
Каждый PNG < 500KB (palette-квантизация).
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

RNG = np.random.default_rng(7)

CHAR = np.array([10, 12, 11], dtype=float)          # #0A0C0B угольный
MINT = np.array([61, 255, 176], dtype=float)        # #3DFFB0 фосфорная мята
AMBER = np.array([255, 180, 84], dtype=float)       # #FFB454 янтарь
GRAPHITE = np.array([38, 44, 41], dtype=float)


def base_canvas(w, h, grid=60):
    """Угольное поле + координатная сетка + лёгкое неравномерное свечение."""
    img = np.zeros((h, w, 3), dtype=float)
    img[:] = CHAR
    # мягкий вертикальный градиент глубины
    grad = np.linspace(1.0, 0.82, h)[:, None, None]
    img *= grad
    # координатная сетка
    for x in range(0, w, grid):
        k = 2.2 if (x // grid) % 5 == 0 else 1.0
        img[:, x:x + 1] += GRAPHITE * 0.16 * k
    for y in range(0, h, grid):
        k = 2.2 if (y // grid) % 5 == 0 else 1.0
        img[y:y + 1, :] += GRAPHITE * 0.16 * k
    # крестики на пересечениях главных линий
    for x in range(0, w, grid * 5):
        for y in range(0, h, grid * 5):
            img[max(0, y - 4):y + 5, x:x + 1] += GRAPHITE * 0.9
            img[y:y + 1, max(0, x - 4):x + 5] += GRAPHITE * 0.9
    return img


def splat(acc, xs, ys, val):
    """Аддитивное накопление точек в float-буфер."""
    h, w = acc.shape
    m = (xs >= 0) & (xs < w) & (ys >= 0) & (ys < h)
    np.add.at(acc, (ys[m].astype(int), xs[m].astype(int)), val if np.isscalar(val) else val[m])


def flow_angle(x, y, w, h):
    """Гладкое векторное поле — сумма синусоид, ламинарный дрейф слева направо."""
    u, v = x / w, y / h
    a = (0.9 * np.sin(2.1 * np.pi * v + 1.3)
         + 0.55 * np.sin(4.7 * u + 3.1 * v + 0.7)
         + 0.35 * np.sin(9.0 * u * v + 2.0)
         + 0.22 * np.sin(13.0 * v - 5.0 * u))
    return a * 0.55  # угол вокруг горизонтали


def trace_field(w, h, n_particles, steps, speed=2.0):
    acc = np.zeros((h, w), dtype=float)
    xs = RNG.uniform(-w * 0.1, w * 0.55, n_particles)
    ys = h * 0.5 + RNG.normal(0, h * 0.23, n_particles)
    inten = RNG.uniform(0.5, 1.6, n_particles) ** 2
    for _ in range(steps):
        a = flow_angle(xs, ys, w, h)
        xs = xs + np.cos(a) * speed
        ys = ys + np.sin(a) * speed
        splat(acc, xs, ys, inten * 0.05)
    return acc


def glow_layer(acc, blur_small, blur_big, k_core=1.0, k_glow=0.55):
    """Ядро + два уровня свечения (осциллограф, не неон)."""
    im = Image.fromarray(np.clip(acc * 255, 0, 255).astype(np.uint8))
    core = np.asarray(im, dtype=float) / 255.0 * k_core
    g1 = np.asarray(im.filter(ImageFilter.GaussianBlur(blur_small)), dtype=float) / 255.0
    g2 = np.asarray(im.filter(ImageFilter.GaussianBlur(blur_big)), dtype=float) / 255.0
    return core + (g1 * 0.7 + g2 * 0.45) * k_glow


def waveform(w, h, y0, amp, freqs, thickness=1.1):
    """Осциллографическая трасса."""
    acc = np.zeros((h, w), dtype=float)
    x = np.arange(0, w, 0.25)
    y = np.zeros_like(x)
    for f, a, p in freqs:
        y += a * np.sin(2 * np.pi * f * x / w + p)
    env = np.exp(-((x - w * 0.5) / (w * 0.42)) ** 4)  # затухание к краям
    y = y0 + y * amp * env
    for dy in np.linspace(-thickness, thickness, 5):
        splat(acc, x, y + dy, 0.16)
    return acc


def save_png(arr, path, colors=160, dither=Image.FLOYDSTEINBERG,
             pre_blur=0.0, out_width=None):
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    if pre_blur:
        img = img.filter(ImageFilter.GaussianBlur(pre_blur))
    if out_width and out_width < img.width:
        img = img.resize((out_width, round(img.height * out_width / img.width)),
                         Image.LANCZOS)
    q = img.quantize(colors=colors, method=Image.MEDIANCUT, dither=dither)
    q.save(path, optimize=True)
    print(path, "->", round(len(open(path, 'rb').read()) / 1024), "KB")


# ----------------------------------------------------------------------------
# 1. HERO — «поток данных»: трассы частиц в трубопроводе + волновые формы
# ----------------------------------------------------------------------------
def hero(path, w=1800, h=1200):
    img = base_canvas(w, h)

    # основное мятное поле потока — терпеливые тысячи трасс
    acc_m = trace_field(w, h, n_particles=5200, steps=340, speed=2.1)
    acc_m += trace_field(w, h, n_particles=1600, steps=520, speed=1.4) * 0.7
    mint_l = glow_layer(acc_m, 2, 10, k_core=1.0, k_glow=0.6)
    mint_l = mint_l / (1.0 + 0.75 * mint_l) * 1.55   # Reinhard: мягкие света без плоского ядра
    img += mint_l[..., None] * MINT * 0.95

    # редкие янтарные «события» — отдельные длинные нити
    acc_a = trace_field(w, h, n_particles=110, steps=760, speed=2.4)
    amber_l = glow_layer(acc_a, 2, 12, k_core=1.4, k_glow=0.8)
    img += amber_l[..., None] * AMBER * 1.1

    # две волновые формы — верх и низ, как каналы осциллографа
    wf1 = waveform(w, h, y0=h * 0.16, amp=34,
                   freqs=[(9, 1.0, 0.3), (23, 0.42, 1.9), (47, 0.18, 4.1)])
    wf2 = waveform(w, h, y0=h * 0.865, amp=26,
                   freqs=[(13, 1.0, 2.2), (31, 0.36, 0.4), (67, 0.14, 3.3)])
    img += glow_layer(wf1, 1.5, 7)[..., None] * MINT * 0.75
    img += glow_layer(wf2, 1.5, 7)[..., None] * MINT * 0.55

    # растровая карта: рой точек-отсчётов с плотностью по полю
    n = 15000
    px = RNG.uniform(0, w, n)
    py = RNG.uniform(0, h, n)
    d = np.abs(flow_angle(px, py, w, h))
    keep = d < RNG.uniform(0.12, 0.55, n)
    acc_dots = np.zeros((h, w), dtype=float)
    splat(acc_dots, px[keep], py[keep], 0.5)
    img += glow_layer(acc_dots, 0.8, 4, k_glow=0.35)[..., None] * MINT * 0.35

    # тонкие служебные метки-тики по левому краю
    d_im = Image.new('RGB', (w, h), (0, 0, 0))
    dr = ImageDraw.Draw(d_im)
    for y in range(60, h - 60, 30):
        L = 14 if (y // 30) % 5 == 0 else 7
        dr.line([(28, y), (28 + L, y)], fill=(40, 120, 88), width=1)
        dr.line([(w - 28 - L, y), (w - 28, y)], fill=(40, 120, 88), width=1)
    img += np.asarray(d_im, dtype=float) * 0.9

    # виньетка
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    img *= (1.0 - 0.28 * np.clip(r - 0.55, 0, 1) ** 2)[..., None]

    save_png(img, path, colors=96, dither=Image.NONE, pre_blur=1.5, out_width=1440)


# ----------------------------------------------------------------------------
# 2. PANEL — повторяющиеся модули: растровая карта тысяч ячеек (для процесса)
# ----------------------------------------------------------------------------
def panel(path, w=1800, h=640):
    img = base_canvas(w, h, grid=40)
    cell = 20
    cols, rows = w // cell, h // cell
    acc_m = np.zeros((h, w), dtype=float)
    acc_a = np.zeros((h, w), dtype=float)

    # плотность модулей — четыре «волны активности» слева направо (4 этапа)
    centers = [0.14, 0.4, 0.64, 0.88]
    for cy in range(1, rows - 1):
        for cx in range(1, cols - 1):
            u = cx / cols
            v = cy / rows
            wave = sum(np.exp(-((u - c) / 0.085) ** 2) for c in centers)
            act = wave * (0.35 + 0.65 * np.sin(np.pi * v) ** 1.5)
            act *= 0.55 + 0.45 * np.sin(23 * u + 11 * v + 3 * np.sin(7 * u))
            if RNG.random() < act * 0.85:
                x0, y0 = cx * cell + 3, cy * cell + 3
                s = cell - 7
                lvl = np.clip(act * RNG.uniform(0.5, 1.3), 0.06, 1.0)
                is_amber = RNG.random() < 0.035
                tgt = acc_a if is_amber else acc_m
                # модуль: рамка-скоба + внутренняя точка/бар
                kind = RNG.integers(0, 4)
                if kind == 0:      # заполненный бар
                    bh = max(2, int(s * lvl))
                    tgt[y0 + s - bh:y0 + s, x0:x0 + s] += lvl * 0.5
                elif kind == 1:    # точка в центре
                    tgt[y0 + s // 2 - 1:y0 + s // 2 + 2, x0 + s // 2 - 1:x0 + s // 2 + 2] += lvl * 1.2
                elif kind == 2:    # контур
                    tgt[y0:y0 + 1, x0:x0 + s] += lvl * 0.8
                    tgt[y0 + s:y0 + s + 1, x0:x0 + s] += lvl * 0.8
                    tgt[y0:y0 + s, x0:x0 + 1] += lvl * 0.8
                    tgt[y0:y0 + s, x0 + s:x0 + s + 1] += lvl * 0.8
                else:              # двойной штрих
                    tgt[y0 + 2:y0 + 4, x0:x0 + s] += lvl * 0.7
                    tgt[y0 + s - 4:y0 + s - 2, x0:x0 + s] += lvl * 0.7

    img += glow_layer(acc_m, 1.2, 8, k_glow=0.5)[..., None] * MINT * 0.85
    img += glow_layer(acc_a, 1.5, 9, k_glow=0.7)[..., None] * AMBER * 0.9

    # сканирующая волна поверх
    wf = waveform(w, h, y0=h * 0.5, amp=h * 0.3,
                  freqs=[(4, 1.0, 0.8), (11, 0.3, 2.6)], thickness=0.9)
    img += glow_layer(wf, 1.5, 8)[..., None] * MINT * 0.4

    # горизонтальная затемняющая рамка сверху/снизу
    fade = np.ones(h)
    fade[:40] = np.linspace(0.55, 1, 40)
    fade[-40:] = np.linspace(1, 0.55, 40)
    img *= fade[:, None, None]

    save_png(img, path, colors=160)


# ----------------------------------------------------------------------------
# 3. WAVE STRIP — узкая осциллограмма для CTA-блока
# ----------------------------------------------------------------------------
def wave_strip(path, w=1800, h=360):
    img = base_canvas(w, h, grid=30)
    acc = np.zeros((h, w), dtype=float)
    # пучок волн с фазовым сдвигом — «эфир» из многих каналов
    for i in range(28):
        p = i / 27
        y0 = h * (0.2 + 0.6 * p)
        a = 10 + 26 * np.sin(np.pi * p)
        acc += waveform(w, h, y0=y0, amp=a,
                        freqs=[(6 + i * 0.7, 1.0, i * 0.9),
                               (19 + i, 0.3, i * 1.7)], thickness=0.7) * 0.5
    img += glow_layer(acc, 1.2, 7, k_glow=0.5)[..., None] * MINT * 0.8
    # одна янтарная несущая
    acc_a = waveform(w, h, y0=h * 0.5, amp=44,
                     freqs=[(3.5, 1.0, 1.1), (9, 0.4, 0.2)], thickness=1.2)
    img += glow_layer(acc_a, 1.5, 9, k_glow=0.8)[..., None] * AMBER * 0.85
    fade = np.ones(h)
    fade[:30] = np.linspace(0.4, 1, 30)
    fade[-30:] = np.linspace(1, 0.4, 30)
    img *= fade[:, None, None]
    save_png(img, path, colors=144)


if __name__ == '__main__':
    import os
    d = os.path.dirname(os.path.abspath(__file__))
    hero(os.path.join(d, 'hero-flow.png'))
    panel(os.path.join(d, 'panel-modules.png'))
    wave_strip(os.path.join(d, 'wave-strip.png'))
