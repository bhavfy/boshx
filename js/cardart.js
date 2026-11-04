// Procedural card art: faces and backs drawn on canvas (no image files).
// Used by the DOM hand (as image URLs) and by the 3D table (as textures).
export const CW = 250, CH = 350;
const FONT = '-apple-system, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const RED = '#d4213d', BLACK = '#141416';

export const BACKS = [
  { id: 'midnight', name: 'Midnight' },
  { id: 'graphite', name: 'Graphite' },
  { id: 'royal', name: 'Royal Blue' },
  { id: 'crimson', name: 'Crimson' },
  { id: 'aurora', name: 'Aurora' },
  { id: 'gold', name: 'Black Gold' },
];

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function suitPath(ctx, s, cx, cy, size, flip = false) {
  ctx.save();
  ctx.translate(cx, cy);
  if (flip) ctx.rotate(Math.PI);
  ctx.scale(size, size);
  ctx.beginPath();
  if (s === 'H') {
    ctx.moveTo(0, 0.46);
    ctx.bezierCurveTo(-0.16, 0.3, -0.5, 0.08, -0.5, -0.16);
    ctx.bezierCurveTo(-0.5, -0.38, -0.33, -0.5, -0.2, -0.5);
    ctx.bezierCurveTo(-0.08, -0.5, -0.01, -0.42, 0, -0.32);
    ctx.bezierCurveTo(0.01, -0.42, 0.08, -0.5, 0.2, -0.5);
    ctx.bezierCurveTo(0.33, -0.5, 0.5, -0.38, 0.5, -0.16);
    ctx.bezierCurveTo(0.5, 0.08, 0.16, 0.3, 0, 0.46);
  } else if (s === 'D') {
    ctx.moveTo(0, -0.52);
    ctx.quadraticCurveTo(0.18, -0.22, 0.4, 0);
    ctx.quadraticCurveTo(0.18, 0.22, 0, 0.52);
    ctx.quadraticCurveTo(-0.18, 0.22, -0.4, 0);
    ctx.quadraticCurveTo(-0.18, -0.22, 0, -0.52);
  } else if (s === 'S') {
    ctx.moveTo(0, -0.5);
    ctx.bezierCurveTo(0.16, -0.3, 0.5, -0.1, 0.5, 0.12);
    ctx.bezierCurveTo(0.5, 0.34, 0.32, 0.42, 0.2, 0.42);
    ctx.bezierCurveTo(0.12, 0.42, 0.05, 0.38, 0.03, 0.32);
    ctx.quadraticCurveTo(0.06, 0.44, 0.16, 0.52);
    ctx.lineTo(-0.16, 0.52);
    ctx.quadraticCurveTo(-0.06, 0.44, -0.03, 0.32);
    ctx.bezierCurveTo(-0.05, 0.38, -0.12, 0.42, -0.2, 0.42);
    ctx.bezierCurveTo(-0.32, 0.42, -0.5, 0.34, -0.5, 0.12);
    ctx.bezierCurveTo(-0.5, -0.1, -0.16, -0.3, 0, -0.5);
  } else if (s === 'C') {
    const c = (x, y, r) => { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); };
    c(0, -0.24, 0.215); c(-0.25, 0.08, 0.215); c(0.25, 0.08, 0.215);
    ctx.moveTo(0, -0.1); ctx.arc(0, 0.04, 0.14, 0, Math.PI * 2);
    ctx.moveTo(-0.04, 0.12);
    ctx.quadraticCurveTo(-0.04, 0.42, -0.17, 0.52);
    ctx.lineTo(0.17, 0.52);
    ctx.quadraticCurveTo(0.04, 0.42, 0.04, 0.12);
  }
  ctx.closePath();
  ctx.restore();
}

function fillSuit(ctx, s, cx, cy, size, color, flip) {
  suitPath(ctx, s, cx, cy, size, flip);
  ctx.fillStyle = color;
  ctx.fill('nonzero');
}

