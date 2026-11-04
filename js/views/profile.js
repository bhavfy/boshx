import { h, icons, avatar, toast, haptic, sheet, timeAgo, AVATARS, COLORS } from '../ui.js';
import { GET, PATCH } from '../api.js';
import { state } from '../store.js';
import { refreshMe } from '../core.js';

export function editProfile(onSaved) {
  const me = state.me;
  let av = me.avatar, color = me.color;
  const name = h('input', { class: 'field', value: me.name, maxlength: 18 });
  const user = h('input', { class: 'field', value: me.username, maxlength: 16, autocapitalize: 'off', spellcheck: 'false' });
  const avGrid = h('div', { class: 'avatar-pick' });
  AVATARS.forEach(a => avGrid.append(h('button', { type: 'button', class: a === av ? 'on' : '', onclick: e => { av = a; [...avGrid.children].forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); } }, a)));
  const colGrid = h('div', { class: 'color-pick' });
  COLORS.forEach(c => colGrid.append(h('button', { type: 'button', style: { background: c }, class: c === color ? 'on' : '', onclick: e => { color = c; [...colGrid.children].forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); } })));
  const s = sheet('Edit profile', h('div', { class: 'stack' },
    h('label', { class: 'label' }, 'Name'), name,
    h('label', { class: 'label' }, 'Username'), user,
    h('label', { class: 'label' }, 'Avatar'), avGrid,
    h('label', { class: 'label' }, 'Colour'), colGrid,
    h('button', { class: 'btn block', style: { marginTop: '10px' }, onclick: async () => {
      try { await PATCH('/me', { name: name.value, username: user.value, avatar: av, color }); await refreshMe(); haptic(10); toast('Saved'); s.close(); onSaved?.(); }
      catch (e) { toast(e.message); }
    } }, 'Save')));
}

export default async function profile(root, { navigate }) {
  const view = h('div', { class: 'view' });
  root.append(view);
  const render = async () => {
    view.innerHTML = '';
    let me = state.me;
    try { me = await refreshMe(); } catch { /* use cached */ }
    const s = me.stats || {};
    const played = s.played || 0, wins = s.wins || 0;
    view.append(h('div', { class: 'topbar' }, h('span'), h('div', { class: 'tb-actions' },
      h('button', { class: 'icon-btn', 'aria-label': 'Edit profile', html: icons.edit, onclick: () => editProfile(render) }),
      h('button', { class: 'icon-btn', 'aria-label': 'Settings', html: icons.settings, onclick: () => navigate('#/settings') }))));
    view.append(h('div', { style: { textAlign: 'center', margin: '4px 0 22px' } },
      h('div', { style: { display: 'inline-block' } }, avatar(me, 96)),
      h('h1', { style: { margin: '14px 0 2px', fontSize: '28px' } }, me.name),
      h('div', { class: 'muted' }, '@' + me.username)));
    view.append(h('div', { class: 'stats-grid' },
      stat(played, 'Games played'), stat(wins, 'Wins'), stat(s.losses || 0, 'Losses'),
      stat(played ? Math.round((wins / played) * 100) + '%' : '–', 'Win rate'), stat(s.high || 0, 'Highest score'), stat(s.matches || 0, 'Matches')));
    view.append(h('div', { class: 'section-title' }, h('h2', null, 'Badges'), h('span', { class: 'link' }, `${me.badges.length}/${state.badgeList.length}`)));
    view.append(h('div', { class: 'badges' }, state.badgeList.map(b => h('div', { class: 'badge-i' + (me.badges.includes(b.id) ? '' : ' locked'), title: b.desc, onclick: () => toast(`${b.icon} ${b.name}: ${b.desc}`) },
      h('span', { class: 'bi' }, b.icon), h('span', { class: 'bn' }, b.name)))));
    const fr = h('div');
    view.append(h('div', { class: 'section-title' }, h('h2', null, 'Friends'), h('a', { class: 'link', href: '#/friends' }, `${me.friendCount} · See all`)), fr);
    const hist = h('div');
    view.append(h('div', { class: 'section-title' }, h('h2', null, 'Recent games'), h('a', { class: 'link', href: '#/history' }, 'See all')), hist);
    GET('/friends').then(r => {
      if (!r.friends.length) { fr.append(h('div', { class: 'empty' }, 'Add friends to play together.')); return; }
      fr.append(h('div', { class: 'hscroll' }, r.friends.slice(0, 12).map(f => h('div', { style: { width: '64px', textAlign: 'center' } }, h('div', { style: { display: 'inline-block' } }, avatar(f, 52, f.online)), h('div', { class: 'small', style: { marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, f.name)))));
    }).catch(() => {});
    GET('/history').then(r => {
      if (!r.history.length) { hist.append(h('div', { class: 'empty' }, 'No games yet.')); return; }
      const g = h('div', { class: 'group' });
      r.history.slice(0, 4).forEach(it => g.append(h('div', { class: 'cell' },
        h('div', { class: 'cell-main' }, h('div', { class: 'cell-title' }, it.won ? '🏆 Won' : `#${it.rank} of ${it.players.length}`), h('div', { class: 'cell-sub' }, `Playing Cards · ${timeAgo(it.ts)}`)),
        h('div', { style: { fontWeight: 800 } }, `${it.score}`))));
      hist.append(g);
    }).catch(() => {});
  };
  render();
}
const stat = (v, l) => h('div', { class: 'stat' }, h('b', null, v), h('span', null, l));
