"""A few made-up landscape pictures for the demo wall's photo turns (drawn here: no real photos, no people).
Run from the install's folder; writes <install>/wall_photos/<16 hex>.jpg."""
import random
import secrets
from pathlib import Path

from PIL import Image, ImageDraw

out = Path.cwd() / "wall_photos"
out.mkdir(exist_ok=True)
random.seed(3)
SCENES = [((255, 179, 102), (255, 230, 170), (60, 110, 80)), ((120, 180, 230), (210, 235, 250), (70, 130, 70)),
          ((250, 140, 120), (255, 205, 160), (90, 80, 120)), ((90, 140, 200), (180, 215, 240), (200, 200, 190))]
for top, bottom, land in SCENES:
    w, h = 1600, 1000
    im = Image.new("RGB", (w, h))
    dr = ImageDraw.Draw(im)
    for y in range(h):
        f = y / h
        dr.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * f) for i in range(3)))
    dr.ellipse([w * 0.68, h * 0.18, w * 0.68 + 140, h * 0.18 + 140], fill=(255, 245, 210))
    for k, shade in enumerate((0.75, 0.9, 1.0)):
        base = h * (0.55 + 0.12 * k)
        pts = [(0, h)] + [(x, base - random.randint(0, 120) * (1.2 - k * 0.3)) for x in range(0, w + 200, 200)] + [(w, h)]
        dr.polygon(pts, fill=tuple(int(c * shade) for c in land))
    im.save(out / f"{secrets.token_hex(8)}.jpg", quality=85)
print(f"{len(SCENES)} wall photos")