// pip layouts in a 0..1 box (x, y, flipped)
const PIPS = {
  2: [[.5, 0], [.5, 1, 1]],
  3: [[.5, 0], [.5, .5], [.5, 1, 1]],
  4: [[0, 0], [1, 0], [0, 1, 1], [1, 1, 1]],
  5: [[0, 0], [1, 0], [.5, .5], [0, 1, 1], [1, 1, 1]],
  6: [[0, 0], [1, 0], [0, .5], [1, .5], [0, 1, 1], [1, 1, 1]],
  7: [[0, 0], [1, 0], [.5, .25], [0, .5], [1, .5], [0, 1, 1], [1, 1, 1]],
  8: [[0, 0], [1, 0], [.5, .25], [0, .5], [1, .5], [.5, .75, 1], [0, 1, 1], [1, 1, 1]],
  9: [[0, 0], [1, 0], [0, .333], [1, .333], [.5, .5], [0, .667, 1], [1, .667, 1], [0, 1, 1], [1, 1, 1]],
  10: [[0, 0], [1, 0], [.5, .167], [0, .333], [1, .333], [0, .667, 1], [1, .667, 1], [.5, .833, 1], [0, 1, 1], [1, 1, 1]],
};

function base(ctx, dark) {
  rr(ctx, 1, 1, CW - 2, CH - 2, 20);
  const g = ctx.createLinearGradient(0, 0, 0, CH);
  if (dark) { g.addColorStop(0, '#1d1d20'); g.addColorStop(1, '#0c0c0e'); }
  else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f1f1ee'); }
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.10)';
  ctx.stroke();
}

function index(ctx, rank, suit, color) {
  for (const flip of [false, true]) {
    ctx.save();
    if (flip) { ctx.translate(CW, CH); ctx.rotate(Math.PI); }
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const fs = rank === '10' ? 40 : 46;
    ctx.font = `700 ${fs}px ${FONT}`;
    if (rank === '10') { ctx.save(); ctx.translate(33, 58); ctx.scale(0.82, 1); ctx.fillText('10', 0, 0); ctx.restore(); }
    else ctx.fillText(rank, 33, 58);
    fillSuit(ctx, suit, 33, 84, 30, color);
    ctx.restore();
  }
}

function crown(ctx, cx, cy, s, color) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-0.5, 0.25); ctx.lineTo(-0.5, -0.2); ctx.lineTo(-0.25, 0.02); ctx.lineTo(0, -0.32);
  ctx.lineTo(0.25, 0.02); ctx.lineTo(0.5, -0.2); ctx.lineTo(0.5, 0.25); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}

