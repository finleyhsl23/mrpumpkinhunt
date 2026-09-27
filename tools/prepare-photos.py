#!/usr/bin/env python3
"""Turn a folder of pumpkin photographs into the hunt's artwork.

    python3 tools/prepare-photos.py incoming/ assets/pumpkins/

Every photo comes in differently - one on straw, one in somebody's hands, one
on a pallet in flat light. Ten of those side by side look like a jumble sale.
This cuts each one out, trims it to the fruit, drops it on transparency and
squeezes it to WebP, so the grid reads as one set.

Size is the point as much as the looks. Ten photos straight off a phone is
30-50MB, which would destroy the offline cache and with it the whole reason
the hunt works in a field with no signal. Target here is under 100KB each.

Name the input files after the slugs in assets/pumpkins.js:

    crown-prince.jpg  casperita.jpg  warty-goblin.jpg  ...

A photo already cut out on a phone (transparent PNG) is passed straight
through - iOS lifts a subject better than anything here, so if the alpha is
already good this leaves it alone.
"""
import os
import sys

import cv2
import numpy as np

TARGET_PX = 800          # longest edge; the grid never shows more than ~260
MAX_BYTES = 100 * 1024
PAD = 0.04               # breathing room round the fruit, as a fraction


def has_usable_alpha(img):
    """A phone cut-out already has a real alpha channel; do not touch it."""
    if img is None or img.shape[2] != 4:
        return False
    a = img[:, :, 3]
    transparent = float((a < 16).mean())
    # Some transparency, but not a mostly-empty frame.
    return 0.05 < transparent < 0.95


def flat_background(bgr):
    """Is this a studio shot on a plain backdrop?

    Judged from the border: if the outer frame is all one colour, it is a
    backdrop, and keying on that colour beats GrabCut by a mile. A photo taken
    out in the field has a busy border and falls through to GrabCut instead.
    """
    h, w = bgr.shape[:2]
    band = max(4, int(min(h, w) * 0.03))
    border = np.concatenate([
        bgr[:band].reshape(-1, 3), bgr[-band:].reshape(-1, 3),
        bgr[:, :band].reshape(-1, 3), bgr[:, -band:].reshape(-1, 3),
    ])
    return float(border.std(axis=0).mean()) < 18.0, np.median(border, axis=0)


