const CACHE_NAME = 'billing-site-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/assets/menu/placeholder.svg',
  '/assets/qr/upi.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Offline-first for navigation and same-origin requests
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Put a copy in cache for future
        if (response && response.status === 200 && response.type === 'basic'){
          const respClone = response.clone();
          caches.open(CACHE_NAME).then(cache=> cache.put(event.request, respClone));
        }
        return response;
      }).catch(()=>{
        // fallback to index.html for navigation requests
        if (event.request.mode === 'navigate'){
          return caches.match('/index.html');
        }
      });
    })
  );
});
