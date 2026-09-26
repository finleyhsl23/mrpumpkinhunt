/* Shared helpers for the API endpoints.
 *
 * The browser never talks to Supabase directly. Everything goes through these
 * functions with the service role key, so there is no anon key in the client
 * to lift and no RLS policy to get subtly wrong.
 *
 * Tables live in their own `mrpumpkin` schema, keeping a seasonal one-off out
 * of the core database - November's clean-up is one DROP SCHEMA. That schema
 * MUST be added to the project's "Exposed schemas" list in Supabase, and the
 * service role granted usage on it, or PostgREST will not serve it and every
 * write fails silently. Both are in supabase/001_mrpumpkin_schema.sql and the
 * README.
 */

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/* Raw IP addresses are personal data and we have no use for them. A salted
 * hash is enough to spot one phone hammering the endpoint. */
export async function hashIp(request, salt) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const data = new TextEncoder().encode(`${salt || "mrpumpkin"}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export async function sb(env, path, init = {}) {
  const url = `${env.SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      /* The hunt's tables live in their own schema, so the request has to say
         so. These headers only work once `mrpumpkin` is in the project's
         "Exposed schemas" list - without that PostgREST refuses to serve it,
         whatever key is used, and every write fails silently. */
      "Accept-Profile": "mrpumpkin",
      "Content-Profile": "mrpumpkin",
      ...(init.headers || {}),
    },
  });
  return res;
}

export function readBody(request, limit = 4096) {
  return request.text().then((text) => {
    if (text.length > limit) throw new Error("payload too large");
    try { return JSON.parse(text); } catch { throw new Error("bad json"); }
  });
}
