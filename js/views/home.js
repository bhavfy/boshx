import { h, icons, avatar, haptic, timeAgo } from '../ui.js';
import { state, prefs } from '../store.js';
import { loadGames } from '../core.js';
import { GET } from '../api.js';
import { logoHTML } from '../logo.js';
import { gameThumb, cardFan } from '../thumbs.js';

function tile(g, navigate, opts = {}) {
  const playable = g.status === 'published';
  return h('button', { class: 'gtile' + (opts.mini ? ' mini-tile' : ''), onclick: () => { haptic(6); navigate('#/game/' + g.id); } },
    gameThumb(g, { badge: opts.badge }),
    h('div', { class: 'gmeta' },
      h('div', { style: { minWidth: 0 } }, h('div', { class: 'gname' }, g.short || g.name), h('div', { class: 'gsub' }, g.mode === 'single' ? 'Single player' : `${g.minPlayers}–${g.maxPlayers} players`)),
      opts.mini ? null : playable && g.playable ? h('span', { class: 'gplay' }, 'Play') : h('span', { class: 'gsoon' }, 'Soon')));
}

export default async function home(root, { navigate }) {
  const me = state.me;
  const view = h('div', { class: 'view' });
  root.append(view);
  view.append(h('div', { class: 'topbar' },
    h('span', { html: logoHTML(20) }),
    h('div', { class: 'tb-actions' },
      h('button', { class: 'icon-btn', 'aria-label': 'Settings', html: icons.settings, onclick: () => navigate('#/settings') }),
      h('button', { 'aria-label': 'Profile', onclick: () => navigate('#/profile') }, avatar(me, 38)))));
  view.append(h('h1', { class: 'large-title' }, `Hi, ${me.name.split(' ')[0]}`));
  const body = h('div', null, h('div', { class: 'center-load', style: { minHeight: '30vh' } }, h('div', { class: 'spinner' })));
  view.append(body);

  let games = [];
  try { games = await loadGames(true); } catch (e) { body.innerHTML = ''; body.append(h('div', { class: 'empty' }, e.message)); return; }
  body.innerHTML = '';
  const published = games.filter(g => g.status === 'published');
  const drafts = games.filter(g => g.status !== 'published');
  const featured = published.find(g => g.id === 'cards') || published[0];

  if (featured) {
    body.append(h('div', { class: 'hero' },
      h('div', { class: 'hero-art' }, featured.id === 'cards' ? cardFan(['XB', 'AH', 'QS'], 1) : h('div', { style: { fontSize: '90px', textAlign: 'right' } }, featured.icon)),
      h('span', { class: 'tag', style: { marginTop: '70px' } }, 'Multiplayer · Featured'),
      h('h3', null, featured.short || featured.name),
      h('p', null, featured.id === 'cards' ? 'Match the centre card, take the pile. Last one standing wins.' : featured.description),
      h('button', { class: 'btn', onclick: () => { haptic(8); navigate('#/game/' + featured.id); } }, 'Play')));
  }

  // continue an unfinished room
  const last = JSON.parse(localStorage.getItem('boshx.lastRoom') || 'null');
  if (last && Date.now() - last.at < 6 * 3600e3) {
    const slot = h('div');
    body.append(slot);
    GET(`/rooms/${last.code}`).then(r => {
      if (!r.me || !['lobby', 'playing'].includes(r.status)) return;
      slot.append(h('div', { class: 'section-title' }, h('h2', null, 'Continue')),
        h('div', { class: 'group' }, h('button', { class: 'cell', onclick: () => navigate('#/room/' + last.code) },
          h('div', { class: 'avatar', style: { '--c': '#3a3a3c' }, html: icons.grid }),
          h('div', { class: 'cell-main' }, h('div', { class: 'cell-title' }, r.name), h('div', { class: 'cell-sub' }, `${r.status === 'playing' ? 'Game in progress' : 'In lobby'} · Room ${r.code} · ${r.players.filter(p => !p.left).length} players`)),
          h('span', { html: icons.chev }))));
    }).catch(() => {});
  }

  // recently played (device + server)
  const recentIds = [...prefs.recent];
  if (me.stats?.lastPlayed?.gameId && !recentIds.includes(me.stats.lastPlayed.gameId)) recentIds.unshift(me.stats.lastPlayed.gameId);
  const recent = recentIds.map(id => games.find(g => g.id === id)).filter(Boolean);
  body.append(h('div', { class: 'section-title' }, h('h2', null, 'Recently Played')));
  if (recent.length) body.append(h('div', { class: 'hscroll' }, recent.map(g => tile(g, navigate, { mini: true }))));
  else body.append(h('div', { class: 'empty' }, 'Games you play show up here.'));

  const newest = [...published].sort((a, b) => b.created - a.created).slice(0, 6);
  body.append(h('div', { class: 'section-title' }, h('h2', null, 'New Games')),
    h('div', { class: 'hscroll' }, newest.map(g => tile(g, navigate, { mini: true, badge: 'NEW' }))));

  body.append(h('div', { class: 'section-title' }, h('h2', null, 'All Games'), h('a', { class: 'link', href: '#/manage' }, 'Manage')),
    h('div', { class: 'grid2' }, published.map(g => tile(g, navigate))));

  if (drafts.length) {
    body.append(h('div', { class: 'section-title' }, h('h2', null, 'Coming Soon')),
      h('div', { class: 'hscroll' }, drafts.map(g => tile(g, navigate, { mini: true, badge: 'SOON' }))));
  }
}
