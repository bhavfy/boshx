// BOSHX Playing Cards — rules engine (shared by server and client).
// Pure functions only: no DOM, no network. The server is the only place that
// deals, shuffles and applies moves; the client only reads the schema/helpers.
//
// BOSHX Classic (Bhavesh's rules):
//  - The machine shuffles and deals all cards equally.
//  - Turns go in order; on your turn you put one of your cards in the centre.
//  - If it matches the previous centre card (Number Matching: 7 on 7, or
//    Symbol Matching: ♥ on ♥; Joker on Joker always matches), you take ALL
//    centre cards into your own cards.
//  - A player whose cards run out is OUT. Last player standing wins.
//  - Safety limit (max rounds / time): when reached, most cards wins.

export const SUITS = ['S', 'H', 'D', 'C'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const JOKERS = ['XR', 'XB'];

export const DECKS = {
  std52: { id: 'std52', name: 'Standard', size: 52, jokers: 0 },
  joker54: { id: 'joker54', name: 'With Jokers', size: 54, jokers: 2 },
};

export const RULES_VERSION = 4;
export const DEFAULT_RULES = {
  name: 'BOSHX Classic',
  deck: 'joker54',          // std52 | joker54
  matchBy: 'rank',          // rank = Number Matching, suit = Symbol Matching
  matchChance: 'lots',      // normal = last centre card only; more = also the card two below (sandwich 7,3,7); lots = also three below
  jokerWild: false,         // Joker matches anything (Joker on Joker always matches)
  playMode: 'top',          // top = hidden face-down stack, play the top card (nobody sees cards, not even the owner); any = visible hand
  remainder: 'pile',        // leftover cards: pile = start the centre, deal = extra to first players, discard = put aside
  collectorPlaysAgain: false,
  maxRounds: 50,            // round limit (then most cards wins). Ignored while a Game timer is on.
  timeLimit: 9,             // Game timer in minutes (0 = no timer). When it runs out: finish the current play, most cards wins, exactly one winner.
  turnSeconds: 20,          // idle player: the top card is auto-played after this many seconds (0 = off)
};

// UI schema — the create-room sheet and Games Management render from this,
// so adding/changing a rule is config, not UI code.
export const RULE_SCHEMA = [
  { key: 'matchBy', label: 'Match mode', type: 'select', options: [['rank', 'Number Matching (7 on 7)'], ['suit', 'Symbol Matching (♥ on ♥)']] },
  { key: 'matchChance', label: 'Match chance', type: 'select', options: [['normal', 'Normal (last card only)'], ['more', 'More (also card two below)'], ['lots', 'Lots (also card three below)']] },
  { key: 'deck', label: 'Deck', type: 'select', options: [['std52', '52 cards (no Joker)'], ['joker54', '54 cards (2 Jokers)']] },
  { key: 'jokerWild', label: 'Joker wild (matches any card)', type: 'bool' },
  { key: 'playMode', label: 'Your cards', type: 'select', options: [['top', 'Hidden stack · play top card'], ['any', 'Visible hand · pick any card']] },
  { key: 'remainder', label: 'Leftover cards', type: 'select', options: [['pile', 'Start the centre pile'], ['deal', 'Give to first players'], ['discard', 'Put aside']] },
  { key: 'collectorPlaysAgain', label: 'Collector plays again', type: 'bool' },
  { key: 'timeLimit', label: 'Game timer', type: 'select', options: [[3, '3 min'], [5, '5 min'], [9, '9 min'], [15, '15 min'], [0, 'No timer']], hidden: [0.5] },
  { key: 'maxRounds', label: 'Round limit (only without a timer)', type: 'select', options: [[25, '25 rounds'], [50, '50 rounds'], [100, '100 rounds'], [200, '200 rounds'], [0, 'No limit']], showIf: r => !r.timeLimit },
  { key: 'turnSeconds', label: 'Idle auto-play (top card plays itself)', type: 'select', options: [[0, 'Off'], [10, '10 s'], [15, '15 s'], [20, '20 s'], [30, '30 s']] },
];

export function normalizeRules(input) {
  const r = { ...DEFAULT_RULES };
  if (input && typeof input === 'object') {
    for (const f of RULE_SCHEMA) {
      if (!(f.key in input)) continue;
      const v = input[f.key];
      if (f.type === 'bool') r[f.key] = !!v;
      else if (f.type === 'select') {
        const ok = f.options.find(o => String(o[0]) === String(v)) || (f.hidden || []).filter(x => String(x) === String(v)).map(x => [x])[0];
        if (ok) r[f.key] = ok[0];
      }
    }
    if (!('matchChance' in input) && r.matchBy === 'suit') r.matchChance = 'normal'; // symbol matches are already frequent
    if (typeof input.name === 'string' && input.name.trim()) r.name = input.name.trim().slice(0, 40);
  }
  return r;
}

export const rankOf = c => (c[0] === 'X' ? 'X' : c.slice(0, -1));
export const suitOf = c => (c[0] === 'X' ? 'X' : c.slice(-1));
export const isJoker = c => c[0] === 'X';
export const isRed = c => c === 'XR' || /[HD]$/.test(c);

export function cardName(c) {
  if (c === 'XR') return 'Red Joker';
  if (c === 'XB') return 'Black Joker';
  const names = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };
  const suits = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' };
  const r = rankOf(c);
  return `${names[r] || r} of ${suits[suitOf(c)]}`;
}

