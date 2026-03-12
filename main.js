/* ═══════════════════════════════════════════════════════════
   BETALINE AI 2 — MAIN INTERACTIVITY ENGINE
   GSAP · tsParticles · Typewriter · Parallax · Cursor · Tilt
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

    // ─── Theme Toggle ───
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('betaline-theme') || 'dark';
    if (savedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');

    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('betaline-theme', next);
    });

    // ─── Custom Cursor ───
    const dot = document.getElementById('cursorDot');
    const ring = document.getElementById('cursorRing');
    let mouseX = 0, mouseY = 0;
    let ringX = 0, ringY = 0;

    if (window.matchMedia('(pointer: fine)').matches) {
        document.addEventListener('mousemove', e => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            dot.style.left = mouseX - 4 + 'px';
            dot.style.top = mouseY - 4 + 'px';
        });

        function animateRing() {
            ringX += (mouseX - ringX) * 0.12;
            ringY += (mouseY - ringY) * 0.12;
            ring.style.left = ringX - 20 + 'px';
            ring.style.top = ringY - 20 + 'px';
            requestAnimationFrame(animateRing);
        }
        animateRing();

        // Magnetic effect on buttons
        document.querySelectorAll('.btn, .nav-cta, .hero-input-wrap button').forEach(el => {
            el.addEventListener('mouseenter', () => ring.classList.add('hover'));
            el.addEventListener('mouseleave', () => ring.classList.remove('hover'));
        });
    } else {
        dot.style.display = 'none';
        ring.style.display = 'none';
    }

    // ─── Navbar scroll ───
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 80);
    });

    // ─── Burger menu ───
    const burger = document.getElementById('burger');
    const navLinks = document.getElementById('navLinks');
    burger.addEventListener('click', () => {
        navLinks.classList.toggle('open');
        burger.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            navLinks.classList.remove('open');
            burger.classList.remove('open');
        });
    });

    // ─── Typewriter Effect ───
    const heroTitle = document.getElementById('heroTitle');
    const phrases = [
        'Ваш бизнес работает в прошлом.',
        'Пора это признать.',
    ];
    const fullText = phrases.join(' ');
    let charIndex = 0;

    function typeWriter() {
        if (charIndex <= fullText.length) {
            heroTitle.innerHTML = fullText.substring(0, charIndex) + '<span class="typewriter"></span>';
            charIndex++;
            setTimeout(typeWriter, 45);
        } else {
            heroTitle.innerHTML = fullText;
        }
    }
    setTimeout(typeWriter, 800);

    // ─── tsParticles ───
    if (typeof tsParticles !== 'undefined') {
        tsParticles.load('tsparticles', {
            fullScreen: false,
            background: { color: 'transparent' },
            particles: {
                number: { value: 40, density: { enable: true, area: 1000 } },
                color: { value: ['#00D4FF', '#00C9A7', '#ffffff'] },
                opacity: { value: { min: 0.1, max: 0.4 }, animation: { enable: true, speed: 0.5 } },
                size: { value: { min: 1, max: 2.5 } },
                move: {
                    enable: true,
                    speed: 0.4,
                    direction: 'none',
                    outModes: 'bounce',
                },
                links: {
                    enable: true,
                    distance: 140,
                    color: '#00D4FF',
                    opacity: 0.06,
                    width: 1,
                },
            },
            interactivity: {
                events: {
                    onHover: { enable: true, mode: 'grab' },
                },
                modes: {
                    grab: { distance: 160, links: { opacity: 0.15 } },
                },
            },
        });
    }

    // ─── GSAP ScrollTrigger Reveals ───
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        // Staggered reveals
        gsap.utils.toArray('.reveal').forEach((el, i) => {
            gsap.fromTo(el,
                { opacity: 0, y: 50 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.8,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: el,
                        start: 'top 85%',
                        toggleActions: 'play none none none',
                    },
                    delay: (i % 3) * 0.15,
                }
            );
        });

        // Parallax hero bg
        gsap.to('.hero-bg', {
            y: 120,
            ease: 'none',
            scrollTrigger: {
                trigger: '.hero',
                start: 'top top',
                end: 'bottom top',
                scrub: true,
            },
        });

        // Counter animations
        gsap.utils.toArray('.stat-number').forEach(el => {
            const target = parseInt(el.getAttribute('data-count'));
            const obj = { val: 0 };
            gsap.to(obj, {
                val: target,
                duration: 2,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: el,
                    start: 'top 85%',
                    toggleActions: 'play none none none',
                },
                onUpdate: () => {
                    el.textContent = Math.round(obj.val);
                },
            });
        });

        // Step cards stagger
        gsap.from('.step-card', {
            opacity: 0,
            y: 60,
            stagger: 0.2,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: '.steps-grid',
                start: 'top 80%',
            },
        });

        // Custom cards stagger
        gsap.from('.custom-card', {
            opacity: 0,
            y: 60,
            stagger: 0.15,
            duration: 0.7,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: '.custom-grid',
                start: 'top 80%',
            },
        });
    }

    // ─── 3D Tilt Effect ───
    document.querySelectorAll('[data-tilt]').forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / centerY * -6;
            const rotateY = (x - centerX) / centerX * 6;
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
        });
    });

    // ─── Smooth scroll for anchor links ───
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            const target = document.querySelector(a.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

});
