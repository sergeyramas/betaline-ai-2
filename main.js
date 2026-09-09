/* ============================================================
   Betaline AI · сайт из макета mockups/blueprint-v2
   Поведение макета (reveal, бургер) + обвязка с боевого betaline-ai.ru:
   форма → /api/lead (source=audit), модалки политики/оферты, чат-виджет
   (/api/chat-ai + callback, source=callback), цели Метрики.
   ============================================================ */
(function () {
    'use strict';

    /* ---------- 0. Конфиг и утилиты ---------- */
    /* Точное совпадение, не endsWith: поддомены (custom./zvonok.) тоже оканчиваются
       на betaline-ai.ru, но своих env не имеют — их формы должны идти на боевой API. */
    var PROD_HOSTS = ['betaline-ai.ru', 'www.betaline-ai.ru'];
    var API_BASE = PROD_HOSTS.indexOf(location.hostname) !== -1 ? '' : 'https://betaline-ai.ru';
    var YM_ID = window.YM_ID || 0;   /* задаётся в <head>; 0 = счётчик ещё не заведён */
    var PHONE_HUMAN = '8 800 200-18-49';

    function $(id) { return document.getElementById(id); }

    function goal(name, params) {
        if (YM_ID && typeof ym !== 'undefined') ym(YM_ID, 'reachGoal', name, params || {});
    }

    /* POST с таймаутом: без него при зависшем API кнопка «Отправляем…» висит вечно */
    function postJSON(path, payload, timeoutMs) {
        var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 15000) : null;
        function done(x, failed) { if (timer) clearTimeout(timer); if (failed) throw x; return x; }
        return fetch(API_BASE + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: ctrl ? ctrl.signal : undefined
        }).then(function (r) { return done(r, false); }, function (e) { return done(e, true); });
    }
    function postLead(payload) { return postJSON('/api/lead', payload, 15000); }

    function phoneDigits(v) { return String(v || '').replace(/\D/g, ''); }
    function isValidPhone(v) { return phoneDigits(v).length >= 10; }
    /* Поле «Email или телефон»: либо похоже на email, либо ≥10 цифр */
    function isValidContact(v) {
        v = String(v || '').trim();
        return v.indexOf('@') !== -1 ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) : isValidPhone(v);
    }

    /* Инлайн-подсказка у поля (порт с боевого) */
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

    /* Автопрефикс +7 для телефонных полей (порт с боевого) */
    function attachPhonePrefix(input) {
        if (!input) return;
        input.addEventListener('focus', function () { if (!this.value) this.value = '+7 '; });
        input.addEventListener('input', function () {
            if (this.value && !this.value.startsWith('+') && this.value.match(/^[78]/)) {
                this.value = '+7 ' + this.value.substring(1);
            }
        });
    }

    /* ---------- 1. Reveal: каскад от hero вниз (как в макете) + failsafe ---------- */
    document.documentElement.classList.add('js');
    function revealAll() {
        var els = document.querySelectorAll('.rv');
        els.forEach(function (el, i) {
            setTimeout(function () { el.classList.add('on'); }, 160 + Math.min(i * 55, 900));
        });
    }
    if (document.readyState === 'complete') revealAll();
    else window.addEventListener('load', revealAll);
    /* Failsafe: что бы ни случилось, через 5 с всё видимо (печать, якоря, боты). Не удалять. */
    setTimeout(function () {
        document.querySelectorAll('.rv:not(.on)').forEach(function (el) { el.classList.add('on'); });
    }, 5000);

    /* ---------- 2. Навбар: бургер, мобильное меню, Esc ---------- */
    var nav = $('nav'), burger = $('burger'), mmenu = $('mmenu');
    function closeMenu() {
        if (!nav) return;
        nav.classList.remove('open');
        if (burger) { burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Открыть меню'); }
    }
    if (burger && nav) {
        burger.addEventListener('click', function () {
            var open = nav.classList.toggle('open');
            burger.setAttribute('aria-expanded', open ? 'true' : 'false');
            burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
        });
    }
    if (mmenu) mmenu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });

    /* ---------- 3. Форма аудита → /api/lead (source=audit) ---------- */
    (function () {
        var form = $('lead-form'), ok = $('form-ok');
        if (!form || !ok) return;
        form.addEventListener('submit', function (ev) {
            ev.preventDefault();
            var name = $('f-name'), contact = $('f-contact'), company = $('f-company'), task = $('f-task');
            var valid = true;
            if (!isValidContact(contact.value)) { showFieldError(contact, 'Нужен email или телефон — минимум 10 цифр'); valid = false; }
            if (!name.value.trim()) { showFieldError(name, 'Как к вам обращаться?'); valid = false; }
            if (!valid) return;
            clearFieldError(name); clearFieldError(contact);

            var btn = form.querySelector('[type="submit"]');
            var btnHtml = btn ? btn.innerHTML : '';
            if (btn) { btn.disabled = true; btn.textContent = 'Отправляем…'; }

            postLead({
                source: 'audit',
                name: name.value.trim(),
                phone: contact.value.trim(),
                niche: company ? company.value.trim() : '',
                task: task ? task.value.trim() : ''
            })
            .then(function (r) { if (!r.ok) throw new Error('server'); return r.json(); })
            .then(function (data) {
                goal('audit_lead');
                var id = data && data.lead_id ? String(data.lead_id).slice(-6).toUpperCase() : '';
                ok.querySelector('.mk').textContent = id ? 'Заявка № ' + id + ' принята' : 'Заявка принята';
                form.classList.add('sent');
                ok.classList.add('show');
            })
            .catch(function () {
                if (btn) { btn.disabled = false; btn.innerHTML = btnHtml; }
                showFieldError(contact, 'Не удалось отправить — попробуйте ещё раз или позвоните: ' + PHONE_HUMAN);
            });
        });
    })();

    /* ---------- 4. Модалки политики/оферты ---------- */
    var LEGAL_MODALS = { policy: 'modalPolicy', oferta: 'modalOferta' };
    function setOpen(el, open) {
        if (!el) return;
        el.classList.toggle('open', open);
        el.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    var modalOpener = null;
    function openLegalModal(kind, opener) {
        var modal = $(LEGAL_MODALS[kind]);
        if (!modal) return;
        modalOpener = opener || document.activeElement;
        setOpen($('modalOverlay'), true);
        setOpen(modal, true);
        document.body.classList.add('modal-open');
        var closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) closeBtn.focus();
    }
    function closeLegalModals() {
        var wasOpen = !!document.querySelector('.modal.open');
        setOpen($('modalOverlay'), false);
        Object.keys(LEGAL_MODALS).forEach(function (k) { setOpen($(LEGAL_MODALS[k]), false); });
        document.body.classList.remove('modal-open');
        if (wasOpen && modalOpener && modalOpener.focus) modalOpener.focus();
        modalOpener = null;
    }
    /* Ловушка фокуса: Tab не уходит под оверлей, пока модалка открыта */
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var modal = document.querySelector('.modal.open');
        if (!modal) return;
        var f = modal.querySelectorAll('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    });
    document.addEventListener('click', function (e) {
        var opener = e.target.closest('[data-modal]');
        if (opener && LEGAL_MODALS[opener.getAttribute('data-modal')]) {
            e.preventDefault();
            openLegalModal(opener.getAttribute('data-modal'), opener);
            return;
        }
        if (e.target.closest('[data-modal-close]') || e.target === $('modalOverlay')) closeLegalModals();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        closeLegalModals();
        closeMenu();
    });

    /* ---------- 5. Чат-виджет (порт с боевого): /api/chat-ai + callback ---------- */
    (function () {
        var win = $('bl-chat-window'), btn = $('bl-chat-btn'), msgs = $('bl-chat-messages'), input = $('bl-chat-input');
        if (!win || !btn || !msgs || !input) return;

        var chatState = { open: false, visitorId: null, topicId: null, inited: false, history: [] };
        try {
            chatState.visitorId = localStorage.getItem('bl_visitor_id') || null;
            chatState.topicId = localStorage.getItem('bl_topic_id') || null;
            chatState.history = JSON.parse(localStorage.getItem('bl_chat_history') || '[]');
        } catch (err) { /* приватный режим — работаем без памяти */ }
        if (!chatState.visitorId) {
            chatState.visitorId = 'v' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
            try { localStorage.setItem('bl_visitor_id', chatState.visitorId); } catch (err) { /* noop */ }
        }

        function addMsg(type, text) {
            var div = document.createElement('div');
            div.className = 'bl-msg ' + type;
            div.textContent = text;
            msgs.appendChild(div);
            msgs.scrollTop = msgs.scrollHeight;
            return div;
        }

        function toggleChat() {
            chatState.open = !chatState.open;
            win.classList.toggle('open', chatState.open);
            win.setAttribute('aria-hidden', chatState.open ? 'false' : 'true');
            btn.classList.toggle('hidden', chatState.open);
            if (!chatState.open) { btn.focus(); return; }
            if (!chatState.inited) {
                chatState.inited = true;
                addMsg('bot', 'Здравствуйте! Я ассистент Betaline AI. Чем могу помочь?');
                setTimeout(function () { addMsg('bot', 'Можете задать любой вопрос или выбрать действие ниже.'); }, 800);
            }
            input.focus();
        }
        btn.addEventListener('click', toggleChat);
        $('bl-chat-close').addEventListener('click', toggleChat);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && chatState.open) toggleChat(); });

        /* UTM собираем один раз — уходит с первым сообщением */
        var utm = (function () {
            var p = new URLSearchParams(location.search);
            return { source: p.get('utm_source') || '', medium: p.get('utm_medium') || '', campaign: p.get('utm_campaign') || '',
                     term: p.get('utm_term') || '', content: p.get('utm_content') || '' };
        })();

        var sending = false;   /* один запрос за раз: иначе до появления topicId плодятся темы */
        function send() {
            if (sending) return;
            var msg = input.value.trim();
            if (!msg) return;
            sending = true;
            input.value = '';
            addMsg('user', msg);
            $('bl-quick-actions').style.display = 'none';
            $('bl-callback-form').style.display = 'none';
            var dots = addMsg('bot', '…');

            var payload = { visitorId: chatState.visitorId, topicId: chatState.topicId, message: msg,
                            history: chatState.history.slice(-10), page: location.pathname + location.search };
            if (!chatState.topicId) {
                payload.utm = utm;
                payload.referrer = document.referrer || '';
                payload.userAgent = navigator.userAgent || '';
                payload.screen = screen.width + 'x' + screen.height;
                payload.lang = navigator.language || '';
            }
            postJSON('/api/chat-ai', payload, 30000)
            .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
            .then(function (data) {
                dots.remove();
                if (!data || data.error || typeof data.reply !== 'string') { addMsg('system', 'Ошибка. Попробуйте позже или напишите в Telegram.'); return; }
                if (data.topicId && !chatState.topicId) {
                    chatState.topicId = data.topicId;
                    try { localStorage.setItem('bl_topic_id', data.topicId); } catch (err) { /* noop */ }
                }
                chatState.history.push({ role: 'user', content: msg }, { role: 'assistant', content: data.reply });
                try { localStorage.setItem('bl_chat_history', JSON.stringify(chatState.history.slice(-20))); } catch (err) { /* noop */ }
                addMsg('bot', data.reply);
                goal('chat_message');
                if (data.contactDetected) goal('chat_lead');
            })
            .catch(function () {
                dots.remove();
                addMsg('system', 'Не удалось отправить. Попробуйте позже или напишите в Telegram.');
            })
            .then(function () { sending = false; });
        }
        $('bl-chat-send').addEventListener('click', send);
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });

        win.querySelectorAll('[data-quick]').forEach(function (b) {
            b.addEventListener('click', function () { input.value = b.getAttribute('data-quick'); send(); });
        });
        $('bl-quick-callback').addEventListener('click', function () {
            $('bl-quick-actions').style.display = 'none';
            $('bl-callback-form').style.display = 'block';
            addMsg('bot', 'Оставьте имя и номер — перезвоним в рабочее время.');
            $('bl-cb-phone').focus();
        });
        $('bl-cb-send').addEventListener('click', function () {
            var sendBtn = this;
            if (sendBtn.disabled) return;
            var nameEl = $('bl-cb-name'), phoneEl = $('bl-cb-phone');
            var phone = phoneEl.value.trim();
            if (!isValidPhone(phone)) { showFieldError(phoneEl, 'Минимум 10 цифр'); return; }
            clearFieldError(phoneEl);
            sendBtn.disabled = true;
            postLead({ source: 'callback', name: nameEl.value.trim(), phone: phone })
            .then(function (r) {
                if (!r.ok) throw new Error('err');
                $('bl-callback-form').style.display = 'none';
                addMsg('system', 'Заявка принята — перезвоним в ближайшее время.');
                goal('callback_chat');
            })
            .catch(function () { addMsg('system', 'Ошибка. Попробуйте позже или позвоните: ' + PHONE_HUMAN); })
            .then(function () { sendBtn.disabled = false; });
        });
        attachPhonePrefix($('bl-cb-phone'));

        /* Пульс бейджа через 30 с первого визита */
        var shown = false;
        try { shown = !!sessionStorage.getItem('bl_chat_shown'); } catch (err) { /* noop */ }
        if (!shown) {
            setTimeout(function () {
                if (!chatState.open) { var badge = btn.querySelector('.bl-badge'); if (badge) badge.style.animation = 'bl-pulse 1.5s infinite'; }
            }, 30000);
            try { sessionStorage.setItem('bl_chat_shown', '1'); } catch (err) { /* noop */ }
        }
    })();
})();
