// Fly Punch · service worker. La app abre rápido y sin conexión:
//  - la página: primero la red (para recibir versiones nuevas), si no hay red, la copia guardada
//  - archivos con hash de /assets e iconos: primero la copia guardada (su nombre cambia si cambian)
//  - los datos del cerebro: primero la red (el circuito crece con versiones nuevas), sin red la copia guardada
//  - nunca toca peticiones a otros dominios (Supabase, fuentes): pasan directo
const CACHE = 'flypunch-v2'; // al subir este número se borra la caché vieja
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icons/icon-192.png']).catch(() => {}))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('./', copy)); return r; }).catch(() => caches.match('./')));
    return;
  }
  if (/\/data\//.test(url.pathname)) {
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return r; }).catch(() => caches.match(req)));
    return;
  }
  if (/\/(assets|icons)\//.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return r; })));
  }
});
