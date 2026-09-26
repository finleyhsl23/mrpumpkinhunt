import { json, sb } from "./_lib.js";

/* A read-only check of whether this deployment actually works.
 *
 * It does not merely report which variables are set. That version of this
 * endpoint said Supabase was configured while every single write was being
 * rejected, because the tables lived in a schema PostgREST had not been told
 * to serve - and the failures were swallowed so a database problem could not
 * spoil a visit. So this one makes a real request and reports what came back.
 *
 * Booleans, counts and the From address only. No key, no secret and no
 * visitor data is ever returned, so it is safe to open in a browser.
 */
export async function onRequestGet({ env }) {
  const from = env.GUIDE_FROM || "Mr Pumpkin Hunt <hunt@smartcoretechnology.co.uk>";
  const domain = (from.match(/@([^>\s]+)/) || [])[1] || null;

  const checks = {
    functions_deployed: true,          // reaching this at all proves it
    resend_key_set: Boolean(env.RESEND_API_KEY),
    supabase_url_set: Boolean(env.SUPABASE_URL),
    supabase_key_set: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    ip_salt_set: Boolean(env.IP_SALT),
    sending_from: from,
    sending_domain: domain,
    database_reachable: false,
    database_detail: "not attempted",
    hunts_saved: null,
  };

  /* The part that matters: can we actually read a row? */
  if (checks.supabase_url_set && checks.supabase_key_set) {
    try {
      const res = await sb(env, "saved_hunts?select=email", {
        headers: { Prefer: "count=exact", Range: "0-0" },
      });
      if (res.ok || res.status === 206) {
        checks.database_reachable = true;
        checks.database_detail = "ok";
        checks.hunts_saved = parseInt((res.headers.get("content-range") || "").split("/")[1] || "0", 10);
      } else {
        const body = await res.text().catch(() => "");
        checks.database_detail = `${res.status}: ${body.slice(0, 200)}`;
        /* By far the most likely cause, and the message PostgREST returns for
           it is easy to miss among the JSON. */
        if (res.status === 404 || res.status === 406 || /schema/i.test(body)) {
          checks.database_detail += "  >> add 'mrpumpkin' to Exposed schemas in Supabase (Settings > API)";
        }
      }
    } catch (err) {
      checks.database_detail = String(err).slice(0, 200);
    }
  } else {
    checks.database_detail = "no url or key";
  }

  const problems = [];
  if (!checks.resend_key_set) problems.push("RESEND_API_KEY is not set - the guide email cannot send");
  if (!checks.supabase_url_set) problems.push("SUPABASE_URL is not set");
  if (!checks.supabase_key_set) problems.push("SUPABASE_SERVICE_ROLE_KEY is not set");
  if (checks.supabase_url_set && checks.supabase_key_set && !checks.database_reachable) {
    problems.push("Supabase is configured but the request failed - see database_detail");
  }
  if (!checks.ip_salt_set) problems.push("IP_SALT is not set - falling back to a default salt");

  return json({
    ok: checks.resend_key_set && checks.database_reachable,
    checks,
    problems,
    note: "The sending domain must be verified for sending in Resend, or every email is rejected before it is logged.",
  });
}
