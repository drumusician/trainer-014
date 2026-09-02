/* Kleine service worker: de app blijft werken zonder bereik langs de lijn. */
const CACHE = 'o14-v5';
const BESTANDEN = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BESTANDEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

/* Netwerk eerst, cache als achtervang — zo krijg je updates én werkt hij offline. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  /* Alleen onze eigen bestanden. Wat naar Supabase gaat mag nooit uit de cache komen. */
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const kopie = r.clone(); caches.open(CACHE).then(c => c.put(e.request, kopie)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
