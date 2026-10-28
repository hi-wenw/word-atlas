/* Word Atlas offline cache: app shell network-first, everything else cache-first. */
// CacheStorage is shared by every application on an origin, including sub-path sites.
const SCOPE = self.registration.scope;
const PREFIX = `word-atlas:${SCOPE}:`;
const VERSION = `${PREFIX}v2`;
const SHELL = `${VERSION}-shell`;
const MEDIA = `${VERSION}-media`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== SHELL && k !== MEDIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function match(req) {
  return (await (await caches.open(SHELL)).match(req)) || (await (await caches.open(MEDIA)).match(req));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (!url.href.startsWith(SCOPE)) return;
  const isNavigation = req.mode === "navigate";
  const isShell = isNavigation || url.pathname.endsWith("/index.json");
  // Register cache writes synchronously with the event so the worker cannot stop early.
  const writes = [];
  const remember = (name, res) => {
    if (res.ok && res.type === "basic") {
      const copy = res.clone();
      writes.push(caches.open(name).then((c) => c.put(req, copy)).then(() => name === MEDIA && trim(MEDIA, 1500)));
    }
    return res;
  };
  const response = isShell
    ? fetch(req)
        .then((res) => remember(SHELL, res))
        .catch(async (error) => {
          const hit = await match(req) || (isNavigation && await match(SCOPE));
          if (hit) return hit;
          throw error;
        })
    : match(req).then((hit) => hit || fetch(req).then((res) => remember(/\/atlas\/(img|thumb|audio)\//.test(url.pathname) ? MEDIA : SHELL, res)));
  event.respondWith(response);
  // Storage quota failures must not turn an otherwise successful request into a failure.
  event.waitUntil(response.then(() => Promise.allSettled(writes), () => undefined));
});
