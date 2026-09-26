import { json, sb, readBody } from "./_lib.js";

/* Best-effort analytics: how many hunts start, how many finish, and which
 * pumpkin is found least - that last number tells the patch which sign is in
 * a bad spot, which is the only genuinely operational thing here.
 *
 * This endpoint must never be able to spoil a visit. Every failure path
 * returns 200 and the client ignores the response entirely.
 */
export async function onRequestPost({ request, env }) {
  try {
    const body = await readBody(request);

    const event = String(body.event || "").slice(0, 24);
    if (!["find", "complete", "bad_code"].includes(event)) return json({ ok: true });

    const row = {
      event,
      device: String(body.device || "").slice(0, 64),
      pumpkin_slug: body.slug ? String(body.slug).slice(0, 48) : null,
      found_count: Number.isFinite(body.found_count) ? Math.min(body.found_count, 99) : null,
      /* The client's clock can be wrong or deliberately set; keep it for
         ordering within a visit but trust the server for anything real. */
      client_at: typeof body.at === "string" ? body.at.slice(0, 32) : null,
    };

    await sb(env, "events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
  } catch {
    /* Swallowed on purpose - see above. */
  }
  return json({ ok: true });
}
