import { GET, POST, getToken, setToken } from './api.js';
import { prefs, state, applyTheme } from './store.js';
import { h, icons, toast, haptic, avatar } from './ui.js';
import { navigate, refreshMe } from './core.js';

applyTheme();
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => prefs.theme === 'system' && applyTheme());

const app = document.getElementById('app');
let unmount = null;
let tabbar = null;

const TABS = [
  ['#/', 'home', 'Home'],
  ['#/friends', 'friends', 'Friends'],
  ['#/history', 'history', 'History'],
  ['#/profile', 'profile', 'Profile'],
];

function renderTabbar(active) {
  if (!tabbar) {
    tabbar = h('nav', { class: 'tabbar' }, TABS.map(([href, ic, label]) => h('a', { href, dataset: { tab: ic }, html: icons[ic] + `<span>${label}</span>`, onclick: () => haptic(5) })));
    document.body.append(tabbar);
  }
  tabbar.classList.toggle('hidden', !active);
  [...tabbar.children].forEach(a => a.classList.toggle('on', a.dataset.tab === active));
}


const ROUTES = [
  [/^#?\/?$/, 'home', () => import('./views/home.js')],
  [/^#\/friends$/, 'friends', () => import('./views/friends.js')],
  [/^#\/history$/, 'history', () => import('./views/history.js')],
  [/^#\/profile$/, 'profile', () => import('./views/profile.js')],
  [/^#\/settings$/, null, () => import('./views/settings.js')],
  [/^#\/manage(?:\/([a-z0-9-]+))?$/, null, () => import('./views/manage.js')],
  [/^#\/game\/([a-z0-9-]+)$/, null, () => import('./views/game.js')],
  [/^#\/room\/([A-Z0-9]{5})$/, null, () => import('./views/room.js')],
  [/^#\/u\/([a-z0-9_.]{3,16})$/, null, () => import('./views/adduser.js')],
];

let routeToken = 0;
async function route() {
  const hash = location.hash || '#/';
  const my = ++routeToken;
  if (!state.me) return;
  let match = null, tab = null, loader = null;
  for (const [re, t, l] of ROUTES) { const m = hash.match(re); if (m) { match = m; tab = t; loader = l; break; } }
  if (!loader) { navigate('#/', true); return; }
  try { unmount?.(); } catch (e) { console.error(e); }
  unmount = null;
  const mod = await loader();
  if (my !== routeToken) return;
  renderTabbar(tab);
  app.innerHTML = '';
  window.scrollTo(0, 0);
  unmount = await mod.default(app, { params: match.slice(1), navigate, refreshMe }) || null;
}
window.addEventListener('hashchange', route);


// ---- presence + invites ----
let pingTimer = null;
const seenInvites = new Set();
async function ping() {
  if (!getToken() || document.hidden) return;
  try {
    const r = await POST('/me/ping');
    for (const inv of r.invites || []) {
      if (seenInvites.has(inv.id)) continue;
      seenInvites.add(inv.id);
      showInvite(inv);
    }
  } catch { /* offline: try next time */ }
}
function showInvite(inv) {
  if (location.hash === '#/room/' + inv.room) { POST(`/invites/${inv.id}/seen`).catch(() => {}); return; }
  haptic([20, 60, 20]);
  const b = h('div', { class: 'banner' },
    avatar(inv, 40),
    h('div', { class: 'grow', style: { flex: 1, minWidth: 0 } }, h('div', { style: { fontWeight: 700 } }, `${inv.name} invited you`), h('div', { class: 'muted small' }, `Room ${inv.room} · Playing Cards`)),
    h('button', { class: 'btn sm pill', onclick: () => { b.remove(); POST(`/invites/${inv.id}/seen`).catch(() => {}); navigate('#/room/' + inv.room); } }, 'Join'),
    h('button', { class: 'icon-btn', 'aria-label': 'Dismiss', html: icons.close, onclick: () => { b.remove(); POST(`/invites/${inv.id}/seen`).catch(() => {}); } }));
  document.body.append(b);
  setTimeout(() => b.remove(), 20000);
}
function startPing() {
  clearInterval(pingTimer);
  ping();
  pingTimer = setInterval(ping, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ping(); });
}

// ---- boot ----
function pendingFromURL() {
  const q = new URLSearchParams(location.search);
  let pending = null;
  const r = q.get('r'); const u = q.get('u');
  const pm = location.pathname.match(/\/r\/([A-Za-z0-9]{5})\/?$/);
  const pu = location.pathname.match(/\/u\/([a-z0-9_.]{3,16})\/?$/i);
  if (r && /^[A-Za-z0-9]{5}$/.test(r)) pending = '#/room/' + r.toUpperCase();
  else if (pm) pending = '#/room/' + pm[1].toUpperCase();
  else if (u) pending = '#/u/' + u.toLowerCase();
  else if (pu) pending = '#/u/' + pu[1].toLowerCase();
  if (pending) {
    const base = location.pathname.replace(/\/(r|u)\/[^/]+\/?$/, '/');
    history.replaceState(null, '', base + pending);
  }
  return pending;
}

async function boot() {
  pendingFromURL();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  if (getToken()) {
    try { await refreshMe(); }
    catch (e) {
      if (e.status === 401) setToken(null);
      else if (e.code === 'offline') { app.innerHTML = ''; app.append(h('div', { class: 'center-load' }, h('div', { style: { textAlign: 'center' } }, h('p', null, 'No internet connection'), h('button', { class: 'btn', onclick: () => location.reload() }, 'Try again')))); return; }
    }
  }
  if (!state.me) {
    const mod = await import('./views/onboarding.js');
    renderTabbar(null);
    app.innerHTML = '';
    await mod.default(app, { done: async () => { await refreshMe(); startPing(); route(); } });
    return;
  }
  startPing();
  route();
}
boot();
