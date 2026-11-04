// BOSHX Playing Cards — client module. Exports hub() (game home) and room()
// (lobby + table + results). All game truth comes from the server.
import { h, icons, toast, haptic, sheet, avatar, shareRow, seg, toggle, stepper, confirmSheet, timeAgo } from '../../js/ui.js';
import { GET, POST } from '../../js/api.js';
import { state, prefs, addRecent } from '../../js/store.js';
import { roomLink } from '../../js/config.js';
import { cardURL, BACKS, warmCards } from '../../js/cardart.js';
import { cardFan } from '../../js/thumbs.js';
import { createVoice } from '../../js/voice.js';
import { RULE_SCHEMA, DEFAULT_RULES, normalizeRules, rulesSummary, HOW_TO_PLAY, cardName, isMatch } from './rules.js';

let CLOCK_OFF = 0; // server clock minus this device's clock (ms), refreshed on every poll
const srvNow = () => Date.now() + CLOCK_OFF;
const cssHref = new URL('./cards.css', import.meta.url).href;
if (!document.querySelector(`link[href="${cssHref}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: cssHref }));

const REASONS = { last_standing: 'Winner: last one standing', round_limit: 'Round limit reached: most cards wins', timer: 'Winner by timer', time_limit: 'Winner by timer' };

// ------------------------------------------------------------------ hub
export async function hub(root, ctx) {
  const { game, navigate } = ctx;
  addRecent(game.id);
  const view = h('div', { class: 'view' });
  root.append(view);
  const code = h('input', { class: 'field code-input', placeholder: 'CODE', maxlength: 5, autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false' });
  code.addEventListener('input', () => { code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  const join = () => { const c = code.value.trim(); if (c.length !== 5) { toast('Enter the 5-letter room code'); return; } haptic(8); navigate('#/room/' + c); };
  code.addEventListener('keydown', e => e.key === 'Enter' && join());

  const hero = h('div', { class: 'cg-hero' }, cardFan(['XR', 'AS', 'KH', 'QD', '7C'], 0.9));
  view.append(
    h('div', { class: 'topbar' }, h('button', { class: 'back-btn', onclick: () => navigate('#/'), html: icons.back + 'Home' }), h('span')),
    hero,
    h('h1', { style: { margin: '0 0 4px', fontSize: '28px', letterSpacing: '-.02em' } }, game.name),
    h('p', { class: 'muted', style: { margin: '0 0 18px', lineHeight: 1.45 } }, game.description),
    h('button', { class: 'btn block', onclick: () => createSheet(ctx) }, 'Create Game'),
    h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'grow' }, code), h('button', { class: 'btn secondary', style: { height: '50px' }, onclick: join }, 'Join')));

  const pub = h('div');
  view.append(h('div', { class: 'section-title' }, h('h2', null, 'Open rooms'), h('span', { class: 'link' }, 'Public')), pub);
  const loadPub = async () => {
    try {
      const { rooms } = await GET('/rooms/public');
      pub.innerHTML = '';
      if (!rooms.length) { pub.append(h('div', { class: 'empty' }, 'No public rooms right now. Create one and make it Public.')); return; }
      const g = h('div', { class: 'group' });
      rooms.forEach(r => g.append(h('button', { class: 'cell', onclick: () => navigate('#/room/' + r.code) },
        h('div', { class: 'row', style: { gap: '0' } }, r.players.slice(0, 3).map((p, i) => { const a = avatar(p, 34); a.style.marginLeft = i ? '-10px' : '0'; a.style.boxShadow = '0 0 0 2px var(--card)'; return a; })),
        h('div', { class: 'cell-main' }, h('div', { class: 'cell-title' }, r.name), h('div', { class: 'cell-sub' }, `${r.players.length}/${r.maxPlayers} players · ${r.code}`)),
        h('span', { class: 'gplay' }, 'Join'))));
      pub.append(g);
    } catch { /* keep last */ }
  };
  loadPub();
  const t = setInterval(() => !document.hidden && loadPub(), 5000);

  view.append(h('div', { class: 'section-title' }, h('h2', null, 'How to play')),
    h('div', { class: 'group' }, HOW_TO_PLAY.map((s, i) => h('div', { class: 'cell' }, h('div', { class: 'avatar', style: { '--c': '#3a3a3c', width: '28px', height: '28px', fontSize: '13px' } }, i + 1), h('div', { class: 'cell-main', style: { fontSize: '15px', lineHeight: 1.4 } }, s)))));
  return () => clearInterval(t);
}

// ------------------------------------------------------------------ rules UI
function ruleRows(rules, onChange, opts = {}) {
  const g = h('div', { class: 'group' });
  const build = () => {
    g.replaceChildren();
    for (const f of RULE_SCHEMA) {
      if (opts.skip?.includes(f.key)) continue;
      if (f.showIf && !f.showIf(rules)) continue; // e.g. the round limit is hidden while a Game timer is on
      let ctrl;
      if (f.type === 'bool') ctrl = opts.readonly ? h('span', { class: 'muted' }, rules[f.key] ? 'On' : 'Off') : toggle(rules[f.key], v => onChange(f.key, v));
      else if (opts.readonly) ctrl = h('span', { class: 'muted', style: { textAlign: 'right', maxWidth: '55%' } }, (f.options.find(o => String(o[0]) === String(rules[f.key])) || [, rules[f.key] < 1 ? rules[f.key] * 60 + ' s' : ''])[1]);
      else {
        ctrl = h('select', { class: 'mini-select' }, f.options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(rules[f.key]) }, l)));
        ctrl.addEventListener('change', () => { const o = f.options.find(x => String(x[0]) === ctrl.value); onChange(f.key, o[0]); if (f.key === 'timeLimit') { rules[f.key] = o[0]; build(); } });
      }
      g.append(h('div', { class: 'cell' }, h('div', { class: 'cell-main cell-title', style: { fontSize: '16px' } }, f.label), ctrl));
    }
  };
  build();
  return g;
}

function deckPick(value, onChange) {
  const el = h('div', { class: 'deck-pick' });
  const opt = (id, label, sub, top) => h('button', { type: 'button', class: 'deck-opt' + (value === id ? ' on' : ''), onclick: e => { value = id; haptic(5); [...el.children].forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); onChange(id); } },
    h('div', { class: 'mini-stack' }, h('img', { src: cardURL('AS'), style: { left: '0', top: '6px', transform: 'rotate(-8deg)' } }), h('img', { src: cardURL(top), style: { left: '6px', top: '2px', transform: 'rotate(6deg)' } })),
    h('div', null, h('div', { style: { fontWeight: 700 } }, label), h('div', { class: 'muted small' }, sub)));
  el.append(opt('std52', '52 cards', 'Standard', 'KH'), opt('joker54', '54 cards', 'With 2 Jokers', 'XR'));
  return el;
}

function backPick(value, onChange) {
  const el = h('div', { class: 'back-pick' });
  BACKS.forEach(b => el.append(h('button', { type: 'button', class: value === b.id ? 'on' : '', onclick: e => { haptic(5); [...el.children].forEach(x => x.classList.remove('on')); e.currentTarget.classList.add('on'); onChange(b.id); } },
    h('img', { src: cardURL('back:' + b.id), alt: b.name }), h('span', null, b.name))));
  return el;
}

function createSheet(ctx) {
  const { game, navigate } = ctx;
  const defaults = normalizeRules(game.rules || DEFAULT_RULES);
  const d = { maxPlayers: 4, public: false, back: prefs.back || 'midnight', rules: { ...defaults } };
  const chanceSeg = () => seg([['normal', 'Normal'], ['more', 'More'], ['lots', 'Lots']], d.rules.matchChance, v => (d.rules.matchChance = v));
  const chanceHost = h('div');
  chanceHost.append(chanceSeg());
  const moreHost = h('div');
  const buildMore = () => moreHost.replaceChildren(ruleRows(d.rules, (k, v) => (d.rules[k] = v), { skip: ['deck', 'matchBy', 'matchChance', 'timeLimit'] }));
  buildMore();
  const more = h('div', { class: 'hidden' }, h('div', { class: 'group-label' }, 'More rules'), moreHost);
  const timerNote = h('div', { class: 'muted small', style: { margin: '6px 4px 0' } });
  const setTimerNote = () => { timerNote.textContent = d.rules.timeLimit ? `When ${d.rules.timeLimit} min is up, the current play finishes and the player with the most cards wins. Always exactly one winner.` : 'No timer: the game runs until someone is left standing (or the round limit).'; };
  setTimerNote();
  const btn = h('button', { class: 'btn block', style: { marginTop: '18px' }, onclick: async () => {
    btn.disabled = true;
    try {
      const r = await POST('/rooms', { gameId: game.id, maxPlayers: d.maxPlayers, public: d.public, settings: { rules: d.rules, back: d.back } });
      haptic([10, 40, 10]); s.close(); navigate('#/room/' + r.code);
    } catch (e) { toast(e.message); btn.disabled = false; }
  } }, 'Create Room');
  const s = sheet('Create Game', h('div', null,
    h('div', { class: 'group' },
      h('div', { class: 'cell' }, h('div', { class: 'cell-main' }, h('div', { class: 'cell-title' }, 'Players'), h('div', { class: 'cell-sub' }, 'Room size, 2 to 8')), stepper(d.maxPlayers, 2, 8, v => (d.maxPlayers = v))),
      h('div', { class: 'cell', style: { flexDirection: 'column', alignItems: 'stretch' } }, h('div', { class: 'cell-title', style: { marginBottom: '8px' } }, 'Room'),
        seg([[false, 'Private (code/link)'], [true, 'Public']], d.public, v => (d.public = v === true || v === 'true')))),
    h('div', { class: 'group-label' }, 'Match mode'),
    seg([['rank', 'Number (7 on 7)'], ['suit', 'Symbol (♥ on ♥)']], d.rules.matchBy, v => { d.rules.matchBy = v; d.rules.matchChance = v === 'suit' ? 'normal' : 'lots'; chanceHost.replaceChildren(chanceSeg()); }),
    h('div', { class: 'group-label' }, 'Match chance'), chanceHost,
    h('div', { class: 'muted small', style: { margin: '6px 4px 0' } }, 'More = a card also matches the one two below (7, 3, 7). Lots = three below. Pure luck either way.'),
    h('div', { class: 'group-label' }, 'Game timer'),
    seg([[3, '3 min'], [5, '5 min'], [9, '9 min'], [15, '15 min'], [0, 'None']], d.rules.timeLimit, v => { d.rules.timeLimit = Number(v); setTimerNote(); buildMore(); }),
    timerNote,
    h('div', { class: 'group-label' }, 'Deck'), deckPick(d.rules.deck, v => (d.rules.deck = v)),
    h('div', { class: 'group-label' }, 'Card back'), backPick(d.back, v => (d.back = v)),
    h('button', { class: 'btn block ghost', style: { marginTop: '14px', height: '44px', fontSize: '15px' }, onclick: e => { more.classList.toggle('hidden'); e.currentTarget.textContent = more.classList.contains('hidden') ? 'More rules' : 'Hide rules'; } }, 'More rules'),
    more, btn));
}

// ------------------------------------------------------------------ room controller
export async function room(root, ctx) {
  const { navigate, code } = ctx;
  const meId = state.me.id;
  let view = ctx.initial;
  let online = new Set(view.online || []);
  let destroyed = false, pollT = null, inflight = null;
  let mode = null; // 'lobby' | 'table'
  let table = null; // Table UI instance
  const container = h('div');
  root.append(container);
  addRecent(view.gameId);
  warmCards(BACKS.map(b => 'back:' + b.id));
  // preload the table code while people gather in the lobby
  setTimeout(() => { if (prefs.quality !== 'lite') import('./table3d.js').catch(() => {}); else import('./tablecss.js').catch(() => {}); }, 1200);

  // ---------------- chat + voice (shared by lobby and table)
  let lastChatId = Math.max(0, ...(view.chat || []).map(m => m.id));
  let unread = 0, chatSheet = null;
  const chatBtns = new Set(), micBtns = new Set();
  const voice = createVoice({ code, meId, onChange: () => refreshMic() });
  window.__boshxVoiceStats = () => voice.stats(); // debug hook (used by tests)
  const pname = pid => (view.players.find(p => p.pid === pid) || {}).name || 'Player';
  function chatButton() {
    const b = h('button', { class: 'tbl-btn chat-btn', 'aria-label': 'Chat', onclick: openChat, html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg><span class="bdg hidden"></span>' });
    chatBtns.add(b); refreshBadge(); return b;
  }
  function micButton() {
    const b = h('button', { class: 'tbl-btn mic-btn', 'aria-label': 'Voice chat', onclick: micTap });
    micBtns.add(b); refreshMic(); return b;
  }
  function refreshBadge() {
    for (const b of chatBtns) { if (!b.isConnected && b.dataset.init) { chatBtns.delete(b); continue; } b.dataset.init = '1'; const d = b.querySelector('.bdg'); d.textContent = unread > 9 ? '9+' : unread; d.classList.toggle('hidden', !unread); }
  }
  const MIC_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  const MIC_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16"/></svg>';
  function refreshMic() {
    const st = voice.status();
    for (const b of micBtns) {
      if (!b.isConnected && b.dataset.init) { micBtns.delete(b); continue; }
      b.dataset.init = '1';
      b.innerHTML = st.joined && !st.muted ? MIC_ON : MIC_OFF;
      b.classList.toggle('live', st.joined && !st.muted);
      b.classList.toggle('joined', st.joined);
      b.setAttribute('aria-label', !st.joined ? 'Join voice chat' : st.muted ? 'Unmute mic' : 'Mute mic');
    }
  }
  async function micTap() {
    haptic(8);
    if (!voice.joined) {
      try { await voice.join(); toast('Voice on 🎙 Tap the mic to mute'); }
      catch (e) { toast(e.name === 'NotAllowedError' ? 'Mic permission denied. Allow it in browser settings.' : (e.message || 'Mic not available')); }
    } else { voice.setMuted(!voice.muted); toast(voice.muted ? 'Mic muted' : 'Mic on'); }
    refreshMic();
  }
  function chatRow(m) {
    const mine = m.pid === meId;
    const p = view.players.find(x => x.pid === m.pid) || { name: 'Player' };
    return h('div', { class: 'msg' + (mine ? ' mine' : '') }, mine ? null : avatar(p, 26), h('div', { class: 'bubble' }, mine ? null : h('b', null, p.name), m.text));
  }
  function openChat() {
    unread = 0; refreshBadge();
    const list = h('div', { class: 'chat-list' });
    (view.chat || []).forEach(m => list.append(chatRow(m)));
    if (!(view.chat || []).length) list.append(h('div', { class: 'muted small chat-empty', style: { textAlign: 'center', padding: '20px' } }, 'Say hi 👋'));
    const input = h('input', { class: 'field', placeholder: 'Message', maxlength: 200, enterkeyhint: 'send' });
    const sendMsg = async text => {
      text = (text ?? input.value).trim(); if (!text) return;
      input.value = '';
      try { await act({ type: 'chat', text }); haptic(5); } catch { /* toast shown */ }
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });
    const quick = h('div', { class: 'chat-quick' }, ['👍', '😂', '🔥', '😮', 'GG!', 'Your turn!'].map(q => h('button', { class: 'pill-tag', onclick: () => sendMsg(q) }, q)));
    const st = voice.status();
    const voiceBox = h('div', { class: 'group', style: { marginBottom: '12px' } });
    const renderVoice = () => {
      const s2 = voice.status();
      voiceBox.innerHTML = '';
      voiceBox.append(h('div', { class: 'cell' }, h('div', { class: 'cell-main' }, h('div', { class: 'cell-title' }, '🎙 Voice chat'), h('div', { class: 'cell-sub' }, s2.joined ? `${s2.muted ? 'Muted' : 'Mic on'} · ${s2.peers.filter(p => p.state === 'connected').length} connected` : 'Talk with everyone in the room')),
        s2.joined ? h('button', { class: 'btn sm secondary', onclick: () => { voice.leave(); setTimeout(renderVoice, 100); } }, 'Leave') : h('button', { class: 'btn sm', onclick: async () => { await micTap(); renderVoice(); } }, 'Join')));
      if (s2.joined) (view.voice || []).filter(p => p !== meId).forEach(pid => {
        const pr = s2.peers.find(x => x.pid === pid);
        voiceBox.append(h('div', { class: 'cell' }, h('div', { class: 'cell-main' }, h('div', { class: 'cell-title', style: { fontSize: '15px' } }, pname(pid)), h('div', { class: 'cell-sub' }, pr ? (pr.state === 'connected' ? 'Connected' : pr.state === 'failed' ? 'Could not connect (network)' : 'Connecting…') : 'Connecting…')),
          h('button', { class: 'btn sm ghost', onclick: () => { voice.togglePeer(pid); renderVoice(); } }, s2.peerMuted.includes(pid) ? 'Unmute' : 'Mute')));
      });
    };
    renderVoice();
    chatSheet = sheet('Room chat', h('div', null, voiceBox, list, quick, h('div', { class: 'row', style: { marginTop: '8px' } }, h('div', { class: 'grow' }, input), h('button', { class: 'btn', style: { height: '50px' }, onclick: () => sendMsg() }, 'Send'))),
      { onClose: () => { chatSheet = null; } });
    chatSheet.list = list; chatSheet.renderVoice = renderVoice;
    requestAnimationFrame(() => (list.scrollTop = list.scrollHeight));
  }
  function onChat(v) {
    const fresh = (v.chat || []).filter(m => m.id > lastChatId);
    if (!fresh.length) return;
    lastChatId = Math.max(lastChatId, ...fresh.map(m => m.id));
    for (const m of fresh) {
      if (chatSheet) { chatSheet.list.querySelector('.chat-empty')?.remove(); chatSheet.list.append(chatRow(m)); chatSheet.list.scrollTop = chatSheet.list.scrollHeight; }
      else if (m.pid !== meId) { unread++; toast(`💬 ${pname(m.pid)}: ${m.text}`, 2600); haptic(6); }
    }
    refreshBadge();
  }

  const apply = (v, fromAction, off) => {
    if (destroyed) return;
    if (v.serverTime) CLOCK_OFF = off != null ? off : v.serverTime - Date.now();
    if (v.online) online = new Set(v.online);
    if (v.same) { refreshPresence(); return; }
    const prevStatus = view?.status;
    view = v;
    onChat(v);
    voice.update(v.voice || []);
    chatSheet?.renderVoice?.();
    if (!view.me && prevStatus) { // removed from room
      toast(view.status === 'lobby' || view.status === 'finished' ? 'You were removed from the room' : 'You left the game');
      localStorage.removeItem('boshx.lastRoom');
      navigate('#/game/cards'); return;
    }
    if (view.status === 'lobby' || view.status === 'closed') showLobby();
    else showTable(fromAction);
  };

  function refreshPresence() {
    if (mode === 'lobby') lobby?.presence();
    else table?.presence();
  }

  // polling: fast in game, slower in lobby, slow when hidden
  const schedule = () => {
    clearTimeout(pollT);
    if (destroyed) return;
    const ms = document.hidden ? 5000 : view.status === 'playing' ? 800 : 1500;
    pollT = setTimeout(poll, ms);
  };
  async function poll() {
    if (destroyed) return;
    try {
      inflight = new AbortController();
      const t0 = Date.now();
      const r = await GET(`/rooms/${code}?v=${view.version}`, { signal: inflight.signal });
      apply(r, false, r.serverTime ? r.serverTime - (t0 + Date.now()) / 2 : null);
    } catch (e) {
      if (e.name !== 'AbortError' && e.code === 'room_not_found') { toast('Room closed'); navigate('#/game/cards'); return; }
    }
    schedule();
  }
  const onVis = () => { if (!document.hidden) { clearTimeout(pollT); poll(); } };
  document.addEventListener('visibilitychange', onVis);

  async function act(body) {
    try {
      inflight?.abort();
      const r = await POST(`/rooms/${code}/action`, body);
      apply(r, true);
      schedule();
      return r;
    } catch (e) {
      if (e.name !== 'AbortError') toast(e.message);
      schedule();
      throw e;
    }
  }

  // ---------------- lobby
  let lobby = null;
  function showLobby() {
    if (mode !== 'lobby') {
      table?.destroy(); table = null;
      mode = 'lobby';
      container.innerHTML = '';
      document.querySelector('.tabbar')?.classList.add('hidden');
      lobby = makeLobby();
    }
    lobby.render();
  }

  function makeLobby() {
    const el = h('div', { class: 'view', style: { paddingBottom: 'calc(var(--safe-b) + 30px)' } });
    container.append(el);
    let lastKey = '';
    const render = () => {
      const key = JSON.stringify([view.version, [...online].sort()]);
      if (key === lastKey) return;
      lastKey = key;
      const isHost = view.host === meId;
      const players = view.players.filter(p => !p.left);
      const r = view.settings.rules;
      el.innerHTML = '';
      el.append(h('div', { class: 'topbar' },
        h('button', { class: 'back-btn', onclick: () => navigate('#/game/cards'), html: icons.back + 'Cards' }),
        h('div', { class: 'row', style: { gap: '8px' } },
          h('span', { class: 'pill-tag', html: (view.public ? icons.globe : icons.lock).replace('<svg', '<svg width="13" height="13"') + (view.public ? 'Public' : 'Private') }),
          micButton(), chatButton())));
      el.append(h('div', { style: { textAlign: 'center', margin: '6px 0 14px' } },
        h('div', { class: 'muted small' }, view.name),
        h('div', { class: 'code-big' }, view.code),
        h('div', { class: 'muted small' }, 'Room code · friends join with this or the link')));
      el.append(shareRow(roomLink(view.code), `Join my BOSHX card game! Room ${view.code}`));

      el.append(h('div', { class: 'section-title' }, h('h2', null, 'Players'), h('span', { class: 'link' }, `${players.length}/${view.maxPlayers}`)));
      const seats = h('div', { class: 'seats' });
      players.forEach(p => seats.append(h('div', { class: 'seat' },
        avatar(p, 42, online.has(p.pid)),
        h('div', { style: { minWidth: 0 } }, h('div', { class: 'sname' }, p.pid === meId ? `${p.name} (you)` : p.name),
          p.pid === view.host ? h('span', { class: 'host-crown' }, '★ Host') : h('span', { class: 'muted small' }, online.has(p.pid) ? 'Online' : 'Offline')),
        isHost && p.pid !== meId ? h('button', { class: 'kick', 'aria-label': 'Remove ' + p.name, html: icons.close, onclick: async () => {
          if (await confirmSheet(`Remove ${p.name}?`, 'They will not be able to rejoin this room.', 'Remove', true)) act({ type: 'kick', pid: p.pid }).catch(() => {});
        } }) : null)));
      for (let i = players.length; i < view.maxPlayers; i++) seats.append(h('button', { class: 'seat empty', onclick: inviteSheet }, h('span', null, '+ Invite')));
      el.append(seats);

      el.append(h('div', { class: 'section-title' }, h('h2', null, 'Game settings'), isHost ? null : h('span', { class: 'link' }, 'Host decides')));
      const sg = h('div', { class: 'group' });
      if (isHost) {
        sg.append(
          h('div', { class: 'cell' }, h('div', { class: 'cell-main cell-title' }, 'Room size'), stepper(view.maxPlayers, Math.max(2, players.length), 8, v => debounceAct({ type: 'settings', maxPlayers: v }))),
          h('div', { class: 'cell' }, h('div', { class: 'cell-main cell-title' }, 'Public room'), toggle(view.public, v => act({ type: 'settings', public: v }).catch(() => {}))));
      }
      el.append(sg.childElementCount ? sg : '');
      el.append(h('div', { class: 'group-label' }, 'Match mode'));
      if (isHost) el.append(seg([['rank', 'Number (7 on 7)'], ['suit', 'Symbol (♥ on ♥)']], r.matchBy, v => act({ type: 'settings', settings: { rules: { matchBy: v } } }).catch(() => {})));
      else el.append(h('div', { class: 'group', style: { padding: '14px 16px' } }, r.matchBy === 'suit' ? 'Symbol Matching (♥ on ♥)' : 'Number Matching (7 on 7)'));
      el.append(h('div', { class: 'group-label' }, 'Game timer'));
      if (isHost) el.append(seg([[3, '3 min'], [5, '5 min'], [9, '9 min'], [15, '15 min'], [0, 'None']], r.timeLimit, v => act({ type: 'settings', settings: { rules: { timeLimit: Number(v) } } }).catch(() => {})));
      else el.append(h('div', { class: 'group', style: { padding: '14px 16px' } }, r.timeLimit ? (r.timeLimit < 1 ? r.timeLimit * 60 + ' s' : r.timeLimit + ' min') + ' timer · most cards wins, one winner' : 'No timer · last one standing'));
      el.append(h('div', { class: 'group-label' }, 'Deck'));
      if (isHost) el.append(deckPick(r.deck, v => act({ type: 'settings', settings: { rules: { deck: v } } }).catch(() => {})));
      else el.append(h('div', { class: 'group', style: { padding: '14px 16px' } }, r.deck === 'joker54' ? '54 cards (2 Jokers)' : '52 cards'));
      el.append(h('div', { class: 'group-label' }, 'Card back'));
      if (isHost) el.append(backPick(view.settings.back, v => act({ type: 'settings', settings: { back: v } }).catch(() => {})));
      else el.append(h('div', { class: 'back-pick' }, h('button', { class: 'on' }, h('img', { src: cardURL('back:' + view.settings.back) }), h('span', null, (BACKS.find(b => b.id === view.settings.back) || {}).name))));
      el.append(h('button', { class: 'btn block ghost', style: { marginTop: '14px', height: '44px', fontSize: '15px' }, onclick: () => rulesSheet(isHost) }, isHost ? 'All rules' : 'See all rules'),
        h('div', { class: 'group-foot', style: { textAlign: 'center' } }, rulesSummary(r)));

      el.append(h('div', { style: { height: '18px' } }));
      if (isHost) {
        el.append(h('button', { class: 'btn block', disabled: players.length < 2, onclick: async e => { e.currentTarget.disabled = true; haptic([10, 30, 10]); try { await act({ type: 'start' }); } catch { e.currentTarget && (e.currentTarget.disabled = false); } } },
          players.length < 2 ? 'Waiting for players…' : `Start game · ${players.length} players`));
      } else el.append(h('div', { class: 'empty', style: { borderStyle: 'solid' } }, h('div', { class: 'spinner', style: { margin: '0 auto 10px' } }), 'Waiting for the host to start'));
      el.append(h('button', { class: 'btn block secondary', style: { marginTop: '10px' }, onclick: inviteSheet }, 'Invite friends'),
        h('button', { class: 'btn block danger', style: { marginTop: '4px' }, onclick: async () => {
          if (!(await confirmSheet('Leave room?', isHost ? 'Host role passes to the next player.' : 'You can join again with the code.', 'Leave', true))) return;
          await act({ type: 'leave' }).catch(() => {});
          localStorage.removeItem('boshx.lastRoom');
          navigate('#/game/cards');
        } }, 'Leave room'));
    };
    return { render, presence: render };
  }

  let dT;
  function debounceAct(body) { clearTimeout(dT); dT = setTimeout(() => act(body).catch(() => {}), 350); }

  function rulesSheet(isHost) {
    const r = { ...view.settings.rules };
    const content = h('div', null,
      ruleRows(r, (k, v) => { r[k] = v; }, { readonly: !isHost }),
      h('div', { class: 'group-label' }, 'How to play'),
      h('div', { class: 'group' }, HOW_TO_PLAY.map(s => h('div', { class: 'cell', style: { fontSize: '14px', lineHeight: 1.4 } }, s))),
      isHost ? h('button', { class: 'btn block', style: { marginTop: '16px' }, onclick: async () => { try { await act({ type: 'settings', settings: { rules: r } }); s.close(); toast('Rules saved'); } catch { /* toast shown */ } } }, 'Save rules') : null);
    const s = sheet(r.name || 'Rules', content);
  }

  async function inviteSheet() {
    const list = h('div', null, h('div', { class: 'center-load', style: { minHeight: '120px' } }, h('div', { class: 'spinner' })));
    sheet('Invite friends', h('div', null,
      shareRow(roomLink(view.code), `Join my BOSHX card game! Room ${view.code}`),
      h('div', { class: 'group-label' }, 'Friends on BOSHX'), list));
    try {
      const { friends } = await GET('/friends');
      list.innerHTML = '';
      if (!friends.length) { list.append(h('div', { class: 'empty' }, 'No friends yet. Share the link above, or add friends from the Friends tab.')); return; }
      const g = h('div', { class: 'group' });
      const inRoom = new Set(view.players.map(p => p.pid));
      friends.forEach(f => {
        const b = h('button', { class: 'btn sm pill' + (inRoom.has(f.id) ? ' secondary' : ''), disabled: inRoom.has(f.id), onclick: async () => {
          try { await POST(`/rooms/${view.code}/invite`, { pid: f.id }); b.textContent = 'Invited ✓'; b.disabled = true; haptic(8); } catch (e) { toast(e.message); }
        } }, inRoom.has(f.id) ? 'In room' : 'Invite');
        g.append(h('div', { class: 'cell' }, avatar(f, 38, f.online), h('div', { class: 'cell-main' }, h('div', { class: 'cell-title' }, f.name), h('div', { class: 'cell-sub' }, f.online ? 'Online' : 'Offline')), b));
      });
      list.append(g);
    } catch (e) { list.innerHTML = ''; list.append(h('div', { class: 'empty' }, e.message)); }
  }

  // ---------------- table
  function showTable(fromAction) {
    if (mode !== 'table') {
      mode = 'table';
      container.innerHTML = '';
      lobby = null;
      document.querySelector('.tabbar')?.classList.add('hidden');
      table = makeTable(container, { meId, getView: () => view, getOnline: () => online, act, navigate, code, inviteSheet, rulesSheet });
      table.topActions.prepend(micButton(), chatButton());
    }
    table.update(fromAction);
  }

  apply(view);
  schedule();
  return () => {
    destroyed = true;
    clearTimeout(pollT);
    inflight?.abort();
    voice.destroy();
    chatSheet?.close();
    document.removeEventListener('visibilitychange', onVis);
    table?.destroy();
    document.querySelector('.tabbar')?.classList.remove('hidden');
  };
}

// ------------------------------------------------------------------ table UI
function makeTable(container, o) {
  const { meId, getView, getOnline, act, navigate } = o;
  let v = getView();
  const blind = () => v.settings.rules.playMode !== 'any';
  const root = h('div', { class: 'tbl' });
  const layer = h('div', { class: 'tbl-layer tbl-flex' });
  const titleEl = h('div', { class: 'tbl-title' });
  const opps = h('div', { class: 'opps' });
  const status = h('div', { class: 'status-line' });
  const center = h('div', { class: 'tbl-center' });
  const anchorM = h('div', { class: 'anchor-machine' });
  const anchorP = h('div', { class: 'anchor-pile' });
  const dropZone = h('div', { class: 'drop-zone' }, 'CENTRE');
  const pileInfo = h('div', { class: 'pile-info' });
  const flash = h('div', { class: 'match-flash' }, 'MATCH!');
  center.append(anchorM, anchorP, dropZone, pileInfo, flash);
  const banner = h('div', { class: 'turn-banner' });
  const meArea = h('div', { class: 'me-area' });
  const meBar = h('div', { class: 'me-bar' });
  const hand = h('div', { class: 'hand' });
  const handInner = h('div', { class: 'hand-inner' });
  hand.append(handInner);
  const topActions = h('div', { class: 'tb-actions' }, h('button', { class: 'tbl-btn', 'aria-label': 'Rules', html: icons.info, onclick: () => o.rulesSheet(false) }));
  layer.append(
    h('div', { class: 'tbl-top' }, h('button', { class: 'tbl-btn', 'aria-label': 'Leave game', html: icons.close, onclick: leave }), titleEl, topActions),
    opps, status, center, banner, meArea);
  root.append(layer);
  container.append(root);

  let lastSeq = 0, lastDealId = 0, busy = false, queue = [], destroyed = false;
  let selected = null, pendingPlay = null, wasMyTurn = false, resultsShown = false, handHidden = false, phase = 'table';
  const oppEls = new Map();
  const cardEls = new Map();
  let renderer = null;
  const rendererReady = (async () => {
    const wantLite = prefs.quality === 'lite' || !webglOK();
    try {
      const mod = wantLite ? await import('./tablecss.js') : await import('./table3d.js');
      renderer = await mod.createTable(root, { back: v.settings.back, anchorMachine: anchorM, anchorPile: anchorP });
    } catch (e) {
      console.warn('3D table failed, using lite', e);
      const mod = await import('./tablecss.js');
      renderer = await mod.createTable(root, { back: v.settings.back, anchorMachine: anchorM, anchorPile: anchorP });
    }
    root.prepend(renderer.el);
    renderer.hideMachine(false);
    if (destroyed) renderer.destroy();
  })();

  const name = pid => (getView().players.find(p => p.pid === pid) || {}).name || 'Player';
  const centerOf = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const myStackEl = () => meArea.querySelector('.my-stack .stk');
  const seatPoint = pid => {
    if (pid === meId) return centerOf(myStackEl() || meBar.querySelector('.ring') || meArea);
    const el = oppEls.get(pid);
    return el ? centerOf(el.querySelector('.ring')) : { x: innerWidth / 2, y: 80 };
  };

  // centre area: machine on top while dealing, otherwise a big pile in the middle
  function layoutCenter() {
    const c = center.getBoundingClientRect();
    if (!c.height) return;
    let pw, py;
    if (phase === 'machine') {
      const mw = Math.min(c.width * 0.7, 300), mh = Math.min(c.height * 0.5, mw * 0.72);
      Object.assign(anchorM.style, { width: mw + 'px', height: mh + 'px', top: c.height * 0.04 + 'px' });
      pw = Math.min(c.width * 0.24, (c.height * 0.36) / 1.4, 110);
      py = c.height * 0.04 + mh + (c.height - c.height * 0.04 - mh) * 0.5;
    } else {
      pw = Math.min(c.width * 0.4, 168, (c.height - 64) / 1.4);
      py = c.height * 0.46;
    }
    for (const el of [anchorP, dropZone]) Object.assign(el.style, { width: pw + 'px', top: py + 'px' });
    pileInfo.style.top = py + (pw * 1.4) / 2 + 8 + 'px';
    flash.style.top = py + 'px';
    renderer?.resize?.();
  }

  let timerEl = null, ringEl = null, autoNote = null, warned = false;
  function fmtClock(ms) { const sec = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); }
  function tickClock() {
    const g = v.game;
    if (timerEl && g?.timerEndsAt) {
      const left = g.timerEndsAt - srvNow();
      const up = g.timeUp || (left <= 0 && v.status === 'playing');
      timerEl.textContent = v.status !== 'playing' ? "Time's up" : up ? 'Time! last play…' : fmtClock(left);
      timerEl.classList.toggle('amber', !up && left < 60000);
      timerEl.classList.toggle('pulse', !up && left < 10000 && left > 0);
      timerEl.classList.toggle('up', up || v.status !== 'playing');
    }
    if (ringEl && g?.deadline) {
      const dl = g.deadline - srvNow();
      ringEl.classList.toggle('low', dl < 5000);
      if (autoNote) {
        const n = Math.ceil(dl / 1000);
        const show = v.status === 'playing' && dl > 0 && dl <= 5000 && !g.timeUp;
        autoNote.textContent = show ? (g.turnPid === meId ? `🤖 auto-play in ${n}…` : `auto in ${n}…`) : '';
        if (show && g.turnPid === meId && !warned) { warned = true; haptic([20, 50, 20]); }
        if (!show && dl > 5000) warned = false;
      }
    }
  }
  const clockT = setInterval(tickClock, 250);

  function renderTop() {
    const g = v.game;
    titleEl.innerHTML = '';
    titleEl.append(h('b', null, v.code));
    timerEl = null;
    if (g.timerEndsAt) { timerEl = h('span', { class: 'gtimer', 'aria-label': 'Game timer' }); titleEl.append(timerEl); tickClock(); }
    else titleEl.append(`Round ${Math.min(g.round, g.maxRounds || g.round)}${g.maxRounds ? ` / ${g.maxRounds}` : ''}`);
  }

  function renderOpps() {
    const g = v.game;
    const online = getOnline();
    const mi = g.seats.indexOf(meId);
    const ordered = mi >= 0 ? [...g.seats.slice(mi + 1), ...g.seats.slice(0, mi)] : g.seats.filter(p => p !== meId);
    for (const pid of [...oppEls.keys()]) if (!ordered.includes(pid)) { oppEls.get(pid).remove(); oppEls.delete(pid); }
    opps.classList.toggle('many', ordered.length > 4);
    ordered.forEach(pid => {
      const p = v.players.find(x => x.pid === pid) || { name: 'Player' };
      let el = oppEls.get(pid);
      if (!el) { el = h('div', { class: 'opp' }, h('div', { class: 'ring' }), h('div', { class: 'oname' }), h('div', { class: 'ocount' })); oppEls.set(pid, el); }
      opps.append(el);
      const out = g.out.includes(pid);
      el.classList.toggle('turn', g.turnPid === pid);
      el.classList.toggle('out', out);
      const ring = el.querySelector('.ring');
      ring.innerHTML = ''; ring.append(avatar(p, ordered.length > 4 ? 38 : 46, online.has(pid)));
      if ((v.voice || []).includes(pid)) ring.append(h('span', { class: 'voice-dot', title: 'In voice' }, '🎙'));
      el.querySelector('.oname').textContent = p.left ? `${p.name} (left)` : p.name;
      el.querySelector('.ocount').innerHTML = `<i></i>${g.handCounts[pid] ?? 0}`;
      el.querySelector('.out-tag')?.remove();
      if (out) el.append(h('span', { class: 'out-tag' }, 'OUT'));
    });
  }

  function renderMe() {
    const g = v.game;
    const me = v.players.find(p => p.pid === meId) || state.me;
    const out = g.out.includes(meId);
    const mine = g.turnPid === meId && v.status === 'playing';
    meArea.innerHTML = '';
    meArea.classList.toggle('turn', mine);
    const canShuffle = !out && g.myCount > 1 && v.status === 'playing';
    if (blind()) {
      const n = handHidden ? 0 : g.myCount;
      const stk = h('div', { class: 'stk' });
      const layers = Math.min(5, Math.ceil(n / 6) + 1, n);
      for (let i = 0; i < layers; i++) stk.append(h('img', { src: cardURL('back:' + v.settings.back), alt: '', style: { transform: `translate(${i * 1.5}px, ${-i * 2.5}px)` } }));
      if (!n) stk.append(h('div', { class: 'stk-empty' }, out ? 'OUT' : ''));
      const stackBtn = h('button', { class: 'my-stack', disabled: !mine || busy || !n, 'aria-label': 'Play top card', onclick: playTop },
        stk, h('span', { class: 'stk-count' }, n));
      meArea.append(h('div', { class: 'stack-row' },
        h('div', { class: 'me-chip' }, h('div', { class: 'ring' }, avatar(me, 40)), h('div', { class: 'mname' }, 'You'), h('div', { class: 'mcount' }, `${g.matches?.[meId] || 0} matches`)),
        h('div', { class: 'stack-wrap' }, stackBtn, h('div', { class: 'stk-hint' }, handHidden ? 'Dealing…' : out ? 'You are out' : mine ? 'Tap to play top card' : `${g.myCount} cards`)),
        h('div', { class: 'me-side' }, canShuffle ? h('button', { class: 'chip-btn', onclick: shuffleMine, html: icons.shuffle + 'Shuffle' }) : h('span'))));
    } else {
      meBar.innerHTML = '';
      meBar.append(h('div', { class: 'ring' }, avatar(me, 34)),
        h('div', { class: 'grow', style: { flex: 1, minWidth: 0 } }, h('div', { class: 'mname' }, out ? 'You are OUT' : 'Your cards'), h('div', { class: 'mcount' }, `${g.myCount} cards · ${g.matches?.[meId] || 0} matches`)),
        canShuffle ? h('button', { class: 'chip-btn', onclick: shuffleMine, html: icons.shuffle + 'Shuffle' }) : null);
      meArea.append(meBar, hand);
      renderHand();
    }
  }

  function renderBanner() {
    const g = v.game;
    const mine = g.turnPid === meId;
    banner.classList.toggle('mine', mine && v.status === 'playing');
    banner.innerHTML = '';
    if (v.status !== 'playing') { banner.textContent = 'Game over'; return; }
    if (handHidden) { banner.classList.remove('mine'); banner.textContent = 'Shuffling & dealing…'; return; }
    if (g.out.includes(meId)) banner.append(`You're out · ${g.turnPid ? name(g.turnPid) + "'s turn" : ''}`);
    else banner.append(mine ? (blind() ? 'Your turn' : selected ? 'Tap again to play' : 'Your turn · pick a card') : `${name(g.turnPid)}'s turn`);
    if (g.timeUp) banner.append(' · time is up!');
    ringEl = null; autoNote = null;
    if (g.deadline && g.deadline - srvNow() > -1500) {
      const left = Math.max(0, g.deadline - srvNow());
      const total = Math.max((v.settings.rules.turnSeconds || 1) * 1000, left);
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'tring');
      const bg = document.createElementNS(NS, 'circle'), fg = document.createElementNS(NS, 'circle');
      for (const [el, cls] of [[bg, 'bg'], [fg, 'fg']]) { el.setAttribute('cx', 12); el.setAttribute('cy', 12); el.setAttribute('r', 9.5); el.setAttribute('class', cls); el.setAttribute('pathLength', 100); }
      fg.style.strokeDasharray = '100'; fg.style.strokeDashoffset = String(100 * (1 - left / total));
      svg.append(bg, fg);
      banner.prepend(svg);
      autoNote = h('span', { class: 'auto-note' }); banner.append(autoNote);
      ringEl = svg;
      requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.transition = `stroke-dashoffset ${left}ms linear`; fg.style.strokeDashoffset = '100'; }));
      tickClock();
    }
    if (mine && !wasMyTurn) haptic([15, 40, 15]);
    wasMyTurn = mine;
  }

  function cardW(n) { const base = Math.max(54, Math.min(80, Math.round(innerWidth * 0.17))); return n > 16 ? Math.round(base * 0.82) : base; }

  function renderHand(entering = false) {
    if (blind()) return;
    const g = v.game;
    const cards = handHidden ? [] : (g.myHand || []);
    const N = cards.length;
    const cw = cardW(N);
    hand.style.setProperty('--cw', cw + 'px');
    const W = Math.min(innerWidth, 560) - 24;
    const rows = N > 16 ? 2 : 1;
    const per = Math.ceil(N / rows);
    let step = per > 1 ? Math.min(cw * 0.66, (W - cw) / (per - 1 + (rows === 2 ? 0.5 : 0))) : 0;
    step = Math.max(step, 13);
    const total = per ? cw + step * (per - 1) + (rows === 2 ? step / 2 : 0) : 0;
    handInner.style.width = Math.max(total + 24, W) + 'px';
    const startX = Math.max(12, (Math.max(total + 24, W) - total) / 2);
    hand.style.height = (rows === 2 ? Math.round(cw * 1.4 * 1.52 + 14) : Math.round(cw * 1.4 + 20)) + 'px';
    const keep = new Set(cards);
    for (const [c, el] of cardEls) if (!keep.has(c)) { el.remove(); cardEls.delete(c); if (selected === c) selected = null; }
    cards.forEach((c, idx) => {
      let el = cardEls.get(c);
      const row = rows === 2 ? (idx < per ? 0 : 1) : 0;
      const i = rows === 2 ? (row === 0 ? idx : idx - per) : idx;
      const n = rows === 2 ? (row === 0 ? per : N - per) : N;
      const mid = (n - 1) / 2;
      const x = startX + i * step + (rows === 2 && row === 1 ? step / 2 : 0);
      const rot = n > 1 ? (i - mid) / Math.max(mid, 1) * Math.min(7, n * 0.6) : 0;
      const y = (n > 1 ? Math.pow((i - mid) / Math.max(mid, 1), 2) * 6 : 0) - (rows === 2 && row === 0 ? Math.round(cw * 1.4 * 0.52) : 0);
      if (!el) {
        el = h('button', { class: 'hcard' + (entering ? ' enter' : ''), 'aria-label': cardName(c), onclick: () => tapCard(c) }, h('img', { src: cardURL(c), alt: '', draggable: 'false' }));
        el.style.setProperty('--x', x + 'px');
        if (entering) el.style.animationDelay = (i * 28) + 'ms';
        cardEls.set(c, el);
      }
      handInner.append(el);
      el.classList.toggle('sel', selected === c);
      el.style.transform = `translate3d(${x}px, ${y + (selected === c ? -22 : 0)}px, 0) rotate(${rot}deg)`;
    });
    hand.classList.toggle('dim', g.turnPid !== meId);
  }

  function renderPileInfo() {
    const g = v.game;
    dropZone.classList.toggle('hidden', g.pileCount > 0);
    pileInfo.innerHTML = '';
    pileInfo.append(h('b', null, g.pileCount), g.pileCount === 1 ? ' card in centre' : ' cards in centre');
  }

  let statusT;
  function say(text) {
    clearTimeout(statusT);
    status.textContent = text;
    status.classList.remove('show'); void status.offsetWidth; status.classList.add('show');
    statusT = setTimeout(() => status.classList.remove('show'), 2600);
  }

  function renderAll(entering) {
    renderTop(); renderOpps(); renderMe(); renderBanner(); renderPileInfo();
    if (!blind()) renderHand(entering);
  }

  function tapCard(c) {
    const g = v.game;
    if (v.status !== 'playing') return;
    if (g.turnPid !== meId) { haptic(5); say(`Wait for your turn · ${name(g.turnPid)} is playing`); return; }
    if (busy) return;
    if (selected !== c) { selected = c; haptic(6); renderHand(); renderBanner(); return; }
    playCard(c);
  }

  async function playCard(c) {
    const el = cardEls.get(c);
    const from = el ? centerOf(el) : centerOf(hand);
    selected = null;
    pendingPlay = c;
    if (el) el.style.opacity = '0';
    haptic(12);
    busy = true;
    const anim = renderer?.play({ from, card: c, faceUp: true });
    try { await act({ type: 'play', card: c }); }
    catch { pendingPlay = null; if (el) el.style.opacity = ''; await anim; busy = false; renderer?.setPile(v.game.pileTop, v.game.pileCount); renderAll(); return; }
    await anim;
    busy = false;
    drain();
  }

  async function playTop() {
    if (v.game.turnPid !== meId || busy || v.status !== 'playing') return;
    haptic(12);
    const btn = meArea.querySelector('.my-stack');
    btn?.classList.add('press');
    if (btn) btn.disabled = true;
    try { await act({ type: 'play' }); } catch { btn?.classList.remove('press'); if (btn) btn.disabled = false; }
  }

  async function shuffleMine() {
    haptic([8, 30, 8, 30, 8]);
    const s = myStackEl();
    s?.classList.remove('shuffling'); void s?.offsetWidth; s?.classList.add('shuffling');
    for (const el of cardEls.values()) { el.style.transition = 'transform .25s ease'; el.style.transform += ' translateY(-10px)'; }
    try { await act({ type: 'shuffle' }); say('You shuffled your cards'); } catch { /* toast shown */ }
    setTimeout(() => { for (const el of cardEls.values()) el.style.transition = ''; }, 400);
  }

  async function leave() {
    const playing = v.status === 'playing';
    if (playing && !(await confirmSheet('Leave game?', 'You will be out of this game and your cards leave the table.', 'Leave', true))) return;
    try { await act({ type: 'leave' }); } catch { /* ignore */ }
    localStorage.removeItem('boshx.lastRoom');
    navigate('#/game/cards');
  }

  function popAt(pt, text) {
    const p = h('div', { class: 'plus-pop', style: { left: pt.x + 'px', top: (pt.y - 30) + 'px' } }, text);
    layer.append(p); setTimeout(() => p.remove(), 1200);
  }

  // 🤖 badge on the centre pile for a moment when a card was auto-played for an idle player
  function showBotBadge() {
    center.querySelector('.bot-badge')?.remove();
    const b = h('div', { class: 'bot-badge' }, '🤖 Auto');
    b.style.top = anchorP.style.top; b.style.marginLeft = (parseFloat(anchorP.style.width) || 120) / 2 - 30 + 'px';
    center.append(b);
    setTimeout(() => b.remove(), 3000);
  }

  // Big, unmistakable MATCH moment: banner + the two matching cards + who took the pile.
  function showMatch(e, mine) {
    layer.querySelector('.match-big')?.remove();
    const who = mine ? 'Tumne' : name(e.pid) + ' ne';
    const imgs = [e.with, e.card].filter(Boolean).map((c, i) => h('img', { class: 'mb-card ' + (i ? 'b' : 'a'), src: cardURL(c), alt: cardName(c) }));
    const el = h('div', { class: 'match-big' + (mine ? ' mine' : '') },
      h('div', { class: 'mb-title' }, 'MATCH!'),
      h('div', { class: 'mb-cards' }, imgs),
      h('div', { class: 'mb-sub' }, `${who} pile li · ${e.n} cards`),
      e.sandwich ? h('div', { class: 'mb-note' }, 'Sandwich!') : null,
      e.auto ? h('div', { class: 'mb-note' }, '🤖 Auto-play (idle player)') : null);
    layer.append(el);
    setTimeout(() => el.remove(), 1900);
    haptic(mine ? [30, 60, 30, 60, 80] : [25, 50, 25]);
  }

  async function runEvent(e) {
    const g = v.game;
    if (e.type === 'deal') {
      handHidden = true;
      renderTop(); renderOpps(); renderMe(); renderBanner(); renderPileInfo();
      phase = 'machine'; layoutCenter();
      renderer?.setPile([], 0);
      await renderer?.showMachine();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const targets = g.seats.map(pid => ({ pid, ...seatPoint(pid) }));
      await renderer?.deal({ targets, perPlayer: g.perPlayer, onLand: () => haptic(3) });
      await renderer?.hideMachine(true);
      phase = 'table'; layoutCenter();
      handHidden = false;
      renderer?.setPile(g.pileTop.slice(-Math.min(g.pileTop.length, e.pile || 0)), e.pile || 0);
      renderMe();
      if (!blind()) renderHand(true);
      haptic([10, 30, 10]);
      say('Cards dealt · good luck!');
    } else if (e.type === 'play') {
      const mine = e.pid === meId;
      if (e.auto) {
        say(`🤖 AUTO · ${mine ? 'You' : name(e.pid)} played ${cardName(e.card)}`);
        toast(mine ? '🤖 Auto-play: tumne time pe card nahi dala, bot ne card chala diya' : `🤖 Auto-play: ${name(e.pid)} ne time pe card nahi dala, bot ne card chala diya`, 2800);
        haptic(mine ? [40, 60, 40] : 10);
        showBotBadge();
      } else say(`${mine ? 'You' : name(e.pid)} played ${cardName(e.card)}`);
      if (!(mine && pendingPlay === e.card)) {
        const from = mine ? (blind() ? seatPoint(meId) : centerOf(hand)) : seatPoint(e.pid);
        if (mine && blind()) { const s = myStackEl(); s && s.lastElementChild?.tagName === 'IMG' && (s.lastElementChild.style.opacity = '0'); }
        await renderer?.play({ from, card: e.card, faceUp: false });
      }
      if (mine) pendingPlay = null;
      if (e.matched) {
        showMatch(e, mine);
        const to = seatPoint(e.pid);
        await renderer?.collect({ to, n: e.n });
        popAt(to, `+${e.n}`);
        say(`${mine ? 'You' : name(e.pid)} took ${e.n} cards!`);
      }
      if (e.out) { say(e.pid === meId ? 'You are OUT!' : `${name(e.pid)} is OUT!`); haptic(30); }
    } else if (e.type === 'shuffle' && e.pid !== meId) {
      const el = oppEls.get(e.pid);
      if (el) { el.classList.remove('wiggle'); void el.offsetWidth; el.classList.add('wiggle'); }
      say(`${name(e.pid)} shuffled their cards`);
    } else if (e.type === 'left') {
      say(`${name(e.pid)} left the game`);
    }
  }

  async function drain() {
    if (busy || destroyed) return;
    busy = true;
    await rendererReady;
    try {
      while (queue.length && !destroyed) {
        const e = queue.shift();
        if (document.hidden || queue.length > 6) { if (e.type === 'play' && e.matched && !document.hidden) showMatch(e, e.pid === meId); continue; }
        try { await runEvent(e); } catch (err) { console.error(err); }
        v = getView();
      }
    } finally { busy = false; }
    if (destroyed) return;
    v = getView();
    renderer?.setBack?.(v.settings.back);
    renderer?.setPile(v.game.pileTop, v.game.pileCount);
    renderAll();
    if (v.status === 'finished') showResults();
  }

  function update(fromAction) {
    v = getView();
    const g = v.game;
    if (!g) return;
    if (v.status !== 'finished') { resultsShown = false; root.querySelector('.results')?.remove(); }
    const fresh = g.events.filter(e => e.seq > lastSeq);
    if (lastSeq === 0) {
      const deal = [...g.events].reverse().find(e => e.type === 'deal');
      const recentDeal = deal && Date.now() - (deal.at + ((v.serverTime || Date.now()) - Date.now())) < 3000 && g.events.filter(e => e.type === 'play').length === 0;
      queue = recentDeal ? [deal] : [];
      lastDealId = g.dealId;
      requestAnimationFrame(layoutCenter);
    } else if (g.dealId !== lastDealId) {
      lastDealId = g.dealId;
      queue = fresh.filter(e => e.type === 'deal').slice(-1);
      cardEls.forEach(el => el.remove()); cardEls.clear();
    } else if (fresh.length > 10) queue = [];
    else queue.push(...fresh);
    lastSeq = v.seq;
    if (!busy) { if (fromAction) { renderBanner(); } drain(); }
    else if (fromAction && !blind()) renderHand();
  }

  function presence() { if (!busy) renderOpps(); }

  function showResults() {
    if (resultsShown) return;
    resultsShown = true;
    const r = v.results;
    const isHost = v.host === meId;
    const won = r.winners.includes(meId);
    haptic(won ? [30, 60, 30, 60, 60] : 20);
    const rows = r.order.map((pid, i) => {
      const p = v.players.find(x => x.pid === pid) || { name: 'Player' };
      const outIdx = r.out.indexOf(pid);
      return h('div', { class: 'rank-row' }, h('div', { class: 'rn' }, i + 1), avatar(p, 40),
        h('div', { style: { minWidth: 0 } }, h('div', { style: { fontWeight: 700 } }, (pid === meId ? 'You' : p.name) + (r.winners.includes(pid) ? ' 🏆' : '')),
          h('div', { class: 'muted small' }, outIdx >= 0 ? `OUT ${ordinal(outIdx + 1)}` : r.reason === 'last_standing' ? 'Last one standing' : 'Still had cards', ` · ${r.matches[pid] || 0} matches`)),
        h('div', { class: 'rc' }, r.cards[pid] || 0, h('span', null, 'cards')));
    });
    const winnerNames = r.winners.map(p => p === meId ? 'You' : name(p)).join(' & ');
    let tieNote = null;
    if (r.tie) {
      const names = r.tie.players.map(p => p === meId ? 'You' : name(p)).join(' = ');
      tieNote = h('div', { class: 'tie-note' }, r.tie.by === 'luck' ? `Tie (${names}) → luck pick 🎲` : `Tie (${names}) → the last one to take a pile wins`);
    }
    const reasonText = r.reason === 'timer' ? 'Winner by timer' : r.reason === 'last_standing' ? 'Winner: last one standing' : (REASONS[r.reason] || '');
    const card = h('div', { class: 'results-card' },
      h('div', { class: 'trophy' }, won ? '🏆' : '🃏'),
      h('h2', null, won ? 'You win!' : `${winnerNames} ${r.winners.length > 1 ? 'win' : 'wins'}!`),
      h('div', { style: { textAlign: 'center', margin: '4px 0 8px' } }, h('span', { class: 'by-tag' }, reasonText)),
      h('div', { class: 'muted', style: { textAlign: 'center', marginBottom: '14px', fontSize: '14px' } }, `${r.moves} plays · ${fmtDur(r.duration)}${r.centre ? ` · ${r.centre} left in centre` : ''}`),
      tieNote,
      rows,
      h('div', { style: { height: '16px' } }),
      isHost ? h('button', { class: 'btn block', onclick: e => { e.currentTarget.disabled = true; haptic(10); act({ type: 'rematch' }).catch(() => { e.currentTarget.disabled = false; }); } }, 'Rematch') :
        h('div', { class: 'empty', style: { borderStyle: 'solid', padding: '14px' } }, 'Waiting for the host to start a rematch…'),
      isHost ? h('button', { class: 'btn block secondary', style: { marginTop: '10px' }, onclick: () => act({ type: 'lobby' }).catch(() => {}) }, 'Change rules / players') : null,
      h('button', { class: 'btn block danger', style: { marginTop: '6px' }, onclick: async () => { await act({ type: 'leave' }).catch(() => {}); localStorage.removeItem('boshx.lastRoom'); navigate('#/'); } }, 'Exit'));
    root.append(h('div', { class: 'results' }, card));
  }

  const onResize = () => { layoutCenter(); if (!busy && !blind()) renderHand(); };
  addEventListener('resize', onResize);

  return {
    update, presence, topActions, say,
    destroy() { destroyed = true; clearInterval(clockT); removeEventListener('resize', onResize); renderer?.destroy(); root.remove(); },
  };
}

const fmtDur = ms => { const s = Math.max(1, Math.round(ms / 1000)); return s < 90 ? s + ' s' : Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's'; };
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

let _gl = null;
function webglOK() {
  if (_gl !== null) return _gl;
  try { const c = document.createElement('canvas'); _gl = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { _gl = false; }
  return _gl;
}
