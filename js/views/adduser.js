import { h, avatar, toast, haptic } from '../ui.js';
import { GET, POST } from '../api.js';
import { state } from '../store.js';

export default async function adduser(root, { params, navigate }) {
  const u = params[0];
  const view = h('div', { class: 'view' });
  root.append(view);
  view.append(h('div', { class: 'center-load' }, h('div', { class: 'spinner' })));
  try {
    const { user } = await GET('/users/' + u);
    view.innerHTML = '';
    const isMe = user.id === state.me.id;
    view.append(h('div', { style: { textAlign: 'center', paddingTop: '60px' } },
      h('div', { style: { display: 'inline-block' } }, avatar(user, 96, user.online)),
      h('h1', { style: { margin: '16px 0 2px' } }, user.name),
      h('div', { class: 'muted' }, '@' + user.username),
      h('div', { class: 'muted small', style: { margin: '10px 0 28px' } }, `${user.stats.played} games · ${user.stats.wins} wins`),
      isMe ? h('p', { class: 'muted' }, 'This is your own invite link. Share it with friends!') :
        h('button', { class: 'btn block', onclick: async () => {
          try { await POST('/friends', { username: user.username }); haptic([10, 30, 10]); toast(`${user.name} added`); navigate('#/friends'); }
          catch (e) { toast(e.message); }
        } }, 'Add Friend'),
      h('button', { class: 'btn block secondary', style: { marginTop: '10px' }, onclick: () => navigate('#/') }, 'Home')));
  } catch (e) {
    view.innerHTML = '';
    view.append(h('div', { class: 'empty', style: { marginTop: '60px' } }, e.message), h('button', { class: 'btn block secondary', style: { marginTop: '12px' }, onclick: () => navigate('#/') }, 'Home'));
  }
}