function faceCard(ctx, rank, suit, color) {
  const red = color === RED;
  const x = 58, y = 64, w = CW - 116, h = CH - 128;
  rr(ctx, x, y, w, h, 14);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  if (red) { g.addColorStop(0, '#fff1f3'); g.addColorStop(1, '#f7d5db'); }
  else { g.addColorStop(0, '#f3f3f6'); g.addColorStop(1, '#d9d9e0'); }
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = red ? 'rgba(212,33,61,.35)' : 'rgba(20,20,22,.25)'; ctx.stroke();
  rr(ctx, x + 7, y + 7, w - 14, h - 14, 9);
  ctx.lineWidth = 1; ctx.strokeStyle = red ? 'rgba(212,33,61,.22)' : 'rgba(20,20,22,.16)'; ctx.stroke();
  // corner pips inside the frame
  fillSuit(ctx, suit, x + 22, y + 24, 18, color);
  fillSuit(ctx, suit, x + w - 22, y + h - 24, 18, color, true);
  // emblem
  const cx = CW / 2, cy = CH / 2;
  if (rank === 'K') crown(ctx, cx, cy - 46, 58, color);
  if (rank === 'Q') { ctx.save(); ctx.translate(cx, cy - 50); for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * 18, i === 0 ? -6 : 0, i === 0 ? 8 : 6, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); } ctx.fillRect(-28, 8, 56, 6); ctx.restore(); }
  if (rank === 'J') { ctx.save(); ctx.translate(cx, cy - 48); ctx.fillStyle = color; ctx.fillRect(-26, -4, 52, 8); ctx.beginPath(); ctx.arc(0, -14, 9, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  ctx.fillStyle = color;
  ctx.font = `800 104px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(rank, cx, cy + 22);
  fillSuit(ctx, suit, cx, cy + 86, 26, color);
}

function joker(ctx, code) {
  const red = code === 'XR';
  rr(ctx, 1, 1, CW - 2, CH - 2, 20);
  const g = ctx.createLinearGradient(0, 0, CW, CH);
  if (red) { g.addColorStop(0, '#2a0a10'); g.addColorStop(1, '#5a0f1d'); }
  else { g.addColorStop(0, '#1b1b1e'); g.addColorStop(1, '#050506'); }
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.stroke();
  const ink = red ? '#ff5a6e' : '#f2f2f2';
  // vertical JOKER index
  for (const flip of [false, true]) {
    ctx.save();
    if (flip) { ctx.translate(CW, CH); ctx.rotate(Math.PI); }
    ctx.fillStyle = ink; ctx.font = `800 26px ${FONT}`; ctx.textAlign = 'center';
    'JOKER'.split('').forEach((ch, i) => ctx.fillText(ch, 28, 44 + i * 26));
    ctx.restore();
  }
  // star burst emblem
  const cx = CW / 2, cy = CH / 2 - 8;
  ctx.save(); ctx.translate(cx, cy + 14);
  const rg = ctx.createRadialGradient(0, 0, 4, 0, 0, 90);
  rg.addColorStop(0, red ? 'rgba(255,90,110,.55)' : 'rgba(255,255,255,.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 - Math.PI / 2; const r = i % 2 ? 16 : 40; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.fillStyle = ink; ctx.fill();
  // jester hat
  ctx.beginPath(); ctx.moveTo(-34, 6); ctx.quadraticCurveTo(-30, -40, -52, -54); ctx.quadraticCurveTo(-8, -40, 0, -10);
  ctx.quadraticCurveTo(8, -40, 52, -54); ctx.quadraticCurveTo(30, -40, 34, 6); ctx.closePath();
  ctx.fillStyle = red ? '#2a0a10' : '#111'; ctx.fill();
  ctx.fillStyle = ink; [[-52, -54], [52, -54], [0, -16]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); });
  ctx.restore();
  ctx.fillStyle = ink; ctx.font = `800 30px ${FONT}`; ctx.textAlign = 'center'; ctx.letterSpacing = '6px';
  ctx.fillText('JOKER', cx + 3, cy + 104);
  ctx.font = `600 13px ${FONT}`; ctx.globalAlpha = 0.55; ctx.fillText('BOSHX', cx + 3, cy + 128); ctx.globalAlpha = 1;
  ctx.letterSpacing = '0px';
}

export function drawFace(ctx, code) {
  ctx.clearRect(0, 0, CW, CH);
  if (code[0] === 'X') return joker(ctx, code);
  const rank = code.slice(0, -1), suit = code.slice(-1);
  const color = suit === 'H' || suit === 'D' ? RED : BLACK;
  base(ctx, false);
  index(ctx, rank, suit, color);
  if (rank === 'A') {
    fillSuit(ctx, suit, CW / 2, CH / 2, suit === 'S' ? 128 : 112, color);
    if (suit === 'S') { ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.font = `800 14px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('BOSHX', CW / 2, CH / 2 + 12); }
  } else if (PIPS[rank]) {
    const x0 = 84, x1 = CW - 84, y0 = 72, y1 = CH - 72;
    for (const [px, py, f] of PIPS[rank]) fillSuit(ctx, suit, x0 + (x1 - x0) * px, y0 + (y1 - y0) * py, 44, color, !!f);
  } else faceCard(ctx, rank, suit, color);
}

