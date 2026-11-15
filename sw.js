// Service worker: guarda o app no celular para funcionar sem internet.
// Ao mudar qualquer arquivo do app, suba a versão abaixo para o celular baixar a nova.
const CACHE = 'controle-loja-v2';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/backup.js',
  './js/calc.js',
  './js/dates.js',
  './js/idb-backend.js',
  './js/money.js',
  './js/store.js',
  './js/ui/backup-view.js',
  './js/ui/closing-view.js',
  './js/ui/day-view.js',
  './js/ui/dom.js',
  './js/ui/entry-form.js',
  './js/ui/history-view.js',
  './js/ui/icons.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(request).catch(() => {
        if (request.mode === 'navigate') return caches.match('./index.html');
        throw new Error('offline');
      });
    }),
  );
});
