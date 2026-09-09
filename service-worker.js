const cacheName = 'weight-monitor-v5';
const appFiles = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(appFiles)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => { if (event.request.mode === 'navigate') { event.respondWith(fetch(event.request).catch(() => caches.match('./'))); return; } event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request))); });
