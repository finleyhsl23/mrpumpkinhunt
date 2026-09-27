/* Renders the printable signs: one per variety, plus a start board for the
 * gate. Run with:  node tools/make-signs.mjs
 *
 * The sign face deliberately does NOT name the pumpkin. The whole hunt is
 * "scan this and find out what it is", and a name printed above the code
 * answers the question before anybody lifts a phone. Staff still need to know
 * which sign goes where, so the name sits below a dashed trim line at the
 * very bottom: cut it off, or fold it under, once the sign is in the ground.
 *
 * Error correction is level H, the highest, which tolerates roughly 30% of
 * the code being obscured. These live outdoors in a field in October, so
 * assume mud, rain and a boot print.
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIVE = process.env.SITE || "https://mrpumpkinhunt.pages.dev";
const OUT = join(ROOT, "signs");
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const lib = readFileSync(join(ROOT, "assets/vendor/qrcode.js"), "utf8");
const win = {};
new Function("window", readFileSync(join(ROOT, "assets/pumpkins.js"), "utf8"))(win);

const css = `
  *{box-sizing:border-box}
  body{margin:0;background:#fff;font:400 16px/1.45 -apple-system,"Segoe UI",system-ui,sans-serif;color:#16131a}
  .sign{width:1000px;padding:62px 56px 0;text-align:center}
  .kicker{font-size:19px;letter-spacing:.22em;text-transform:uppercase;color:#c2610d;font-weight:800}
  h1{font-size:58px;line-height:1.08;margin:18px 0 10px;font-weight:800;letter-spacing:-.01em}
  .lede{color:#55505e;margin:0 auto 34px;font-size:24px;max-width:34ch}
  .qr{width:560px;margin:0 auto;padding:22px;border:3px solid #16131a;border-radius:22px}
  .qr svg{width:100%;height:auto;display:block}
  .code{margin-top:30px;font:800 52px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.26em;text-indent:.26em}
  .code small{display:block;font:700 16px/1.5 -apple-system,system-ui,sans-serif;letter-spacing:.15em;text-transform:uppercase;color:#6d6878;margin-bottom:10px;text-indent:0}
  .foot{margin-top:30px;font-size:16px;color:#8b8694}
  /* Staff only. Trim or fold under once the sign is placed. */
  .trim{margin-top:44px;border-top:2px dashed #cfc9d6;padding:14px 0 26px;
        font:600 15px/1.4 -apple-system,system-ui,sans-serif;color:#a49eae;letter-spacing:.04em}
`;

function page(body) {
  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"><style>${css}</style></head>
<body><div class="sign" id="sign"></div><script>${lib}</script><script>
document.getElementById("sign").innerHTML = ${JSON.stringify(body)}
  .replace("__QR__", (function(){ var q = qrcode(0, "H"); q.addData(__URL__); q.make();
    return q.createSvgTag({ cellSize: 10, margin: 1, scalable: true }); })());
</script></body></html>`;
}

function build(url, body) {
  return page(body).replace("__URL__", JSON.stringify(url));
}

const varietySign = (p, i) => build(`${LIVE}/p/${p.code}`,
  '<div class="kicker">Mr Pumpkin Hunt</div>' +
  "<h1>Which pumpkin is this?</h1>" +
  '<div class="lede">Point your camera at the code to find out — and collect it.</div>' +
  '<div class="qr">__QR__</div>' +
  '<div class="code"><small>Won’t scan? Type this in</small>' + p.code + "</div>" +
  '<div class="foot">mrpumpkinhunt.pages.dev · built by SmartCore Technology</div>' +
  '<div class="trim">Sign ' + (i + 1) + " of " + win.PUMPKINS.length +
    " — place beside: " + p.name + "  ·  trim or fold this strip under</div>");

const startSign = build(LIVE,
  '<div class="kicker">Mr Pumpkin · Derby</div>' +
  "<h1>Ten pumpkins are hiding in the patch.</h1>" +
  '<div class="lede">Scan to start the hunt. Free with your ticket — all you need is a camera.</div>' +
  '<div class="qr">__QR__</div>' +
  '<div class="foot" style="margin-top:34px;font-size:20px">mrpumpkinhunt.pages.dev</div>' +
  '<div class="trim">Start board — place at the gate  ·  trim or fold this strip under</div>');

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 3 });

async function shoot(html, name) {
  writeFileSync("/tmp/sign.html", html);
  const pg = await ctx.newPage();
  await pg.goto("file:///tmp/sign.html", { waitUntil: "networkidle" });
  await pg.locator(".sign").screenshot({ path: join(OUT, name) });
  await pg.close();
  console.log("  " + name);
}

console.log(`signs for ${LIVE}`);
await shoot(startSign, "00-start-here.png");
for (const [i, p] of win.PUMPKINS.entries()) {
  await shoot(varietySign(p, i), `${String(i + 1).padStart(2, "0")}-${p.slug}-${p.code}.png`);
}
await browser.close();
console.log(`\n  ${win.PUMPKINS.length + 1} signs written to signs/`);
