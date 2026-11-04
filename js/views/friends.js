import { h, icons, avatar, toast, haptic, timeAgo, shareRow, confirmSheet } from '../ui.js';
import { GET, POST, DEL } from '../api.js';
import { state } from '../store.js';
import { friendLink } from '../config.js';

export default async function friends(root, { navigate }) {
  const me = state.me;
  const view = h('div', { class: 'view' });
  root.append(view);
  view.append(h('div', { class: 'topbar' }, h('span'), h('div')));
  view.append(h('h1', { class: 'large-title' }, 'Friends'));

  const input = h('input', { class: 'field', placeholder: 'Add by username', autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false' });
  const add = async () => {
    const u = input.value.trim().replace(/^@/, '').toLowerCase();
    if (!u) return;
    try {
      const r = await POST('/friends', { username: u });
      haptic([10, 30, 10]); toast(`${r.friend.name} added`);
      input.value = '';
      load();
    } catch (e) { toast(e.message); }
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  view.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, input), h('button', { class: 'btn', style: { height: '50px' }, onclick: add }, 'Add')));

  view.append(h('div', { class: 'group-label' }, 'Your invite link'),
    h('div', { class: 'group', style: { padding: '14px' } },
      h('div', { class: 'row', style: { marginBottom: '12px' } }, avatar(me, 40), h('div', { class: 'grow' }, h('div', { style: { fontWeight: 700 } }, me.name), h('div', { class: 'muted small' }, '@' + me.username))),
      shareRow(friendLink(me.username), `Add me on BOSHX (@${me.username}) and let's play cards!`)));

  const listWrap = h('div');
  view.append(h('div', { class: 'group-label' }, 'Friends'), listWrap);

  async function load() {
    try {
      const r = await GET('/friends');
      listWrap.innerHTML = '';
      if (!r.friends.length) { listWrap.append(h('div', { class: 'empty' }, 'No friends yet. Add by username or share your link.')); return; }
      const g = h('div', { class: 'group' });
      for (const f of r.friends) {
        g.append(h('div', { class: 'cell' },
          avatar(f, 42, f.online),
          h('div', { class: 'cell-main' }, h('div', { class: 'cell-title' }, f.name), h('div', { class: 'cell-sub' }, `@${f.username} · ${f.online ? 'Online' : f.lastSeen ? 'Seen ' + timeAgo(f.lastSeen) : 'Offline'} · ${f.stats.wins} wins`)),
          h('button', { class: 'icon-btn', 'aria-label': 'Remove friend', html: icons.trash, onclick: async () => {
            if (!(await confirmSheet('Remove friend?', `${f.name} will be removed from your friends.`, 'Remove', true))) return;
            await DEL('/friends/' + f.id).catch(e => toast(e.message)); load();
          } })));
      }
      listWrap.append(g, h('div', { class: 'group-foot' }, 'Invite friends into a room from the room lobby.'));
    } catch (e) { listWrap.innerHTML = ''; listWrap.append(h('div', { class: 'empty' }, e.message)); }
  }
  load();
  const t = setInterval(() => !document.hidden && load(), 15000);
  return () => clearInterval(t);
}
