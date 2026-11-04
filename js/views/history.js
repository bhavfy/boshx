import { h, timeAgo, sheet } from '../ui.js';
import { GET } from '../api.js';
import { loadGames } from '../core.js';

const REASONS = { last_standing: 'Last one standing', round_limit: 'Round limit reached', timer: 'Winner by timer', time_limit: 'Timer: most cards won' };

export default async function history(root) {
  const view = h('div', { class: 'view' });
  root.append(view);
  view.append(h('div', { class: 'topbar' }, h('span'), h('div')), h('h1', { class: 'large-title' }, 'Game History'));
  const body = h('div', null, h('div', { class: 'center-load' }, h('div', { class: 'spinner' })));
  view.append(body);
  try {
    const [{ history }, games] = await Promise.all([GET('/history'), loadGames().catch(() => [])]);
    body.innerHTML = '';
    if (!history.length) { body.append(h('div', { class: 'empty' }, 'No games yet. Finished games show up here.')); return; }
    const g = h('div', { class: 'group' });
    for (const it of history) {
      const game = games.find(x => x.id === it.gameId);
      g.append(h('button', { class: 'cell hist-row', onclick: () => detail(it, game) },
        h('div', { class: 'avatar', style: { '--c': it.won ? '#30D158' : '#3a3a3c' } }, it.won ? '🏆' : '#' + it.rank),
        h('div', { class: 'cell-main' },
          h('div', { class: 'cell-title' }, h('span', { class: it.won ? 'win-tag' : 'lose-tag' }, it.won ? 'Won' : `${ordinal(it.rank)} place`), ' · ', game?.short || it.gameId),
          h('div', { class: 'cell-sub' }, `${it.players.length} players · ${timeAgo(it.ts)} · Room ${it.room}`)),
        h('div', { style: { textAlign: 'right' } }, h('div', { class: 'score' }, it.score), h('div', { class: 'muted small' }, 'cards'))));
    }
    body.append(g);
  } catch (e) { body.innerHTML = ''; body.append(h('div', { class: 'empty' }, e.message)); }
}

const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

function detail(it, game) {
  const g = h('div', { class: 'group' });
  it.players.forEach((p, i) => g.append(h('div', { class: 'cell' },
    h('div', { style: { width: '26px', fontWeight: 800, color: 'var(--text-2)' } }, i + 1),
    h('div', { class: 'cell-main' }, h('div', { class: 'cell-title' }, p.name, p.won ? ' 🏆' : '')),
    h('div', { style: { fontWeight: 700 } }, `${p.score} cards`))));
  sheet(`${game?.short || 'Game'} · Room ${it.room}`, h('div', { class: 'stack' },
    h('div', { class: 'muted' }, `${new Date(it.ts).toLocaleString()} · ${REASONS[it.reason] || ''}${it.rules ? ' · ' + it.rules : ''}`),
    g,
    h('div', { class: 'muted small' }, `You: ${it.matches || 0} matches, took ${it.taken || 0} cards from the centre.`)));
}
