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


def cut_out(bgr):
    """Separate fruit from background with GrabCut.

    Seeded from a generous centre rectangle rather than anything clever: a
    pumpkin photographed on purpose is centred and fills the frame, which is
    exactly the case GrabCut handles well.
    """
    h, w = bgr.shape[:2]
    rect = (int(w * 0.06), int(h * 0.06), int(w * 0.88), int(h * 0.88))

    mask = np.zeros((h, w), np.uint8)
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(bgr, mask, rect, bgd, fgd, 5, cv2.GC_INIT_WITH_RECT)
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

    # Keep only the biggest blob: stray corners of background get picked up
    # otherwise, and a floating scrap of straw is worse than a soft edge.
    n, labels, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
    if n > 1:
        biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        fg = np.where(labels == biggest, 255, 0).astype(np.uint8)

    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    # Feather by a pixel or two so the edge does not look cut with scissors.
    fg = cv2.GaussianBlur(fg, (5, 5), 0)
    return fg


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
            alpha = cut_out(bgr)
            bgra = np.dstack([bgr, alpha])
            how = "cut out here"

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
