/* Offline cache for the hunt.
 *
 * This is the single most important file in the project. A pumpkin patch is a
 * field: signal is worst exactly where the far pumpkins are. The whole hunt
 * is precached on the first scan - which almost always happens at the gate,
 * where the bars are - so every sign after that works with no connection at
 * all.
 *
 * Bump CACHE when anything in SHELL changes, or phones will keep serving the
 * old copy until their cache is cleared.
 */
var CACHE = "mrpumpkin-v3";

var SHELL = [
  "/",
  "/index.html",
  "/p.html",
  "/privacy.html",
  "/assets/styles.css",
  "/assets/app.js",
  "/assets/pumpkins.js",
  "/assets/favicon.svg",
  "/assets/field.svg",
  "/assets/pumpkins/crown-prince.svg",
  "/assets/pumpkins/casperita.svg",
  "/assets/pumpkins/warty-goblin.svg",
  "/assets/pumpkins/grizzly-bear.svg",
  "/assets/pumpkins/blue-banana.svg",
  "/assets/pumpkins/galaxy-of-stars.svg",
  "/assets/pumpkins/jill-be-little.svg",
  "/assets/pumpkins/tiny-turk.svg",
  "/assets/pumpkins/porcelain-doll.svg",
  "/assets/pumpkins/magic-lantern.svg",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      /* addAll fails the whole install if any single request 404s, which
         would leave the hunt with no cache at all. Individual puts mean one
         missing image costs one missing image. */
      return Promise.all(
        SHELL.map(function (url) {
          return cache.add(new Request(url, { cache: "reload" })).catch(function () {});
        })
      );
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  /* Telemetry and email must never be served from cache. */
  if (url.pathname.indexOf("/api/") === 0) return;

  /* Every /p/<code> is the same document, so one cached copy answers all ten
     signs - including the nine the visitor has not scanned yet. */
  var lookup = /^\/p\//.test(url.pathname) ? "/p.html" : req;

  event.respondWith(
    caches.match(lookup, { ignoreSearch: true }).then(function (hit) {
      if (hit) {
        /* Refresh in the background so a content fix lands next visit. */
        fetch(req).then(function (res) {
          if (res && res.ok) caches.open(CACHE).then(function (c) { c.put(lookup, res.clone()); });
        }).catch(function () {});
        return hit;
      }
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === "basic") {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        /* Offline and never cached: hand back the hunt rather than a
           browser error page. */
        return caches.match("/index.html");
      });
    })
  );
});
