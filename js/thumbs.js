import { h } from './ui.js';
import { cardURL } from './cardart.js';
import { APP_BASE } from './config.js';

// "3D" game thumbnail: card fan for Playing Cards, tilted emoji on a glass plate otherwise
export function gameThumb(g, opts = {}) {
  const el = h('div', { class: 'gthumb' });
  if (g.color) el.style.background = `linear-gradient(150deg, color-mix(in srgb, ${g.color} 75%, #fff 10%), color-mix(in srgb, ${g.color} 60%, #000 40%))`;
  if (g.thumbnail) el.append(h('img', { class: 'thumb-img', src: g.thumbnail, alt: '' }));
  else if (g.id === 'cards') el.append(cardFan(['XR', 'AS', 'KH'], 0.9));
  else { el.append(h('div', { class: 'plate' }), h('div', { class: 'emo3d' }, g.icon || '🎮')); }
  if (opts.badge) el.append(h('span', { class: 'badge' }, opts.badge));
  return el;
}

export function cardFan(codes, scale = 1) {
  const fan = h('div', { class: 'fan' });
  const n = codes.length;
  codes.forEach((c, i) => {
    const a = (i - (n - 1) / 2) * 16;
    const img = h('img', { src: cardURL(c), alt: '' });
    img.style.transform = `translate3d(${(i - (n - 1) / 2) * 14 * scale}%, ${Math.abs(i - (n - 1) / 2) * 4}%, ${i * 6}px) rotateX(14deg) rotate(${a}deg)`;
    fan.append(img);
  });
  return fan;
}

export const clientURL = g => new URL(String(g.client || `games/${g.id}/client.js`).replace(/^\//, ''), APP_BASE).href;
