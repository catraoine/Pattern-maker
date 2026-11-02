"""Draws the knit tiles the T-shirt's sketches are filled with (public/fabrics/flat/<knit>.jpg).

Kept apart from fabric-textures.py so the woven tiles stay exactly as they are. Each tile is seamless and lies
on the grain: the wales (the columns of V-shaped stitches) run top to bottom, so jersey reads as fine lengthwise
lines, rib as raised ridges, and the yarn's slubs and heather run across, along the courses.
Run it again only to change a knit's look:  python3 scripts/knit-textures.py  (needs numpy and Pillow).
"""
from pathlib import Path

import numpy as np
from PIL import Image

N = 256
OUT = Path(__file__).resolve().parent.parent / 'public' / 'fabrics' / 'flat'
rng = np.random.default_rng(11)
y, x = np.mgrid[0:N, 0:N].astype(float)


def smooth(gx: int, gy: int, amp: float) -> np.ndarray:
    """Noise on a gx by gy grid, smoothed and wrapping at the tile edges."""
    g = rng.random((gy, gx))
    big = np.tile(g, (3, 3))
    im = Image.fromarray((big * 255).astype('uint8')).resize((3 * N, 3 * N), Image.BICUBIC)
    return (np.asarray(im)[N:2 * N, N:2 * N] / 255 - 0.5) * amp


def grain(amp: float) -> np.ndarray:
    return (rng.random((N, N)) - 0.5) * amp


def stitches(w: int, h: int, fat: float = 0.24) -> np.ndarray:
    """Knit stitches: in each w by h cell two slanted legs meet at the foot in a V, and each course's V sits into
    the one below it. 1 on the yarn, 0 in the gaps between wales."""
    out = np.zeros((N, N))
    lx = x % w
    for shift in (0, h):  # the legs run a little past their cell into the next course
        ly = (y % h) + shift
        for side in (-1, 1):
            cx, cy = w / 2 + side * w * 0.22, h * 0.5
            dx, dy = lx - cx, ly - cy
            # The leg leans in towards the foot of the V.
            d = np.array([-side * 0.42 * w, h])
            d = d / np.hypot(*d)
            along = dx * d[0] + dy * d[1]
            across = dx * d[1] - dy * d[0]
            leg = 1 - (along / (0.62 * h)) ** 2 - (across / (fat * w)) ** 2
            out = np.maximum(out, np.clip(leg, 0, 1) ** 0.6)
    return out


def save(name: str, lum: np.ndarray, colour: str) -> None:
    c = np.array([int(colour[i:i + 2], 16) for i in (1, 3, 5)], float)
    rgb = np.clip(c * (0.45 + 1.1 * np.clip(lum, 0, 1))[..., None], 0, 255)
    Image.fromarray(rgb.astype('uint8')).save(OUT / f'{name}.jpg', quality=88)


OUT.mkdir(parents=True, exist_ok=True)

# Jersey: plain V stitches in fine lengthwise wales.
save('jersey', 0.3 + 0.32 * stitches(16, 16) + smooth(8, 8, 0.06) + grain(0.06), '#a7adb4')

# Slub: jersey in an uneven yarn, its thick bits showing as short bright dashes along the courses.
slub = np.clip(smooth(6, 64, 3.0), 0, None) * (smooth(64, 3, 1.0) + 0.5)
save('slub', 0.3 + 0.28 * stitches(16, 16) + 0.18 * np.clip(slub, 0, 0.5) + grain(0.06), '#c8bba2')

# Modal: a fine, fluid jersey with a soft sheen running down it.
save('modal', 0.36 + 0.18 * stitches(8, 8) + 0.07 * np.sin(2 * np.pi * x / (N / 2)) ** 2 + smooth(3, 1, 0.12) + grain(0.03), '#6a5468')

# Rib: 1x1 rib, a raised knit wale then a sunk one, so it reads as ridges.
ridge = (np.cos(2 * np.pi * x / 32) * 0.5 + 0.5) ** 1.4
save('rib', 0.1 + 0.55 * ridge * (0.55 + 0.45 * stitches(16, 12, 0.2)) + smooth(8, 8, 0.05) + grain(0.05), '#7f8c7b')

# Interlock: a tight double knit, smooth both sides, with only a whisper of stitch.
save('interlock', 0.42 + 0.14 * stitches(8, 8) + smooth(8, 8, 0.05) + grain(0.04), '#d6cfc1')

# Waffle: raised ridges round sunk squares, over a fine knit.
cell = 32
wx, wy = np.abs((x % cell) - cell / 2) / (cell / 2), np.abs((y % cell) - cell / 2) / (cell / 2)
# The pockets are shaded on one side and lit on the other, as a raised grid looks under a lamp.
pocket = 1 - np.clip((np.maximum(wx, wy) - 0.5) / 0.5, 0, 1) ** 0.7
lit = np.sin(np.pi * (x % cell) / cell) * 0.5
waffle = 1 - pocket * (0.55 + lit * 0.5)
save('waffle', 0.3 + 0.28 * waffle + 0.14 * stitches(8, 8) + grain(0.05), '#c8bfae')

# French terry: the smooth jersey face in a heathered marl, light and dark fibres twisted along the yarn.
marl = smooth(64, 128, 0.0) + (rng.random((N, N // 4)).repeat(4, axis=1) - 0.5) * 0.3
save('terry', 0.32 + 0.26 * stitches(12, 12) + marl + smooth(8, 8, 0.06), '#8f8f8d')

# Ponte: a firm double knit, smooth with faint ribs running across.
across = (np.cos(2 * np.pi * y / 8) * 0.5 + 0.5) ** 2
save('ponte', 0.34 + 0.2 * across + 0.12 * stitches(8, 8) + smooth(8, 8, 0.06) + grain(0.04), '#3a3c44')