export function buildDeck(rules) {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push(r + s);
  if (rules.deck === 'joker54') d.push(...JOKERS);
  return d;
}

// rand(n) must return a uniform integer in [0, n). The server passes a
// crypto.getRandomValues based one.
export function shuffle(deck, rand) {
  const a = deck.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Do two single cards match under the chosen mode?
function pairMatch(rules, a, b) {
  if (!a || !b) return false;
  if (isJoker(a) && isJoker(b)) return true;
  if (rules.jokerWild && (isJoker(a) || isJoker(b))) return true;
  if (isJoker(a) || isJoker(b)) return false;
  if (rules.matchBy === 'suit') return suitOf(a) === suitOf(b);
  return rankOf(a) === rankOf(b);
}

// Does `card` played on top of `top` take the centre? (last card only)
export function isMatch(rules, top, card) { return pairMatch(rules, top, card); }

// Full check against the centre pile (before `card` is added). Returns
// { with: <matched centre card>, depth: 1 | 2 } or null.
// depth 1 = the last centre card; depth 2/3 = the card two/three below
// (sandwich), only when the host chose Match chance More / Lots.
export function findMatch(rules, pile, card) {
  const n = pile.length;
  if (!n) return null;
  if (pairMatch(rules, pile[n - 1], card)) return { with: pile[n - 1], depth: 1 };
  const reach = rules.matchChance === 'lots' ? 3 : rules.matchChance === 'more' ? 2 : 1;
  for (let d = 2; d <= reach && n >= d; d++) if (pairMatch(rules, pile[n - d], card)) return { with: pile[n - d], depth: d };
  return null;
}

// Start a game. seats = player ids in turn order.
export function deal(rules, seats, rand, starter = 0) {
  const deck = shuffle(buildDeck(rules), rand);
  const n = seats.length;
  const per = Math.floor(deck.length / n);
  const hands = {};
  seats.forEach(pid => (hands[pid] = []));
  let k = 0;
  for (let c = 0; c < per; c++) for (let i = 0; i < n; i++) hands[seats[(starter + i) % n]].push(deck[k++]);
  const rest = deck.slice(k);
  let pile = [], aside = 0;
  if (rules.remainder === 'deal') rest.forEach((c, i) => hands[seats[(starter + i) % n]].push(c));
  else if (rules.remainder === 'pile') pile = rest;
  else aside = rest.length;
  return {
    seats, hands, pile, aside, perPlayer: per,
    turn: starter % n, starter: starter % n, round: 1, moves: 0,
    out: [],             // eliminated players, in order
    taken: Object.fromEntries(seats.map(p => [p, 0])),   // cards taken from the centre
    matches: Object.fromEntries(seats.map(p => [p, 0])),
    lastCollector: null,
    lastTake: {},        // pid -> move number of the last pile they took (tie-break)
  };
}

export const alive = g => g.seats.filter(pid => !g.out.includes(pid));

function nextTurn(g, from) {
  const n = g.seats.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    const pid = g.seats[i];
    if (!g.out.includes(pid) && g.hands[pid]?.length) {
      // passing the starting seat (or the first alive seat after it) = new round
      if (i <= from) g.round++;
      return i;
    }
  }
  return -1;
}

// Apply a play. Returns { ok, error?, event? }. Mutates g.
export function play(rules, g, pid, card) {
  if (g.seats[g.turn] !== pid) return { ok: false, error: 'not_your_turn' };
  const hand = g.hands[pid];
  if (!hand || !hand.length) return { ok: false, error: 'no_cards' };
  let idx;
  if (rules.playMode === 'top') idx = 0; // card arg ignored: top card
  else {
    idx = hand.indexOf(card);
    if (idx < 0) return { ok: false, error: 'card_not_in_hand' };
  }
  const c = hand.splice(idx, 1)[0];
  const top = g.pile[g.pile.length - 1];
  const hit = findMatch(rules, g.pile, c);
  g.moves++;
  const ev = { type: 'play', pid, card: c, onto: top || null, matched: false, n: 0 };
  g.pile.push(c);
  if (hit) {
    ev.matched = true;
    ev.with = hit.with;
    ev.sandwich = hit.depth > 1;
    ev.depth = hit.depth;
    ev.n = g.pile.length;
    hand.push(...g.pile);           // the whole centre goes into the player's own cards
    g.taken[pid] += g.pile.length;
    g.matches[pid]++;
    g.biggest = g.biggest || {};
    g.biggest[pid] = Math.max(g.biggest[pid] || 0, ev.n);
    g.pile = [];
    g.lastCollector = pid;
    (g.lastTake = g.lastTake || {})[pid] = g.moves;
  }
  if (!hand.length) { g.out.push(pid); ev.out = true; }
  if (!(ev.matched && rules.collectorPlaysAgain)) {
    const prev = g.turn;
    g.turn = nextTurn(g, prev);
  }
  const left = alive(g);
  if (left.length <= 1) { ev.gameOver = true; ev.reason = 'last_standing'; }
  return { ok: true, event: ev };
}

