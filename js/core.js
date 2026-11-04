import { GET } from './api.js';
import { state } from './store.js';

export function navigate(hash, replace = false) {
  if (replace) { history.replaceState(null, '', hash); window.dispatchEvent(new HashChangeEvent('hashchange')); }
  else location.hash = hash;
}
export async function refreshMe() {
  const r = await GET('/me');
  state.me = r.me;
  state.badgeList = r.badgeList;
  return r.me;
}
export async function loadGames(force = false) {
  if (state.games.length && !force) return state.games;
  const r = await GET('/games');
  state.games = r.games;
  return state.games;
}
