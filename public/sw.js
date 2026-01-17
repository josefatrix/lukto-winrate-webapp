// LUKTO Stats Service Worker v2
// Force cache refresh on iOS
const CACHE_NAME = 'lukto-stats-v2';

// Minimal caching - just static assets
const urlsToCache = [
  '/manifest.json',
  '/lukto-logo.png'
];

// Install
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v2...');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .catch((err) => console.log('[SW] Cache failed:', err))
  );
});

// Activate - delete ALL old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v2...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('[SW] Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('[SW] All caches cleared');
      return self.clients.claim();
    })
  );
});

// Fetch - ALWAYS network first for HTML/JS/CSS
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Always go to network for same-origin requests
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Only use cache as absolute fallback
        return caches.match(event.request);
      })
    );
    return;
  }
  
  // Let external requests pass through
  return;
});
