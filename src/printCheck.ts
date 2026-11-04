// The print check (Quality: Automated checks, check 3, Cat 2026-11-04): sample patterns built into the tiled PDF the
// print screen makes, then checked the way a sewist checks a print. Every piece is on the printed pages, the 10 cm test
// square measures 10 cm, and neighbouring pages show the same lines where they overlap, so the tiles line up when taped.
// The geometry is checked from the sheet; the square and the tiles from the PDF's pages rendered to pixels
// (pdftoppm), as a printer would print them. printCheck.test.ts runs it on every pull request and nightly.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OVERLAP, PAGE_MARGIN, Paper, Sheet, layout, pageName, pageSize, tileGrid, usedTiles } from './engine/export';
import { toTiledPdf } from './engine/pdf';
import { PatternDesign, printedPattern } from './patternSweep';
import { DEFAULT_COAT_CHOICES, DEFAULT_TEE_CHOICES, DEFAULT_TROUSERS_CHOICES } from './garments';
import { INITIAL } from './savedWork';
import type { Piece } from './engine/piece';

/** The sample patterns: one of every garment, and the widest and longest pieces the app makes. */
export const PRINT_SAMPLES: PatternDesign[] = [
  { key: 'A-line skirt, knee', garment: 'skirt', saved: {} },
  { key: 'circle skirt, maxi', garment: 'skirt', saved: { choices: { ...INITIAL.choices, silhouette: 'circle', length: 'maxi' } } },
  { key: 'top with long sleeves and a shirt collar', garment: 'bodice', saved: { bodice: { ...INITIAL.bodice, sleeve: 'long', collar: 'shirt', closure: 'front_buttons' } } },
  { key: 'dress, midi', garment: 'dress', saved: { dress: { garment: 'dress', fit: 'regular', bodice: { ...INITIAL.bodice, length: 'waist' }, skirt: { ...INITIAL.choices, length: 'midi' }, waistSeam: 'natural' } } },
  { key: 'trousers, full length', garment: 'trousers', saved: { trousers: DEFAULT_TROUSERS_CHOICES } },
  { key: 'T-shirt', garment: 'tee', saved: { tee: DEFAULT_TEE_CHOICES } },
  { key: 'coat, knee', garment: 'coat', saved: { coat: DEFAULT_COAT_CHOICES } },
];

/** The printed sheet and its PDF for a sample, as the print screen lays it out. */
export async function printSample(d: PatternDesign, paper: Paper): Promise<{ sheet: Sheet; pieces: Piece[]; pdf: Uint8Array }> {
  const { made } = printedPattern(d);
  const sheet = layout(made.pieces, `Maison Tracé: ${d.key}`, made.notes, { pattern: d.key });
  const pdf = await toTiledPdf(sheet, paper);
  return { sheet, pieces: made.pieces, pdf };
}

/** Where page (r, c) shows the sheet: the part inside its margins, in sheet cm. */
function tileRect(sheet: Sheet, paper: Paper, r: number, c: number) {
  const [pw, ph] = pageSize(sheet, paper);
  const tw = pw - 2 * PAGE_MARGIN;
  const th = ph - 2 * PAGE_MARGIN;
  return { x: c * (tw - OVERLAP), y: r * (th - OVERLAP), w: tw, h: th };
}

/** Pieces with a line that isn't on any printed page: each piece's lines, point by point, inside a page that prints. */
export function piecesOffThePages(sheet: Sheet, paper: Paper, pieces: Piece[]): string[] {
  const used = usedTiles(sheet, paper);
  const { rows, cols } = tileGrid(sheet, paper);
  const rects = used.flatMap((row, r) => row.flatMap((u, c) => (u ? [tileRect(sheet, paper, r, c)] : [])));
  const onAPage = (x: number, y: number) => rects.some((t) => x >= t.x - 0.01 && x <= t.x + t.w + 0.01 && y >= t.y - 0.01 && y <= t.y + t.h + 0.01);
  const out: string[] = [];
  pieces.forEach((pc, i) => {
    const prims = sheet.prims.filter((pr) => pr.kind === 'poly' && pr.piece === i);
    if (!prims.length) {
      out.push(`${pc.name}: not drawn on the sheet`);
      return;
    }
    let off = 0;
    for (const pr of prims) if (pr.kind === 'poly') for (const q of pr.pts) if (!onAPage(q.x, q.y)) off++;
    if (off) out.push(`${pc.name}: ${off} points of its lines on no printed page (sheet ${rows} x ${cols} pages)`);
  });
  return out;
}

