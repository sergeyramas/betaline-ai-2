import { MOCK_DASHBOARD } from './modules/mock-data.js';
import { listBots } from './modules/bot-storage.js';
import { renderBotsList } from './modules/bots-list.js';
import { openWizard, bindWizardNav, configureWizard } from './modules/wizard.js';
import { openBotDetail, bindBotDetailHandlers, configureTestChat } from './modules/test-chat.js';
import { showProLock, bindProLockHandlers, showToast } from './modules/pro-lock.js';

const SUPABASE_URL = document.querySelector('meta[name="supabase-url"]')?.content || '';
const SUPABASE_ANON_KEY = document.querySelector('meta[name="supabase-anon-key"]')?.content || '';
const USE_MOCK = !SUPABASE_URL || SUPABASE_URL === 'SUPABASE_PLACEHOLDER';

let supabase = null;
async function getSupabase() {
  if (USE_MOCK) return null;
  if (supabase) return supabase;
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabase;
  } catch (e) {
    console.warn('Supabase load failed, falling back to mock', e);
    return null;
  }
}

// ─── View routing ────────────────────────────────────────────────────────────

export function setView(name) {
  document.body.setAttribute('data-view', name);
  // legacy hidden attribute mirroring (so existing code paths still work)
  const map = {
    login:           'login-view',
    dashboard:       'dashboard-view',
    wizard:          'wizard-view',
    'wizard-success':'wizard-success-view',
    'bot-detail':    'bot-detail-view',
  };
  Object.entries(map).forEach(([viewName, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (viewName === name) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  });
}
window.__cabSetView = setView;

// ─── State machine ───────────────────────────────────────────────────────────

async function init() {
  if (USE_MOCK) {
    const raw = sessionStorage.getItem('mock-user');
    if (raw) {
      try {
        const user = JSON.parse(raw);
        showDashboard(user);
        return;
      } catch {}
    }
    showLogin();
  } else {
    const sb = await getSupabase();
    if (!sb) { showLogin(); return; }
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) {
      showDashboard(session.user);
    } else {
      showLogin();
    }
  }
}

function showLogin() {
  setView('login');
}

function showDashboard(user) {
  window.__cabUser = user;
  setView('dashboard');
  renderDashboard(user);
  loadBotConfig(user.id);
  renderChart();
  renderBotsList();
}

// ─── Dashboard rendering ─────────────────────────────────────────────────────

function renderDashboard(user) {
  const greeting = document.getElementById('cab-greeting');
  if (greeting) greeting.textContent = 'Привет, ' + (user.phone || user.email || 'друг') + '! 👋';

  const daysLeft = Math.ceil((new Date(user.created_at).getTime() + 7 * 86400000 - Date.now()) / 86400000);

  const badge = document.getElementById('trial-badge');
  if (badge) {
    badge.textContent = daysLeft > 0
      ? `⏳ Триал: осталось ${daysLeft} дн`
      : '❌ Триал истёк. Пополните баланс.';
    badge.className = 'trial-badge ' + (daysLeft > 0 ? 'trial-active' : 'trial-expired');
  }

  const daysEl = document.getElementById('days-left-stat');
  if (daysEl) daysEl.textContent = daysLeft > 0 ? daysLeft : '0';

  const msgUsed = document.getElementById('msg-used');
  if (msgUsed) msgUsed.textContent = String(MOCK_DASHBOARD.msgUsedToday);
  const msgTotal = document.getElementById('msg-total');
  if (msgTotal) msgTotal.textContent = ' / ' + MOCK_DASHBOARD.msgLimit;
  const leadsEl = document.getElementById('leads-stat');
  if (leadsEl) leadsEl.textContent = String(MOCK_DASHBOARD.leadsCount);
  const planEl = document.getElementById('plan-stat');
  if (planEl) planEl.textContent = MOCK_DASHBOARD.plan;

  if (!user.email) {
    const banner = document.getElementById('add-email-banner');
    if (banner) banner.removeAttribute('hidden');
  }
}

function renderChart() {
  const svg = document.querySelector('.cab-chart-bars');
  const labelsBox = document.getElementById('chart-labels');
  if (!svg) return;
  const data = MOCK_DASHBOARD.chart14days;
  const max = Math.max(...data);
  const w = 700, h = 200, gap = 8;
  const barW = (w - gap * (data.length - 1)) / data.length;
  let svgInner = '';
  data.forEach((v, i) => {
    const barH = (v / max) * (h - 20);
    const x = i * (barW + gap);
    const y = h - barH;
    const last = i === data.length - 1;
    svgInner += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="6" fill="${last ? 'url(#chart-grad)' : '#FCD9B7'}"/>`;
  });
  svg.innerHTML = `<defs><linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F97316"/><stop offset="1" stop-color="#FB923C"/></linearGradient></defs>` + svgInner;
  if (labelsBox) {
    const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    labelsBox.innerHTML = data.map((_, i) => `<span>${dayNames[i % 7]}</span>`).join('');
  }
}

// ─── Bot config (legacy v1 panel) ────────────────────────────────────────────

async function loadBotConfig(userId) {
  if (USE_MOCK) return;
  const sb = await getSupabase();
  if (!sb) return;
  const { data } = await sb.from('bot_configs').select('*').eq('user_id', userId).single();
  if (!data) return;
  const f = document.getElementById('botName'); if (f) f.value = data.bot_name || '';
  const g = document.getElementById('greeting'); if (g) g.value = data.greeting || '';
  const toneEl = document.querySelector(`[name="tone"][value="${data.tone || 'friendly'}"]`);
  if (toneEl) toneEl.checked = true;
}

document.getElementById('bot-config-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    bot_name: document.getElementById('botName')?.value || '',
    greeting: document.getElementById('greeting')?.value || '',
    tone: document.querySelector('[name="tone"]:checked')?.value || 'friendly',
  };
  if (!USE_MOCK && window.__cabUser) {
    const sb = await getSupabase();
    if (sb) await sb.from('bot_configs').upsert({ user_id: window.__cabUser.id, ...data });
  }
  const toast = document.getElementById('config-toast');
  if (toast) { toast.removeAttribute('hidden'); setTimeout(() => toast.setAttribute('hidden', ''), 2000); }
});

