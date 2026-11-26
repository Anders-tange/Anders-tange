# Draws the app icon: a red dex case with a green LCD and a paw. Run once; the PNGs are committed.
import sys
from PIL import Image, ImageDraw
out = sys.argv[1]
def icon(size, maskable=False):
    S = 1024
    im = Image.new("RGBA", (S, S), (25, 27, 32, 255))
    d = ImageDraw.Draw(im)
    pad = 150 if maskable else 70
    r = 170 if not maskable else 120
    d.rounded_rectangle([pad, pad, S - pad, S - pad], radius=r, fill=(207, 31, 46))
    d.rounded_rectangle([pad, pad + 40, S - pad, S - pad], radius=r, fill=(138, 14, 26))
    d.rounded_rectangle([pad, pad, S - pad, S - pad - 30], radius=r, fill=(207, 31, 46))
    # lens
    cx, cy, lr = pad + 120, pad + 120, 56 if not maskable else 44
    d.ellipse([cx - lr - 14, cy - lr - 14, cx + lr + 14, cy + lr + 14], fill=(244, 243, 237))
    d.ellipse([cx - lr, cy - lr, cx + lr, cy + lr], fill=(42, 108, 192))
    d.ellipse([cx - lr * .55, cy - lr * .6, cx - lr * .05, cy - lr * .1], fill=(160, 200, 245))
    # screen
    sx0, sy0, sx1, sy1 = pad + 90, pad + 250, S - pad - 90, S - pad - 110
    d.rounded_rectangle([sx0 - 24, sy0 - 24, sx1 + 24, sy1 + 24], radius=40, fill=(230, 229, 223))
    d.rounded_rectangle([sx0, sy0, sx1, sy1], radius=24, fill=(211, 224, 191))
    # paw
    ink = (27, 40, 21)
    mx, my = (sx0 + sx1) / 2, (sy0 + sy1) / 2 + 30
    k = (sx1 - sx0) / 520
    d.ellipse([mx - 105 * k, my - 40 * k, mx + 105 * k, my + 120 * k], fill=ink)
    for dx, dy, rr in [(-150, -95, 46), (-58, -170, 50), (58, -170, 50), (150, -95, 46)]:
        d.ellipse([mx + (dx - rr) * k, my + (dy - rr * 1.2) * k, mx + (dx + rr) * k, my + (dy + rr * 1.2) * k], fill=ink)
    return im.resize((size, size), Image.LANCZOS)
icon(192).save(f"{out}/icon-192.png")
icon(512).save(f"{out}/icon-512.png")
icon(512, True).save(f"{out}/maskable-512.png")
icon(180).convert("RGB").save(f"{out}/apple-touch-icon.png")
icon(64).save(f"{out}/favicon.png")
