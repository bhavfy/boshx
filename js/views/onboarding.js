import { h, toast, haptic, avatar, AVATARS, COLORS } from '../ui.js';
import { POST, GET, setToken } from '../api.js';
import { markSVG } from '../logo.js';

export default async function onboarding(root, { done }) {
  let av = AVATARS[0], color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const preview = h('div');
  const nameIn = h('input', { class: 'field', placeholder: 'Your name', maxlength: 18, autocomplete: 'nickname' });
  const userIn = h('input', { class: 'field', placeholder: 'username', maxlength: 16, autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false' });
  const userHint = h('div', { class: 'group-foot', style: { margin: '6px 4px 0' } }, 'Friends add you with this. Letters, numbers, _ or .');
  let userTouched = false, checkT;
  const renderPreview = () => { preview.innerHTML = ''; preview.append(avatar({ name: nameIn.value || '?', avatar: av, color }, 76)); };
  const suggest = () => {
    if (userTouched) return;
    const base = nameIn.value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '').slice(0, 11);
    userIn.value = base.length >= 3 ? base + Math.floor(10 + Math.random() * 89) : '';
    check();
  };
  const check = () => {
    clearTimeout(checkT);
    const u = userIn.value.toLowerCase();
    if (!u) { userHint.textContent = 'Friends add you with this. Letters, numbers, _ or .'; return; }
    checkT = setTimeout(async () => {
      try {
        const r = await GET('/username-check?u=' + encodeURIComponent(u));
        userHint.textContent = r.ok ? `@${u} is available ✓` : r.reason === 'taken' ? `@${u} is taken` : '3–16 letters, numbers, _ or .';
        userHint.style.color = r.ok ? 'var(--green)' : 'var(--red)';
      } catch { /* ignore */ }
    }, 350);
  };
  nameIn.addEventListener('input', () => { renderPreview(); suggest(); });
  userIn.addEventListener('input', () => { userTouched = true; userIn.value = userIn.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''); check(); });

  const avGrid = h('div', { class: 'avatar-pick' });
  AVATARS.slice(0, 12).forEach(a => avGrid.append(h('button', { type: 'button', class: a === av ? 'on' : '', onclick: e => { av = a; haptic(5); [...avGrid.children].forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); renderPreview(); } }, a)));
  const colGrid = h('div', { class: 'color-pick' });
  COLORS.forEach(c => colGrid.append(h('button', { type: 'button', style: { background: c }, class: c === color ? 'on' : '', 'aria-label': c, onclick: e => { color = c; haptic(5); [...colGrid.children].forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); renderPreview(); } })));

  const go = h('button', { class: 'btn block', onclick: async () => {
    const name = nameIn.value.trim();
    if (!name) { toast('Enter your name'); nameIn.focus(); return; }
    go.disabled = true;
    try {
      const r = await POST('/profile', { name, username: userIn.value, avatar: av, color });
      setToken(r.token);
      haptic([10, 40, 10]);
      await done();
    } catch (e) { toast(e.message); go.disabled = false; }
  } }, 'Continue');

  renderPreview();
  root.append(h('div', { class: 'onb' },
    h('div', { class: 'onb-mark', html: markSVG(52, '#fff') }),
    h('h1', null, 'Welcome to BOSHX'),
    h('p', { class: 'muted', style: { margin: '0 0 26px', fontSize: '17px' } }, 'Play games with your friends. Set up your player card, no password needed.'),
    h('div', { class: 'row', style: { gap: '16px', marginBottom: '20px' } }, preview, h('div', { class: 'grow stack' }, nameIn)),
    h('label', { class: 'label' }, 'Username'), userIn, userHint,
    h('label', { class: 'label', style: { marginTop: '20px' } }, 'Avatar'), avGrid,
    h('label', { class: 'label', style: { marginTop: '20px' } }, 'Colour'), colGrid,
    h('div', { style: { flex: 1, minHeight: '28px' } }), go,
    h('p', { class: 'muted small', style: { textAlign: 'center', marginTop: '12px' } }, 'Your profile is saved on this phone.')));
  setTimeout(() => nameIn.focus(), 300);
}
