"""Draws the flat fabric tiles the style sketches are filled with (public/fabrics/flat/*.jpg).

Each tile is seamless and lies on the grain: the warp runs top to bottom, so corduroy ribs, velvet
pile and satin sheen run down the garment, and denim twill runs on the diagonal. Run it again only
to change a fabric's look:  python3 scripts/fabric-textures.py  (needs numpy and Pillow).
"""
from pathlib import Path

import numpy as np
from PIL import Image

N = 256
OUT = Path(__file__).resolve().parent.parent / 'public' / 'fabrics' / 'flat'
rng = np.random.default_rng(7)
y, x = np.mgrid[0:N, 0:N].astype(float)


def noise(cells: int, amp: float) -> np.ndarray:
    """Smooth noise that wraps at the tile edges, so the tiles join without a seam."""
    g = rng.random((cells, cells))
    big = np.tile(g, (3, 3))
    im = Image.fromarray((big * 255).astype('uint8')).resize((3 * N, 3 * N), Image.BICUBIC)
    return (np.asarray(im)[N:2 * N, N:2 * N] / 255 - 0.5) * amp


def streak(cells: int, amp: float) -> np.ndarray:
    """Noise drawn out down the grain: soft streaks of sheen that run the length of the cloth."""
    g = rng.random((2, cells))
    big = np.tile(g, (3, 3))
    im = Image.fromarray((big * 255).astype('uint8')).resize((3 * N, 3 * N), Image.BICUBIC)
    return (np.asarray(im)[N:2 * N, N:2 * N] / 255 - 0.5) * amp


def grain(amp: float) -> np.ndarray:
    return (rng.random((N, N)) - 0.5) * amp


def wave(t: np.ndarray, period: float) -> np.ndarray:
    return np.sin(2 * np.pi * t / period) * 0.5 + 0.5


def save(name: str, lum: np.ndarray, colour: str) -> None:
    c = np.array([int(colour[i:i + 2], 16) for i in (1, 3, 5)], float)
    rgb = np.clip(c * (0.45 + 1.1 * np.clip(lum, 0, 1))[..., None], 0, 255)
    Image.fromarray(rgb.astype('uint8')).save(OUT / f'{name}.jpg', quality=86)


OUT.mkdir(parents=True, exist_ok=True)
plain = 0.5 * wave(x, 4) + 0.5 * wave(y, 4)  # a plain weave, one thread over, one under

save('cotton', 0.45 + 0.15 * plain + noise(8, 0.08) + grain(0.12), '#9fb0cc')
slubs = (np.tile(rng.random((1, N)) > 0.9, (N, 1)) * 0.12) + (np.tile(rng.random((N, 1)) > 0.92, (1, N)) * 0.1)
save('linen', 0.42 + 0.18 * plain + slubs + noise(6, 0.1) + grain(0.12), '#b5aa96')
rows = (y // 16) % 2
herring = np.where(rows == 0, (x + y) % 8, (x - y) % 8) / 8
save('wool', 0.35 + 0.3 * wave(herring, 1) + noise(16, 0.12) + grain(0.16), '#6e6c69')
save('silk', 0.4 + 0.18 * wave(x, N / 2) + streak(6, 0.14) + grain(0.04), '#c9b9a5')
save('viscose', 0.42 + 0.14 * wave(x, N / 4) + streak(8, 0.14) + grain(0.06), '#7a7848')
save('polyester', 0.45 + 0.12 * plain + noise(8, 0.08) + grain(0.06), '#4a5680')
save('blend', 0.42 + 0.16 * plain + noise(16, 0.12) + grain(0.18), '#8e8b88')
save('default', 0.42 + 0.14 * plain + noise(8, 0.08) + grain(0.1), '#8e857c')

save('denim', 0.25 + 0.5 * wave(x + y, 16) ** 1.5 + noise(32, 0.06) + noise(4, 0.08) + grain(0.12), '#3e5478')
save('corduroy', 0.2 + 0.6 * wave(x, 16) ** 0.6 + noise(32, 0.1) + noise(4, 0.08) + grain(0.08), '#96623a')
save('velvet', 0.34 + 0.2 * wave(x, N / 2) + streak(6, 0.18) + grain(0.04), '#1f6a45')
save('satin', 0.3 + 0.4 * wave(x, N / 3) ** 2 + streak(6, 0.1) + grain(0.03), '#a78b74')
save('leather', 0.42 + noise(64, 0.18) + noise(8, 0.12) + grain(0.05), '#8a4e33')
save('sheer', 0.6 + 0.1 * plain + noise(4, 0.08) + grain(0.05), '#d9aaa3')

# Lace: an ivory net with flowers, on the dark of whatever is under it.
net = np.maximum(wave(x + y, 8) ** 10, wave(x - y, 8) ** 10)
cx, cy = (x % 64) - 32, (y % 64) - 32
r = np.hypot(cx, cy)
petals = ((np.abs(np.sin(4 * np.arctan2(cy, cx))) * 7 + 9 > r) & (r > 3)) | ((r > 21) & (r < 23))
save('lace', 0.02 + 0.3 * net + 0.5 * petals + noise(16, 0.06) + grain(0.05), '#e6dccb')

# Sequins: rows of discs, each catching the light a little differently.
sx, sy = (x % 16) - 8, (y % 16) - 8
disc = np.hypot(sx, sy) < 7
shine = rng.random((N // 16, N // 16))[(y // 16).astype(int), (x // 16).astype(int)]
save('sequins', 0.1 + disc * (0.35 + 0.6 * shine) + grain(0.04), '#bdb9b2')