document.querySelectorAll('.cab-swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    document.querySelectorAll('.cab-swatch').forEach(s => s.classList.remove('selected'));
    swatch.classList.add('selected');
  });
});

// ─── Integrations panel ──────────────────────────────────────────────────────

document.querySelectorAll('.int-connect-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const card = btn.closest('.integration-card');
    const type = card?.dataset.type || 'Интеграция';
    const phone = window.__cabUser?.phone || '';
    btn.disabled = true;
    try {
      await fetch('/api/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Интеграция: ' + type, phone: phone || '+70000000000' }),
      });
    } catch {}
    const msg = card?.querySelector('.integration-requested');
    if (msg) msg.removeAttribute('hidden');
    btn.textContent = 'Запрошено ✓';
  });
});

// ─── Sidebar tab switching ───────────────────────────────────────────────────

document.querySelectorAll('.cab-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cab-tab').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.cab-panel').forEach(p => p.setAttribute('hidden', ''));
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    document.getElementById('cab-' + btn.dataset.tab).removeAttribute('hidden');
  });
});

// ─── Login / logout ──────────────────────────────────────────────────────────

document.getElementById('login-google')?.addEventListener('click', () => {
  if (USE_MOCK) {
    const mockUser = {
      id: 'mock-google-' + Date.now(),
      phone: '',
      email: 'demo@betaline.ai',
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    };
    sessionStorage.setItem('mock-user', JSON.stringify(mockUser));
    showDashboard(mockUser);
  }
});

document.getElementById('toggle-password')?.addEventListener('click', () => {
  const input = document.getElementById('login-password');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
});

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const contact = document.getElementById('login-contact')?.value?.trim() || '';
  const password = document.getElementById('login-password')?.value || '';
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  if (errorEl) errorEl.textContent = '';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Входим…'; }

  if (USE_MOCK) {
    const mockUser = {
      id: 'mock-' + Date.now(),
      phone: contact.startsWith('+') ? contact : '',
      email: contact.includes('@') ? contact : '',
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    };
    sessionStorage.setItem('mock-user', JSON.stringify(mockUser));
    showDashboard(mockUser);
  } else {
    const sb = await getSupabase();
    if (!sb) {
      if (errorEl) errorEl.textContent = 'Не удалось подключиться к серверу';
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Войти →'; }
      return;
    }
    const isEmail = contact.includes('@');
    let result;
    if (isEmail) {
      result = await sb.auth.signInWithPassword({ email: contact, password });
    } else {
      result = await sb.auth.signInWithPassword({ phone: contact, password });
    }
    if (result.error) {
      if (errorEl) errorEl.textContent = result.error.message || 'Неверный логин или пароль';
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Войти →'; }
    } else {
      showDashboard(result.data.user);
    }
  }
});

document.getElementById('logout-btn')?.addEventListener('click', async () => {
  if (USE_MOCK) {
    sessionStorage.removeItem('mock-user');
  } else {
    const sb = await getSupabase();
    await sb?.auth.signOut();
  }
  window.__cabUser = null;
  showLogin();
});

if (!USE_MOCK) {
  getSupabase().then(sb => {
    sb?.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        showDashboard(session.user);
      } else {
        showLogin();
      }
    });
  });
}

// ─── Wizard / bot-detail / pro-lock wiring (Iteration 3) ─────────────────────

configureWizard({
  setView,
  onComplete: () => { /* success view shown by wizard.js */ }
});

configureTestChat({
  setView,
  onEdit: (bot) => openWizard(bot)
});

bindWizardNav();
bindBotDetailHandlers();
bindProLockHandlers();

function handleCreateBot() {
  const bots = listBots();
  if (bots.length >= 1) {
    showProLock('multi_bot');
    return;
  }
  openWizard();
}

document.getElementById('btn-create-bot')?.addEventListener('click', handleCreateBot);
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action="create-bot"]');
  if (t) handleCreateBot();
});

document.getElementById('success-cabinet-btn')?.addEventListener('click', () => {
  setView('dashboard');
  renderBotsList();
});
document.getElementById('success-test-btn')?.addEventListener('click', () => {
  if (window.__lastCreatedBotId) {
    openBotDetail(window.__lastCreatedBotId);
  } else {
    setView('dashboard');
  }
});

// ─── Boot ────────────────────────────────────────────────────────────────────

init();
