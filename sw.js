const CACHE_NAME = 'weather-pwa-v1';
const DATA_CACHE_NAME = 'weather-data-v1';

// Static assets to precache
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './weather.css',
  './weather.js',
  './manifest.json',
  './icons/favicon.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './images/cloudy.jpg',
  './images/fogy.jpg',
  './images/mist.jpg',
  './images/rainy.jpg',
  './images/snowy.jpg',
  './images/sunny.jpg',
  './images/thunderstorm.jpg'
];

// Install event: cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate event: clean up outdated caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME && cache !== DATA_CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: handle offline & online requests
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Weather API requests: Network-first with cache fallback
  if (requestUrl.hostname.includes('openweathermap.org')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If valid response, clone and update dynamic data cache
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(DATA_CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Network failed, attempt to serve from cache
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return a structured offline JSON response if not in cache
          return new Response(
            JSON.stringify({
              cod: 503,
              message: 'You are offline and no cached data is available for this location.'
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // Static Assets: Cache-first with network fallback
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
      if (cachedResponse) {
        // Fetch in background to update cache for next time (Stale-While-Revalidate)
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {/* Ignore background fetch failure */});

        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    }).catch(() => {
      // Offline fallback for navigation requests
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
