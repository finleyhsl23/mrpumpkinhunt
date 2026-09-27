/* The guide email carries its own copy of the variety text, because a Pages
 * Function cannot load assets/pumpkins.js. That duplication is the reason
 * this check exists: edit one and forget the other, and visitors get a
 * different description on the website than in their email.
 *
 * Run with: node tools/check-copy-sync.js
 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

const src = fs.readFileSync(path.join(root, "functions/api/send-guide.js"), "utf8");
const at = src.indexOf("const VARIETIES");
if (at < 0) throw new Error("send-guide.js no longer declares VARIETIES");
const literal = src.slice(src.indexOf("{", at), src.indexOf("};", at) + 1);
const email = eval("(" + literal + ")");

global.window = {};
require(path.join(root, "assets/pumpkins.js"));
const site = global.window.PUMPKINS;

const problems = [];
const siteSlugs = site.map((p) => p.slug);
const emailSlugs = Object.keys(email);
if (siteSlugs.join() !== emailSlugs.join()) {
  problems.push(`varieties differ or are in a different order:\n  site:  ${siteSlugs.join(", ")}\n  email: ${emailSlugs.join(", ")}`);
} else {
  for (const p of site) {
    if (email[p.slug].name !== p.name) problems.push(`${p.slug}: name "${email[p.slug].name}" in the email, "${p.name}" on the site`);
    if (email[p.slug].best !== p.bestFor) problems.push(`${p.slug}: best-for "${email[p.slug].best}" in the email, "${p.bestFor}" on the site`);
  }
}

// Every variety needs a full set of fields; a missing one renders as blank.
for (const p of site) {
  for (const f of ["code", "slug", "name", "tagline", "description", "bestFor", "bestForKey", "size", "scale", "fact", "hint"]) {
    if (!p[f]) problems.push(`${p.slug || "?"}: missing ${f}`);
  }
  if (!global.window.BEST_FOR_LABELS[p.bestForKey]) problems.push(`${p.slug}: bestForKey "${p.bestForKey}" has no label`);
}

// Codes are printed onto physical signs, so a duplicate would send two
// varieties to the same page and a change would orphan a sign in the field.
const codes = site.map((p) => p.code);
if (new Set(codes).size !== codes.length) problems.push("duplicate variety codes");

if (problems.length) {
  console.error("FAIL\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`OK  ${site.length} varieties, website and email copy in step`);
