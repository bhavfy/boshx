import { h, icons, toast, seg, toggle, confirmSheet, haptic } from '../ui.js';
import { DEL, setToken } from '../api.js';
import { prefs, savePrefs, applyTheme, state } from '../store.js';
import { BACKS, cardURL } from '../cardart.js';
import { editProfile } from './profile.js';
import { VERSION } from '../config.js';
import { markSVG } from '../logo.js';

export default async function settings(root, { navigate }) {
  const view = h('div', { class: 'view' });
  root.append(view);
  view.append(h('div', { class: 'topbar' }, h('button', { class: 'back-btn', onclick: () => history.length > 1 ? history.back() : navigate('#/'), html: icons.back + 'Back' }), h('span')));
  view.append(h('h1', { class: 'large-title' }, 'Settings'));

  view.append(h('div', { class: 'group-label' }, 'Appearance'),
    h('div', { class: 'group', style: { padding: '12px' } }, seg([['dark', 'Dark'], ['light', 'Light'], ['system', 'Auto']], prefs.theme, v => { savePrefs({ theme: v }); applyTheme(); })));

  view.append(h('div', { class: 'group-label' }, 'Game'),
    h('div', { class: 'group' },
      h('div', { class: 'cell' }, h('div', { class: 'cell-main' }, h('div', { class: 'cell-title' }, 'Haptics'), h('div', { class: 'cell-sub' }, 'Vibrate on turns and matches (Android)')), toggle(prefs.haptics, v => savePrefs({ haptics: v }))),
      h('div', { class: 'cell', style: { flexDirection: 'column', alignItems: 'stretch' } },
        h('div', { class: 'cell-title' }, '3D table'),
        h('div', { class: 'cell-sub', style: { marginBottom: '10px' } }, 'Lite uses no WebGL, best for older phones'),
        seg([['auto', 'Auto'], ['high', '3D'], ['lite', 'Lite']], prefs.quality, v => savePrefs({ quality: v })))));

  const backs = h('div', { class: 'hscroll', style: { margin: '0', padding: '12px' } });
  const renderBacks = () => { backs.innerHTML = ''; BACKS.forEach(b => backs.append(h('button', { style: { width: '64px', textAlign: 'center' }, onclick: () => { haptic(5); savePrefs({ back: b.id }); renderBacks(); } },
    h('img', { src: cardURL('back:' + b.id), alt: b.name, style: { width: '64px', borderRadius: '7px', outline: prefs.back === b.id ? '2px solid var(--text)' : 'none', outlineOffset: '2px' } }),
    h('div', { class: 'small', style: { marginTop: '6px', color: prefs.back === b.id ? 'var(--text)' : 'var(--text-2)' } }, b.name)))); };
  renderBacks();
  view.append(h('div', { class: 'group-label' }, 'Default card back (for rooms you create)'), h('div', { class: 'group' }, backs));

  view.append(h('div', { class: 'group-label' }, 'Platform'),
    h('div', { class: 'group' },
      h('button', { class: 'cell', onclick: () => navigate('#/manage') }, h('div', { class: 'avatar', style: { '--c': '#3a3a3c', width: '32px', height: '32px' }, html: icons.grid }), h('div', { class: 'cell-main' }, h('div', { class: 'cell-title' }, 'Games Management'), h('div', { class: 'cell-sub' }, 'Add, edit, publish games · owner PIN')), h('span', { html: icons.chev }))));

  view.append(h('div', { class: 'group-label' }, 'Account'),
    h('div', { class: 'group' },
      h('button', { class: 'cell', onclick: () => editProfile() }, h('div', { class: 'cell-main' }, h('div', { class: 'cell-title' }, 'Edit profile'), h('div', { class: 'cell-sub' }, `${state.me.name} · @${state.me.username}`)), h('span', { html: icons.chev })),
      h('button', { class: 'cell', onclick: async () => {
        if (!(await confirmSheet('Delete profile?', 'Your profile, stats, friends and history are deleted from the server. This cannot be undone.', 'Delete profile', true))) return;
        try { await DEL('/me'); setToken(null); localStorage.removeItem('boshx.lastRoom'); toast('Profile deleted'); setTimeout(() => { location.hash = ''; location.reload(); }, 600); }
        catch (e) { toast(e.message); }
      } }, h('div', { class: 'cell-main' }, h('div', { class: 'cell-title', style: { color: 'var(--red)' } }, 'Delete profile')))),
    h('div', { class: 'group-foot' }, 'Your profile key is saved on this phone. If you clear browser data, you start with a new profile.'));

  view.append(h('div', { style: { textAlign: 'center', margin: '34px 0 0', color: 'var(--text-3)' } }, h('div', { html: markSVG(30) }), h('div', { class: 'small' }, `BOSHX ${VERSION}`)));
}
