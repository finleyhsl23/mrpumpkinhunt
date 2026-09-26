/* Shared hunt state.
 *
 * Progress lives in localStorage and nowhere else. There is no sign-in, no
 * account, and no network call on the critical path: a child standing in the
 * far corner of a field with no bars must still be able to find a pumpkin and
 * see it tick off. The server is told about finds on a best-effort basis, for
 * the patch's own stats, and it is queued when there is no signal.
 */
(function () {
  "use strict";

  var KEY = "mrpumpkin.progress.v1";
  var QUEUE_KEY = "mrpumpkin.queue.v1";
  var DEVICE_KEY = "mrpumpkin.device.v1";

  /* Private browsing, blocked site data and a handful of locked-down
   * corporate phones all make localStorage throw rather than return null.
   * The hunt degrades to "works but forgets" instead of showing an error. */
  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function deviceId() {
    var id = safeGet(DEVICE_KEY);
    if (!id) { id = uuid(); safeSet(DEVICE_KEY, id); }
    return id;
  }

  function readJSON(key, fallback) {
    var raw = safeGet(key);
    if (!raw) return fallback;
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (e) { return fallback; }
  }

  var Hunt = {
    total: function () { return window.PUMPKINS.length; },

    bySlug: function (slug) {
      return window.PUMPKINS.filter(function (p) { return p.slug === slug; })[0] || null;
    },

    byCode: function (code) {
      var wanted = String(code || "").trim().toLowerCase();
      return window.PUMPKINS.filter(function (p) { return p.code === wanted; })[0] || null;
    },

    /* { slug: isoTimestamp } */
    found: function () { return readJSON(KEY, {}); },

    isFound: function (slug) { return Object.prototype.hasOwnProperty.call(Hunt.found(), slug); },

    foundCount: function () { return Object.keys(Hunt.found()).length; },

    isComplete: function () { return Hunt.foundCount() >= Hunt.total(); },

    /* Returns true only the first time a given pumpkin is recorded, so a
     * re-scan of a sign greets you warmly instead of firing the confetti
     * again and double-counting. */
    markFound: function (slug) {
      var found = Hunt.found();
      if (Object.prototype.hasOwnProperty.call(found, slug)) return false;
      found[slug] = new Date().toISOString();
      safeSet(KEY, JSON.stringify(found));
      Hunt.track("find", { slug: slug });
      return true;
    },

    reset: function () {
      try { window.localStorage.removeItem(KEY); } catch (e) { /* nothing to clear */ }
    },

    /* Best-effort telemetry. Never blocks the interface, never surfaces an
     * error: if it fails it goes in a queue and is retried when the phone
     * next has a signal, which for most families is back at the gate. */
    track: function (event, payload) {
      var body = {
        event: event,
        device: deviceId(),
        at: new Date().toISOString(),
        found_count: Hunt.foundCount(),
      };
      for (var k in payload || {}) body[k] = payload[k];

      if (!navigator.onLine) { Hunt.queue(body); return; }

      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(function () { Hunt.queue(body); });
    },

    queue: function (body) {
      var q = readJSON(QUEUE_KEY, []);
      if (!Array.isArray(q)) q = [];
      q.push(body);
      /* A queue that grows without bound on a phone that never regains
       * signal is a slow leak; 200 events is far more than one visit. */
      if (q.length > 200) q = q.slice(-200);
      safeSet(QUEUE_KEY, JSON.stringify(q));
    },

    flush: function () {
      var q = readJSON(QUEUE_KEY, []);
      if (!Array.isArray(q) || !q.length || !navigator.onLine) return;
      safeSet(QUEUE_KEY, "[]");
      q.forEach(function (body) {
        fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).catch(function () { Hunt.queue(body); });
      });
    },

    deviceId: deviceId,

    /* Paints the sticky count and bar present on every page. */
    paintProgress: function () {
      var n = Hunt.foundCount();
      var total = Hunt.total();
      var count = document.querySelector("[data-count]");
      var bar = document.querySelector("[data-bar]");
      if (count) count.textContent = n + " of " + total;
      if (bar) bar.style.width = Math.round((n / total) * 100) + "%";
    },

    artFor: function (p) { return "/assets/pumpkins/" + p.slug + ".svg"; },
  };

  function paintOnline() {
    document.body.classList.toggle("is-offline", !navigator.onLine);
  }

  window.addEventListener("online", function () { paintOnline(); Hunt.flush(); });
  window.addEventListener("offline", paintOnline);

  document.addEventListener("DOMContentLoaded", function () {
    paintOnline();
    Hunt.paintProgress();
    Hunt.flush();

    /* The service worker is what makes the hunt work past the gate. Scope is
     * the site root so a /p/<code> deep link is covered too. */
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(function () {
        /* Caching is an enhancement - the hunt still runs without it. */
      });
    }
  });

  window.Hunt = Hunt;
})();
