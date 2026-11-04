import { prefs } from './store.js';

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v, k === 'ontouchstart' ? { passive: true } : undefined);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return el;
}
export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const I = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const icons = {
  home: I('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
  friends: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17.5" cy="9" r="2.6"/><path d="M16.5 14.6c2.7.2 4.4 1.9 5 5.4"/>'),
  history: I('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4.5h4.5"/><path d="M12 7.5V12l3 2"/>'),
  profile: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.4 4-6.5 8-6.5s7.2 2.1 8 6.5"/>'),
  settings: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  back: I('<path d="M15 5l-7 7 7 7"/>'),
  chev: I('<path d="M9 6l6 6-6 6"/>', 'class="chev"'),
  close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  share: I('<path d="M12 3v13"/><path d="M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'),
  copy: I('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.7 19.5c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.6 13.3 1.9 11.8c-1-.3-1-1 .2-1.5L20.6 3.2c.9-.3 1.6.2 1.3 1.1z"/></svg>',
  crown: I('<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>'),
  shuffle: I('<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>'),
  trash: I('<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>'),
  edit: I('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  grid: I('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  link: I('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  lock: I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  globe: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/>'),
  exit: I('<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/>'),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
};
export const icon = name => { const s = document.createElement('span'); s.style.display = 'contents'; s.innerHTML = icons[name]; return s; };

let toastWrap;
export function toast(msg, ms = 2400) {
  if (!toastWrap) { toastWrap = h('div', { class: 'toast-wrap' }); document.body.append(toastWrap); }
  const t = h('div', { class: 'toast' }, msg);
  toastWrap.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, ms);
}

export function haptic(p = 10) {
  if (!prefs.haptics) return;
  try { navigator.vibrate?.(p); } catch { /* not supported */ }
}

export function sheet(title, content, opts = {}) {
  const back = h('div', { class: 'sheet-back' });
  const close = () => {
    if (!back.isConnected) return;
    back.classList.add('closing'); el.classList.add('closing');
    setTimeout(() => { back.remove(); el.remove(); opts.onClose?.(); }, 220);
  };
  const el = h('div', { class: 'sheet', role: 'dialog' },
    h('div', { class: 'grab' }),
    h('div', { class: 'sheet-head' }, h('h3', null, title), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close, html: icons.close })),
    content);
  back.addEventListener('click', close);
  document.body.append(back, el);
  return { el, close };
}

export function confirmSheet(title, text, okLabel = 'OK', danger = false) {
  return new Promise(res => {
    let done = false;
    const s = sheet(title, h('div', { class: 'stack' },
      h('p', { class: 'muted', style: { margin: '0 4px 8px', lineHeight: 1.45 } }, text),
      h('button', { class: 'btn block' + (danger ? ' danger' : ''), style: danger ? { background: 'var(--card-2)' } : null, onclick: () => { done = true; s.close(); res(true); } }, okLabel),
      h('button', { class: 'btn block secondary', onclick: () => { s.close(); } }, 'Cancel')), { onClose: () => { if (!done) res(false); } });
  });
}

export function avatar(p, size = 44, online) {
  const a = h('div', { class: 'avatar', style: { '--c': p?.color || '#8e8e93', width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.4) + 'px' } });
  const name = p?.name || '?';
  if (p?.avatar) a.append(h('span', { class: 'emo' }, p.avatar));
  else a.append(name.trim().slice(0, 1).toUpperCase());
  if (online !== undefined) a.append(h('span', { class: 'dot' + (online ? ' on' : '') }));
  return a;
}

export function timeAgo(ts) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const hh = Math.round(m / 60); if (hh < 24) return `${hh} h ago`;
  const d = Math.round(hh / 24); if (d < 7) return `${d} d ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Link copied'); }
  catch { const i = h('input', { value: t }); document.body.append(i); i.select(); document.execCommand('copy'); i.remove(); toast('Link copied'); }
}

export function shareRow(url, text) {
  const full = `${text} ${url}`;
  return h('div', { class: 'share-row' },
    h('button', { onclick: async () => { haptic(); if (navigator.share) { try { await navigator.share({ title: 'BOSHX', text, url }); } catch { /* cancelled */ } } else copyText(url); }, html: icons.share + '<span>Share</span>' }),
    h('button', { onclick: () => { haptic(); open('https://wa.me/?text=' + encodeURIComponent(full), '_blank'); }, html: icons.whatsapp + '<span>WhatsApp</span>' }),
    h('button', { onclick: () => { haptic(); open('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text), '_blank'); }, html: icons.telegram + '<span>Telegram</span>' }),
    h('button', { onclick: () => { haptic(); copyText(url); }, html: icons.copy + '<span>Copy</span>' }));
}

export function seg(options, value, onChange) {
  const el = h('div', { class: 'seg' });
  const render = v => { [...el.children].forEach((b, i) => b.classList.toggle('on', String(options[i][0]) === String(v))); };
  options.forEach(([v, label]) => el.append(h('button', { type: 'button', onclick: () => { haptic(6); render(v); onChange(v); } }, label)));
  render(value);
  return el;
}

export function toggle(checked, onChange) {
  const inp = h('input', { type: 'checkbox' });
  inp.checked = !!checked;
  inp.addEventListener('change', () => { haptic(6); onChange(inp.checked); });
  return h('label', { class: 'toggle' }, inp, h('span'));
}

export function stepper(value, min, max, onChange) {
  const val = h('span', { class: 'val' }, value);
  let v = value;
  const set = n => { v = Math.max(min, Math.min(max, n)); val.textContent = v; onChange(v); haptic(6); };
  return h('div', { class: 'stepper' }, h('button', { type: 'button', 'aria-label': 'Less', onclick: () => set(v - 1) }, '−'), val, h('button', { type: 'button', 'aria-label': 'More', onclick: () => set(v + 1) }, '+'));
}

export const AVATARS = ['😎', '🦁', '🐯', '🦊', '🐼', '🐵', '🦄', '🐲', '👻', '🤖', '🔥', '⚡', '🎯', '🎮', '👑', '💎', '🌙', '🍀'];
export const COLORS = ['#0A84FF', '#30D158', '#FF9F0A', '#FF375F', '#BF5AF2', '#64D2FF', '#FFD60A', '#AC8E68', '#8E8E93', '#FF6B3D'];
