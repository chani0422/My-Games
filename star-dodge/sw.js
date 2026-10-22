/* Bump this cache version whenever shipped application files change. */
const CACHE = "star-dodge-shell-v0-2-0";
const FILES = [
  "./",
  "index.html",
  "style.css",
  "config.js",
  "engine.js",
  "app.js",
  "progression.js",
  "services.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(
        FILES.map((file) => {
          const url = new URL(file, self.registration.scope);
          url.searchParams.set("v", "0.2.0");
          return new Request(url, { cache: "reload" });
        }),
      ),
    ),
  ),
);
// Let existing flights finish before the new version activates.
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("star-dodge-shell-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url),
    scope = new URL(self.registration.scope).pathname;
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(scope)
  )
    return;
  const relative = url.pathname.slice(scope.length);
  if (!FILES.includes(relative || "./")) return;
  event.respondWith(
    caches
      .open(CACHE)
      .then(
        async (cache) =>
          (await cache.match(event.request, { ignoreSearch: true })) ||
          fetch(event.request),
      ),
  );
});
