# Mr Pumpkin — Pumpkin Hunt

A QR scavenger hunt for the pumpkin patch. Ten varieties, ten signs in the
field. Scan a sign, learn what that pumpkin is and what it is good for, and
collect it. Find all ten and you can have the guide emailed over.

Built for October 2026. First gate open **Sunday 4th October**.

---

## The one thing that matters

**A pumpkin patch is a field, and the signal is worst exactly where the far
pumpkins are.** Everything here is built around that:

- The hunt is **plain static files**. No framework, no build step, no server
  on the critical path.
- Progress lives in **localStorage on the visitor's own phone**. No sign-in,
  no account, nothing to load before a pumpkin can be found.
- A **service worker precaches the entire hunt** on the first scan — which
  almost always happens at the gate, where the bars are. Every sign after
  that works with no connection at all.
- Supabase and Resend are **best-effort extras**. If either is down, or the
  phone has no signal, the hunt still works and nobody sees an error.

This is verified, not assumed: the test run loads a pumpkin page with the
network switched off.

---

## Layout

```
index.html                  the hunt: intro, collection grid, manual code entry, finish
p.html                      one pumpkin — every /p/<code> serves this
privacy.html                what we do with an email address
qr.html                     printable sign sheet + staff key  (/qr)
assets/pumpkins.js          THE CONTENT FILE — names, descriptions, codes
assets/app.js               progress store, offline queue
assets/styles.css           all colour lives in the :root block at the top
assets/pumpkins/*.svg       placeholder artwork (see below)
assets/vendor/qrcode.js     vendored QR encoder, deliberately not a CDN link
functions/api/track.js      anonymous stats
functions/api/send-guide.js the completion email
supabase/001_*.sql          the mrpumpkin schema
sw.js                       the offline cache
```

---

## Codes, and why they look like nonsense

A sign encodes `https://<site>/p/k7m2q`. The code is deliberately meaningless.

- **It cannot be guessed.** `/p/crown-prince` would mean the first child to
  read one sign could type the other nine from the car park.
- **It is not tied to a variety at print time.** The sign says "I am sign
  k7m2q", nothing more. Which pumpkin that means is one line in
  `assets/pumpkins.js`.

That last point is the useful one: **signs can be printed before the content
is final**, reassigned to a different variety later, and physically moved
around the field, without reprinting anything.

Codes avoid `0`/`O` and `1`/`l`/`i` so a muddy sign can still be read aloud by
a member of staff and typed in by hand.

| Code    | Variety          |
|---------|------------------|
| `k7m2q` | Crown Prince     |
| `w4xp9` | Casperita        |
| `t3ndr` | Warty Goblin     |
| `b8jhz` | Grizzly Bear     |
| `s5qvk` | Blue Banana      |
| `m9r4t` | Galaxy of Stars  |
| `p2wgy` | Jill Be Little   |
| `h6zkn` | Tiny Turk        |
| `d4tqm` | Porcelain Doll   |
| `v7nbx` | Magic Lantern    |

---

## Printing the signs

Open `/qr`, set the site address, press **Print signs**. One sign per half
page, each with its QR and the code printed underneath as the fallback.

**Matte laminate, never gloss.** A phone torch on a gloss laminate makes a
hotspot the camera cannot read through. Two October dates run to 6pm and the
last week closes at dusk, so this will happen. It is the most common way a QR
trail fails and it is invisible until it is dark.

Also: mount at chest height where a torch reaches, and do not trim the white
border off the code — that border is what makes it scannable.

The **staff key** (code → variety) is on the same page but deliberately does
not print with the signs. Keep it at the gate. The signs must give nothing
away or there is no hunt.

---

## Deploying

Cloudflare Pages, no build command, output directory is the repository root.

### Environment variables

| Name                        | What it is                                          |
|-----------------------------|-----------------------------------------------------|
| `SUPABASE_URL`              | `https://<ref>.supabase.co`                          |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key. **Server-side only.**              |
| `RESEND_API_KEY`            | Resend API key                                       |
| `GUIDE_FROM`                | e.g. `Mr Pumpkin Hunt <hunt@mail.example.co.uk>`     |
| `IP_SALT`                   | Any long random string, for hashing IPs              |

