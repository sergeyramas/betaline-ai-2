/* ════════════════════════════════════════════════════════════
   BETALINE AI — LANDING V3 — main.js
   Вся клиентская логика: навбар, reveal, квиз, аудит, callback,
   plan-модалка, модалки политики/оферты, чат-виджет, CallbackFire,
   цели Метрики. Vanilla JS, без зависимостей.
   Каждый блок защищён проверками существования DOM-элементов.
   ════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    /* ─────────────────────────────────────────────
       0. Конфиг и утилиты
       ───────────────────────────────────────────── */
    /* Точное совпадение, не endsWith: поддомены (custom./zvonok.) тоже оканчиваются
       на betaline-ai.ru, но своих env не имеют — их формы должны идти на боевой API. */
    var PROD_HOSTS = ['betaline-ai.ru', 'www.betaline-ai.ru'];
    var API_BASE = PROD_HOSTS.indexOf(location.hostname) !== -1 ? '' : 'https://betaline-ai.ru';
    var YM_ID = 108480715;

    function goal(name, params) {
        if (typeof ym !== 'undefined') ym(YM_ID, 'reachGoal', name, params || {});
    }

    function $(id) { return document.getElementById(id); }

    function postLead(payload) {
        return fetch(API_BASE + '/api/lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    }

    /* Единая валидация телефона: очистка от не-цифр, минимум 10 цифр */
    function phoneDigits(v) { return String(v || '').replace(/\D/g, ''); }
    function isValidPhone(v) { return phoneDigits(v).length >= 10; }

    /* Инлайн-подсказка у поля вместо alert() */
    function showFieldError(input, msg) {
        if (!input) return;
        input.classList.add('err');
        var parent = input.parentNode;
        var hint = parent ? parent.querySelector('.field-hint') : null;
        if (!hint && parent) {
            hint = document.createElement('div');
            hint.className = 'field-hint';
            parent.insertBefore(hint, input.nextSibling);
        }
        if (hint) { hint.textContent = msg; hint.style.display = 'block'; }
        try { input.focus(); } catch (e) { /* noop */ }
        input.addEventListener('input', function () {
            input.classList.remove('err');
            if (hint) hint.style.display = 'none';
        }, { once: true });
    }

    function clearFieldError(input) {
        if (!input) return;
        input.classList.remove('err');
        var hint = input.parentNode ? input.parentNode.querySelector('.field-hint') : null;
        if (hint) hint.style.display = 'none';
    }

    /* Показ/скрытие модалок независимо от того, как их прячет CSS */
    function showEl(el, fallbackDisplay) {
        if (!el) return;
        el.style.display = '';
        el.classList.add('open');
        el.setAttribute('aria-hidden', 'false');
        if (getComputedStyle(el).display === 'none') {
            el.style.display = fallbackDisplay || 'block';
        }
    }
    function hideEl(el) {
        if (!el) return;
        el.classList.remove('open');
        el.setAttribute('aria-hidden', 'true');
        el.style.display = 'none';
    }

    /* Автопрефикс +7 для телефонных полей (порт с боевого) */
    function attachPhonePrefix(input) {
        if (!input) return;
        input.addEventListener('focus', function () {
            if (!this.value) this.value = '+7 ';
        });
        input.addEventListener('input', function () {
            if (this.value && !this.value.startsWith('+')) {
                if (this.value.match(/^[78]/)) {
                    this.value = '+7 ' + this.value.substring(1);
                }
            }
        });
    }

    /* ─────────────────────────────────────────────
       1. Навбар: burger, мобильное меню, Esc
       ───────────────────────────────────────────── */
    (function () {
        var burger = $('burger');
        var nav = $('nav');
        var mmenu = $('mmenu');
        if (burger && nav) {
            burger.addEventListener('click', function () {
                var open = nav.classList.toggle('open');
                burger.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        }
        if (mmenu && nav) {
            mmenu.addEventListener('click', function (e) {
                if (e.target.closest('a')) {
                    nav.classList.remove('open');
                    if (burger) burger.setAttribute('aria-expanded', 'false');
                }
            });
        }
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && nav && nav.classList.contains('open')) {
                nav.classList.remove('open');
                if (burger) burger.setAttribute('aria-expanded', 'false');
            }
        });
        /* Плавный скролл к якорям обеспечивают scroll-behavior:smooth (style.css)
           и scroll-margin-top на section[id] (widgets.css, поправка на шапку 72px). */
    })();

    /* ─────────────────────────────────────────────
       2. Scroll-reveal (.rv → .visible), одноразовый
       ───────────────────────────────────────────── */
    (function () {
        var els = document.querySelectorAll('.rv');
        if (!els.length) return;
        if (!('IntersectionObserver' in window)) {
            els.forEach(function (el) { el.classList.add('visible'); });
            return;
        }
        var obs = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) {
                    en.target.classList.add('visible');
                    obs.unobserve(en.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
        els.forEach(function (el) { obs.observe(el); });
        /* Failsafe: контент не должен остаться невидимым, если IO не сработал
           (печать, якорный прыжок, элементы внутри свёрнутых панелей, боты) */
        window.addEventListener('load', function () {
            setTimeout(function () {
                els.forEach(function (el) { el.classList.add('visible'); });
                obs.disconnect();
            }, 5000);
        });
    })();

    /* ─────────────────────────────────────────────
       3. Цели Метрики: diag_bot_click (делегирование)
       ───────────────────────────────────────────── */
    document.addEventListener('click', function (e) {
        if (e.target.closest('[data-goal="diag_bot_click"]')) {
            goal('diag_bot_click');
        }
    });

    /* ─────────────────────────────────────────────
       4. Pains: «Показать ещё» (#painsMore → .pains-hidden)
       ───────────────────────────────────────────── */
    (function () {
        var btn = $('painsMore');
        if (!btn) return;
        btn.addEventListener('click', function () {
            document.querySelectorAll('.pains-hidden').forEach(function (el) {
                el.classList.add('pains-shown');
                el.classList.remove('pains-hidden');
            });
            btn.style.display = 'none';
            goal('pains_expand');
        });
    })();

    /* ─────────────────────────────────────────────
       5. Квиз (source=quiz) — порт с боевого
       ───────────────────────────────────────────── */
    var currentStep = 1;
    var totalSteps = 4;
    var quizState = {};

    function quizRoot() { return $('quiz') || document; }

    window.selectOpt = function (el, key, priceAdd) {
        var parent = el.closest('.options-grid');
        if (!parent) return;
        parent.querySelectorAll('.opt-card').forEach(function (c) { c.classList.remove('selected'); });
        el.classList.add('selected');

        var titleEl = el.querySelector('.opt-title');
        quizState[key] = { title: titleEl ? titleEl.innerText : '', price: priceAdd || 0 };

        var nextBtn = $('qNextBtn');
        if (nextBtn) nextBtn.disabled = false;
        updateRightPanel();
    };

    function updateRightPanel() {
        var total = 0;
        var validKeys = 0;
        ['niche', 'task', 'platform', 'speed'].forEach(function (key) {
            if (!quizState[key]) return;
            var ci = $('ci-' + key);
            if (ci) {
                ci.classList.add('visible');
                var v = ci.querySelector('.v');
                if (v) v.innerText = quizState[key].title;
            }
            total += quizState[key].price;
            validKeys++;
        });
        if (quizState.speed) {
            var t = '2-4 недели';
            if (quizState.speed.price > 0) t = 'До 7 дней';
            if (quizState.speed.price < 0) t = '1-2 месяца';
            var qTime = $('qTime');
            if (qTime) qTime.innerText = 'Сроки: ' + t;
        }
        var qPrice = $('qPrice');
        if (validKeys > 0 && qPrice) {
            qPrice.innerText = 'от ' + total.toLocaleString('ru-RU') + ' ₽';
            qPrice.style.color = '#1a1a1a';
            setTimeout(function () { qPrice.style.color = '#F97316'; }, 300);
        }
    }

    window.qNext = function () {
        if (currentStep > totalSteps) return;
        var root = quizRoot();
        var cur = root.querySelector('.quiz-step[data-step="' + currentStep + '"]');
        if (!cur) return;
        cur.classList.remove('active');
        currentStep++;
        var next = root.querySelector('.quiz-step[data-step="' + currentStep + '"]');
        if (next) next.classList.add('active');

        var stepNum = $('qStepNum');
        if (stepNum) stepNum.innerText = currentStep <= totalSteps ? currentStep : totalSteps;
        var progress = $('qProgress');
        if (progress) progress.style.width = (Math.min(currentStep, totalSteps) / totalSteps * 100) + '%';

        var prevBtn = root.querySelector('.btn-prev');
        if (prevBtn) prevBtn.style.visibility = 'visible';

        var nextBtn = $('qNextBtn');
        if (currentStep > totalSteps) {
            if (nextBtn) nextBtn.style.display = 'none';
            var bar = root.querySelector('.progress-bar');
            if (bar) bar.style.display = 'none';
            var counter = root.querySelector('.step-counter');
            if (counter) counter.style.display = 'none';
        } else {
            var nextGrid = root.querySelector('.quiz-step[data-step="' + currentStep + '"] .options-grid');
            if (nextBtn) nextBtn.disabled = nextGrid ? !nextGrid.querySelector('.selected') : false;
        }
    };

    window.qPrev = function () {
        if (currentStep <= 1) return;
        var root = quizRoot();
        var cur = root.querySelector('.quiz-step[data-step="' + currentStep + '"]');
        if (cur) cur.classList.remove('active');
        currentStep--;
        var prev = root.querySelector('.quiz-step[data-step="' + currentStep + '"]');
        if (prev) prev.classList.add('active');

        var stepNum = $('qStepNum');
        if (stepNum) stepNum.innerText = currentStep;
        var progress = $('qProgress');
        if (progress) progress.style.width = (currentStep / totalSteps * 100) + '%';

        var nextBtn = $('qNextBtn');
        if (nextBtn) { nextBtn.style.display = 'flex'; nextBtn.disabled = false; }
        var bar = root.querySelector('.progress-bar');
        if (bar) bar.style.display = 'block';
        var counter = root.querySelector('.step-counter');
        if (counter) counter.style.display = 'block';

        if (currentStep === 1) {
            var prevBtn = root.querySelector('.btn-prev');
            if (prevBtn) prevBtn.style.visibility = 'hidden';
        }
    };

    window.submitQuiz = function () {
        var phoneInput = $('qPhone');
        if (!phoneInput) return;
        var phone = phoneInput.value;
        if (!isValidPhone(phone)) {
            showFieldError(phoneInput, 'Введите корректный номер — минимум 10 цифр');
            return;
        }
        clearFieldError(phoneInput);

        var root = quizRoot();
        var btn = root.querySelector('.final-form .btn-submit');
        if (btn) { btn.disabled = true; btn.textContent = 'Отправляем...'; }

        var qPrice = $('qPrice');
        postLead({
            source: 'quiz',
            phone: phone,
            niche: quizState.niche ? quizState.niche.title : '',
            task: quizState.task ? quizState.task.title : '',
            platform: quizState.platform ? quizState.platform.title : '',
            speed: quizState.speed ? quizState.speed.title : '',
            price: qPrice ? qPrice.innerText : ''
        })
        .then(function (r) {
            if (!r.ok) throw new Error('Server error');
            goal('quiz_lead');
            var ff = root.querySelector('.final-form');
            if (ff) {
                ff.innerHTML = '<div class="ff-icon" style="color:#10B981;">✅</div>' +
                    '<h3 class="step-title">Заявка отправлена!</h3>' +
                    '<p class="step-subtitle">Наш инженер изучит ответы и пришлёт точный расчёт. Хорошего дня!</p>';
            }
        })
        .catch(function () {
            if (btn) { btn.disabled = false; btn.textContent = 'Получить расчет →'; }
            showFieldError(phoneInput, 'Не удалось отправить — попробуйте ещё раз или напишите нам в Telegram');
        });
    };

    /* ─────────────────────────────────────────────
       6. Аудит (source=audit): панели, wheel-picker,
          автопрефикс +7, отправка формы
       ───────────────────────────────────────────── */
    var wheelsBuilt = false;
    var WHEEL_ITEM_H = 44;

    window.toggleOpt = function (btn, panelId) {
        var panel = $(panelId);
        if (!panel || !btn) return;
        btn.classList.toggle('open');
        panel.classList.toggle('open');
        /* Ленивая сборка wheel-picker при первом открытии панели даты */
        if (panelId === 'auditDatePanel' && !wheelsBuilt) {
            wheelsBuilt = true;
            setTimeout(buildAuditWheels, 350); /* ждём анимацию панели */
        }
    };

    function buildWheel(scrollEl, items, hiddenEl) {
        if (!scrollEl) return;
        scrollEl.innerHTML = '';
        var padT = document.createElement('div');
        padT.style.height = WHEEL_ITEM_H + 'px';
        scrollEl.appendChild(padT);
        items.forEach(function (item, i) {
            var el = document.createElement('div');
            el.className = 'wheel-item';
            el.textContent = item.label;
            el.dataset.idx = i;
            scrollEl.appendChild(el);
        });
        var padB = document.createElement('div');
        padB.style.height = WHEEL_ITEM_H + 'px';
        scrollEl.appendChild(padB);

        var snapTimer;
        function getIdx() { return Math.round(scrollEl.scrollTop / WHEEL_ITEM_H); }

        function commit(idx) {
            idx = Math.max(0, Math.min(items.length - 1, idx));
            scrollEl.scrollTo({ top: idx * WHEEL_ITEM_H, behavior: 'smooth' });
            scrollEl.querySelectorAll('.wheel-item[data-idx]').forEach(function (el) {
                el.classList.toggle('active', parseInt(el.dataset.idx, 10) === idx);
            });
            if (hiddenEl) hiddenEl.value = items[idx].value;
        }

        scrollEl.addEventListener('scroll', function () {
            var idx = getIdx();
            scrollEl.querySelectorAll('.wheel-item[data-idx]').forEach(function (el) {
                el.classList.toggle('active', parseInt(el.dataset.idx, 10) === idx);
            });
            clearTimeout(snapTimer);
            snapTimer = setTimeout(function () { commit(getIdx()); }, 120);
        });

        scrollEl.addEventListener('click', function (e) {
            var el = e.target.closest('.wheel-item[data-idx]');
            if (el) commit(parseInt(el.dataset.idx, 10));
        });

        commit(0);
    }

    function buildAuditWheels() {
        var dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        var monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

        /* Ближайшие 14 дней */
        var days = [];
        var today = new Date();
        for (var d = 0; d < 14; d++) {
            var dt = new Date(today);
            dt.setDate(today.getDate() + d);
            days.push({
                label: d === 0 ? 'Сегодня' : d === 1 ? 'Завтра' : dayNames[dt.getDay()] + ', ' + dt.getDate() + ' ' + monthNames[dt.getMonth()],
                value: dt.toISOString().split('T')[0]
            });
        }

        /* Слоты 9:00–20:00 */
        var times = [];
        for (var h = 9; h <= 20; h++) times.push({ label: h + ':00', value: h + ':00' });

        buildWheel($('wheelDay'), days, $('auditDateHidden'));
        buildWheel($('wheelTime'), times, $('auditTimeHidden'));

        /* Время по умолчанию 12:00 = index 3 */
        setTimeout(function () {
            var wt = $('wheelTime');
            if (wt) wt.scrollTo({ top: 3 * WHEEL_ITEM_H, behavior: 'smooth' });
        }, 50);
    }

    window.submitAuditForm = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        var form = $('auditForm');
        if (!form) return false;
        var fd = new FormData(form);
        var data = {};
        fd.forEach(function (v, k) { data[k] = v; });

        var phoneInput = $('auditPhone') || form.querySelector('input[name="phone"]');
        if (!isValidPhone(data.phone)) {
            showFieldError(phoneInput, 'Введите корректный номер — минимум 10 цифр');
            return false;
        }
        clearFieldError(phoneInput);

        var btn = form.querySelector('.submit-btn') || form.querySelector('[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Отправляем...'; }

        postLead({
            source: 'audit',
            name: data.name || '',
            phone: data.phone,
            niche: data.niche || '',
            date: data.date || '',
            time: data.time || '',
            task: data.task || ''
        })
        .then(function (r) {
            if (!r.ok) throw new Error('Server error');
            goal('audit_lead');
            form.style.display = 'none';
            var ok = $('auditSuccess');
            if (ok) ok.style.display = 'block';
        })
        .catch(function () {
            if (btn) { btn.disabled = false; btn.textContent = 'Получить разбор бесплатно'; }
            showFieldError(phoneInput, 'Не удалось отправить — попробуйте ещё раз или позвоните: 8 800 200-18-49');
        });

        return false;
    };

    /* Автопрефикс +7 на телефонные поля форм */
    ['auditPhone', 'cbPhone', 'qPhone', 'pmPhone'].forEach(function (id) {
        attachPhonePrefix($(id));
    });

    /* ─────────────────────────────────────────────
       7. Callback (source=callback) + таймер 24 сек
       ───────────────────────────────────────────── */
    var _cbTimerInterval = null;

    function startCbTimer() {
        var el = $('cbTimer');
        if (!el) return;
        var total = 24 * 100; /* 24 секунды в сантисекундах */
        _cbTimerInterval = setInterval(function () {
            total--;
            if (total <= 0) {
                clearInterval(_cbTimerInterval);
                el.textContent = '00:00:00';
                return;
            }
            var secs = Math.floor(total / 100);
            var cs = total % 100;
            el.textContent = '00:' + String(secs).padStart(2, '0') + ':' + String(cs).padStart(2, '0');
        }, 10);
    }

    window.submitCallback = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        var phoneInput = $('cbPhone');
        if (!phoneInput) return false;
        var phone = phoneInput.value;
        if (!isValidPhone(phone)) {
            showFieldError(phoneInput, 'Введите корректный номер — минимум 10 цифр');
            return false;
        }
        clearFieldError(phoneInput);

        var nameInput = $('cbName');
        var form = phoneInput.closest('form');
        var btn = form ? (form.querySelector('.cb-submit') || form.querySelector('[type="submit"]')) : null;
        if (btn) { btn.disabled = true; btn.textContent = 'Отправляем...'; }

        postLead({ source: 'callback', name: nameInput ? nameInput.value.trim() : '', phone: phone })
        .then(function (r) {
            if (!r.ok) throw new Error('err');
            goal('callback_lead');
            if (typeof window.triggerCallbackFire === 'function') window.triggerCallbackFire(phone);
            var wrap = $('cbFormWrap');
            if (wrap) wrap.style.display = 'none';
            else if (form) form.style.display = 'none';
            var ok = $('cbSuccess');
            if (ok) ok.style.display = 'block';
            startCbTimer();
        })
        .catch(function () {
            if (btn) { btn.disabled = false; btn.textContent = 'Позвоните мне!'; }
            showFieldError(phoneInput, 'Не удалось отправить — попробуйте ещё раз или позвоните: 8 800 200-18-49');
        });
        return false;
    };

    /* ─────────────────────────────────────────────
       8. Plan-модалка (source=pricing, + plan)
          Success ТОЛЬКО при res.ok (фикс боевого бага)
       ───────────────────────────────────────────── */
    var currentPlan = '';

    window.openPlanModal = function (planName) {
        var modal = $('planModal');
        if (!modal) return;
        currentPlan = planName || '';
        var title = $('pmPlanName');
        if (title) title.textContent = currentPlan;
        var form = modal.querySelector('form');
        if (form) { form.reset(); form.style.display = ''; }
        var wrap = $('pmFormWrap');
        if (wrap) wrap.style.display = 'block';
        var ok = $('pmSuccess');
        if (ok) ok.style.display = 'none';
        clearFieldError($('pmPhone'));
        showEl(modal, 'flex');
    };

    window.closePlanModal = function () {
        hideEl($('planModal'));
    };

    window.submitPlanModal = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        var modal = $('planModal');
        if (!modal) return false;
        var nameInput = $('pmName');
        var phoneInput = $('pmPhone');
        var phone = phoneInput ? phoneInput.value.trim() : '';
        if (!isValidPhone(phone)) {
            showFieldError(phoneInput, 'Введите корректный номер — минимум 10 цифр');
            return false;
        }
        clearFieldError(phoneInput);

        var btn = modal.querySelector('.pm-submit') || modal.querySelector('[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Отправляем...'; }

        postLead({
            source: 'pricing',
            plan: currentPlan,
            name: nameInput ? nameInput.value.trim() : '',
            phone: phone
        })
        .then(function (r) {
            if (!r.ok) throw new Error('Server error');
            goal('pricing_lead');
            var wrap = $('pmFormWrap');
            if (wrap) wrap.style.display = 'none';
            else {
                var form = modal.querySelector('form');
                if (form) form.style.display = 'none';
            }
            var ok = $('pmSuccess');
            if (ok) ok.style.display = 'block';
            setTimeout(window.closePlanModal, 3500);
        })
        .catch(function () {
            if (btn) { btn.disabled = false; btn.textContent = 'Оставить заявку'; }
            showFieldError(phoneInput, 'Не удалось отправить — позвоните нам: 8 800 200-18-49');
        });
        return false;
    };

    /* Открытие с кнопок [data-plan] в pricing (делегирование) */
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-plan]');
        if (btn) {
            e.preventDefault();
            window.openPlanModal(btn.getAttribute('data-plan'));
        }
    });

    /* Закрытие plan-модалки по клику на фон */
    (function () {
        var modal = $('planModal');
        if (!modal) return;
        modal.addEventListener('click', function (e) {
            if (e.target === modal) window.closePlanModal();
        });
    })();

    /* ─────────────────────────────────────────────
       9. Модалки политики/оферты
       ───────────────────────────────────────────── */
    var LEGAL_MODALS = { policy: 'modalPolicy', oferta: 'modalOferta' };

    function openLegalModal(kind) {
        var modal = $(LEGAL_MODALS[kind]);
        if (!modal) return;
        showEl($('modalOverlay'), 'block');
        showEl(modal, 'block');
    }

    function closeLegalModals() {
        hideEl($('modalOverlay'));
        Object.keys(LEGAL_MODALS).forEach(function (k) { hideEl($(LEGAL_MODALS[k])); });
    }
    window.closeLegalModals = closeLegalModals;

    document.addEventListener('click', function (e) {
        var opener = e.target.closest('[data-modal]');
        if (opener) {
            var kind = opener.getAttribute('data-modal');
            if (LEGAL_MODALS[kind]) {
                e.preventDefault();
                openLegalModal(kind);
                return;
            }
        }
        /* Закрытие: крестик/кнопка с [data-close] или клик по оверлею */
        if (e.target.closest('[data-close]') || e.target.closest('.modal-close')) {
            closeLegalModals();
            window.closePlanModal();
            return;
        }
        var overlay = $('modalOverlay');
        if (overlay && e.target === overlay) closeLegalModals();
    });

    /* Esc закрывает все модалки */
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeLegalModals();
            window.closePlanModal();
        }
    });

    /* ─────────────────────────────────────────────
       10. Чат-виджет (разметка в partials/widgets.html)
       ───────────────────────────────────────────── */
    (function () {
        var chatState = {
            open: false,
            visitorId: null,
            topicId: null,
            inited: false,
            history: []
        };

        try {
            chatState.visitorId = localStorage.getItem('bl_visitor_id') || null;
            chatState.topicId = localStorage.getItem('bl_topic_id') || null;
            chatState.history = JSON.parse(localStorage.getItem('bl_chat_history') || '[]');
        } catch (err) { /* приватный режим — работаем без памяти */ }

        if (!chatState.visitorId) {
            chatState.visitorId = 'v' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
            try { localStorage.setItem('bl_visitor_id', chatState.visitorId); } catch (err) { /* noop */ }
        }

        window.toggleChat = function () {
            var win = $('bl-chat-window');
            var btn = $('bl-chat-btn');
            if (!win || !btn) return;
            chatState.open = !chatState.open;
            if (chatState.open) {
                win.classList.add('open');
                btn.style.display = 'none';
                if (!chatState.inited) {
                    chatState.inited = true;
                    window.blAddMsg('bot', 'Привет! Я ассистент BetaLine AI. Чем могу помочь?');
                    setTimeout(function () {
                        window.blAddMsg('bot', 'Можете задать любой вопрос, или выберите действие ниже.');
                    }, 800);
                }
                var input = $('bl-chat-input');
                if (input) input.focus();
            } else {
                win.classList.remove('open');
                btn.style.display = 'flex';
            }
        };

        /* Публичное открытие чата (для #painsWildcard, #trustChat и др.) */
        window.openBlChat = function () {
            if (!chatState.open) window.toggleChat();
        };

        window.blAddMsg = function (type, text) {
            var msgs = $('bl-chat-messages');
            if (!msgs) return;
            var div = document.createElement('div');
            div.className = 'bl-msg ' + type;
            div.textContent = text;
            msgs.appendChild(div);
            msgs.scrollTop = msgs.scrollHeight;
        };

        /* UTM собираем один раз */
        var _utmParams = (function () {
            var p = new URLSearchParams(location.search);
            return {
                source: p.get('utm_source') || '',
                medium: p.get('utm_medium') || '',
                campaign: p.get('utm_campaign') || '',
                term: p.get('utm_term') || '',
                content: p.get('utm_content') || ''
            };
        })();

        window.blSend = function () {
            var input = $('bl-chat-input');
            if (!input) return;
            var msg = input.value.trim();
            if (!msg) return;
            input.value = '';
            window.blAddMsg('user', msg);

            /* Прячем быстрые действия после первого сообщения */
            var qa = $('bl-quick-actions');
            if (qa) qa.style.display = 'none';
            var cbf = $('bl-callback-form');
            if (cbf) cbf.style.display = 'none';

            /* Typing-индикатор */
            window.blAddMsg('bot', '...');
            var dots = document.querySelector('#bl-chat-messages .bl-msg.bot:last-child');

            /* Payload с историей; при первом сообщении — контекст визита */
            var payload = {
                visitorId: chatState.visitorId,
                topicId: chatState.topicId,
                message: msg,
                history: chatState.history.slice(-10),
                page: location.pathname + location.search
            };
            if (!chatState.topicId) {
                payload.utm = _utmParams;
                payload.referrer = document.referrer || '';
                payload.userAgent = navigator.userAgent || '';
                payload.screen = screen.width + 'x' + screen.height;
                payload.lang = navigator.language || '';
            }

            fetch(API_BASE + '/api/chat-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (dots) dots.remove();
                if (data.error) {
                    window.blAddMsg('system', 'Ошибка. Попробуйте позже или напишите в Telegram.');
                    return;
                }
                if (data.topicId && !chatState.topicId) {
                    chatState.topicId = data.topicId;
                    try { localStorage.setItem('bl_topic_id', data.topicId); } catch (err) { /* noop */ }
                }
                chatState.history.push({ role: 'user', content: msg });
                chatState.history.push({ role: 'assistant', content: data.reply });
                try { localStorage.setItem('bl_chat_history', JSON.stringify(chatState.history.slice(-20))); } catch (err) { /* noop */ }

                window.blAddMsg('bot', data.reply);
                goal('chat_message');
                if (data.contactDetected) goal('chat_lead');
            })
            .catch(function () {
                if (dots) dots.remove();
                window.blAddMsg('system', 'Не удалось отправить. Попробуйте позже или напишите в Telegram.');
            });
        };

        window.blQuick = function (text) {
            var input = $('bl-chat-input');
            if (!input) return;
            input.value = text;
            window.blSend();
        };

        window.blShowCallback = function () {
            var qa = $('bl-quick-actions');
            if (qa) qa.style.display = 'none';
            var cbf = $('bl-callback-form');
            if (cbf) cbf.style.display = 'block';
            window.blAddMsg('bot', 'Оставьте имя и номер — перезвоним за 24 секунды!');
        };

        window.blSendCallback = function () {
            var nameEl = $('bl-cb-name');
            var phoneEl = $('bl-cb-phone');
            if (!phoneEl) return;
            var name = nameEl ? nameEl.value.trim() : '';
            var phone = phoneEl.value.trim();
            if (!isValidPhone(phone)) {
                showFieldError(phoneEl, 'Минимум 10 цифр');
                return;
            }
            clearFieldError(phoneEl);

            postLead({ source: 'callback', name: name, phone: phone })
            .then(function (r) {
                if (!r.ok) throw new Error('err');
                var cbf = $('bl-callback-form');
                if (cbf) cbf.style.display = 'none';
                window.blAddMsg('system', '✅ Заявка принята! Перезвоним в ближайшее время.');
                goal('callback_chat');
            })
            .catch(function () {
                window.blAddMsg('system', 'Ошибка. Попробуйте позже.');
            });
        };

        /* Enter в поле чата */
        (function () {
            var input = $('bl-chat-input');
            if (input) {
                input.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') window.blSend();
                });
            }
        })();

        /* Пульс бейджа через 30 секунд первого визита */
        var chatShown = false;
        try { chatShown = !!sessionStorage.getItem('bl_chat_shown'); } catch (err) { /* noop */ }
        if (!chatShown) {
            setTimeout(function () {
                if (!chatState.open) {
                    var badge = document.querySelector('#bl-chat-btn .bl-badge');
                    if (badge) badge.style.animation = 'bl-pulse 1.5s infinite';
                }
            }, 30000);
            try { sessionStorage.setItem('bl_chat_shown', '1'); } catch (err) { /* noop */ }
        }

        /* Открытие чата с триггеров на странице */
        ['painsWildcard', 'trustChat'].forEach(function (id) {
            var el = $(id);
            if (el) {
                el.addEventListener('click', function (e) {
                    if (el.closest('a')) e.preventDefault();
                    window.openBlChat();
                });
            }
        });

        attachPhonePrefix($('bl-cb-phone'));
    })();

    /* ─────────────────────────────────────────────
       11. CallbackFire — только desktop (>960px):
           на мобильных виджет ломает скролл
       ───────────────────────────────────────────── */
    window.triggerCallbackFire = function () {}; /* no-op fallback для мобильных */
    if (window.innerWidth > 960) {
        (function () {
            var cbkCss = document.createElement('link');
            cbkCss.rel = 'stylesheet';
            cbkCss.href = 'https://cdn.saas-support.com/widget/cbk.css';
            document.head.appendChild(cbkCss);

            var cbkJs = document.createElement('script');
            cbkJs.src = 'https://cdn.saas-support.com/widget/cbk.js?wcb_code=b92a3d20c846c4b8bfdf38ee65302fe6';
            cbkJs.async = true;
            document.body.appendChild(cbkJs);

            /* Скрытая триггер-форма (только desktop) */
            var f = document.createElement('form');
            f.id = 'cbfTriggerForm';
            f.className = 'callbackwidget-call-form';
            f.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none';
            f.innerHTML = '<input type="tel" name="phone" id="cbfTriggerPhone">';
            document.body.appendChild(f);

            window.triggerCallbackFire = function (phone) {
                var input = $('cbfTriggerPhone');
                if (input) {
                    input.value = phone;
                    var evt = new Event('submit', { bubbles: true, cancelable: true });
                    f.dispatchEvent(evt);
                }
            };
        })();
    }

})();