/** A page rendered to grey pixels, 0 black to 255 white. */
interface Gray {
  w: number;
  h: number;
  px: Uint8Array;
}

function readPgm(file: string): Gray {
  const buf = readFileSync(file);
  // "P5\n<w> <h>\n255\n" then the pixels.
  let at = 0;
  const fields: string[] = [];
  while (fields.length < 4) {
    while (/\s/.test(String.fromCharCode(buf[at]))) at++;
    let s = '';
    while (!/\s/.test(String.fromCharCode(buf[at]))) s += String.fromCharCode(buf[at++]);
    fields.push(s);
  }
  at++;
  return { w: Number(fields[1]), h: Number(fields[2]), px: buf.subarray(at) };
}

/** Every page of a PDF rendered at `dpi`, in page order. Needs pdftoppm (poppler-utils). */
function renderPages(pdf: Uint8Array, dpi: number, first = 1, last?: number): Gray[] {
  const dir = mkdtempSync(join(tmpdir(), 'print-check-'));
  const file = join(dir, 'p.pdf');
  writeFileSync(file, pdf);
  execFileSync('pdftoppm', ['-r', String(dpi), '-gray', '-f', String(first), ...(last ? ['-l', String(last)] : []), file, join(dir, 'page')]);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.pgm'))
    .sort((a, b) => Number(/(\d+)\.pgm$/.exec(a)![1]) - Number(/(\d+)\.pgm$/.exec(b)![1]))
    .map((f) => readPgm(join(dir, f)));
}

const INK = 100;
const dark = (g: Gray, x: number, y: number) => x >= 0 && y >= 0 && x < g.w && y < g.h && g.px[y * g.w + x] < INK;

/** The middles of the dark runs along a row (or a column) of pixels between two places, in pixels. */
function runs(g: Gray, along: 'row' | 'col', at: number, from: number, to: number): number[] {
  const out: number[] = [];
  let start = -1;
  for (let i = from; i <= to; i++) {
    const d = along === 'row' ? dark(g, i, at) : dark(g, at, i);
    if (d && start < 0) start = i;
    if (!d && start >= 0) {
      out.push((start + i - 1) / 2);
      start = -1;
    }
  }
  return out;
}

/** The test square's sides on page A1, measured across its middle both ways, in cm. Sheet margin 3 cm. */
function testSquare(page: Gray, dpi: number): { across?: number; down?: number } {
  const px = dpi / 2.54;
  const left = (PAGE_MARGIN + 3) * px;
  // Across a row 2 cm down inside the square (clear of its words), and down a column 2 cm in.
  const row = Math.round(left + 2 * px);
  const xs = runs(page, 'row', row, Math.round(left - 0.5 * px), Math.round(left + 10.5 * px));
  const ys = runs(page, 'col', row, Math.round(left - 0.5 * px), Math.round(left + 10.5 * px));
  const side = (v: number[]) => (v.length >= 2 ? (v[v.length - 1] - v[0]) / px : undefined);
  return { across: side(xs), down: side(ys) };
}

/** Where two neighbouring pages' shared strip differs: dark pixels on one with nothing dark within 2 px on the other.
 *  The joining diamonds and the trim lines are page furniture, not the pattern, so their bands are left out. */
