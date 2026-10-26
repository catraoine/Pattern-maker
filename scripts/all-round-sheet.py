"""Lays the All round sweep's stills out on one sheet: a row for each garment and neckline, eight views across.

python3 scripts/all-round-sheet.py <sweep folder>/<project> <sheet.png> [top]
`top` crops each still to its upper part (0.5 by default), where the neck and shoulders are.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

src, out = Path(sys.argv[1]), sys.argv[2]
top = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
rows = sorted(p for p in src.iterdir() if p.is_dir())
first = Image.open(rows[0] / '0.png')
w, h = first.size
cw, ch = int(w * 0.7), int(h * top)
sheet = Image.new('RGB', (cw * 8 + 120, ch * len(rows)), 'black')
draw = ImageDraw.Draw(sheet)
for r, row in enumerate(rows):
    draw.text((6, r * ch + 6), row.name, fill='white')
    for k in range(8):
        still = Image.open(row / f'{k}.png').convert('RGB')
        sheet.paste(still.crop((int(w * 0.15), 0, int(w * 0.15) + cw, ch)), (120 + k * cw, r * ch))
sheet.save(out)
