import { json } from "./_lib.js";

/* A read-only check of whether this deployment is configured.
 *
 * Exists because a silent failure cost us an evening: the guide email was not
 * sending, nothing appeared in Resend, and there was no way to tell from a
 * phone in a field whether the cause was a missing key, an unverified domain
 * or an undeployed function.
 *
 * Booleans and the From address only. No key, no secret and no visitor data
 * is ever returned, so this is safe to open in a browser.
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
  };

  const blocking = [];
  if (!checks.resend_key_set) blocking.push("RESEND_API_KEY is not set - the guide email cannot send");
  if (!checks.supabase_url_set || !checks.supabase_key_set) {
    blocking.push("Supabase is not configured - stats will not record (the hunt still works)");
  }
  if (!checks.ip_salt_set) blocking.push("IP_SALT is not set - falling back to a default salt");
  if (domain && domain !== domain.toLowerCase()) blocking.push("sending domain has odd casing");

  return json({
    ok: checks.resend_key_set,
    checks,
    problems: blocking,
    note: "The sending domain above must be verified for sending in Resend, or every email is rejected before it is logged.",
  });
}
