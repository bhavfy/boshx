import { h, icons, toast, haptic, seg, confirmSheet, stepper, toggle } from '../ui.js';
import { GET, POST, PUT, DEL } from '../api.js';
import { loadGames } from '../core.js';
import { gameThumb } from '../thumbs.js';

const PIN_KEY = 'boshx.pin';
const CATEGORIES = ['Cards', 'Memory', 'Detective', 'Mystery', 'Puzzle', 'Party', 'Trivia', 'Arcade', 'Other'];

async function pinGate(view, onOk) {
  const saved = sessionStorage.getItem(PIN_KEY);
  if (saved) {
    try { await POST('/admin/verify', {}, { pin: saved }); return onOk(saved); } catch { sessionStorage.removeItem(PIN_KEY); }
  }
  const { hasPin } = await GET('/admin/status');
  const pin = h('input', { class: 'field', type: 'password', inputmode: 'numeric', maxlength: 8, placeholder: hasPin ? 'Owner PIN' : 'Choose a 4–8 digit PIN', style: { textAlign: 'center', letterSpacing: '.3em', fontSize: '22px' } });
  const go = async () => {
    try {
      if (!hasPin) await POST('/admin/claim', { pin: pin.value });
      await POST('/admin/verify', {}, { pin: pin.value });
      sessionStorage.setItem(PIN_KEY, pin.value);
      haptic(10);
      onOk(pin.value);
    } catch (e) { toast(e.message); pin.value = ''; }
  };
  pin.addEventListener('keydown', e => e.key === 'Enter' && go());
  view.append(h('div', { style: { textAlign: 'center', padding: '40px 8px 0' } },
    h('div', { class: 'icon-btn', style: { width: '64px', height: '64px', margin: '0 auto 16px' }, html: icons.lock }),
    h('h2', { style: { margin: '0 0 6px' } }, hasPin ? 'Owner access' : 'Set owner PIN'),
    h('p', { class: 'muted', style: { margin: '0 0 22px' } }, hasPin ? 'Enter your PIN to manage games.' : 'Only someone with this PIN can add, edit or delete games. Set it once and keep it safe.'),
    h('div', { class: 'stack' }, pin, h('button', { class: 'btn block', onclick: go }, hasPin ? 'Unlock' : 'Set PIN'))));
  setTimeout(() => pin.focus(), 200);
}

export default async function manage(root, { params, navigate }) {
  const view = h('div', { class: 'view' });
  root.append(view);
  view.append(h('div', { class: 'topbar' }, h('button', { class: 'back-btn', onclick: () => navigate(params[0] ? '#/manage' : '#/settings'), html: icons.back + (params[0] ? 'Games' : 'Settings') }), h('span')));
  const body = h('div');
  view.append(body);
  await pinGate(body, pin => { body.innerHTML = ''; params[0] ? editor(body, params[0], pin, navigate) : list(body, pin, navigate); });
}

async function list(body, pin, navigate) {
  body.append(h('h1', { class: 'large-title' }, 'Games'));
  body.append(h('button', { class: 'btn block', style: { marginBottom: '8px' }, onclick: async () => {
    try { const r = await POST('/games', { name: 'New game', status: 'draft' }, { pin }); await loadGames(true); navigate('#/manage/' + r.game.id); }
    catch (e) { toast(e.message); }
  }, html: icons.plus + 'Add New Game' }));
  const games = await loadGames(true);
  const g = h('div', { class: 'group' });
  for (const game of games) {
    const th = gameThumb(game);
    th.style.cssText += ';width:52px;height:52px;border-radius:12px;flex:none;aspect-ratio:auto';
    g.append(h('button', { class: 'cell', onclick: () => navigate('#/manage/' + game.id) }, th,
      h('div', { class: 'cell-main' }, h('div', { class: 'cell-title' }, game.name),
        h('div', { class: 'cell-sub' }, `${game.status === 'published' ? '● Published' : '○ Draft'} · ${game.category} · ${game.playable ? 'module installed' : 'no module yet'}`)),
      h('span', { html: icons.chev })));
  }
  body.append(g, h('div', { class: 'group-foot' }, 'Each game is its own module (games/<id>/ on the app + games/<id>.js on the server). A new entry here is a draft until its module exists; publish it when it is ready. Playing Cards default rules are edited here too.'),
    h('div', { class: 'group-label' }, 'Owner'),
    h('div', { class: 'group' },
      h('button', { class: 'cell', onclick: async () => {
        const np = prompt('New PIN (4–8 digits)');
        if (!np) return;
        try { await POST('/admin/pin', { pin: np }, { pin }); sessionStorage.setItem(PIN_KEY, np); toast('PIN changed'); } catch (e) { toast(e.message); }
      } }, h('div', { class: 'cell-main' }, h('div', { class: 'cell-title' }, 'Change PIN'))),
      h('button', { class: 'cell', onclick: async () => {
        if (!(await confirmSheet('Restore built-in games?', 'Adds back any built-in game you deleted. Your edits stay.', 'Restore'))) return;
        await POST('/games/restore-defaults', {}, { pin }).catch(e => toast(e.message)); body.innerHTML = ''; list(body, pin, navigate);
      } }, h('div', { class: 'cell-main' }, h('div', { class: 'cell-title' }, 'Restore built-in games'))),
      h('button', { class: 'cell', onclick: () => { sessionStorage.removeItem(PIN_KEY); navigate('#/settings'); } }, h('div', { class: 'cell-main' }, h('div', { class: 'cell-title' }, 'Lock')))));
}