function emblem(ctx, cx, cy, s, ink, ink2) {
  // BOSHX mark: two crossed cards
  ctx.save(); ctx.translate(cx, cy);
  for (const [a, col] of [[-0.32, ink2], [0.32, ink]]) {
    ctx.save(); ctx.rotate(a);
    rr(ctx, -s * 0.32, -s * 0.46, s * 0.64, s * 0.92, s * 0.09);
    ctx.fillStyle = col; ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export function drawBack(ctx, id) {
  ctx.clearRect(0, 0, CW, CH);
  const cx = CW / 2, cy = CH / 2;
  ctx.save();
  rr(ctx, 1, 1, CW - 2, CH - 2, 20);
  ctx.clip();
  const lin = (a, b) => { const g = ctx.createLinearGradient(0, 0, CW, CH); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  let ink = '#fff', ink2 = 'rgba(255,255,255,.35)', border = 'rgba(255,255,255,.85)';
  if (id === 'graphite') {
    ctx.fillStyle = lin('#5a5a60', '#2a2a2e'); ctx.fillRect(0, 0, CW, CH);
    ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 16; i++) { rr(ctx, 18 + i * 7, 18 + i * 7, CW - 36 - i * 14, CH - 36 - i * 14, 14); ctx.stroke(); }
  } else if (id === 'royal') {
    ctx.fillStyle = lin('#1f3d8a', '#0b1a44'); ctx.fillRect(0, 0, CW, CH);
    ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1;
    for (let r = 10; r < 260; r += 9) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
    ink2 = 'rgba(160,190,255,.5)';
  } else if (id === 'crimson') {
    ctx.fillStyle = '#a3192d'; ctx.fillRect(0, 0, CW, CH);
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1.4;
    for (let i = -CH; i < CW + CH; i += 16) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + CH, CH); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i, CH); ctx.lineTo(i + CH, 0); ctx.stroke(); }
  } else if (id === 'aurora') {
    ctx.fillStyle = lin('#3b1d6e', '#0f5c63'); ctx.fillRect(0, 0, CW, CH);
    const rg = ctx.createRadialGradient(cx * 0.6, cy * 0.5, 10, cx, cy, 260);
    rg.addColorStop(0, 'rgba(255,120,200,.45)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, CW, CH);
  } else if (id === 'gold') {
    ctx.fillStyle = lin('#141414', '#050505'); ctx.fillRect(0, 0, CW, CH);
    ctx.strokeStyle = 'rgba(214,178,94,.55)'; ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI; ctx.beginPath(); ctx.ellipse(cx, cy, 100, 34, a, 0, Math.PI * 2); ctx.stroke(); }
    ink = '#d6b25e'; ink2 = 'rgba(214,178,94,.4)'; border = 'rgba(214,178,94,.9)';
  } else { // midnight
    ctx.fillStyle = lin('#202024', '#060607'); ctx.fillRect(0, 0, CW, CH);
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
    for (let i = -CH; i < CW + CH; i += 12) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + CH * 0.6, CH); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i + CH * 0.6, 0); ctx.lineTo(i, CH); ctx.stroke(); }
  }
  ctx.restore();
  // inner border + emblem
  rr(ctx, 12, 12, CW - 24, CH - 24, 13);
  ctx.lineWidth = 2.5; ctx.strokeStyle = border; ctx.stroke();
  emblem(ctx, cx, cy - 10, 92, ink, ink2);
  ctx.fillStyle = ink; ctx.font = `800 20px ${FONT}`; ctx.textAlign = 'center'; ctx.letterSpacing = '5px';
  ctx.fillText('BOSHX', cx + 2, cy + 74); ctx.letterSpacing = '0px';
  rr(ctx, 1, 1, CW - 2, CH - 2, 20); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.stroke();
}

const faceCanvasCache = new Map();
const urlCache = new Map();

export function cardCanvas(key) {
  // key: card code, or 'back:<id>'
  if (faceCanvasCache.has(key)) return faceCanvasCache.get(key);
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const ctx = c.getContext('2d');
  if (key.startsWith('back:')) drawBack(ctx, key.slice(5)); else drawFace(ctx, key);
  faceCanvasCache.set(key, c);
  return c;
}

export function cardURL(key) {
  const u = urlCache.get(key);
  if (u) return u;
  const d = cardCanvas(key).toDataURL('image/png');
  urlCache.set(key, d);
  return d;
}

// Pre-draw cards in idle time and encode them off the main thread (toBlob), so
// dealing and collecting never stall on image generation.
const ALL = (() => { const a = []; for (const s of ['S', 'H', 'D', 'C']) for (const r of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) a.push(r + s); a.push('XR', 'XB'); return a; })();
let warming = null;
export function warmCards(extra = []) {
  if (warming) return warming;
  const keys = [...extra, ...ALL].filter(k => !urlCache.has(k));
  const idle = window.requestIdleCallback || (fn => setTimeout(() => fn({ timeRemaining: () => 8 }), 16));
  warming = new Promise(res => {
    let i = 0;
    const work = deadline => {
      while (i < keys.length && deadline.timeRemaining() > 4) {
        const k = keys[i++];
        if (urlCache.has(k)) continue;
        const c = cardCanvas(k);
        urlCache.set(k, null); // reserved
        c.toBlob(b => { urlCache.set(k, b ? URL.createObjectURL(b) : c.toDataURL()); }, 'image/png');
      }
      if (i < keys.length) idle(work, { timeout: 500 }); else res();
    };
    idle(work, { timeout: 500 });
  });
  return warming;
}
