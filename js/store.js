// Device-local preferences + the signed-in profile.
const PREF_KEY = 'boshx.prefs';
const defaults = { theme: 'dark', haptics: true, quality: 'auto', back: 'midnight', recent: [] };
export const prefs = Object.assign({}, defaults, JSON.parse(localStorage.getItem(PREF_KEY) || '{}'));
export function savePrefs(patch) { Object.assign(prefs, patch); localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); }

export const state = { me: null, games: [], badgeList: [] };

export function applyTheme() {
  const t = prefs.theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : prefs.theme;
  document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = t === 'light' ? '#f2f2f7' : '#000000';
}

export function addRecent(gameId) {
  const r = [gameId, ...prefs.recent.filter(x => x !== gameId)].slice(0, 8);
  savePrefs({ recent: r });
}
