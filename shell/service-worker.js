// Minimaler Service Worker: Cache-first für die App-Shell (schnelles Laden,
// Offline-Ansicht der Oberfläche), Network-only für die Server-API (/api/*),
// damit Journal-Daten und Fotos immer aktuell sind.
const CACHE_NAME = 'probennahmejournal-shell-v4';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/api.js',
  './js/shell-reset.js',
  './js/vvea.js',
  './js/parse-csv.js',
  './js/parse-pdf.js',
  './js/report.js',
  './js/report-pdf.js',
  './js/email.js',
  './icons/icon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // API-Aufrufe (Journal-Daten, Fotos, Login) nie aus dem Cache beantworten.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    return; // Browser-Standardverhalten (Netzwerk) greift.
  }

  // App-Shell + externe Ressourcen (z.B. pdf.js von CDN): Cache-first, im
  // Hintergrund aktualisieren, damit PDF-Import nach erstem Gebrauch auch
  // offline funktioniert.
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
