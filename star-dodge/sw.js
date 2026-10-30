/* Each installation stores a complete, immutable offline shell. */
const VERSION = "0.5.0";
const CACHE = "star-dodge-shell-v0-5-0-four-ships";
const FILES = [
  "./",
  "index.html",
  "style.css",
  "config.js",
  "stages.js",
  "engine.js",
  "app.js",
  "effects.js",
  "audio.js",
  "progression.js",
  "services.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(
          FILES.map((file) => {
            const url = new URL(file, self.registration.scope);
            url.searchParams.set("v", VERSION);
            return new Request(url, { cache: "reload" });
          }),
        ),
      )
      .then(() => self.skipWaiting()),
  ),
);
// Activating the worker does not reload or interrupt an existing flight.
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
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
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
  if (event.request.mode === "navigate") {
    // Prefer current HTML online; offline HTML stays paired with its own scripts.
    event.respondWith(
      fetch(new Request(event.request, { cache: "no-cache" }))
        .then((response) => {
          if (!response.ok) throw Error("Navigation unavailable");
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE),
            key = new URL("index.html", self.registration.scope);
          key.searchParams.set("v", VERSION);
          return (await cache.match(key.href)) || Response.error();
        }),
    );
    return;
  }
  // Never satisfy a new version's script URL with an older cached script.
  if (!url.searchParams.has("v")) url.searchParams.set("v", VERSION);
  event.respondWith(
    caches
      .open(CACHE)
      .then(
        async (cache) => (await cache.match(url.href)) || fetch(event.request),
      ),
  );
});
