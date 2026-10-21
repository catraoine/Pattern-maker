"""Draws the app icons from the name alone (Cat's R1 The Name, 2026-10-21): MAISON over TRACÉ in Chakra Petch,
champagne on black, with MT for the browser tab where the full name is too small to read.

The letters are written out as outlines, so the icons look the same on every device whether or not the font is
installed. Writes public/icon.svg (home screen, install) and public/favicon.svg (browser tab); the PNG icons are
those SVGs rendered at 512, 192 and 180 px. Run it again only to change the icon:
python3 scripts/brand-icons.py  (needs fonttools; reads the font from node_modules/@fontsource/chakra-petch).
"""
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / 'node_modules' / '@fontsource' / 'chakra-petch' / 'files'
OUT = ROOT / 'public'
CHAMPAGNE = '#D9C49B'
SIZE = 512


def line(font: TTFont, text: str, size: float, tracking: float, cx: float, baseline: float) -> str:
    """One line of text as a single path, centred on cx, with `tracking` em between letters."""
    glyphs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font['head'].unitsPerEm
    names = [cmap[ord(ch)] for ch in text]
    advances = [glyphs[n].width for n in names]
    width = sum(advances) + tracking * upm * (len(names) - 1)
    scale = size / upm
    pen = SVGPathPen(glyphs, ntos=lambda v: f'{v:.1f}')
    x = cx / scale - width / 2
    for name, adv in zip(names, advances):
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x * scale, baseline)))
        x += adv + tracking * upm
    return pen.getCommands()


def icon(paths: list[str]) -> str:
    body = ''.join(f'<path d="{d}" fill="{CHAMPAGNE}"/>' for d in paths)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}"><rect width="{SIZE}" height="{SIZE}" fill="#000000"/>{body}</svg>\n'


medium = TTFont(FONTS / 'chakra-petch-latin-500-normal.woff')
bold = TTFont(FONTS / 'chakra-petch-latin-600-normal.woff')
# Kept inside the middle 80% so the maskable icon survives a round crop.
name = [line(medium, 'MAISON', 74, 0.22, SIZE / 2, 240), line(medium, 'TRACÉ', 74, 0.22, SIZE / 2, 333)]
(OUT / 'icon.svg').write_text(icon(name))
(OUT / 'favicon.svg').write_text(icon([line(bold, 'MT', 250, 0.06, SIZE / 2, 343)]))
print('wrote public/icon.svg and public/favicon.svg; render the PNGs from icon.svg')
