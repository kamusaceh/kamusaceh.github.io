const CACHE_NAME = 'kamus-aceh-v2';
const ASSETS = ['/', '/index.html', '/homepage.html', '/assets/style.css', '/assets/script.js', '/config/app-config.js', '/db/index.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});