import { json, sb, hashIp, readBody } from "./_lib.js";

/* Emails the visitor their pumpkin guide.
 *
 * This is a public "type an address, we send mail" endpoint, which is an
 * abuse relay if left open - someone will point it at a third party, or
 * simply burn the month's quota for entertainment. Hence the per-IP cap and
 * the strict allowlist of what can appear in the message: the body is built
 * from our own content, and nothing the caller sends is rendered except a
 * first name, escaped.
 */

const MAX_PER_IP_PER_HOUR = 6;
const SITE = "https://mrpumpkinhunt.pages.dev";

/* Brand palette, lifted from the hunt. Email gets a warm cream body rather
 * than the site's near-black: several clients invert dark backgrounds badly,
 * and a cream email prints legibly if anyone ever does. */
const ORANGE = "#f97316";
const BROWN = "#2a1a0f";
const CREAM = "#fdf7ef";
const INK = "#3d2411";
const MUTED = "#7b6857";

const VARIETIES = {
  "crown-prince":    { name: "Crown Prince",    best: "Roasting & soup",       note: "Keeps for months in a cool shed — and the flavour improves, so it is better at Christmas than today." },
  "casperita":       { name: "Casperita",       best: "Decorating",            note: "White pumpkins are not painted; the skin simply never makes the orange pigment." },
  "warty-goblin":    { name: "Warty Goblin",    best: "Carving & display",     note: "The warts are hard as bark and no two are ever the same." },
  "grizzly-bear":    { name: "Grizzly Bear",    best: "Display",               note: "Tan rather than orange, and the warts are bred hard so they survive a day of handling." },
  "blue-banana":     { name: "Blue Banana",     best: "Roasting & soup",       note: "Cut it into rings rather than wedges — it roasts far more evenly." },
  "galaxy-of-stars": { name: "Galaxy of Stars", best: "Display",               note: "A gourd, not a pumpkin. Look at one end on and you will see the five points." },
  "jill-be-little":  { name: "Jill Be Little",  best: "Decorating",            note: "Hollow one out, crack an egg in and bake it — properly edible." },
  "tiny-turk":       { name: "Tiny Turk",       best: "Display",               note: "The knot on top is the blossom end, growing upwards instead of tucking in." },
  "porcelain-doll":  { name: "Porcelain Doll",  best: "Roasting, soup & pies", note: "Pink pumpkins are grown worldwide to raise money for breast cancer charities." },
  "magic-lantern":   { name: "Magic Lantern",   best: "Carving",               note: "Cut the lid slanted inwards or it drops straight through." },
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function buildEmail(name, foundSlugs) {
  const found = foundSlugs.filter((s) => VARIETIES[s]);
  const missed = Object.keys(VARIETIES).filter((s) => !found.includes(s));
  const who = name ? esc(name) : "you";
  const all = found.length === Object.keys(VARIETIES).length;

  /* Tables and inline styles throughout: Outlook still has no flexbox, and
     a <style> block is stripped by several clients including Gmail. */
  const row = (slug) => {
    const v = VARIETIES[slug];
    return `<tr><td style="padding:0 0 10px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background:${CREAM};border-radius:14px;border:1px solid #efe2d1">
        <tr>
          <td width="84" valign="middle" style="padding:12px 0 12px 12px">
            <img src="${SITE}/assets/pumpkins/png/${slug}.png" width="72" height="72" alt="${esc(v.name)}"
                 style="display:block;width:72px;height:72px;border:0;border-radius:12px">
          </td>
          <td valign="middle" style="padding:12px 16px 12px 14px">
            <div style="font:700 17px/1.25 Georgia,'Times New Roman',serif;color:${INK}">${esc(v.name)}</div>
            <div style="font:700 11px/1.6 Arial,Helvetica,sans-serif;color:${ORANGE};letter-spacing:.09em;text-transform:uppercase">${esc(v.best)}</div>
            <div style="font:400 13px/1.55 Arial,Helvetica,sans-serif;color:${MUTED};padding-top:4px">${esc(v.note)}</div>
          </td>
        </tr>
      </table></td></tr>`;
  };

  const html = `<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your Mr Pumpkin guide</title></head>
<body style="margin:0;padding:0;background:#efe4d6;">
<!-- Shown in the inbox preview line, before anything is opened. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Every variety you found at Mr Pumpkin, and what each one is best for.</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efe4d6;padding:20px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden">

  <tr><td style="background:${BROWN};padding:22px 26px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle" style="padding-right:10px">
        <img src="${SITE}/assets/favicon.svg" width="26" height="26" alt=""
             style="display:block;width:26px;height:26px;border:0">
      </td>
      <td valign="middle">
        <div style="font:700 17px/1.2 Arial,Helvetica,sans-serif;color:#fff">Mr Pumpkin</div>
        <div style="font:400 12px/1.4 Arial,Helvetica,sans-serif;color:#c9ac8e">Pick Your Perfect Pumpkin Near Derby</div>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:28px 26px 4px">
    <div style="font:700 11px/1 Arial,Helvetica,sans-serif;color:${ORANGE};letter-spacing:.16em;text-transform:uppercase">
      ${all ? "All ten found" : `${found.length} of 10 found`}
    </div>
    <h1 style="font:700 27px/1.2 Georgia,'Times New Roman',serif;color:${INK};margin:12px 0 0">
      ${all ? `Well done ${who}.` : `Nicely done ${who}.`}
    </h1>
    <p style="font:400 15px/1.6 Arial,Helvetica,sans-serif;color:${MUTED};margin:10px 0 0">
      Here is every variety you found on the hunt, and what each one is actually good for once you get it home.
    </p>
  </td></tr>

  <tr><td style="padding:22px 26px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${found.map(row).join("")}</table>
  </td></tr>

  ${missed.length ? `<tr><td style="padding:10px 26px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:${CREAM};border-radius:14px;border:1px dashed #e3d2bc">
      <tr><td style="padding:16px 18px">
        <div style="font:700 13px/1.3 Arial,Helvetica,sans-serif;color:${INK}">Still out there</div>
        <div style="font:400 13px/1.6 Arial,Helvetica,sans-serif;color:${MUTED};padding-top:4px">
          ${esc(missed.map((s) => VARIETIES[s].name).join(", "))} — something for the next visit.
        </div>
      </td></tr></table>
  </td></tr>` : ""}

  <tr><td align="center" style="padding:24px 26px 6px">
    <a href="${SITE}" style="display:inline-block;background:${ORANGE};color:#2b1503;text-decoration:none;
       font:700 15px/1 Arial,Helvetica,sans-serif;padding:15px 30px;border-radius:99px">Back to the hunt</a>
  </td></tr>

  <tr><td style="padding:22px 26px 26px">
    <div style="border-top:1px solid #efe2d1;padding-top:16px;
         font:400 12px/1.7 Arial,Helvetica,sans-serif;color:#9d8b79">
      Sent once because you asked for it at the end of the hunt. We will not email you again.<br>
      Hunt built by <a href="https://smartcoretechnology.co.uk" style="color:${ORANGE};text-decoration:none">SmartCore Technology</a>.
    </div>
  </td></tr>

</table></td></tr></table>
</body></html>`;

  const text =
    `${all ? "Well done" : "Nicely done"} ${name || "you"} - ${found.length} of 10 found at Mr Pumpkin.\n\n` +
    found.map((s) => `${VARIETIES[s].name} - ${VARIETIES[s].best}\n  ${VARIETIES[s].note}`).join("\n\n") +
    (missed.length ? `\n\nStill out there: ${missed.map((s) => VARIETIES[s].name).join(", ")}` : "") +
    `\n\nBack to the hunt: ${SITE}\n\nSent once because you asked for it at the end of the hunt.\nBuilt by SmartCore Technology - smartcoretechnology.co.uk\n`;

  const subject = all
    ? `${name ? name + ", you" : "You"} found all ten — your Mr Pumpkin guide`
    : `Your Mr Pumpkin guide — ${found.length} of 10 found`;

  return { html, text, subject };
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

  if (!env.RESEND_API_KEY) {
    console.log("send-guide: RESEND_API_KEY is not set");
    return json({ error: "email is not configured" }, 503);
  }

  const ip = await hashIp(request, env.IP_SALT);

  /* Cheap durable rate limit. At this volume a round trip costs nothing, and
     it survives restarts in a way an in-memory counter would not. */
  try {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const res = await sb(env, `guide_requests?ip_hash=eq.${ip}&created_at=gte.${since}&select=id`, {
      headers: { Prefer: "count=exact", Range: "0-0" },
    });
    const total = parseInt((res.headers.get("content-range") || "").split("/")[1] || "0", 10);
    if (total >= MAX_PER_IP_PER_HOUR) return json({ error: "too many requests, try again later" }, 429);
  } catch {
    /* If the check itself fails, let the send through rather than block a
       family at the gate. The cap is anti-abuse, not billing control. */
  }

  const { html, text, subject } = buildEmail(name, found);

  /* The From name is the event, not SmartCore: nobody who spent an afternoon
     at a pumpkin patch knows what SmartCore is, and an unrecognised sender
     gets binned. Attribution lives in the footer instead. The domain must be
     one that is verified for sending in Resend. */
  const from = env.GUIDE_FROM || "Mr Pumpkin Hunt <hunt@smartcoretechnology.co.uk>";

  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject, html, text }),
  });

  if (!sent.ok) {
    /* Resend's own message names the cause - almost always a From domain
       that is not verified for sending. It contains no secret (the From
       address travels in every email header anyway), so it is handed back
       rather than swallowed. A silent 502 cost us two rounds of guessing. */
    const raw = await sent.text().catch(() => "");
    let detail = raw.slice(0, 300);
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.message) detail = String(parsed.message).slice(0, 300);
    } catch { /* not JSON; the raw text will do */ }

    console.log("send-guide: resend rejected", sent.status, "from:", from, detail);
    return json({ error: "could not send", status: sent.status, from, detail }, 502);
  }

  try {
    await sb(env, "guide_requests", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ email, name: name || null, device: String(body.device || "").slice(0, 64), found_slugs: found, ip_hash: ip }),
    });
  } catch {
    /* The email is away, which is what the visitor cares about. */
  }

  return json({ ok: true });
}
