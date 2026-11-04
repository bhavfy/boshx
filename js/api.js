import { API_BASE } from './config.js';

const TOKEN_KEY = 'boshx.token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = t => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export async function api(method, path, data, opts = {}) {
  const headers = {};
  const t = getToken();
  if (t) headers['x-boshx-token'] = t;
  if (opts.pin) headers['x-boshx-pin'] = opts.pin;
  if (data !== undefined) headers['content-type'] = 'application/json';
  let res;
  try {
    res = await fetch(API_BASE + '/api' + path, { method, headers, body: data !== undefined ? JSON.stringify(data) : undefined, signal: opts.signal, cache: 'no-store' });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, 'offline', 'No internet connection');
  }
  let j = {};
  try { j = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw new ApiError(res.status, j.error || 'error', j.message || `Error ${res.status}`);
  return j;
}
export const GET = (p, o) => api('GET', p, undefined, o);
export const POST = (p, d, o) => api('POST', p, d ?? {}, o);
export const PUT = (p, d, o) => api('PUT', p, d ?? {}, o);
export const PATCH = (p, d, o) => api('PATCH', p, d ?? {}, o);
export const DEL = (p, o) => api('DELETE', p, undefined, o);