The browser never talks to Supabase. Both keys stay in the Pages functions,
which is why there is no anon key in the client to lift, no RLS policy to get
subtly wrong, and no need to add `mrpumpkin` to Supabase's exposed schemas.

### Database

Run `supabase/001_mrpumpkin_schema.sql` once. It creates the `mrpumpkin`
schema, two tables and two views. In November the whole thing is
`drop schema mrpumpkin cascade;` and the core database is untouched.

Two views worth reading during the season:

- `mrpumpkin.v_finds_by_pumpkin` — sorted least-found first. **The pumpkin at
  the top of that list probably has a sign in a bad spot.**
- `mrpumpkin.v_daily` — hunts started, hunts finished, failed scans per day.

### Email

Send from a **subdomain** (`mail.…`), not the root domain, so a problem here
can never affect deliverability of anything else. Get SPF, DKIM and DMARC in
before the 4th — not on the morning of.

The From *name* is the event, not SmartCore. Nobody who spent an afternoon at
a pumpkin patch knows what SmartCore is; if that is the sender they will bin
it as spam. Attribution is in the footer instead.

---

## Changing the content

Everything visitors read is in `assets/pumpkins.js`. Edit and redeploy — the
signs are unaffected, because they only ever refer to codes.

`scale` is each variety's real size relative to the others. It is what makes
Jill Be Little genuinely tiny beside a Grizzly Bear in the grid, which is an
identification aid, not decoration. Keep it roughly honest.

### Swapping in real photographs

The artwork is placeholder SVG. Real cut-out photos drop straight in:

1. Cut the background out. **A phone will beat any tool here** — on an iPhone,
   long-press the pumpkin in the photo to lift the subject out. Thirty seconds
   each, and very good against grass or straw.
2. Save as PNG with transparency, then **resize to ~800px and convert to
   WebP**. Target under 100KB each and under 1.5MB for all ten.
   **This matters**: ten photos straight off a phone is 30–50MB, which would
   destroy the offline caching and with it the whole point of the build.
3. Drop them in `assets/pumpkins/`, update the paths, and bump `CACHE` in
   `sw.js` or phones will keep serving the old copies.

Keep the full-resolution originals for print — different job, different rules.

---

## Before opening on the 4th

- [ ] **Confirm Grizzly Bear and Galaxy of Stars** with whoever bought the
      seed. Their descriptions are the two I am least sure of, and they get
      read while somebody is stood next to the actual pumpkin.
- [ ] Freeze the site address, then print. That URL is laminated and staked
      in a field — it cannot be changed afterwards.
- [ ] Matte laminate. Really.
- [ ] Put the **start board at the gate**, big and unmissable. The hunt is not
      in any of the ticket marketing, so people discover it on the day — and
      the gate is also where the precache happens.
- [ ] Verify SPF/DKIM/DMARC on the sending subdomain.
- [ ] Walk the field and scan all ten signs on a real phone, ideally in poor
      light.

**Treat Sunday 4th October as a pilot.** There is a six-day gap before the
first peak weekend on the 10th and 11th — that is the window to fix whatever
the first real families break.

---

## Deliberately not built

Leaderboards, accounts, photo uploads, an admin CMS, multi-tenancy, an app.
Each is a week this project does not have and a support burden nobody wants
in October. The hunt is an hour of a family's afternoon, not a platform.

---

## Known follow-ups

- The Google Font is loaded from Google. Self-hosting it would remove a
  third-party request and make the hunt fully self-contained. It degrades
  gracefully to a system font today, so this is tidiness rather than urgency.
- The guide email is text-only. Once real photographs exist, PNG thumbnails
  could be added — but not SVG, which Gmail strips.
- The guide is offered only on completion, per the brief. Making it available
  at any point is a one-line change in `index.html` if families who do not
  finish start asking for it.
