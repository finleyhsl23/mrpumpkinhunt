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
  var STARTED_KEY = "mrpumpkin.started.v1";
  var EMAIL_KEY = "mrpumpkin.email.v1";
  var FINISHED_KEY = "mrpumpkin.finished.v1";

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
      Hunt.saveRemote();
      return true;
    },

    reset: function () {
      try { window.localStorage.removeItem(KEY); } catch (e) { /* nothing to clear */ }
    },

    /* Clears the whole hunt - progress, email and the started/finished flags
     * - so the phone is ready for the next family. The device id is kept, or
     * the patch's visitor counts would double every time somebody exits. */
    resetAll: function () {
      [KEY, STARTED_KEY, EMAIL_KEY, FINISHED_KEY].forEach(function (k) {
        try { window.localStorage.removeItem(k); } catch (e) { /* nothing to clear */ }
      });
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

      /* sendBeacon, not fetch: a find is recorded microseconds before the
       * page navigates to the pumpkin, and beacons are the one API designed
       * to survive that. A keepalive fetch mostly does too, but it is held
       * open by the browser afterwards, which is both untidy and a nuisance
       * to test around. */
      var payload = JSON.stringify(body);
      if (navigator.sendBeacon) {
        var sent = false;
        try {
          sent = navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
        } catch (e) { sent = false; }
        if (sent) return;
      }

      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
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

    /* --- where the visitor is in the hunt ---------------------------------
     * Three states: not started, hunting, finished. Held on the phone with
     * everything else, so moving between them never needs a signal. */

    hasStarted: function () { return safeGet(STARTED_KEY) === "1" || Hunt.foundCount() > 0; },
    start: function () { safeSet(STARTED_KEY, "1"); },

    /* Scanning a sign out in the field counts as starting - plenty of people
     * will never see the board at the gate. */
    email: function () { return safeGet(EMAIL_KEY) || ""; },
    setEmail: function (value) { safeSet(EMAIL_KEY, String(value || "").trim()); },

    hasFinished: function () { return safeGet(FINISHED_KEY) === "1"; },
    finish: function () { safeSet(FINISHED_KEY, "1"); },

    /* --- progress kept against an email -------------------------------
     * Only for visitors who chose to give an address. Everyone else stays
     * entirely on their own phone, as before. Both calls fail soft: the hunt
     * has never needed the network and still does not. */

    loadRemote: function (email) {
      return fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "load", email: email }),
      })
        .then(function (r) { return r.json(); })
        .catch(function () { return { found: null }; });
    },

    saveRemote: function () {
      var email = Hunt.email();
      if (!email || !navigator.onLine) return Promise.resolve(false);
      return fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", email: email, found: Object.keys(Hunt.found()) }),
      })
        .then(function (r) { return r.ok; })
        .catch(function () { return false; });
    },

    /* Takes on a hunt fetched from the server. Merged rather than replaced:
     * somebody may have found one or two on this phone before entering an
     * address, and losing those would be indefensible. */
    adopt: function (slugs) {
      var found = Hunt.found();
      (slugs || []).forEach(function (slug) {
        if (!Object.prototype.hasOwnProperty.call(found, slug) && Hunt.bySlug(slug)) {
          found[slug] = new Date().toISOString();
        }
      });
      safeSet(KEY, JSON.stringify(found));
    },

    /* Sends the guide. Resolves with true on success; the caller decides
     * what to tell the visitor, because the answer differs by screen. */
    sendGuide: function (email, name) {
      return fetch("/api/send-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          name: name || "",
          device: deviceId(),
          found: Object.keys(Hunt.found()),
        }),
      }).then(function (r) {
        /* Hand back why, not just whether: a deployment missing its Resend
           key looks identical to a network blip otherwise. */
        return r.json().catch(function () { return {}; }).then(function (body) {
          /* Whoever is setting the site up is reading the console; the
             visitor only ever sees the friendly wording. */
          if (!r.ok && body && body.detail) {
            try {
              console.warn("guide email rejected:", r.status, body.from || "", body.detail);
            } catch (e) { /* no console, no matter */ }
          }
          return { ok: r.ok, reason: body && body.error ? body.error : "" };
        });
      });
    },

    /* Paints the sticky count and the row of pips on every page. Ten pips
     * rather than a percentage bar, because a parent can count what is left
     * at a glance and a percentage never tells them that. */
    paintProgress: function () {
      var n = Hunt.foundCount();
      var total = Hunt.total();

      var count = document.querySelector("[data-count]");
      if (count) count.textContent = n + " of " + total;

      var pips = document.querySelector("[data-pips]");
      if (!pips) return;
      if (pips.children.length !== total) {
        pips.innerHTML = "";
        for (var i = 0; i < total; i++) pips.appendChild(document.createElement("span"));
      }
      for (var j = 0; j < total; j++) {
        pips.children[j].className = "pip" + (j < n ? " on" : "");
      }
    },

    /* A short burst of falling confetti for the moment all ten are in. Pure
     * CSS animation on a handful of nodes, cleaned up after itself, and it
     * respects prefers-reduced-motion via the stylesheet. */
    celebrate: function () {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      var colours = ["#f2811d", "#f7ca57", "#74c65e", "#ec8fae", "#ff9c3d"];
      var box = document.createElement("div");
      box.className = "confetti";
      for (var i = 0; i < 40; i++) {
        var bit = document.createElement("i");
        bit.style.left = Math.random() * 100 + "%";
        bit.style.background = colours[i % colours.length];
        bit.style.animationDuration = (2.2 + Math.random() * 1.6) + "s";
        bit.style.animationDelay = (Math.random() * 0.7) + "s";
        box.appendChild(bit);
      }
      document.body.appendChild(box);
      setTimeout(function () { box.remove(); }, 5200);
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
