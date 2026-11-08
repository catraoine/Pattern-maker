"""Crop the option pictures (Cat's A2, Nov 8): from the Front drawings that e2e/choice-pics.spec.ts photographs,
a tight crop of the detail each question is about, the same frame for every option of a question so they compare.

    CHOICE_PICS=/tmp/pics npx playwright test -c e2e e2e/choice-pics.spec.ts --project=desktop --trace off
    python3 scripts/choice-pics.py /tmp/pics public/pics
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

from PIL import Image

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
W, H = 324, 294  # the chip's picture, 1.5x its size on a phone
ASPECT = W / H
DPR = 3

# What each question's frame holds: round the neck and shoulders, the arms, the top of the trousers, or the whole piece.
NECK = {'bodice-neckline', 'tee-neckline', 'tee-shoulder'}
ARMS = {'bodice-sleeve', 'tee-sleeve'}
TOP = {'trousers-rise': 0.45, 'bodice-waistSeam': 0.6}
# A back slit can't be seen from the front, so the slit keeps its drawn icons (listed for Cat, Nov 8).
SKIP = {'skirt-slit'}

shots = json.loads((SRC / 'shots.json').read_text())
groups = defaultdict(list)
for key, s in shots.items():
    groups[key[4:].rsplit('-', 1)[0]].append((key, s))


def to_px(s, x, y):
    vx, vy, vw, vh, rw, rh = s['svg']
    k = min(rw / vw, rh / vh)
    ox, oy = (rw - vw * k) / 2, (rh - vh * k) / 2
    return ((ox + (x - vx) * k) * DPR, (oy + (y - vy) * k) * DPR)


for group, items in groups.items():
    if group in SKIP:
        continue
    xs0 = min(s['cloth'][0] for _, s in items)
    ys0 = min(s['cloth'][1] for _, s in items)
    xs1 = max(s['cloth'][0] + s['cloth'][2] for _, s in items)
    ys1 = max(s['cloth'][1] + s['cloth'][3] for _, s in items)
    head = items[0][1]['form']
    cx = head[0] + head[2] / 2 if head else (xs0 + xs1) / 2
    if group in NECK:
        # Shoulder to shoulder, from just above the shoulders down far enough for a V.
        w = (xs1 - xs0) * 1.04
        # From the base of the form's neck, so straps reaching up the neck don't pull the head in.
        top = head[1] + head[3] - 2.5 if head else ys0 - 1.5
        box = (cx - w / 2, top, cx + w / 2, top + w / ASPECT)
    else:
        y1 = ys0 + (ys1 - ys0) * TOP[group] if group in TOP else ys1
        pad = 0.05 * max(xs1 - xs0, y1 - ys0)
        x0, x1, y0, y1 = xs0 - pad, xs1 + pad, ys0 - pad, y1 + pad
        # Grow the short side to the picture's shape, about the middle.
        if (x1 - x0) / (y1 - y0) < ASPECT:
            w = (y1 - y0) * ASPECT
            x0, x1 = cx - w / 2, cx + w / 2
        else:
            h = (x1 - x0) / ASPECT
            m = (y0 + y1) / 2
            y0, y1 = m - h / 2, m + h / 2
        box = (x0, y0, x1, y1)
    for key, s in items:
        im = Image.open(SRC / f'{key}.png').convert('RGB')
        frame = box
        if group in NECK and s['form']:
            # The form's head sits where each drawing puts it: start every crop at its own neck.
            dy = s['form'][1] + s['form'][3] - 2.5 - box[1]
            frame = (box[0], box[1] + dy, box[2], box[3] + dy)
        (a, b), (c, d) = to_px(s, frame[0], frame[1]), to_px(s, frame[2], frame[3])
        im.crop((round(a), round(b), round(c), round(d))).resize((W, H), Image.LANCZOS).save(OUT / f'{key[4:]}.webp', quality=82, method=6)
    print(group, len(items))

# The list the app reads, so a question with no pictures keeps its drawn icons.
names = sorted(p.stem for p in OUT.glob('*.webp'))
Path('src/ui/choicePics.ts').write_text(
    '// Made by scripts/choice-pics.py: the options that show a crop of our own form drawing (Cat\'s A2, Nov 8).\n'
    'export const CHOICE_PICS = new Set([\n' + ''.join(f"  '{n}',\n" for n in names) + ']);\n'
)