async function editor(body, id, pin, navigate) {
  let game;
  try { game = (await GET('/games/' + id)).game; } catch (e) { body.append(h('div', { class: 'empty' }, e.message)); return; }
  const d = { ...game };
  body.append(h('h1', { class: 'large-title' }, game.name));
  const preview = h('div', { style: { width: '150px', margin: '0 auto 8px', borderRadius: '18px', overflow: 'hidden' } });
  const renderPreview = () => { preview.innerHTML = ''; preview.append(gameThumb(d)); };
  renderPreview();
  const f = (label, el) => h('div', { style: { marginBottom: '14px' } }, h('label', { class: 'label' }, label), el);
  const input = (key, attrs = {}) => { const i = h('input', { class: 'field', value: d[key] ?? '', ...attrs }); i.addEventListener('input', () => { d[key] = i.value; renderPreview(); }); return i; };
  const desc = h('textarea', { class: 'field', style: { fontFamily: 'var(--font)', fontSize: '15px', minHeight: '90px' } }, d.description || '');
  desc.addEventListener('input', () => (d.description = desc.value));
  const cat = h('select', { class: 'field' }, CATEGORIES.map(c => h('option', { value: c, selected: c === d.category }, c)));
  cat.addEventListener('change', () => (d.category = cat.value));
  const file = h('input', { type: 'file', accept: 'image/*', class: 'hidden' });
  file.addEventListener('change', async () => {
    const fl = file.files[0]; if (!fl) return;
    const img = await createImageBitmap(fl);
    const c = document.createElement('canvas'); c.width = 400; c.height = 320;
    const s = Math.max(400 / img.width, 320 / img.height);
    c.getContext('2d').drawImage(img, (400 - img.width * s) / 2, (320 - img.height * s) / 2, img.width * s, img.height * s);
    d.thumbnail = c.toDataURL('image/jpeg', 0.82); renderPreview();
  });
  const rules = h('textarea', { class: 'field', spellcheck: 'false' }, JSON.stringify(d.rules || {}, null, 2));

  body.append(preview,
    h('div', { class: 'row', style: { justifyContent: 'center', marginBottom: '18px' } },
      h('button', { class: 'btn sm secondary', onclick: () => file.click() }, 'Upload thumbnail'),
      d.thumbnail ? h('button', { class: 'btn sm ghost', onclick: e => { d.thumbnail = ''; renderPreview(); e.currentTarget.remove(); } }, 'Remove') : null, file),
    f('Game name', input('name', { maxlength: 40 })),
    f('Short name (tiles)', input('short', { maxlength: 20 })),
    h('div', { class: 'row' }, h('div', { class: 'grow' }, f('Icon (emoji)', input('icon', { maxlength: 4 }))), h('div', { class: 'grow' }, f('Tile colour', (() => { const c = h('input', { type: 'color', class: 'field', value: d.color || '#2c2c2e', style: { padding: '6px' } }); c.addEventListener('input', () => { d.color = c.value; renderPreview(); }); return c; })()))),
    f('Description', desc),
    f('Category', cat),
    f('Mode', seg([['multiplayer', 'Multiplayer'], ['single', 'Single player']], d.mode, v => (d.mode = v))),
    h('div', { class: 'group', style: { marginBottom: '14px' } },
      h('div', { class: 'cell' }, h('div', { class: 'cell-main cell-title' }, 'Min players'), stepper(d.minPlayers || 1, 1, 16, v => (d.minPlayers = v))),
      h('div', { class: 'cell' }, h('div', { class: 'cell-main cell-title' }, 'Max players'), stepper(d.maxPlayers || 2, 1, 16, v => (d.maxPlayers = v)))),
    f(id === 'cards' ? 'Default rules for new rooms (JSON)' : 'Rules & settings (JSON)', rules),
    id === 'cards' ? h('div', { class: 'group-foot', style: { margin: '-6px 4px 14px' } }, 'Keys: matchBy (rank|suit), deck (std52|joker54), jokerWild, playMode (any|top), remainder (pile|deal|discard), collectorPlaysAgain, maxRounds, timeLimit, turnSeconds, name. Hosts can still change rules per room.') : null,
    f('Visibility', seg([['published', 'Published'], ['draft', 'Draft']], d.status, v => (d.status = v))),
    h('div', { class: 'muted small', style: { margin: '-4px 4px 18px' } }, game.playable ? '✓ Game module installed — playable.' : 'No game module yet — players will see it as "Coming soon" even if published.'),
    h('button', { class: 'btn block', onclick: async () => {
      let r;
      try { r = JSON.parse(rules.value || '{}'); } catch { toast('Rules JSON is not valid'); return; }
      try {
        await PUT('/games/' + id, { name: d.name, short: d.short, icon: d.icon, color: d.color, description: d.description, category: d.category, mode: d.mode, minPlayers: d.minPlayers, maxPlayers: d.maxPlayers, thumbnail: d.thumbnail || '', rules: r, status: d.status }, { pin });
        await loadGames(true); haptic(10); toast('Saved'); navigate('#/manage');
      } catch (e) { toast(e.message); }
    } }, 'Save'),
    h('button', { class: 'btn block danger', style: { marginTop: '8px' }, onclick: async () => {
      if (!(await confirmSheet('Delete game?', `"${game.name}" will be removed from BOSHX.`, 'Delete', true))) return;
      try { await DEL('/games/' + id, { pin }); await loadGames(true); toast('Deleted'); navigate('#/manage'); } catch (e) { toast(e.message); }
    } }, 'Delete game'));
}