export function shuffleHand(g, pid, rand) {
  if (!g.hands[pid] || g.out.includes(pid)) return false;
  g.hands[pid] = shuffle(g.hands[pid], rand);
  return true;
}

// Round limit only applies when there is no Game timer. The Game timer is handled
// by the server clock (see server/games/cards.js): when it runs out the current play
// is finished and the game ends with standings().
export function limitReached(rules, g, startedAt, now) {
  if (!rules.timeLimit && rules.maxRounds && g.round > rules.maxRounds) return 'round_limit';
  return null;
}

// Final standings when the game ends. Order: alive players by cards held (desc),
// ties by who took a pile most recently, then eliminated players (last out ranks
// highest). ALWAYS exactly one winner:
//   1) most cards; 2) tie -> the player who took the most recent pile ("last matcher");
//   3) still tied (nobody took a pile) -> random pick with the server RNG.
// tie = { by: 'last_take' | 'luck', players: [...] } when the top was tied, else null.
export function standings(g, rand) {
  const cnt = p => g.hands[p]?.length || 0;
  const lt = p => (g.lastTake && g.lastTake[p] != null ? g.lastTake[p] : -1);
  const live = alive(g).filter(p => cnt(p) > 0);
  const gone = [...g.out].reverse();
  live.sort((a, b) => cnt(b) - cnt(a) || lt(b) - lt(a));
  let tie = null;
  if (live.length > 1) {
    const top = cnt(live[0]);
    const tied = live.filter(p => cnt(p) === top);
    if (tied.length > 1) {
      const bestLt = Math.max(...tied.map(lt));
      const best = tied.filter(p => lt(p) === bestLt);
      if (best.length === 1) tie = { by: 'last_take', players: tied };
      else {
        const pick = best[rand ? rand(best.length) : Math.floor(Math.random() * best.length)];
        live.splice(live.indexOf(pick), 1); live.unshift(pick);
        tie = { by: 'luck', players: tied };
      }
    }
  }
  const order = [...live, ...gone];
  const winner = order[0];
  return { order, winners: winner ? [winner] : [], tie, cards: Object.fromEntries(g.seats.map(p => [p, cnt(p)])) };
}

export function rulesSummary(r) {
  const parts = [
    r.matchBy === 'suit' ? 'Symbol Matching' : 'Number Matching',
    r.matchChance === 'lots' ? 'lots of matches' : r.matchChance === 'more' ? 'more matches' : 'normal matches',
    r.deck === 'joker54' ? '54 cards' : '52 cards',
    r.playMode === 'top' ? 'hidden stack' : 'visible hand',
  ];
  if (r.jokerWild) parts.push('Joker wild');
  if (r.timeLimit) parts.push(`${r.timeLimit < 1 ? r.timeLimit * 60 + ' s' : r.timeLimit + ' min'} timer`);
  else if (r.maxRounds) parts.push(`${r.maxRounds} round limit`);
  if (r.turnSeconds) parts.push(`${r.turnSeconds}s idle auto-play`);
  return parts.join(' · ');
}

export const HOW_TO_PLAY = [
  'Machine shuffles and deals all cards equally. Your cards stay face-down in your stack: nobody can see them, not even you.',
  'Turns go in order. On your turn, tap your stack: the top card flips into the centre.',
  'If your card matches the last centre card (number or symbol, as the host chose), you take ALL centre cards into your cards. With "More" match chance it also matches the card two below (sandwich: 7, 3, 7).',
  'Joker on Joker always matches.',
  'Cards you take go to the bottom of your stack. Shuffle your stack any time.',
  'Run out of cards and you are OUT. Last player standing wins.',
  'Game timer: when time is up the current play finishes and the player with the most cards wins. Tie? The last player to take a pile wins; still tied → luck pick. Exactly one winner.',
  'Idle for a few seconds on your turn? Your top card plays itself so the game never stalls.',
];
