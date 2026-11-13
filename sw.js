/* TUUUT service worker: everything cached on the device so the app opens without internet */
const VERSION = "tuuut-v2";
const FILES = ["./", "index.html", "manifest.webmanifest", "lib/pdf.min.js", "lib/pdf.worker.min.js", "voorbeeld-ode.pdf",
  "icon-192.png", "icon-512.png", "icon-maskable-512.png",
  "fonts/unbounded-latin-500-normal.woff2", "fonts/unbounded-latin-700-normal.woff2", "fonts/unbounded-latin-800-normal.woff2",
  "fonts/atkinson-hyperlegible-latin-400-normal.woff2", "fonts/atkinson-hyperlegible-latin-700-normal.woff2", "fonts/atkinson-hyperlegible-latin-400-italic.woff2"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== "tuuut-share").map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", e => { if(e.data === "skip") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if(url.origin !== location.origin) return;
  /* share target: files shared from WhatsApp, Google Drive, Dropbox, OneDrive ... */
  if(req.method === "POST" && url.pathname.endsWith("/share")){
    e.respondWith((async () => {
      try{
        const fd = await req.formData(); const c = await caches.open("tuuut-share");
        let i = 0;
        for(const f of fd.getAll("files")){
          if(!f || typeof f === "string") continue;
          await c.put(new Request("./shared/" + Date.now() + "-" + (i++)), new Response(f, { headers: { "content-type": f.type || "application/octet-stream", "x-name": encodeURIComponent(f.name || "bestand") } }));
        }
      }catch(err){}
      return Response.redirect("./?share=1", 303);
    })());
    return;
  }
  if(req.method !== "GET") return;
  /* cache first (works on stage without signal), refresh in the background when online */
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const key = req.mode === "navigate" ? "index.html" : req;
    const hit = await c.match(key, { ignoreSearch: req.mode === "navigate" });
    const net = fetch(req).then(r => { if(r && r.ok && req.mode !== "navigate") c.put(req, r.clone()); return r; }).catch(() => null);
    if(hit){ e.waitUntil(net); return hit; }
    return (await net) || new Response("Offline", { status: 503 });
  })());
});
