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
    tagline: "The one the chefs want",
    description:
      "Steel-blue on the outside, deep orange within. Squat and drum-shaped, with a skin that looks dusty until you rub it. Most people walk straight past it — which is a shame, because it is the best eating pumpkin in the field.",
    bestFor: "Roasting & soup",
    bestForKey: "eat",
    size: "About the size of a football, 3–4kg",
    scale: 0.85,
    fact: "It keeps for months in a cool shed, so one bought in October will still be good at Christmas.",
    hint: "Look for the odd blue one out.",
  },
  {
    code: "w4xp9",
    slug: "casperita",
    name: "Casperita",
    tagline: "Small, white and neat",
    description:
      "A properly white mini pumpkin, deeply ribbed and about the size of a grapefruit. Bright orange inside despite the ghostly skin.",
    bestFor: "Decorating",
    bestForKey: "show",
    size: "Grapefruit-sized, around half a kilo",
    scale: 0.42,
    fact: "White pumpkins are not painted or bleached — the skin simply never makes the orange pigment.",
    hint: "One of the pale ones, but not the smallest.",
  },
  {
    code: "t3ndr",
    slug: "warty-goblin",
    name: "Warty Goblin",
    tagline: "Bred to be ugly on purpose",
    description:
      "Orange, and absolutely covered in hard dark-green warts. Growers spent years breeding these lumps in deliberately, because children choose the ugliest pumpkin on the stall every single time.",
    bestFor: "Carving & display",
    bestForKey: "carve",
    size: "Two hands wide, about 4kg",
    scale: 0.88,
    fact: "The warts are hard as bark and grow as the skin stretches — no two are ever the same.",
    hint: "You will know it when you see it.",
  },
  {
    code: "b8jhz",
    slug: "grizzly-bear",
    name: "Grizzly Bear",
    tagline: "The big rugged one",
    description:
      "A large orange pumpkin with rough, rugged skin and a thick sturdy handle. Heavy enough that a child will need both arms and probably a grown-up.",
    bestFor: "Carving",
    bestForKey: "carve",
    size: "Big — around 6kg",
    scale: 1.1,
    fact: "That thick stalk is called the handle, and a good one is what tells you a pumpkin was picked ripe.",
    hint: "One of the heavyweights.",
  },
  {
    code: "s5qvk",
    slug: "blue-banana",
    name: "Blue Banana",
    tagline: "Long, blue, and not a pumpkin shape at all",
    description:
      "A banana squash: long, thick and blue-grey, lying on its side like a rolled-up rug. The flesh inside is dense, sweet and a startling orange.",
    bestFor: "Roasting & soup",
    bestForKey: "eat",
    size: "As long as your forearm, sometimes longer",
    scale: 1.05,
    fact: "Cut it into rings rather than wedges — it roasts far more evenly that way.",
    hint: "Not round. Look low down.",
  },
  {
    code: "m9r4t",
    slug: "galaxy-of-stars",
    name: "Galaxy of Stars",
    tagline: "Freckled all over",
    description:
      "Orange skin flecked and speckled with pale cream spots, as though someone had flicked a paintbrush at it. No two are freckled the same way.",
    bestFor: "Display",
    bestForKey: "show",
    size: "Football-sized, about 3kg",
    scale: 0.8,
    fact: "The speckles spread as the pumpkin grows, so the biggest ones are the most freckled.",
    hint: "Get close — from a distance it just looks orange.",
  },
  {
    code: "p2wgy",
    slug: "jill-be-little",
    name: "Jill Be Little",
    tagline: "The smallest in the field",
    description:
      "Creamy white, flat as a scone and small enough to sit in a child's palm. The pale sister of Jack Be Little, which is the orange one.",
    bestFor: "Decorating",
    bestForKey: "show",
    size: "Fits in one hand, about 200g",
    scale: 0.28,
    fact: "Hollow one out, crack an egg into it and bake it — they are properly edible, not just ornaments.",
    hint: "Tiny. Easy to walk straight past.",
  },
  {
    code: "h6zkn",
    slug: "tiny-turk",
    name: "Tiny Turk",
    tagline: "Wearing a hat",
    description:
      "A miniature Turk's Turban. A striped orange base with a pale knot sitting on top, exactly like a little turban — which is precisely how it got the name.",
    bestFor: "Display",
    bestForKey: "show",
    size: "Small, about half a kilo",
    scale: 0.5,
    fact: "The knot is the blossom end. It grows pointing upwards instead of tucking itself in like every other squash.",
    hint: "The one that looks like it is wearing something.",
  },
  {
    code: "d4tqm",
    slug: "porcelain-doll",
    name: "Porcelain Doll",
    tagline: "The pink one",
    description:
      "Genuinely pink — a soft dusty rose, flattened and deeply ribbed. It stops people in their tracks, and it is a proper cooking pumpkin underneath the colour.",
    bestFor: "Roasting, soup & pies",
    bestForKey: "eat",
    size: "Large and flat, around 5kg",
    scale: 0.95,
    fact: "Pink pumpkins are grown all over the world to raise money for breast cancer charities.",
    hint: "You cannot miss this one.",
  },
  {
    code: "v7nbx",
    slug: "magic-lantern",
    name: "Magic Lantern",
    tagline: "The proper Halloween pumpkin",
    description:
      "The one every child pictures: deep even orange, round, with a strong handle and walls thick enough to hold a face without collapsing by Tuesday.",
    bestFor: "Carving",
    bestForKey: "carve",
    size: "Classic carving size, about 5kg",
    scale: 1.0,
    fact: "Keep the lid's cut slanted inwards — straight down and it drops through into the pumpkin.",
    hint: "The most ordinary-looking one here.",
  },
];

window.BEST_FOR_LABELS = {
  eat: { label: "For eating", cls: "tag-eat" },
  carve: { label: "For carving", cls: "tag-carve" },
  show: { label: "For showing off", cls: "tag-show" },
};
