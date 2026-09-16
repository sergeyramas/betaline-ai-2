/* ecosystem.js v1.1.0 — связка сайтов Betaline.
 * Один файл, копируется как есть в каждый репо (источник — betaline-ai-2).
 * Подключение: <script src="/ecosystem.js" defer data-site="custom|custom2|voice|main"></script>
 * Сайт с fixed-шапкой добавляет у себя: .шапка{top:var(--eco-h,0)} и scroll-padding-top += 36px.
 * Если внизу на мобильном есть свой sticky-элемент: html{--eco-back-bottom:84px} в его media query.
 * Десктоп-кнопка стоит под шапкой сайта: html{--eco-back-top:<высота шапки + 12px>} (дефолт 78px).
 *
 * Элемент 1 — оранжевая полоска продуктов (все сайты), закреплена сверху, не прячется (решение оператора 16.09).
 * Элемент 2 — кнопка «← Вернуться к индивидуальным решениям» (voice|main), только если
 *   пришли с custom/custom2 (?from=). Появляется после 200px и только когда прокрутка остановилась.
 */
(function () {
  'use strict';
  var me = document.currentScript;
  var SITE = (me && me.getAttribute('data-site')) || 'main';
  var SITES = {
    main:    { name: 'AI-ассистент для сайта', url: 'https://betaline-ai.ru/' },
    voice:   { name: 'Голосовой агент',        url: 'https://zvonok.betaline-ai.ru/' },
    custom2: { name: 'Индивидуальные решения', url: 'https://custom2.betaline-ai.ru/' }
  };
  var FROM_OK = { custom: 1, custom2: 1 };
  var H = 36, BACK_MIN = 200, IDLE = 700;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var css =
    'html{--eco-h:' + H + 'px}body{padding-top:var(--eco-h)!important}' + // !important: стили сайтов в <body> идут позже
    '.eco{position:fixed;top:0;left:0;right:0;height:var(--eco-h);z-index:60;background:#e8541e;color:#fff;' +
    'font:500 13px/1 Golos Text,-apple-system,Segoe UI,sans-serif;display:flex;align-items:center;gap:22px;padding:0 24px;' +
    'overflow-x:auto;white-space:nowrap;scrollbar-width:none}' +
    '.eco::-webkit-scrollbar{display:none}' +
    '.eco b{font-weight:700;margin-right:6px}' +
    '.eco a{color:#fff;text-decoration:none;opacity:.88;padding:10px 0;border-bottom:1.5px solid transparent}' +
    '.eco a:hover{opacity:1}.eco a:focus-visible{outline:2px solid #fff;outline-offset:2px;opacity:1}' +
    '.eco a[aria-current]{opacity:1;border-bottom-color:#fff}' +
    '.eco-back{position:fixed;z-index:60;top:calc(var(--eco-h) + var(--eco-back-top,78px));left:16px;display:inline-flex;align-items:center;gap:6px;' +
    'background:#e8541e;border:0;color:#fff;padding:13px 24px;border-radius:999px;font:600 15px/1 Golos Text,-apple-system,Segoe UI,sans-serif;' +
    'text-decoration:none;box-shadow:0 0 0 0 rgba(232,84,30,.55),0 6px 28px rgba(232,84,30,.45);opacity:0;transform:translateY(-8px);pointer-events:none;transition:opacity .3s,transform .3s}' +
    '.eco-back.on{animation:ecoPulse 2.4s ease-in-out infinite}' +
    '@keyframes ecoPulse{0%,100%{box-shadow:0 0 0 0 rgba(232,84,30,.55),0 6px 28px rgba(232,84,30,.45)}50%{box-shadow:0 0 0 10px rgba(232,84,30,0),0 6px 36px rgba(232,84,30,.7)}}' +
    '.eco-back.on{opacity:1;transform:none;pointer-events:auto}' +
    '.eco-back:focus-visible{outline:2px solid #fff;outline-offset:3px}' +
    '.eco-back .m{display:none}' +
    '@media(max-width:719px){' +
    '.eco{gap:16px;padding:0 14px;font-size:12px}.eco b{display:none}' +
    '.eco-back{top:auto;left:12px;bottom:calc(var(--eco-back-bottom,12px) + env(safe-area-inset-bottom));white-space:nowrap;padding:12px 18px;transform:translateY(8px)}' +
    '.eco-back .d{display:none}.eco-back .m{display:inline}}' +
    '@media(prefers-reduced-motion:reduce){.eco-back{transition:none;animation:none}}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  // ---- полоска
  var bar = document.createElement('nav');
  bar.className = 'eco';
  bar.setAttribute('aria-label', 'Продукты Betaline');
  var html = '<b>Betaline</b>';
  Object.keys(SITES).forEach(function (k) {
    var s = SITES[k];
    var active = (k === SITE) || (k === 'custom2' && SITE === 'custom');
    var href = active ? '/' : s.url + '?utm_source=' + SITE + '&utm_medium=ecosystem';
    html += '<a href="' + href + '"' + (active ? ' aria-current="page"' : '') + '>' + s.name + '</a>';
  });
  bar.innerHTML = html;
  document.body.appendChild(bar);

  // ---- кнопка «назад»
  var back = null;
  if (SITE === 'voice' || SITE === 'main') {
    var from = null;
    try {
      from = new URLSearchParams(location.search).get('from');
      if (from && FROM_OK[from]) sessionStorage.setItem('eco_from', from);
      else from = sessionStorage.getItem('eco_from');
    } catch (e) {}
    if (from && FROM_OK[from]) {
      back = document.createElement('a');
      back.className = 'eco-back';
      back.href = 'https://' + from + '.betaline-ai.ru/#services';
      back.innerHTML = '<span aria-hidden="true">&larr;</span><span class="d">Вернуться к индивидуальным решениям</span><span class="m">К решениям</span>';
      back.setAttribute('aria-label', 'Вернуться к индивидуальным решениям');
      document.body.appendChild(back);
    }
  }

  // ---- поведение кнопки: один passive scroll + rAF + idle-таймер; полоска статична
  if (!back) return;
  var ticking = false, idleT = 0;
  function apply(scrolling) {
    var y = window.pageYOffset;
    back.classList.toggle('on', y >= BACK_MIN && (reduce || !scrolling || back.contains(document.activeElement)));
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; apply(true); }); }
    clearTimeout(idleT);
    idleT = setTimeout(function () { apply(false); }, IDLE);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  apply(false);
})();
