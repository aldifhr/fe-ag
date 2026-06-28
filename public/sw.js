const CACHE_NAME = "manhwa-images-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only cache image requests from manga sources
  const isImage =
    event.request.destination === "image" ||
    /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url.pathname) ||
    url.hostname.includes("shinigami") ||
    url.hostname.includes("shngm");

  if (!isImage) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response.ok) {
              // Only cache same-origin or manga CDN responses
              const cloned = response.clone();
              cache.put(event.request, cloned);
            }
            return response;
          })
          .catch(() => {
            // Return a placeholder on network error
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280" viewBox="0 0 200 280"><rect fill="#1a1a2e" width="200" height="280"/><text fill="#666" font-size="14" text-anchor="middle" x="100" y="140">No Image</text></svg>',
              { headers: { "Content-Type": "image/svg+xml" } },
            );
          });
      });
    }),
  );
});

// Limit cache to 500 entries
self.addEventListener("message", (event) => {
  if (event.data === "trim-cache") {
    caches.open(CACHE_NAME).then((cache) => {
      cache.keys().then((keys) => {
        if (keys.length > 500) {
          cache.delete(keys[0]).then(() => {
            self.clients.matchAll().then((clients) => {
              clients.forEach((client) => client.postMessage("cache-trimmed"));
            });
          });
        }
      });
    });
  }
});