def key_out(bgr, _bg_bgr):
    """Cut out against a plain backdrop by flooding inwards from the edges.

    The obvious approach - threshold every pixel on its distance from the
    backdrop colour - fails badly here, because two of these pumpkins are
    orange on an orange backdrop. Anything close to the backdrop colour gets
    classified as backdrop no matter where it sits, so Magic Lantern lost all
    but a sliver and Warty Goblin was hollowed out, leaving only its warts.

    Flooding is about connection rather than colour: start at the corners and
    spread through pixels similar to their neighbours. Backdrop is whatever
    the flood can reach. A pumpkin the same colour as the backdrop still stops
    it, because its edge is darker than the paper around it - and a hole in the
    middle of the fruit is unreachable by definition.
    """
    h, w = bgr.shape[:2]
    blurred = cv2.GaussianBlur(bgr, (5, 5), 0)

    mask = np.zeros((h + 2, w + 2), np.uint8)
    # Neighbour-relative, not fixed-range: a paper backdrop is lit unevenly,
    # and a flood that insists every pixel match the corner leaves islands of
    # slightly-shaded paper behind. Following the gradient sweeps the lot.
    # 18, not 10: the cast shadow under each pumpkin is the backdrop in
    # shade, and a tighter flood stops dead at it, leaving a hard orange blob
    # beneath the fruit that reads as a mistake. Following the gradient down
    # into the shadow sweeps it. Higher than this starts walking into the
    # fruit itself on the softer-edged ones.
    tol = (18, 18, 18)
    flags = 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8)

    # Seed all round the frame, not just the corners: one corner may not
    # reach the far side past the subject.
    seeds = []
    for x in range(2, w - 2, max(8, w // 60)):
        seeds += [(x, 1), (x, h - 2)]
    for y in range(2, h - 2, max(8, h // 60)):
        seeds += [(1, y), (w - 2, y)]

    for sx, sy in seeds:
        if mask[sy + 1, sx + 1] == 0:
            cv2.floodFill(blurred, mask, (sx, sy), 0, tol, tol, flags)

    background = mask[1:-1, 1:-1]
    subject = cv2.bitwise_not(background)

    subject = cv2.morphologyEx(subject, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    subject = cv2.morphologyEx(subject, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    return subject


def strip_fringe(bgr, mask, bg_bgr):
    """Remove leftover backdrop clinging to the edge of the cut-out.

    Shading and soft shadow stop the flood a little short, leaving an orange
    halo and the odd island. Colour alone cannot be trusted to clear it - two
    of these pumpkins ARE orange - so it is only applied within a band around
    the mask's own boundary. The middle of the fruit is never touched.
    """
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    bg = cv2.cvtColor(np.uint8([[bg_bgr]]), cv2.COLOR_BGR2LAB).astype(np.float32)[0][0]

    # Tight, and on all three channels. An earlier, looser version removed
    # anything merely orange-ish near the edge, which ate the orange stripes
    # off Tiny Turk and took half the fruit with them. This only clears paper
    # that is near-identical to the backdrop; the flood handles the rest.
    # 10, not 16. Magic Lantern's skin measures 16.4 LAB units from the
    # backdrop - the same hue and saturation, a shade darker - so a threshold
    # of 16 classified the fruit itself as leftover paper and reduced its mask
    # to six rows. True backdrop sits within 5 of itself, so 10 clears the
    # halo and leaves the closest-matching fruit alone.
    close_to_backdrop = np.linalg.norm(lab - bg, axis=2) < 10

    inner = cv2.erode(mask, np.ones((13, 13), np.uint8))
    edge_band = (mask > 0) & (inner == 0)

    cleaned = mask.copy()
    cleaned[edge_band & close_to_backdrop] = 0
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    return cv2.erode(cleaned, np.ones((3, 3), np.uint8))


def largest_blob(mask):
    """Keep only the biggest shape. A stray speck of backdrop read as fruit is
    worse than a slightly soft edge."""
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    if n <= 1:
        return mask
    biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    return np.where(labels == biggest, 255, 0).astype(np.uint8)


def fill_holes(mask):
    """A pumpkin is solid. Anything enclosed by it belongs to it - a dark
    hollow under a stem would otherwise be punched straight through."""
    flood = mask.copy()
    h, w = mask.shape
    cv2.floodFill(flood, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 255)
    return mask | cv2.bitwise_not(flood)


def cut_out(bgr, report=None):
    """Separate fruit from background.

    Keying is tried first because these are studio shots on a plain backdrop
    and it is far more accurate there. GrabCut is the fallback for a photo
    taken in the field, where it handles a busy background better.
    """
    flat, bg = flat_background(bgr)
    mask = None

    if flat:
        mask = largest_blob(key_out(bgr, bg))
        mask = fill_holes(largest_blob(strip_fringe(bgr, mask, bg)))

    # Sanity check. A mask covering almost nothing means the subject was eaten;
    # almost everything means the backdrop leaked in. Either way GrabCut is a
    # better bet than shipping a shredded pumpkin.
    def plausible(m):
        if m is None:
            return False
        share = float((m > 0).mean())
        return 0.03 < share < 0.95

    used_keying = plausible(mask)
    if report is not None:
        report["how"] = "keyed off the backdrop" if used_keying else "cut out with GrabCut"

    if not used_keying:
        h, w = bgr.shape[:2]
        rect = (int(w * 0.06), int(h * 0.06), int(w * 0.88), int(h * 0.88))
        gc = np.zeros((h, w), np.uint8)
        cv2.grabCut(bgr, gc, rect, np.zeros((1, 65), np.float64),
                    np.zeros((1, 65), np.float64), 5, cv2.GC_INIT_WITH_RECT)
        mask = fill_holes(largest_blob(
            np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)))

    mask = soften_base(mask)
    # Feather by a pixel or two so the edge does not look cut with scissors.
    return cv2.GaussianBlur(mask, (5, 5), 0)


def soften_base(mask):
    """Fade the very bottom of the cut-out out to nothing.

    Each of these sits on a lit backdrop and casts a shadow directly beneath
    it. That shadow is the same orange as the paper, only darker, so no colour
    test separates it from an orange pumpkin - and it tapers rather than
    flaring, so there is no waist in the silhouette to cut at either. Both
    were tried.

    Fading the base sidesteps the problem: whatever remains down there stops
    being a hard-edged orange crescent and becomes a soft shadow, which is
    what the eye expects under a pumpkin anyway. It costs a few pixels on the
    ones that were already clean, and they look grounded rather than cut out.
    """
    rows = np.flatnonzero((mask > 0).sum(axis=1))
    if len(rows) < 40:
        return mask

    top, bottom = rows[0], rows[-1]
    fade = max(10, int((bottom - top) * 0.13))
    start = max(top, bottom - fade)

    ramp = mask.astype(np.float32)
    for i, y in enumerate(range(bottom, start - 1, -1)):
        # Eased rather than linear: a straight ramp still left the bottom
        # half-opaque, which is where the shadow actually is. This clears the
        # last few per cent properly and recovers within a dozen pixels.
        ramp[y] *= min(1.0, (i / float(fade)) ** 1.6)
    return np.clip(ramp, 0, 255).astype(np.uint8)


def trim(bgra):
    """Crop to the visible fruit, then pad evenly."""
    a = bgra[:, :, 3]
    ys, xs = np.where(a > 12)
    if len(xs) == 0:
        return bgra
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    pad = int(max(x1 - x0, y1 - y0) * PAD)
    h, w = bgra.shape[:2]
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(w - 1, x1 + pad), min(h - 1, y1 + pad)
    return bgra[y0:y1 + 1, x0:x1 + 1]


def fit(bgra):
    h, w = bgra.shape[:2]
    scale = TARGET_PX / float(max(h, w))
    if scale >= 1:
        return bgra
    return cv2.resize(bgra, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)


def save_under_budget(bgra, path):
    """Step the quality down until it fits, rather than guessing once."""
    for q in (88, 82, 76, 70, 64, 58, 50):
        cv2.imwrite(path, bgra, [cv2.IMWRITE_WEBP_QUALITY, q])
        size = os.path.getsize(path)
        if size <= MAX_BYTES:
            return q, size
    return q, size


def main(src_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    names = sorted(
        f for f in os.listdir(src_dir)
        if f.lower().endswith((".jpg", ".jpeg", ".png", ".heic", ".webp"))
    )
    if not names:
        print(f"no photographs found in {src_dir}")
        return 1

    total = 0
    for name in names:
        slug = os.path.splitext(name)[0]
        raw = cv2.imread(os.path.join(src_dir, name), cv2.IMREAD_UNCHANGED)
        if raw is None:
            print(f"  {slug:<18} SKIPPED - could not read")
            continue

        if has_usable_alpha(raw):
            bgra, how = raw, "kept the phone's cut-out"
        else:
            bgr = raw[:, :, :3] if raw.ndim == 3 else cv2.cvtColor(raw, cv2.COLOR_GRAY2BGR)
            report = {}
            alpha = cut_out(bgr, report)
            bgra = np.dstack([bgr, alpha])
            how = report.get("how", "cut out")

        bgra = fit(trim(bgra))
        out = os.path.join(out_dir, slug + ".webp")
        q, size = save_under_budget(bgra, out)
        total += size
        flag = "" if size <= MAX_BYTES else "   <-- OVER BUDGET"
        print(f"  {slug:<18} {bgra.shape[1]}x{bgra.shape[0]}  {size/1024:5.1f}KB  q{q}  {how}{flag}")

    print(f"\n  {len(names)} photographs, {total/1024:.0f}KB total")
    if total > 1_500_000:
        print("  WARNING: over 1.5MB. That will slow the precache at the gate.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2]))