function stripMismatch(a: Gray, b: Gray, dpi: number, join: 'right' | 'below', pw: number, ph: number): { ink: number; off: number } {
  const px = dpi / 2.54;
  const tw = pw - 2 * PAGE_MARGIN;
  const th = ph - 2 * PAGE_MARGIN;
  // On page a the strip is its last OVERLAP cm inside the margin; on page b its first.
  const inset = 3;
  const n = Math.floor(OVERLAP * px) - 2 * inset;
  const span = Math.floor((join === 'right' ? th : tw) * px);
  // The page's footer ("PAGE A2 ...") is printed over the last 3 mm of the tile, at the bottom of a right join's strip
  // and across the whole of a lower join's strip on the page above.
  const FOOT = 0.35;
  const furniture = (t: number) => [0.3, 0.7].some((f) => Math.abs(t / px - (join === 'right' ? th * f : tw * f)) < 1.3) || (join === 'right' && t / px > th - FOOT);
  let ink = 0;
  let off = 0;
  const near = (g: Gray, x: number, y: number) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dark(g, x + dx, y + dy)) return true;
    return false;
  };
  for (let t = inset; t < span - inset; t++) {
    if (furniture(t)) continue;
    for (let k = 0; k < n; k++) {
      const s = inset + k;
      if (join === 'below' && s / px > OVERLAP - FOOT) continue;
      const [ax, ay, bx, by] =
        join === 'right'
          ? [Math.round((PAGE_MARGIN + tw - OVERLAP) * px) + s, Math.round(PAGE_MARGIN * px) + t, Math.round(PAGE_MARGIN * px) + s, Math.round(PAGE_MARGIN * px) + t]
          : [Math.round(PAGE_MARGIN * px) + t, Math.round((PAGE_MARGIN + th - OVERLAP) * px) + s, Math.round(PAGE_MARGIN * px) + t, Math.round(PAGE_MARGIN * px) + s];
      const da = dark(a, ax, ay);
      const db = dark(b, bx, by);
      if (da || db) ink++;
      if ((da && !near(b, bx, by)) || (db && !near(a, ax, ay))) off++;
    }
  }
  return { ink, off };
}

/** Everything wrong with a sample's print on one paper, in words. */
export async function printProblems(d: PatternDesign, paper: Paper, dpi = 150): Promise<string[]> {
  const out: string[] = [];
  const { sheet, pieces, pdf } = await printSample(d, paper);
  out.push(...piecesOffThePages(sheet, paper, pieces));
  const used = usedTiles(sheet, paper);
  const order = used.flatMap((row, r) => row.flatMap((u, c) => (u ? [[r, c] as const] : [])));
  if (!used[0]?.[0]) out.push('page A1, with the test square, is not printed');
  const pages = renderPages(pdf, dpi, 1, order.length);
  if (pages.length !== order.length) out.push(`${pages.length} pattern pages rendered, ${order.length} expected`);
  const [pw, ph] = pageSize(sheet, paper);
  const px = dpi / 2.54;
  for (const g of pages)
    if (Math.abs(g.w / px - pw) > 0.1 || Math.abs(g.h / px - ph) > 0.1) {
      out.push(`a page prints ${(g.w / px).toFixed(1)} x ${(g.h / px).toFixed(1)} cm, the paper is ${pw} x ${ph}`);
      break;
    }
  if (pages[0]) {
    const sq = testSquare(pages[0], dpi);
    for (const [way, v] of [['across', sq.across], ['down', sq.down]] as const)
      if (v === undefined || Math.abs(v - 10) > 0.05) out.push(`the test square measures ${v === undefined ? 'nothing' : `${v.toFixed(2)} cm`} ${way}, not 10 cm`);
  }
  const index = new Map(order.map(([r, c], i) => [`${r},${c}`, i]));
  for (const [r, c] of order)
    for (const [dr, dc, join] of [[0, 1, 'right'], [1, 0, 'below']] as const) {
      const j = index.get(`${r + dr},${c + dc}`);
      if (j === undefined) continue;
      const m = stripMismatch(pages[index.get(`${r},${c}`)!], pages[j], dpi, join, pw, ph);
      // A few pixels of a line's anti-aliasing can fall either side; a line out of place is hundreds.
      if (m.off > Math.max(30, m.ink * 0.03)) out.push(`pages ${pageName(r, c)} and ${pageName(r + dr, c + dc)} differ where they overlap: ${m.off} of ${m.ink} inked pixels on one page have nothing under them on the other (a line or words missing or moved)`);
    }
  return out;
}
