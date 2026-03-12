/* ═══════════════════════════════════════════════════════════
   BETALINE AI 2 — MARKETING ENGINE
   Exit-intent · Countdown · Toast · Sticky CTA · Modal
   ═══════════════════════════════════════════════════════════ */

(function () {

    // ─── Sticky CTA Bar ───
    const stickyCta = document.getElementById('stickyCta');
    let stickyShown = false;

    window.addEventListener('scroll', () => {
        const heroBottom = document.getElementById('hero').offsetHeight;
        if (window.scrollY > heroBottom && !stickyShown) {
            stickyCta.classList.add('visible');
            stickyShown = true;
        }
        if (window.scrollY < heroBottom / 2 && stickyShown) {
            stickyCta.classList.remove('visible');
            stickyShown = false;
        }
    });

    // ─── Exit-Intent Popup ───
    const exitPopup = document.getElementById('exitPopup');
    let exitShown = false;

    document.addEventListener('mouseleave', e => {
        if (e.clientY < 5 && !exitShown && !sessionStorage.getItem('betaline-exit-shown')) {
            exitPopup.classList.add('active');
            exitShown = true;
            sessionStorage.setItem('betaline-exit-shown', '1');
        }
    });

    window.closeExitPopup = function () {
        exitPopup.classList.remove('active');
    };

    window.submitExitEmail = function () {
        const email = document.getElementById('exitEmail').value;
        if (email && email.includes('@')) {
            exitPopup.classList.remove('active');
            showToast('✅', 'Отчёт отправлен на ' + email);
        }
    };

    // Click overlay to close
    exitPopup.addEventListener('click', e => {
        if (e.target === exitPopup) closeExitPopup();
    });

    // ─── Brief Modal ───
    const modalOverlay = document.getElementById('modalOverlay');

    window.openModal = function () {
        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    window.closeModal = function () {
        modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
    };

    modalOverlay.addEventListener('click', e => {
        if (e.target === modalOverlay) closeModal();
    });

    window.submitBrief = function (e) {
        e.preventDefault();
        closeModal();
        showToast('🎯', 'Заявка отправлена! Мы свяжемся с вами в течение 2 часов.');
    };

    // ─── Countdown Timer ───
    // Set deadline to 3 days from now
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 3);
    deadline.setHours(23, 59, 59, 0);

    function updateCountdown() {
        const now = new Date();
        const diff = deadline - now;

        if (diff <= 0) return;

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        const el = (id) => document.getElementById(id);
        el('cd-days').textContent = String(days).padStart(2, '0');
        el('cd-hours').textContent = String(hours).padStart(2, '0');
        el('cd-mins').textContent = String(mins).padStart(2, '0');
        el('cd-secs').textContent = String(secs).padStart(2, '0');
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);

    // ─── Toast Notifications ───
    const toastContainer = document.getElementById('toastContainer');

    window.showToast = function (icon, message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<span class="toast-icon">${icon}</span> ${message}`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(60px)';
            toast.style.transition = 'all 0.4s ease';
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    };

    // ─── Social Proof Toasts (periodic) ───
    const proofMessages = [
        ['🔔', '«ТехноПро» подключила ИИ-сотрудника 12 минут назад'],
        ['📊', '47 компаний начали тестирование на этой неделе'],
        ['✅', '«Финансгрупп» сэкономила 2.3 млн ₽ за первый месяц'],
        ['🚀', '«SalesForce RU» увеличила конверсию на 34%'],
        ['💬', 'ИИ-бот обработал 1 240 диалогов за сегодня'],
    ];

    let proofIndex = 0;

    function showSocialProof() {
        if (document.hidden) return;
        const [icon, msg] = proofMessages[proofIndex % proofMessages.length];
        showToast(icon, msg);
        proofIndex++;
    }

    // First toast after 15s, then every 45s
    setTimeout(() => {
        showSocialProof();
        setInterval(showSocialProof, 45000);
    }, 15000);

    // ─── Escape key handler ───
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeModal();
            closeExitPopup();
        }
    });

})();
