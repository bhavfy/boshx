import { h, icons, toast } from '../ui.js';
import { loadGames } from '../core.js';
import { gameThumb, clientURL } from '../thumbs.js';
import * as ui from '../ui.js';
import * as apiMod from '../api.js';
import * as store from '../store.js';
import * as core from '../core.js';
import * as config from '../config.js';

export const ctxFor = extra => ({ ui, api: apiMod, store, core, config, ...extra });

export default async function game(root, { params, navigate }) {
  const id = params[0];
  const games = await loadGames().catch(() => []);
  const g = games.find(x => x.id === id);
  if (!g) { navigate('#/', true); return; }
  if (g.playable && g.status === 'published') {
    const mod = await import(clientURL(g));
    return mod.hub(root, ctxFor({ game: g, navigate }));
  }
  // Not playable yet: an honest info page
  const view = h('div', { class: 'view' });
  root.append(view);
  const th = gameThumb(g);
  th.style.borderRadius = '22px';
  view.append(h('div', { class: 'topbar' }, h('button', { class: 'back-btn', onclick: () => navigate('#/'), html: icons.back + 'Home' }), h('span')),
    h('div', { style: { margin: '10px 0 18px' } }, th),
    h('h1', { style: { margin: '0 0 4px' } }, g.name),
    h('div', { class: 'muted', style: { marginBottom: '14px' } }, `${g.category} · ${g.mode === 'single' ? 'Single player' : `${g.minPlayers}–${g.maxPlayers} players`}`),
    h('p', { style: { lineHeight: 1.5 } }, g.description),
    h('div', { class: 'empty' }, 'Coming soon. This game is being built.'));
}
