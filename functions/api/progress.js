import { json, sb, hashIp, readBody } from "./_lib.js";

/* Loads and saves a hunt against an email, so somebody coming back can pick
 * up where they left off - on a different phone, or after clearing their
 * browser.
 *
 * Deliberately returns no personal detail. A lookup answers only "this
 * address has a hunt, with these pumpkins, last seen on this date". There is
 * no verification on an email typed into a field, so anything more would let
 * a stranger learn something about somebody by guessing an address - and the
 * one thing we could return that is worth having, a child's name, is exactly
 * the thing not to hand out.
 */

const LOOKUPS_PER_IP_PER_HOUR = 40;

const SLUGS = new Set([
  "crown-prince", "casperita", "warty-goblin", "grizzly-bear", "blue-banana",
  "galaxy-of-stars", "jill-be-little", "tiny-turk", "porcelain-doll", "magic-lantern",
]);

const clean = (email) => String(email || "").trim().toLowerCase().slice(0, 160);
const valid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
const onlyKnown = (list) =>
  Array.isArray(list) ? [...new Set(list.filter((s) => SLUGS.has(s)))].slice(0, 10) : [];

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await readBody(request);
  } catch {
    return json({ error: "bad request" }, 400);
  }

  const email = clean(body.email);
  if (!valid(email)) return json({ error: "invalid email" }, 400);

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    /* Not configured is not an error the visitor should see: the hunt works
       perfectly well on the phone alone. */
    return json({ found: null, configured: false });
  }

  const action = body.action === "save" ? "save" : "load";

  /* Rate limit the lookup, or this is an oracle for "has this address ever
     visited". The cap is generous enough that a family retyping a typo a few
     times never notices it. */
  if (action === "load") {
    try {
      const ip = await hashIp(request, env.IP_SALT);
      const since = new Date(Date.now() - 3600_000).toISOString();
      const res = await sb(env, `lookups?ip_hash=eq.${ip}&created_at=gte.${since}&select=id`, {
        headers: { Prefer: "count=exact", Range: "0-0" },
      });
      const total = parseInt((res.headers.get("content-range") || "").split("/")[1] || "0", 10);
      if (total > LOOKUPS_PER_IP_PER_HOUR) return json({ found: null, throttled: true });

      /* Record the attempt whether or not it finds anything, or the cap only
         counts successes and a guessing spree runs free. */
      await sb(env, "lookups", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ ip_hash: ip }),
      });
    } catch {
      /* The cap is anti-abuse, not a gate. Never block a real visitor on it. */
    }
  }

  try {
    if (action === "save") {
      const found = onlyKnown(body.found);
      await sb(env, "saved_hunts?on_conflict=email", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ email, found_slugs: found, last_seen: new Date().toISOString() }),
      });
      return json({ ok: true });
    }

    const res = await sb(env, `saved_hunts?email=eq.${encodeURIComponent(email)}&select=found_slugs,last_seen`);
    const rows = await res.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return json({ found: null });

    return json({
      found: onlyKnown(row.found_slugs),
      lastSeen: row.last_seen || null,
    });
  } catch (err) {
    console.log("progress:", action, "failed", String(err).slice(0, 200));
    /* Never a hard failure. Worst case the visitor starts fresh, which is
       exactly what happened before this existed. */
    return json({ found: null, error: "lookup failed" });
  }
}
