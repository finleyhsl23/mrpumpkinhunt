import { json, sb, hashIp, readBody } from "./_lib.js";

/* Emails the visitor their pumpkin guide once they have finished the hunt.
 *
 * This is a public "type an address, we send mail" endpoint, which is an
 * abuse relay if left open - someone will point it at a third party, or
 * simply burn the month's Resend quota for entertainment. Hence the per-IP
 * cap and the strict allowlist of what can appear in the message: the body is
 * built from our own content file, and nothing the caller sends is rendered
 * except a first name, escaped.
 */

const MAX_PER_IP_PER_HOUR = 6;

const VARIETIES = {
  "crown-prince":    { name: "Crown Prince",    best: "Roasting & soup",        note: "Keeps for months in a cool shed - one bought today will still be good at Christmas." },
  "casperita":       { name: "Casperita",       best: "Decorating",             note: "White pumpkins are not painted; the skin simply never makes the orange pigment." },
  "warty-goblin":    { name: "Warty Goblin",    best: "Carving & display",      note: "The warts are hard as bark and no two are ever the same." },
  "grizzly-bear":    { name: "Grizzly Bear",    best: "Carving",                note: "That thick stalk is the handle, and a good one means it was picked ripe." },
  "blue-banana":     { name: "Blue Banana",     best: "Roasting & soup",        note: "Cut it into rings rather than wedges - it roasts far more evenly." },
  "galaxy-of-stars": { name: "Galaxy of Stars", best: "Display",                note: "The speckles spread as it grows, so the biggest are the most freckled." },
  "jill-be-little":  { name: "Jill Be Little",  best: "Decorating",             note: "Hollow one out, crack an egg in and bake it - properly edible." },
  "tiny-turk":       { name: "Tiny Turk",       best: "Display",                note: "The knot on top is the blossom end, growing upwards instead of tucking in." },
  "porcelain-doll":  { name: "Porcelain Doll",  best: "Roasting, soup & pies",  note: "Pink pumpkins are grown worldwide to raise money for breast cancer charities." },
  "magic-lantern":   { name: "Magic Lantern",   best: "Carving",                note: "Cut the lid slanted inwards or it drops straight through." },
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function buildEmail(name, foundSlugs) {
  const found = foundSlugs.filter((s) => VARIETIES[s]);
  const missed = Object.keys(VARIETIES).filter((s) => !found.includes(s));
  const who = name ? esc(name) : "you";

  const row = (slug) => {
    const v = VARIETIES[slug];
    return `<tr><td style="padding:14px 0;border-bottom:1px solid #eee2d4">
      <div style="font:600 17px/1.3 Georgia,serif;color:#3d2411">${esc(v.name)}</div>
      <div style="font:600 12px/1.6 Arial,sans-serif;color:#c2610d;text-transform:uppercase;letter-spacing:.08em">${esc(v.best)}</div>
      <div style="font:400 14px/1.6 Arial,sans-serif;color:#5d4c3c;margin-top:5px">${esc(v.note)}</div>
    </td></tr>`;
  };

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#faf5ee;padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:26px">
<tr><td>
  <div style="font:600 12px/1 Arial,sans-serif;color:#c2610d;letter-spacing:.14em;text-transform:uppercase">Mr Pumpkin</div>
  <h1 style="font:700 26px/1.2 Georgia,serif;color:#3d2411;margin:10px 0 0">All ten found</h1>
  <p style="font:400 15px/1.6 Arial,sans-serif;color:#5d4c3c">Well done ${who} — here is every variety from the hunt, and what each one is actually good for once you get it home.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${found.map(row).join("")}</table>
  ${missed.length ? `<p style="font:400 14px/1.6 Arial,sans-serif;color:#7b6857;margin-top:20px">You didn't catch ${missed.length} of them this time — ${esc(missed.map((s) => VARIETIES[s].name).join(", "))}. Something for the next visit.</p>` : ""}
  <p style="font:400 13px/1.7 Arial,sans-serif;color:#8a7867;margin-top:26px;padding-top:16px;border-top:1px solid #eee2d4">
    Sent once because you asked for it at the end of the hunt. We won't email you again.<br>
    Pumpkin hunt built by <a href="https://smartcoretechnology.co.uk" style="color:#c2610d">SmartCore Technology</a>.
  </p>
</td></tr></table></body></html>`;

  const text =
    `Well done ${name || "you"} - here is every variety from the hunt.\n\n` +
    found.map((s) => `${VARIETIES[s].name} - ${VARIETIES[s].best}\n  ${VARIETIES[s].note}`).join("\n\n") +
    (missed.length ? `\n\nStill to find next time: ${missed.map((s) => VARIETIES[s].name).join(", ")}` : "") +
    `\n\nSent once because you asked for it at the end of the hunt.\nBuilt by SmartCore Technology - smartcoretechnology.co.uk\n`;

  return { html, text };
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await readBody(request);
  } catch {
    return json({ error: "bad request" }, 400);
  }

  const email = String(body.email || "").trim().slice(0, 160);
  const name = String(body.name || "").trim().slice(0, 60);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "invalid email" }, 400);

  const found = Array.isArray(body.found) ? body.found.filter((s) => VARIETIES[s]).slice(0, 10) : [];
  if (!found.length) return json({ error: "nothing found yet" }, 400);

  const ip = await hashIp(request, env.IP_SALT);

  /* Cheap durable rate limit. At this volume a round trip costs nothing, and
     it survives restarts in a way an in-memory counter would not. */
  try {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const res = await sb(env, `guide_requests?ip_hash=eq.${ip}&created_at=gte.${since}&select=id`, {
      headers: { Prefer: "count=exact", Range: "0-0" },
    });
    const range = res.headers.get("content-range") || "";
    const total = parseInt(range.split("/")[1] || "0", 10);
    if (total >= MAX_PER_IP_PER_HOUR) {
      return json({ error: "too many requests, try again later" }, 429);
    }
  } catch {
    /* If the check itself fails, let the send through rather than block a
       family at the gate. The cap is anti-abuse, not billing control. */
  }

  const { html, text } = buildEmail(name, found);

  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      /* Friendly From name, because nobody who spent an afternoon at a
         pumpkin patch knows what SmartCore is. Attribution goes in the
         footer, not the sender. */
      from: env.GUIDE_FROM || "Mr Pumpkin Hunt <hunt@mail.smartcoretechnology.co.uk>",
      to: [email],
      subject: "Your Mr Pumpkin guide",
      html,
      text,
    }),
  });

  if (!sent.ok) {
    const detail = await sent.text().catch(() => "");
    console.log("resend failed", sent.status, detail.slice(0, 300));
    return json({ error: "could not send" }, 502);
  }

  try {
    await sb(env, "guide_requests", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        email,
        name: name || null,
        device: String(body.device || "").slice(0, 64),
        found_slugs: found,
        ip_hash: ip,
      }),
    });
  } catch {
    /* The email is away, which is what the visitor cares about. */
  }

  return json({ ok: true });
}
