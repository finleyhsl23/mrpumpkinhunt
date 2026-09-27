/* The ten varieties in the hunt.
 *
 * `code` is what a QR sign encodes and it is deliberately meaningless: the
 * sign says "I am sign k7m2q", not "I am the Crown Prince". That is what lets
 * signs be printed before the content is final, reassigned to a different
 * variety later, and physically moved around the field without reprinting.
 * Codes avoid 0/O and 1/l/i so a muddy sign can still be read aloud and typed
 * in by hand.
 *
 * `scale` renders each variety at its real size relative to the others, so a
 * Jill Be Little genuinely looks tiny beside a Blue Banana. It is an
 * identification aid, not decoration.
 */
window.PUMPKINS = [
  {
    code: "k7m2q",
    slug: "crown-prince",
    name: "Crown Prince",
    tagline: "Striking blue, rich sweet flesh",
    description:
      "This striking variety has a smooth, steel-grey-blue skin that contrasts beautifully with its deep orange interior. Its dense, sweet, nutty flesh is prized by chefs and bakers alike, because it has almost no stringiness.",
    bestFor: "Gourmet roasting & baking",
    bestForKey: "eat",
    size: "About the size of a football — 3 to 4kg",
    scale: 0.85,
    fact: "It keeps for months in a cool shed — and the flavour actually improves, so it is better at Christmas than it is today.",
    hint: "Look for the odd blue one out.",
  },
  {
    code: "w4xp9",
    slug: "casperita",
    name: "Casperita",
    tagline: "Miniature stark white powerhouse",
    description:
      "A pint-sized, ghost-white pumpkin that yields a high number of fruit per vine. Its pale rind stays crisp and clean, while the inside holds a surprisingly sweet, pale flesh.",
    bestFor: "Single-serve baking bowls",
    bestForKey: "eat",
    size: "Grapefruit-sized — 250 to 700g",
    scale: 0.42,
    fact: "White pumpkins are not painted or bleached — the skin simply never makes the orange pigment.",
    hint: "One of the pale ones, but not the smallest.",
  },
  {
    code: "t3ndr",
    slug: "warty-goblin",
    name: "Warty Goblin",
    tagline: "Frighteningly bumpy green and orange",
    description:
      "True to its name, this hard-shelled specimen is covered in prominent, bumpy warts that stay green even as the rest of the pumpkin matures to a deep orange. A spooky, textured look that commands attention.",
    bestFor: "Spooky Halloween porches",
    bestForKey: "carve",
    size: "Big — 4 to 9kg",
    scale: 1.0,
    fact: "The warts are hard as bark and grow as the skin stretches, so no two are ever the same.",
    hint: "You will know it when you see it.",
  },
  {
    code: "m8jkc",
    slug: "grizzly-bear",
    name: "Grizzly Bear",
    tagline: "Heavy warts, rustic brown charm",
    description:
      "This unusual variety changes colour as it ripens, from green to a deep, dark tan-brown. It is completely covered in heavy, corky warts, giving it an intensely rugged, rustic texture.",
    bestFor: "Earthy autumn displays",
    bestForKey: "show",
    size: "Smaller than you’d think — 3 to 4kg",
    scale: 0.78,
    fact: "The warts are bred hard rather than soft, so they survive being handled all day without knocking off.",
    hint: "Look for the tan one, not an orange one.",
  },
  {
    code: "b5hqt",
    slug: "blue-banana",
    name: "Blue Banana",
    tagline: "Elongated heirloom blue-grey squash",
    description:
      "An unusual, banana-shaped heirloom pumpkin with a smooth, silvery-blue skin. Beneath the striking exterior lies a thick, dry, finely grained orange flesh with an exceptionally sweet flavour.",
    bestFor: "Rich autumn soups",
    bestForKey: "eat",
    size: "Forearm length — and 5 to 9kg of it",
    scale: 1.05,
    fact: "Cut it into rings rather than wedges — it roasts far more evenly that way.",
    hint: "Not round. Look low down.",
  },
  {
    code: "z2fwg",
    slug: "galaxy-of-stars",
    name: "Galaxy of Stars",
    tagline: "Star-shaped speckled colourful gourds",
    description:
      "These unusual, star-shaped gourds have distinct ridges and a playful mix of green, white and yellow stripes and speckles. They look like colourful celestial bodies dropped straight into the patch.",
    bestFor: "Eye-catching centrepieces",
    bestForKey: "show",
    size: "Small — a handful each",
    scale: 0.35,
    fact: "They are grown as a mixture on purpose, so nobody knows quite what shapes and colours a plant will give until they appear.",
    hint: "Look for the basket, not a single pumpkin.",
  },
  {
    code: "r9cvs",
    slug: "jill-be-little",
    name: "Jill Be Little",
    tagline: "Tiny ribbed deep orange classic",
    description:
      "A charming, miniature heirloom pumpkin with deep ribbing and a classic bright orange colour. These pocket-sized fruits grow on productive vines and sit perfectly in the palm of your hand.",
    bestFor: "Crafts & tablescapes",
    bestForKey: "show",
    size: "Fits in one hand — 100 to 200g",
    scale: 0.3,
    fact: "Hollow one out, crack an egg into it and bake it — they are properly edible, not just ornaments.",
    hint: "Tiny, orange, and easy to walk straight past.",
  },
  {
    code: "y6dpl",
    slug: "tiny-turk",
    name: "Tiny Turk",
    tagline: "Miniature turban-shaped colourful accent",
    description:
      "A smaller, scaled-down version of the classic Turk’s Turban squash. It has a distinct cap-like top and a vibrant mix of orange, cream and green patches that make it look like a painted sculpture.",
    bestFor: "Whimsical tabletop decor",
    bestForKey: "show",
    size: "Small — about half a kilo",
    scale: 0.5,
    fact: "The knot is the blossom end. It grows pointing upwards instead of tucking itself in like every other squash.",
    hint: "The one that looks like it is wearing something.",
  },
  {
    code: "h4gzn",
    slug: "porcelain-doll",
    name: "Porcelain Doll",
    tagline: "Elegant pink, deeply ribbed beauty",
    description:
      "This exceptionally beautiful pumpkin shows a unique, muted pink colour on a deeply ribbed, blocky frame. It has sweet, deep orange flesh, and sales of its seed often support breast cancer research.",
    bestFor: "Chic modern decorating",
    bestForKey: "eat",
    size: "A proper lump — 7 to 11kg",
    scale: 1.15,
    fact: "Pink pumpkins are grown all over the world to raise money for breast cancer charities.",
    hint: "You cannot miss this one.",
  },
  {
    code: "v7nbx",
    slug: "magic-lantern",
    name: "Magic Lantern",
    tagline: "Classic dark orange carving standard",
    description:
      "The quintessential jack-o’-lantern pumpkin: a classic round-to-oblong shape, a rich dark orange skin and a sturdy, dark green handle. It grows on space-saving semi-bush vines while still producing large fruit.",
    bestFor: "Carving jack-o’-lanterns",
    bestForKey: "carve",
    size: "A proper carver — 7 to 11kg",
    scale: 1.1,
    fact: "Keep the lid’s cut slanted inwards — straight down and it drops through into the pumpkin.",
    hint: "The most ordinary-looking one here.",
  },
];

window.BEST_FOR_LABELS = {
  eat: { label: "For eating", cls: "tag-eat" },
  carve: { label: "For carving", cls: "tag-carve" },
  show: { label: "For showing off", cls: "tag-show" },
};
