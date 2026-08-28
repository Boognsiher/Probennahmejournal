// Minimaler Cache-first Service Worker für den Offline-Betrieb auf der Baustelle.
const CACHE_NAME = 'probennahmejournal-v18';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/vvea.js',
  './js/parse-csv.js',
  './js/parse-pdf.js',
  './js/report.js',
  './js/report-pdf.js',
  './js/email.js',
  './js/label.js',
  './js/niutec-form.js',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
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
  // Auch externe CDN-Ressourcen (z.B. pdf.js) cachen, damit der PDF-Import nach
  // dem ersten Gebrauch offline weiterfunktioniert.
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
