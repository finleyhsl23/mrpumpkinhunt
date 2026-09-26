/* Offline cache for the hunt.
 *
 * This is the single most important file in the project. A pumpkin patch is a
 * field: signal is worst exactly where the far pumpkins are. The whole hunt
 * is precached on the first visit - which almost always happens at the gate,
 * where the bars are - so every sign after that works with no connection.
 *
 * Bump CACHE when anything in SHELL changes, or phones keep serving the old
 * copy until their site data is cleared.
 */
var CACHE = "mrpumpkin-v7";

/* Canonical, extensionless paths only.
 *
 * This matters more than it looks. Cloudflare Pages serves `foo.html` at
 * `/foo` and 301s `/foo.html` to it. Precaching the `.html` form therefore
 * stored a *redirected* response, and a browser will not serve one of those
 * for a navigation - Safari fails the whole page with "Response served by
 * service worker has redirections". Asking for the canonical path avoids the
 * redirect at source; cleanResponse() below is the belt to that braces. */
var SHELL = [
  "/",
  "/found",
  "/privacy",
  "/assets/styles.css",
  "/assets/app.js",
  "/assets/pumpkins.js",
  "/assets/vendor/jsqr.js",
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

/* Strips the redirected flag by rebuilding the response. A response that
 * arrived via a redirect can never be handed to a navigation, so it must not
 * reach the cache in that state. */
function cleanResponse(res) {
  if (!res || !res.redirected) return Promise.resolve(res);
  return res.blob().then(function (body) {
    return new Response(body, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  });
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      /* One put per URL rather than addAll: addAll fails the whole install if
         any single request 404s, which would leave the hunt with no cache at
         all. One missing image should cost one missing image. */
      return Promise.all(
        SHELL.map(function (url) {
          return fetch(new Request(url, { cache: "reload" }))
            .then(cleanResponse)
            .then(function (res) {
              if (res && res.ok) return cache.put(url, res);
            })
            .catch(function () {});
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
  /* Telemetry and email must never come from cache. */
  if (url.pathname.indexOf("/api/") === 0) return;

  var isNavigation = req.mode === "navigate";

  /* Every /p/<code> is the same document, so one cached copy answers all ten
     signs - including the nine not scanned yet. */
  var lookup = /^\/p\//.test(url.pathname) ? "/found" : req;

  /* Pages are network-first, assets are cache-first.
   *
   * Cache-first for pages meant a returning phone always rendered the
   * PREVIOUS build and only picked up changes on the visit after - so a fix
   * pushed in the morning would not reach anyone until their second load.
   * That is wrong for a site being changed daily a week before it opens.
   *
   * Going to the network first costs a moment when online and nothing at all
   * when offline, because the timeout below falls straight back to the cache.
   * Assets stay cache-first: they are the heavy part, and bumping CACHE is
   * what releases new ones. */
  if (isNavigation) {
    event.respondWith(networkFirst(req, lookup));
    return;
  }

  event.respondWith(
    caches.match(lookup, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req)
        .then(cleanResponse)
        .then(function (res) {
          if (res && res.ok && res.type === "basic") {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(lookup, copy); });
          }
          return res;
        })
        .catch(function () { return caches.match(req); });
    })
  );
});

function networkFirst(req, lookup) {
  /* A field with one bar is worse than no bars: the request neither fails
     nor arrives. Race it, and take the cache if the network dawdles. */
  var timeout = new Promise(function (resolve) {
    setTimeout(function () { resolve(null); }, 2500);
  });

  var live = fetch(req)
    .then(cleanResponse)
    .then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(lookup, copy); });
      }
      return res;
    })
    .catch(function () { return null; });

  return Promise.race([live, timeout]).then(function (res) {
    if (res && res.ok) return res;
    /* Network was slow, absent or unhappy - serve what we precached at the
       gate. Never a redirected response: a navigation will not accept one. */
    return caches.match(lookup, { ignoreSearch: true }).then(function (hit) {
      if (hit && !hit.redirected) return hit;
      return live.then(function (late) {
        return (late && late.ok) ? late : caches.match("/");
      });
    });
  });
}
