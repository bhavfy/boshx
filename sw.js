// BOSHX service worker: network-first (always the newest version when online),
// cached copy when offline. Never touches the API.
const CACHE = 'boshx-v5-20261104c';
const SHELL = ['./', './index.html', './css/app.css', './js/app.js', './manifest.webmanifest', './icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const r = await fetch(e.request, { cache: 'no-cache' });
      if (r.ok && r.type === 'basic') c.put(e.request, r.clone());
      return r;
    } catch {
      return (await c.match(e.request)) || (e.request.mode === 'navigate' ? c.match('./index.html') : Response.error());
    }
  })());
});
