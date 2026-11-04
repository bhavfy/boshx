import { h, icons } from '../ui.js';
import { GET, POST } from '../api.js';
import { loadGames } from '../core.js';
import { clientURL } from '../thumbs.js';
import { ctxFor } from './game.js';

export default async function room(root, { params, navigate }) {
  const code = params[0];
  const view = h('div', { class: 'view' }, h('div', { class: 'center-load' }, h('div', { class: 'spinner' })));
  root.append(view);
  let r;
  try {
    r = await GET(`/rooms/${code}`);
    if (!r.me) r = await POST(`/rooms/${code}/join`);
  } catch (e) {
    view.innerHTML = '';
    view.append(h('div', { class: 'topbar' }, h('button', { class: 'back-btn', onclick: () => navigate('#/'), html: icons.back + 'Home' }), h('span')),
      h('div', { style: { textAlign: 'center', padding: '50px 10px' } }, h('div', { style: { fontSize: '44px' } }, '🃏'), h('h2', null, e.code === 'room_not_found' ? 'Room not found' : 'Can\'t join'), h('p', { class: 'muted' }, e.message),
        h('button', { class: 'btn', onclick: () => navigate('#/game/cards') }, 'Go to Playing Cards')));
    return;
  }
  const games = await loadGames().catch(() => []);
  const g = games.find(x => x.id === r.gameId) || { id: r.gameId };
  const mod = await import(clientURL(g));
  view.remove();
  localStorage.setItem('boshx.lastRoom', JSON.stringify({ code, at: Date.now() }));
  return mod.room(root, ctxFor({ game: g, navigate, code, initial: r }));
}
