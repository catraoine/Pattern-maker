"""Lays stills out on one sheet: a row per look, the angles across, optionally two folders side by side (before | after).

python3 scripts/body-sheet.py <out.png> <label:folder> [<label:folder> ...] [--top 0.5] [--looks a,b,c]
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

args = sys.argv[1:]
out = args.pop(0)
top = 1.0
looks = None
sets = []
while args:
    a = args.pop(0)
    if a == '--top': top = float(args.pop(0))
    elif a == '--looks': looks = args.pop(0).split(',')
    else:
        label, folder = a.split(':', 1)
        sets.append((label, Path(folder)))
rows = sorted({p.name for _, f in sets for p in f.iterdir() if p.is_dir()})
if looks: rows = [r for r in looks if r in rows]
sample = next(p for _, f in sets for p in (f / rows[0]).glob('*.png'))
w, h = Image.open(sample).size
n = max(len(list((f / r).glob('*.png'))) for _, f in sets for r in rows)
cw, ch = int(w * 0.8), int(h * top)
gap = 40
sheet = Image.new('RGB', (len(sets) * (cw * n + gap), ch * len(rows) + 30), 'black')
d = ImageDraw.Draw(sheet)
for s, (label, folder) in enumerate(sets):
    x0 = s * (cw * n + gap)
    d.text((x0 + 8, 8), label, fill='white')
    for r, row in enumerate(rows):
        d.text((x0 + 8, 30 + r * ch + 6), row, fill='white')
        for k in range(n):
            p = folder / row / f'{k}.png'
            if not p.exists(): continue
            im = Image.open(p).convert('RGB').crop((int(w * 0.1), 0, int(w * 0.1) + cw, ch))
            sheet.paste(im, (x0 + k * cw, 30 + r * ch))
sheet.save(out)
print(out, sheet.size)
