#!/usr/bin/env python3
"""Prepare the pumpkin photographs for the hunt.

    python3 tools/prepare-photos.py images/ assets/pumpkins/

The photographs are studio shots on Mr Pumpkin's orange backdrop, and the
backdrop is kept on purpose: it is what makes ten photographs taken separately
read as one set. Nothing is cut out.

What this does do is square them up and squeeze them, because size is the
whole game. Ten photographs straight off a camera is 30-50MB, which would
destroy the offline precache and with it the reason the hunt works in a field
with no signal. Target is under 100KB each.

Name each input file after its slug in assets/pumpkins.js:

    crown-prince.jpg  casperita.jpg  warty-goblin.jpg  ...

Pass --cutout to remove the backdrop instead, for photographs taken somewhere
that is not the studio.
"""
import os
import sys

import cv2
import numpy as np

TARGET_PX = 800          # the grid never shows more than ~300
MAX_BYTES = 100 * 1024


def square(img):
    """Centre-crop to a square so the grid is uniform.

    Most of these are already square; Galaxy of Stars is 3:2 and would
    otherwise be the one tile that is a different shape.
    """
    h, w = img.shape[:2]
    if h == w:
        return img
    side = min(h, w)
    y = (h - side) // 2
    x = (w - side) // 2
    return img[y:y + side, x:x + side]


def fit(img):
    h, w = img.shape[:2]
    scale = TARGET_PX / float(max(h, w))
    if scale >= 1:
        return img
    return cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)


def cut_out_backdrop(bgr):
    """Optional: drop the backdrop by flooding inwards from the frame.

    Not used for the studio shots. Kept because a photograph taken out in the
    field may need it, and because thresholding on colour cannot do this job -
    Magic Lantern's skin sits 16 LAB units from the orange paper, the same hue
    and saturation a shade darker, so any colour threshold that clears the
    paper clears the pumpkin too. Flooding is about connection, not colour.
    """
    h, w = bgr.shape[:2]
    blurred = cv2.GaussianBlur(bgr, (5, 5), 0)
    mask = np.zeros((h + 2, w + 2), np.uint8)
    flags = 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8)

    seeds = []
    for x in range(2, w - 2, max(8, w // 60)):
        seeds += [(x, 1), (x, h - 2)]
    for y in range(2, h - 2, max(8, h // 60)):
        seeds += [(1, y), (w - 2, y)]
    for sx, sy in seeds:
        if mask[sy + 1, sx + 1] == 0:
            cv2.floodFill(blurred, mask, (sx, sy), 0, (18,) * 3, (18,) * 3, flags)

    subject = cv2.bitwise_not(mask[1:-1, 1:-1])
    subject = cv2.morphologyEx(subject, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))

    n, labels, stats, _ = cv2.connectedComponentsWithStats(subject, 8)
    if n > 1:
        biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        subject = np.where(labels == biggest, 255, 0).astype(np.uint8)
    return cv2.GaussianBlur(subject, (5, 5), 0)


def save_under_budget(img, path):
    """Step the quality down until it fits, rather than guessing once."""
    for q in (90, 84, 78, 72, 66, 60, 52):
        cv2.imwrite(path, img, [cv2.IMWRITE_WEBP_QUALITY, q])
        size = os.path.getsize(path)
        if size <= MAX_BYTES:
            return q, size
    return q, size


# Twice the 128px the email renders them at, so they stay sharp on a phone.
MAIL_PX = 256


def main(src_dir, out_dir, cutout=False):
    os.makedirs(out_dir, exist_ok=True)
    names = sorted(
        f for f in os.listdir(src_dir)
        if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
    )
    if not names:
        print(f"no photographs found in {src_dir}")
        return 1

    total = 0
    mail_total = 0
    for name in names:
        slug = os.path.splitext(name)[0]
        raw = cv2.imread(os.path.join(src_dir, name), cv2.IMREAD_UNCHANGED)
        if raw is None:
            print(f"  {slug:<18} SKIPPED - could not read")
            continue

        bgr = raw[:, :, :3] if raw.ndim == 3 else cv2.cvtColor(raw, cv2.COLOR_GRAY2BGR)
        img = fit(square(bgr))

        if cutout:
            img = np.dstack([img, cut_out_backdrop(img)])

        out = os.path.join(out_dir, slug + ".webp")
        q, size = save_under_budget(img, out)
        total += size
        flag = "" if size <= MAX_BYTES else "   <-- OVER BUDGET"

        # The guide email cannot use the WebP above: Outlook on Windows and
        # older Apple Mail will not render it, and an email that shows broken
        # images is worse than one showing none. JPEG is the one photographic
        # format every mail client has always understood. Written at twice its
        # display size so it stays sharp on a phone screen.
        mail_dir = os.path.join(out_dir, "email")
        os.makedirs(mail_dir, exist_ok=True)
        thumb = cv2.resize(img[:, :, :3], (MAIL_PX, MAIL_PX), interpolation=cv2.INTER_AREA)
        mail_out = os.path.join(mail_dir, slug + ".jpg")
        cv2.imwrite(mail_out, thumb, [cv2.IMWRITE_JPEG_QUALITY, 82, cv2.IMWRITE_JPEG_OPTIMIZE, 1])
        mail_size = os.path.getsize(mail_out)
        mail_total += mail_size

        print(f"  {slug:<18} {img.shape[1]}x{img.shape[0]}  {size/1024:5.1f}KB  q{q}"
              f"   email {mail_size/1024:4.1f}KB{flag}")

    print(f"\n  {len(names)} photographs, {total/1024:.0f}KB for the site"
          f" and {mail_total/1024:.0f}KB of email thumbnails")
    if total > 1_500_000:
        print("  WARNING: over 1.5MB. That will slow the precache at the gate.")
    return 0


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(args[0], args[1], cutout="--cutout" in sys.argv))
