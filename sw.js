/* Adman Field — offline cache. Bump CACHE when index.html changes. */
const CACHE = "adman-field-v31";
const FILES = ["./", "./index.html", "./manifest.json", "./supabase.js"];
const MARK = "adman_field_v1";                      // only a real copy of the app carries this
/* cache what we can; a missing file must never stop the worker from installing */
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(
    FILES.map(f => fetch(f, {cache:"no-store"}).then(r => r.ok ? c.put(f, r) : null).catch(() => null))
  )).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* network first so a new index.html lands as soon as the tablet is online; cache when it is not */
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;          // Supabase and CDN calls go straight through
  if (url.pathname.endsWith("sw.js")) return;          // the update check always goes to the network
  const isPage = e.request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html");
  const cached = () => caches.match(e.request, {ignoreSearch:true}).then(m => m || (isPage ? caches.match("./index.html") : undefined));
  e.respondWith(
    fetch(e.request.url, {cache:"no-store", credentials:"same-origin"})
      .then(async r => {
        if (!r.ok) return (await cached()) || r;                               // GitHub mid-deploy: show the app we have
        if (isPage) {                                                           // a Wi-Fi login page is not the app
          const body = await r.clone().text();
          if (body.indexOf(MARK) < 0) return (await cached()) || r;
        }
        const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      })
      .catch(async () => (await cached()) || Response.error())
  );
});
