// Lay out pieces and export them at true scale: SVG and tiled PDF for home printing.
import { P, add, lerp, mul, p, sub, unit } from './geometry';
import { allNotches, drillHoles, edgeLabels, insidePolygon, notchSlit } from './marks';
import { Piece, bounds, cutLine } from './piece';
import { PROFILE_RES, nestOutlines, profile } from './layplan';

const GAP = 4; // cm between pieces
const MARGIN = 3; // cm around the sheet

export type LineStyle = 'cut' | 'stitch' | 'stitchSolid' | 'mark' | 'notch' | 'fine';

/** Typefaces: the Contour Line label face (tracked capitals) and the body face. */
export type Face = 'label' | 'body' | 'bodyMedium';

/** Drafting order, for showing a pattern being drawn: the stitching line, darts, grain and fold
 * marks, seam allowance, then notches and labels. */
export type DraftStep = 'outline' | 'darts' | 'grain' | 'allowance' | 'labels';
type Order = { piece?: number; step?: DraftStep };

export type Prim =
  | ({ kind: 'poly'; pts: P[]; style: LineStyle; closed: boolean } & Order)
  | ({
      kind: 'text';
      at: P;
      text: string;
      size: number;
      rotate: number;
      anchor: 'middle' | 'start';
      face?: Face;
      /** Extra space between letters, as a fraction of the size. */
      tracking?: number;
      grey?: number;
    } & Order);

export interface Sheet {
  prims: Prim[];
  width: number; // cm
  height: number; // cm
}

/** Who and what the pattern is for, printed in each piece's information block. */
export interface SheetInfo {
  pattern: string;
  madeFor?: string;
  date?: string;
  /** A numbered drop's copy, e.g. "Drop 01 · No. 0127/600": in the title block and on every main piece. */
  edition?: string;
  /** An Archive cut's credit line, under the title. */
  credit?: string;
}

// Line weights follow the industry hierarchy: the cutting line is heaviest, the stitching line a
// fine dash, construction and balance lines finest of all.
export const STYLES: Record<LineStyle, { width: number; dash?: number[]; grey: number }> = {
  cut: { width: 0.05, grey: 0 },
  stitch: { width: 0.02, dash: [0.4, 0.25], grey: 0.35 },
  stitchSolid: { width: 0.03, grey: 0 },
  mark: { width: 0.025, grey: 0.1 },
  notch: { width: 0.05, grey: 0 },
  fine: { width: 0.015, dash: [0.8, 0.2, 0.12, 0.2], grey: 0.45 },
};

export const FONT_FAMILY: Record<Face, string> = {
  label: "'Chakra Petch', Helvetica, Arial, sans-serif",
  body: "'Space Grotesk', Helvetica, Arial, sans-serif",
  bodyMedium: "'Space Grotesk', Helvetica, Arial, sans-serif",
};

function arrowHeads(a: P, b: P, head = 1.2): P[][] {
  const u = unit(sub(b, a));
  const n = p(-u.y, u.x);
  const side = (base: P, dir: number) => [
    add(add(base, mul(u, -head * dir)), mul(n, head * 0.45)),
    base,
    add(add(base, mul(u, -head * dir)), mul(n, -head * 0.45)),
  ];
  return [side(b, 1), side(a, -1)];
}

/** A drill hole: a small circle with a cross through it. */
function drill(at: P, r = 0.25): P[][] {
  const ring = Array.from({ length: 13 }, (_, i) => add(at, p(r * Math.cos((i * Math.PI) / 6), r * Math.sin((i * Math.PI) / 6))));
  return [ring, [add(at, p(-r * 1.6, 0)), add(at, p(r * 1.6, 0))], [add(at, p(0, -r * 1.6)), add(at, p(0, r * 1.6))]];
}

/** The point of a polyline nearest to q. */
function nearest(q: P, pts: P[]): P {
  let best = pts[0];
  let bd = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const ab = sub(b, a);
    const l2 = ab.x * ab.x + ab.y * ab.y;
    const k = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * ab.x + (q.y - a.y) * ab.y) / l2)) : 0;
    const c = add(a, mul(ab, k));
    const d = Math.hypot(c.x - q.x, c.y - q.y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

/** The runs of a closed polyline that leave another by more than half a millimetre (and somewhere
 * by more than 2 mm), longest first, each with the points either side so it joins on. */
export function leaving(pts: P[], from: P[]): P[][] {
  const n = pts.length;
  const gap = pts.map((q) => {
    const c = nearest(q, from);
    return Math.hypot(c.x - q.x, c.y - q.y);
  });
  const off = gap.map((g) => g > 0.05);
  if (off.every(Boolean)) return [pts];
  const runs: P[][] = [];
  for (let i = 0; i < n; i++) {
    if (!off[i] || off[(i - 1 + n) % n]) continue;
    let j = i;
    while (off[(j + 1) % n] && j - i < n) j++;
    const run: P[] = [];
    let most = 0;
    for (let k = i - 1; k <= j + 1; k++) {
      run.push(pts[((k % n) + n) % n]);
      most = Math.max(most, gap[((k % n) + n) % n]);
    }
    // Under 2 mm apart (a curve meeting a new angle) is no line to cut.
    if (most > 0.2) runs.push(run);
  }
  const length = (r: P[]) => r.reduce((t, q, k) => (k ? t + Math.hypot(q.x - r[k - 1].x, q.y - r[k - 1].y) : 0), 0);
  return runs.sort((u, v) => length(v) - length(u));
}

const TITLE_W = 46; // cm, the title block beside the test square

/** Turn a vector by `deg` degrees clockwise (the way SVG and the labels rotate). */
const turn = (v: P, deg: number): P => {
  const a = (deg * Math.PI) / 180;
  return p(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a));
};

export interface LayoutOptions {
  /** Draw the draft itself: the frame and the numbered construction points. */
  atelier?: boolean;
}

// ---- Text extents, estimated for keeping labels clear of each other. The labels are drawn at 0.857
// of their size, with capitals about 0.6 em wide and tracking added to every letter; measured on the
// printed sheets. A little generous, so a fit is a real fit. ----
const CHAR_EM: Record<string, number> = { ' ': 0.25, '·': 0.35, '.': 0.25, ',': 0.25, ':': 0.25, '/': 0.45, '(': 0.38, ')': 0.38, '-': 0.4, '+': 0.6 };

/** The width of a label in cm. */
export function textWidth(t: string, size: number, tracking = 0): number {
  let em = 0;
  for (const c of t) em += CHAR_EM[c] ?? (/[a-z]/.test(c) ? 0.55 : /[0-9]/.test(c) ? 0.7 : 0.6);
  return (em + tracking * t.length) * size * 0.9;
}

/** A label's footprint: a rectangle centred at c, u along the reading direction, n down the text. */
interface Box {
  c: P;
  u: P;
  n: P;
  hw: number;
  hh: number;
}

const dot = (a: P, b: P) => a.x * b.x + a.y * b.y;

/** The box of a label whose baseline middle is at `at`, with a little room round it. */
function textBox(at: P, text: string, size: number, rotate: number, tracking = 0, pad = 0.15): Box {
  const u = turn(p(1, 0), rotate);
  const n = turn(p(0, 1), rotate);
  return { c: add(at, mul(n, -size * 0.32)), u, n, hw: textWidth(text, size, tracking) / 2 + pad, hh: size * 0.38 + pad };
}

/** A box along a line (a grain arrow), `across` wide. */
function lineBox(a: P, b: P, across: number): Box {
  const u = unit(sub(b, a));
  return { c: lerp(a, b, 0.5), u, n: p(-u.y, u.x), hw: Math.hypot(b.x - a.x, b.y - a.y) / 2, hh: across / 2 };
}

const shifted = (b: Box, d: P): Box => ({ ...b, c: add(b.c, d) });
const corners = (b: Box): P[] => [1, -1].flatMap((su) => [1, -1].map((sn) => add(b.c, add(mul(b.u, su * b.hw), mul(b.n, sn * b.hh)))));

/** How far b reaches into a along an axis: positive when their extents on it overlap. */
function reach(a: Box, b: Box, axis: P): number {
  const ext = (bx: Box) => bx.hw * Math.abs(dot(bx.u, axis)) + bx.hh * Math.abs(dot(bx.n, axis));
  return ext(a) + ext(b) - Math.abs(dot(sub(b.c, a.c), axis));
}

const overlaps = (a: Box, b: Box) => [a.u, a.n, b.u, b.n].every((ax) => reach(a, b, ax) > 0);
const within = (b: Box, poly: P[]) => corners(b).every((q) => insidePolygon(q, poly));

/** Whether the segment a-b reaches into the box. */
function crosses(b: Box, a: P, c: P): boolean {
  // In the box's own frame: along the text and down it, from its centre.
  const local = (q: P) => p(dot(sub(q, b.c), b.u), dot(sub(q, b.c), b.n));
  const A = local(a);
  const C = local(c);
  // Clip the segment to the box (Liang-Barsky): any of it left means it reaches in.
  let t0 = 0;
  let t1 = 1;
  const d = sub(C, A);
  for (const [pk, qk] of [
    [-d.x, A.x + b.hw],
    [d.x, b.hw - A.x],
    [-d.y, A.y + b.hh],
    [d.y, b.hh - A.y],
  ]) {
    if (pk === 0) {
      if (qk < 0) return false;
      continue;
    }
    const r = qk / pk;
    if (pk < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

/** Whether a polyline reaches into the box. */
const crossesLine = (b: Box, pts: P[]) => pts.some((q, i) => i > 0 && crosses(b, pts[i - 1], q));

type TextPrim = Extract<Prim, { kind: 'text' }>;

/** A label on a piece and how freely it moves out of another's way: the name block (rank 0) stays,
 * grain and fold labels (1) slide along their line, the piece's own marks (2), seam names (3) and
 * balance lines (4) give way in that order. */
interface Lab {
  prim: TextPrim;
  box: Box;
  rank: number;
  /** The line the label sits beside (a grain arrow, a fold): it stays within that line's reach. */
  along?: [P, P];
}

const LABEL_GAP = 0.3;

function moveLab(l: Lab, d: P) {
  l.prim.at = add(l.prim.at, d);
  l.box = shifted(l.box, d);
}

/** Whether a label beside a line would still be beside it. */
function besides(l: Lab, box: Box): boolean {
  if (!l.along) return true;
  const [a, b] = l.along;
  const u = unit(sub(b, a));
  const t = dot(sub(box.c, a), u);
  return t >= -0.2 && t <= Math.hypot(b.x - a.x, b.y - a.y) + 0.2;
}

/**
 * Nudge the labels of one piece apart. A label that strays outside the stitching line is first
 * brought back in along its reading direction; then, for each pair that collide, the one that gives
 * way moves the shortest valid distance along or across its text, a grain or fold label preferring to
 * slide along its line. Nothing moves onto a higher-ranked label, onto a line drawn across the piece
 * (`marks`), or off the piece.
 */
function settle(labs: Lab[], poly: P[], marks: P[][] = []) {
  for (const l of labs) {
    if (l.rank === 0 || within(l.box, poly)) continue;
    outer: for (let d = 0.5; d <= 4; d += 0.5)
      for (const s of [-1, 1]) {
        const m = mul(l.box.u, s * d);
        if (within(shifted(l.box, m), poly) && besides(l, shifted(l.box, m))) {
          moveLab(l, m);
          break outer;
        }
      }
  }
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let i = 0; i < labs.length; i++)
      for (let j = i + 1; j < labs.length; j++) {
        const a = labs[i];
        const b = labs[j];
        if (!overlaps(a.box, b.box)) continue;
        const [stay, mv] = b.rank >= a.rank ? [a, b] : [b, a];
        if (mv.rank === 0) continue;
        const others = labs.filter((o) => o !== mv && o !== stay);
        // Just clear of the other label along each axis, or farther when something else is there.
        const options = [mv.box.u, mv.box.n].flatMap((ax) => {
          const need = reach(stay.box, mv.box, ax) + LABEL_GAP;
          return [0, 0.5, 1, 1.5, 2, 3].flatMap((more) => [mul(ax, need + more), mul(ax, -need - more)]);
        });
        const dist = (m: P) => Math.hypot(m.x, m.y);
        const inside = (m: P) => within(shifted(mv.box, m), poly) && besides(mv, shifted(mv.box, m));
        // Nor onto a line drawn across the piece, unless it already sat on one.
        const onLine = marks.some((ln) => crossesLine(mv.box, ln));
        const clear = (m: P) => {
          const bx = shifted(mv.box, m);
          return !overlaps(bx, stay.box) && !others.some((o) => o.rank <= mv.rank && overlaps(o.box, bx)) && (onLine || !marks.some((ln) => crossesLine(bx, ln)));
        };
        const valid = options.filter((m) => inside(m) && clear(m)).sort((x, y) => dist(x) - dist(y));
        // A grain or fold label slides along its line rather than away from it, when it can.
        const slide = mv.along ? valid.find((m) => Math.abs(dot(unit(m), mv.box.u)) > 0.9) : undefined;
        const choice = slide ?? valid[0];
        if (choice) {
          moveLab(mv, choice);
          moved = true;
        }
      }
    if (!moved) break;
  }
}

/**
 * Pairs of labels on the same piece whose footprints overlap, by the estimate the labels are placed
 * with: the check a layout is held to.
 */
export function labelCollisions(sheet: Sheet): [string, string][] {
  const out: [string, string][] = [];
  const byPiece = new Map<number, TextPrim[]>();
  for (const pr of sheet.prims) {
    if (pr.kind !== 'text' || pr.piece === undefined) continue;
    byPiece.set(pr.piece, [...(byPiece.get(pr.piece) ?? []), pr]);
  }
  for (const prims of byPiece.values()) {
    const boxes = prims.map((pr) => textBox(pr.at, pr.text, pr.size, pr.rotate, pr.tracking ?? 0, 0));
    for (let i = 0; i < prims.length; i++)
      for (let j = i + 1; j < prims.length; j++) if (overlaps(boxes[i], boxes[j])) out.push([prims[i].text, prims[j].text]);
  }
  return out;
}

/** Shorter words for an information line that will not fit its piece. */
const ABBREVIATIONS: [RegExp, string][] = [
  [/ \(1 PAIR\)/, ''],
  [/ \(2 PAIRS\)/, ''],
  [/SELF FABRIC/, 'SELF'],
  [/INTERFACING/, 'INTERF.'],
  [/LINING OR POCKETING/, 'LINING'],
  [/, INTERFACED/, ''],
];

/** Fabric notes reworded for the piece as cut. */
const FABRIC_NOTES: [RegExp, string][] = [
  // The collar is cut on the fold with one straight grain, so both layers are on it.
  [/^Upper collar in self, under collar in self on the bias \+ interfacing$/i, 'Upper and under collar in self + interfacing'],
];

/**
 * The information line broken at its separators to fit `free` cm: a piece's number and cutting
 * together, the fabric on a line of its own, then shorter words, and the fabric dropped altogether
 * before the number and cutting are squeezed.
 */
export function wrapInfo(line: string, size: number, tracking: number, free: number): string[] {
  const fits = (t: string) => textWidth(t, size, tracking) <= free;
  if (fits(line)) return [line];
  const abbreviate = (t: string) => ABBREVIATIONS.reduce((s, [re, to]) => s.replace(re, to), t);
  const pack = (parts: string[]) => {
    const out: string[] = [];
    for (const part of parts) {
      const last = out[out.length - 1];
      if (last !== undefined && fits(`${last} · ${part}`)) out[out.length - 1] = `${last} · ${part}`;
      else out.push(part);
    }
    return out;
  };
  let parts = line.split(' · ');
  let lines = pack(parts);
  if (lines.every(fits)) return lines;
  parts = parts.map(abbreviate);
  lines = pack(parts);
  if (lines.every(fits)) return lines;
  // The fabric is the last part, after the number and the cutting.
  if (parts.length > 2) {
    lines = pack(parts.slice(0, 2));
    if (lines.every(fits)) return lines;
  }
  return lines;
}

/**
 * The information line as one row of at most `avail` cm, for a band too shallow to stack it: whole,
 * then in shorter words, then without the fabric, and at the least the cutting alone.
 */
export function fitRow(line: string, size: number, tracking: number, avail: number): string {
  const parts = line.split(' · ');
  const abbreviate = (t: string) => ABBREVIATIONS.reduce((s, [re, to]) => s.replace(re, to), t);
  const tries = [line, abbreviate(line), parts.slice(0, 2).join(' · '), abbreviate(parts.slice(0, 2).join(' · ')), parts[1] ?? parts[0], abbreviate(parts[1] ?? parts[0])];
  return tries.find((t) => textWidth(t, size, tracking) <= avail) ?? tries[tries.length - 1];
}

/** A line of plain words broken at its spaces into lines of at most `free` cm. */
export function wrapWords(line: string, size: number, tracking: number, free: number): string[] {
  const out: string[] = [];
  for (const word of line.split(' ')) {
    const last = out[out.length - 1];
    if (last !== undefined && textWidth(`${last} ${word}`, size, tracking) <= free) out[out.length - 1] = `${last} ${word}`;
    else out.push(word);
  }
  return out;
}

/** The largest run of a span [lo, hi] left after cutting out `holes`, nearest to `at`. */
function freeRun(lo: number, hi: number, holes: [number, number][], at: number): [number, number] {
  let runs: [number, number][] = [[lo, hi]];
  for (const [a, b] of holes)
    runs = runs.flatMap(([x, y]): [number, number][] => (b <= x || a >= y ? [[x, y]] : [...(a > x ? [[x, a] as [number, number]] : []), ...(b < y ? [[b, y] as [number, number]] : [])]));
  runs = runs.filter(([x, y]) => y > x);
  if (!runs.length) return [lo, hi];
  const contains = runs.find(([x, y]) => at >= x && at <= y);
  return contains ?? runs.reduce((best, r) => (r[1] - r[0] > best[1] - best[0] ? r : best));
}

export interface Packed {
  /** Where each piece's bounding box goes, its top-left corner. */
  at: P[];
  /** Which pieces lie turned end to end (180 degrees about their box's centre); the box is the same. */
  turned: boolean[];
  width: number;
  height: number;
}

/** A piece's points turned end to end within its box. */
export const turnedInBox = (q: P, [x0, y0, x1, y1]: [number, number, number, number]): P => p(x0 + x1 - q.x, y0 + y1 - q.y);

/** The title block's footprint, from the sheet's margin: the test square and the card beside it. */
const TITLE_BLOCK = { w: 10 + TITLE_W, h: 10 };

/** The vertical span of an outline in each column across it, from its box's top left. */
export interface ColumnSpans {
  x0: number;
  y0: number;
  step: number;
  top: number[];
  bottom: number[];
}

/** An outline's columns, in its own coordinates, for counting the pages it inks. */
export function columnSpans(outline: P[]): ColumnSpans {
  const prof = profile(outline);
  return { x0: Math.min(...outline.map((q) => q.x)), y0: Math.min(...outline.map((q) => q.y)), step: PROFILE_RES, top: prof.top, bottom: prof.bottom };
}

/**
 * The A4 pages a packing takes, counting the tiles the title block and the pieces touch: each
 * piece by its outline's columns when given (`spans`, from its box's top left), else by its box.
 */
export function packedPages(k: Packed, sizes: { w: number; h: number }[], spans?: ColumnSpans[]): number {
  const [pw, ph] = PAPER_CM.a4;
  const stepX = pw - 2 * PAGE_MARGIN - OVERLAP;
  const stepY = ph - 2 * PAGE_MARGIN - OVERLAP;
  const w = k.width + 2 * MARGIN;
  const h = k.height + 2 * MARGIN;
  const cols = Math.max(1, Math.ceil((w - OVERLAP) / stepX));
  const rows = Math.max(1, Math.ceil((h - OVERLAP) / stepY));
  const boxes = [{ x: MARGIN, y: MARGIN, ...TITLE_BLOCK }, ...sizes.map((s, i) => ({ x: k.at[i].x + MARGIN, y: k.at[i].y + MARGIN, w: s.w, h: s.h }))];
  const touches = (b: { x: number; y: number; w: number; h: number }, x: number, y: number) => b.x < x + stepX + OVERLAP && b.x + b.w > x && b.y < y + stepY + OVERLAP && b.y + b.h > y;
  // Whether a piece's outline reaches the tile: some column of it crosses the tile's width with its
  // span crossing the tile's height.
  const inks = (i: number, x: number, y: number) => {
    const sp = spans?.[i];
    if (!sp) return true;
    const ox = boxes[i + 1].x + sp.x0;
    const oy = boxes[i + 1].y + sp.y0;
    const c0 = Math.max(0, Math.floor((x - ox) / sp.step));
    const c1 = Math.min(sp.top.length - 1, Math.ceil((x + stepX + OVERLAP - ox) / sp.step));
    for (let c = c0; c <= c1; c++) if (oy + sp.top[c] < y + stepY + OVERLAP && oy + sp.bottom[c] > y) return true;
    return false;
  };
  let n = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = c * stepX;
      const y = r * stepY;
      if (boxes.some((b, i) => touches(b, x, y) && (i === 0 || inks(i - 1, x, y)))) n++;
    }
  return n;
}

/**
 * The pieces nested by their cutting lines, the way that takes the fewest A4 pages on a sheet not
 * much longer than it is wide: a range of sheet widths is tried, each filling whole columns of
 * pages, with the pieces taken tallest, biggest or widest first, dropped as low as they go or
 * filling the left first. Each piece may also lie turned end to end, which keeps its grain line
 * vertical on the sheet (a quarter turn would not, and the sheet is for cutting). Each returned
 * position is where the piece's bounding box goes.
 */
export function pack(outlines: P[][], boxes: [number, number, number, number][]): Packed {
  if (!outlines.length) return { at: [], turned: [], width: 0, height: 0 };
  const sizes = boxes.map(([x0, y0, x1, y1]) => ({ w: x1 - x0, h: y1 - y0, x: x0, y: y0 }));
  const turned = outlines.map((o, i) => o.map((q) => turnedInBox(q, boxes[i])));
  // Each outline's columns within its box, both ways round, for counting the pages it inks.
  const spansOf = (os: P[][]) => os.map((o, i) => columnSpans(o.map((q) => p(q.x - sizes[i].x, q.y - sizes[i].y))));
  const spans = { plain: spansOf(outlines), turned: spansOf(turned) };
  const widest = Math.max(...sizes.map((s) => s.w));
  const all = sizes.reduce((t, s) => t + s.w + GAP, -GAP);
  const stepX = PAPER_CM.a4[0] - 2 * PAGE_MARGIN - OVERLAP;
  const oblong = (k: Packed) => Math.abs(Math.log((k.width + 2 * MARGIN) / (k.height + 2 * MARGIN)));
  const targets = new Set<number>();
  for (let k = 1; k * stepX + OVERLAP - 2 * MARGIN < all + stepX; k++) targets.add(Math.max(widest, k * stepX + OVERLAP - 2 * MARGIN - 0.01));
  for (let i = 0; i <= 12; i++) targets.add(widest + ((all - widest) * i) / 12);
  const orders = {
    height: sizes.map((_, i) => i).sort((a, b) => sizes[b].h - sizes[a].h || sizes[b].w - sizes[a].w),
    area: sizes.map((_, i) => i).sort((a, b) => sizes[b].w * sizes[b].h - sizes[a].w * sizes[a].h),
    width: sizes.map((_, i) => i).sort((a, b) => sizes[b].w - sizes[a].w || sizes[b].h - sizes[a].h),
  };
  let best: Packed | undefined;
  let bestPages = Infinity;
  for (const target of targets)
    for (const order of Object.values(orders))
    for (const policy of ['low', 'left', 'snug'] as const) {
      const nest = nestOutlines(outlines, Math.max(target, TITLE_BLOCK.w) + GAP, GAP, order, TITLE_BLOCK, policy, turned);
      // From the outline's translation to where its box's top-left corner lands.
      const k: Packed = { at: nest.at.map((d, i) => p(d.x + sizes[i].x, d.y + sizes[i].y)), turned: nest.turned, width: nest.width, height: nest.height };
      // Fewest pages, a sheet longer than twice its width counting as a page more, since it tapes
      // together awkwardly; among equals the squarer sheet.
      const n = packedPages(k, sizes, k.turned.map((tn, i) => (tn ? spans.turned[i] : spans.plain[i]))) + (oblong(k) > Math.log(2) ? 1 : 0);
      if (n < bestPages || (n === bestPages && best && oblong(k) < oblong(best))) {
        best = k;
        bestPages = n;
      }
    }
  return best!;
}

export function layout(pieces: Piece[], title: string, notes: string[], info?: SheetInfo, opts: LayoutOptions = {}): Sheet {
  const prims: Prim[] = [];
  let order: Order = {};
  const poly = (pts: P[], style: LineStyle, closed = false) => prims.push({ kind: 'poly', pts, style, closed, ...order });
  const text = (
    at: P,
    t: string,
    size: number,
    rotate = 0,
    anchor: 'middle' | 'start' = 'middle',
    opts: { face?: Face; tracking?: number; grey?: number } = {},
  ): TextPrim => {
    const pr: TextPrim = { kind: 'text', at, text: t, size, rotate, anchor, ...opts, ...order };
    prims.push(pr);
    return pr;
  };

  // Title block: the 10 cm test square at top left, title and notes beside it. The pieces are nested
  // by their cutting lines beside and below it, the way they are drawn.
  const boxes = pieces.map((pc) => bounds(pc));
  const packed = pack(pieces.map((pc) => cutLine(pc)), boxes);
  pieces.forEach((pc, piece) => {
    const [x0, y0] = boxes[piece];
    const at = add(packed.at[piece], p(MARGIN, MARGIN));
    const off = sub(at, p(x0, y0));
    // Onto the sheet: a piece the packer turned end to end goes round within its box first.
    const turned = packed.turned[piece];
    const t = (q: P) => add(turned ? turnedInBox(q, boxes[piece]) : q, off);
    // A label's baseline point onto the sheet. A label is set a little to one side of its mark, and
    // turning the piece would put its letters on the mark's other side, so on a turned piece the
    // baseline moves down by the letters' height: the letters then sit where the turn put the label.
    const tl = (q: P, size: number, rotate = 0) => (turned ? add(t(q), mul(turn(p(0, 1), rotate), size * 0.64)) : t(q));
    const stitch = pc.outline.points().map(t);
    const labs: Lab[] = [];
    const lab = (prim: TextPrim, rank: number, tracking = 0, along?: [P, P]) =>
      labs.push({ prim, box: textBox(prim.at, prim.text, prim.size, prim.rotate, tracking), rank, ...(along ? { along } : {}) });
    order = { piece, step: 'allowance' };
    poly(cutLine(pc).map(t), 'cut', true);
    order = { piece, step: 'outline' };
    // A couture pattern is thread-traced along the stitching line, so it is drawn solid.
    poly(stitch, pc.meta.threadTrace ? 'stitchSolid' : 'stitch', true);
    // A second line for one side of the body: drawn only where it leaves the main one, and named
    // between the two lines.
    if (pc.alternate) {
      const alt = leaving(pc.alternate.outline.points(), pc.outline.points());
      alt.forEach((run) => poly(run.map(t), pc.meta.threadTrace ? 'stitchSolid' : 'stitch'));
      leaving(cutLine(pc, pc.alternate.outline), cutLine(pc)).forEach((run) => poly(run.map(t), 'cut'));
      const run = alt[0];
      if (run && run.length > 1) {
        const k = Math.floor(run.length / 2);
        const mid = run[k];
        const near = nearest(mid, pc.outline.points());
        const u = unit(sub(run[Math.min(run.length - 1, k + 1)], run[Math.max(0, k - 1)]));
        let rot = (Math.atan2(u.y, u.x) * 180) / Math.PI;
        if (rot > 90) rot -= 180;
        if (rot <= -90) rot += 180;
        lab(text(tl(add(lerp(mid, near, 0.5), p(0, 0.18)), 0.45, rot), `${pc.alternate.label} LINE`, 0.45, rot, 'middle', { face: 'label', tracking: 0.12 }), 4, 0.12);
      }
    }
    if (opts.atelier && pc.draft) {
      pc.draft.frame.forEach((ln) => poly(ln.map(t), 'fine'));
      pc.draft.points.forEach((dp) => {
        const c = t(dp.at);
        poly(Array.from({ length: 13 }, (_, i) => add(c, p(0.18 * Math.cos((i * Math.PI) / 6), 0.18 * Math.sin((i * Math.PI) / 6)))), 'mark', true);
        text(add(c, p(0.35, -0.3)), dp.n, 0.65, 0, 'start', { face: 'label', tracking: 0.05 });
      });
    }
    order = { piece, step: 'darts' };
    // The lines drawn across the piece (a roll line, dart legs, a pocket, a fold line): the name
    // block keeps off them.
    const marks: P[][] = [...pc.lines.map((ln) => ln.points().map(t)), ...(pc.balance ?? []).map((b) => b.pts.map(t))];
    pc.lines.forEach((ln) => poly(ln.points().map(t), 'mark'));
    drillHoles(pc).forEach((h) => drill(t(h)).forEach((ring) => poly(ring, 'mark')));
    order = { piece, step: 'grain' };
    (pc.balance ?? []).forEach((b) => {
      poly(b.pts.map(t), 'fine');
      const [a, c] = [b.pts[0], b.pts[b.pts.length - 1]];
      const u = unit(sub(c, a));
      const rot = (Math.atan2(u.y, u.x) * 180) / Math.PI;
      lab(text(tl(add(lerp(a, c, 0.75), mul(p(u.y, -u.x), 0.35)), 0.5, rot), b.label, 0.5, rot, 'middle', { face: 'label', tracking: 0.15, grey: 0.35 }), 4, 0.15);
    });
    // The grain arrow and the fold bracket: labels keep off them.
    const fixtures: Box[] = [];
    if (pc.grain) {
      const [a, b] = pc.grain.map(t);
      poly([a, b], 'mark');
      arrowHeads(a, b).forEach((h) => poly(h, 'mark'));
      fixtures.push(lineBox(a, b, 0.8));
      const u = unit(sub(pc.grain[1], pc.grain[0]));
      const rot = (Math.atan2(u.y, u.x) * 180) / Math.PI;
      lab(text(tl(add(lerp(pc.grain[0], pc.grain[1], 0.5), mul(p(-u.y, u.x), -0.6)), 0.7, rot), 'GRAIN', 0.7, rot, 'middle', { face: 'label', tracking: 0.2 }), 1, 0.2, [a, b]);
    }
    if (pc.fold) {
      // Top to bottom on the sheet; a turned piece has its fold edge on the right, so the bracket
      // reaches in to the left and its label reads up the piece.
      const [a, b] = pc.fold.map(t).sort((q, r) => q.y - r.y);
      const side = turned ? -1 : 1;
      // The bracket reaches 2 cm into the piece, less on a narrow one (a fly shield), so its label
      // and the grain arrow have room beside it.
      const xs = stitch.map((q) => q.x);
      const reach = Math.max(0.8, Math.min(2, (Math.max(...xs) - Math.min(...xs)) / 4));
      const inset = p(side * reach, 0);
      const long = b.y - a.y > 9;
      poly([a, add(a, inset), add(b, inset), b], 'mark');
      if (long) {
        arrowHeads(add(add(a, mul(inset, 0.5)), p(0, 1)), sub(add(b, mul(inset, 0.5)), p(0, 1)), 0.9).forEach((h) => poly(h, 'mark'));
      }
      fixtures.push({ c: lerp(add(a, mul(inset, 0.5)), add(b, mul(inset, 0.5)), 0.5), u: p(0, 1), n: p(1, 0), hw: (b.y - a.y) / 2, hh: reach / 2 });
      lab(text(p(a.x + side * (reach + 0.6), (a.y + b.y) / 2), long ? 'PLACE ON FOLD' : 'FOLD', 0.7, side * 90, 'middle', { face: 'label', tracking: 0.2 }), 1, 0.2, [a, b]);
    }
    order = { piece, step: 'labels' };
    allNotches(pc).forEach(([pt, d]) => poly(notchSlit(pc, pt, d).map(t), 'notch'));
    // Facings are too narrow for seam names; their notches and the garment's own labels say it.
    if (pc.kind !== 'facing') edgeLabels(pc).forEach((l) => lab(text(tl(l.at, 0.45, l.rotate), l.text, 0.45, l.rotate, 'middle', { face: 'label', tracking: 0.12, grey: 0.3 }), 3, 0.12));
    const name = pc.name.toUpperCase();
    const fabric = FABRIC_NOTES.reduce((s, [re, to]) => s.replace(re, to), pc.fabric ?? 'Self fabric').toUpperCase();
    // Cutting words a piece carries beyond its count ("Cut 1 on fold, stretch along it") go in the
    // information block in place of the count.
    const isCut = (x: string) => x.toLowerCase().startsWith(pc.cut.toLowerCase());
    const cutWords = pc.labels.map((l) => l.text).filter(isCut).sort((a, b) => b.length - a.length)[0] ?? pc.cut;
    pc.labels.forEach((l) => {
      const rot = l.rotate ?? 0;
      if (info && isCut(l.text)) return; // part of the information block
      if (info && l.text === name) {
        // The piece's information block: name, piece number and cutting, the pattern and its owner.
        // Small finishing pieces carry just the first line. It is fitted to the piece: lines too long
        // for it are broken at their separators, a name too long goes on two lines (smaller if it
        // must), a band too shallow for the block takes it as one row, and the block moves clear of
        // the seam names and the grain and fold marks.
        const size = pc.kind ? 0.42 : 0.5;
        const u = turn(p(1, 0), rot);
        const n = turn(p(0, 1), rot);
        const at0 = tl(l.at, l.size, rot);
        // The room along the text, clear of the fold and grain marks beside it, and across it, clear
        // of a grain arrow running along it.
        const span = stitch.map((q) => dot(sub(q, at0), u));
        const deep = stitch.map((q) => dot(sub(q, at0), n));
        const holesU: [number, number][] = [];
        const holesN: [number, number][] = [];
        for (const o of [...fixtures, ...labs.filter((x) => x.rank === 1).map((x) => x.box)]) {
          const halfN = o.hw * Math.abs(dot(o.u, n)) + o.hh * Math.abs(dot(o.n, n));
          const halfU = o.hw * Math.abs(dot(o.u, u)) + o.hh * Math.abs(dot(o.n, u));
          const cN = dot(sub(o.c, at0), n);
          const cU = dot(sub(o.c, at0), u);
          if (Math.abs(dot(o.u, u)) > 0.5) holesN.push([cN - halfN - LABEL_GAP, cN + halfN + LABEL_GAP]);
          else if (Math.abs(cN) <= halfN + 1.5) holesU.push([cU - halfU - LABEL_GAP, cU + halfU + LABEL_GAP]);
        }
        const run = freeRun(Math.min(...span) + 0.5, Math.max(...span) - 0.5, holesU, 0);
        const free = Math.max(4, run[1] - run[0]);
        const band = freeRun(Math.min(...deep) + 0.25, Math.max(...deep) - 0.25, holesN, 0);
        const room = band[1] - band[0];
        const width = (lines: string[], sz: number) => Math.max(...lines.map((x) => textWidth(x, sz, 0.12)));
        // The name on one line, or two when the piece is too narrow for it: a finishing piece, or a
        // garment piece the name would not fit across at all.
        let nameSize = l.size;
        let nameLines = [name];
        const tight = !!pc.kind || width(nameLines, nameSize) > Math.max(...span) - Math.min(...span) - 1;
        if (tight && width(nameLines, nameSize) > free && name.includes(' ')) {
          const words = name.split(' ');
          let split = 1;
          for (let k = 2; k < words.length; k++)
            if (width([words.slice(0, k).join(' '), words.slice(k).join(' ')], nameSize) < width([words.slice(0, split).join(' '), words.slice(split).join(' ')], nameSize)) split = k;
          nameLines = [words.slice(0, split).join(' '), words.slice(split).join(' ')];
        }
        while (tight && width(nameLines, nameSize) > free && nameSize > 0.5) nameSize = Math.max(0.5, nameSize - 0.05);
        const infoLine = `${pc.kind ? `PIECE ${piece + 1}/${pieces.length}` : `PIECE ${piece + 1} OF ${pieces.length}`} · ${cutWords.toUpperCase()} · ${fabric}`;
        const extras = [
          ...(pc.alternate ? [`TRIM YOUR ${pc.alternate.label.split(' ')[0]} SIDE TO THE ${pc.alternate.label} LINE`] : []),
          ...(pc.kind
            ? []
            : [info.pattern.toUpperCase(), [info.madeFor && `MADE FOR ${info.madeFor}`, info.date, info.edition].filter(Boolean).join(' · ').toUpperCase()]),
        ].filter(Boolean);
        const trace = pc.meta.threadTrace ? 'THREAD-TRACE THE STITCHING LINE' : '';
        const obstacles = [...fixtures, ...labs.filter((x) => x.rank !== 2).map((x) => x.box)];
        let lines: string[] = [];
        let row = '';
        let nameAt = at0;
        let block: Box = textBox(at0, name, nameSize, rot, 0.12);
        let shift = p(0, 0);
        // The lines are wrapped to the room beside the marks; when the block then fits nowhere on
        // the piece (a narrow sleeve), or only across a line drawn on it (a collar's roll line),
        // they are wrapped tighter and the search is made again, and the best of the tries kept.
        const nameW0 = width([name], nameSize);
        const nameSize0 = nameSize;
        const nameLines0 = nameLines;
        type Try = { bestS: number; shift: P; lines: string[]; row: string; nameAt: P; block: Box; nameLines: string[]; nameSize: number };
        let kept: Try | undefined;
        for (const wrapTo of [...new Set([free, Math.max(nameW0, Math.min(free, 8)), Math.max(nameW0, Math.min(free, 6))])]) {
          nameSize = nameSize0;
          nameLines = nameLines0;
          row = '';
          const infoLines = wrapInfo(infoLine, size, 0.12, wrapTo);
          // Wrapped tight, the information line gives up its fabric: it goes on in words instead.
          const parts = infoLine.split(' · ');
          if (infoLines.flatMap((x) => x.split(' · ')).length < parts.length)
            infoLines.push(...wrapWords(ABBREVIATIONS.reduce((s, [re, to]) => s.replace(re, to), parts[parts.length - 1]), size, 0.12, wrapTo));
          lines = [...infoLines, ...extras.flatMap((e) => wrapWords(e, size, 0.12, wrapTo))];
          // The lines' baselines down from the name's, and the block's extent across the text.
          const lead = nameSize * 1.15;
          const stacked = () => {
            const topN = trace ? -nameSize * 1.2 - 0.45 * 0.75 : -nameSize * 0.75;
            const last = lead * (nameLines.length - 1);
            const botN = last + (lines.length ? nameSize * 0.45 + 0.72 * lines.length + 0.1 : nameSize * 0.15);
            return { topN, botN };
          };
          // A band too shallow for the stacked block takes the name and its cutting as one row.
          if (stacked().botN - stacked().topN + 0.3 > room) {
            nameLines = [name];
            const fit = (avail: number) => fitRow(infoLine, size, 0.12, avail);
            row = fit(free - width(nameLines, nameSize) - 0.8);
            while (width(nameLines, nameSize) + 0.8 + textWidth(row, size, 0.12) > free && nameSize > 0.5) {
              nameSize = Math.max(0.5, nameSize - 0.05);
              row = fit(free - width(nameLines, nameSize) - 0.8);
            }
            lines = [];
          }
          const rowW = row ? textWidth(row, size, 0.12) : 0;
          const nameW = width(nameLines, nameSize);
          const widest = row ? nameW + 0.8 + rowW : Math.max(nameW, ...lines.map((ln) => textWidth(ln, size, 0.12)));
          // Centre the block in the room it has; a block wider than that stays put.
          let du = 0;
          if (widest < run[1] - run[0]) du = Math.max(run[0] + widest / 2, Math.min(run[1] - widest / 2, 0));
          nameAt = add(at0, mul(u, du));
          const { topN, botN } = stacked();
          block = { c: add(nameAt, mul(n, (topN + botN) / 2)), u, n, hw: widest / 2 + 0.15, hh: (botN - topN) / 2 + 0.15 };
          // The nearest shift that keeps the block on the piece, off the marks and clear of the lines
          // drawn across the piece: tried close by at a fine step, then over the whole piece, and
          // failing both, the spot that overlaps least (a line crossed counts for less than a label).
          const bx0 = block;
          const score = (d: P) => {
            const bx = shifted(bx0, d);
            return (
              (within({ ...bx, hw: bx.hw - 0.15, hh: bx.hh - 0.15 }, stitch) ? 0 : 1e4) +
              obstacles.filter((o) => overlaps(o, bx)).length * 100 +
              marks.filter((ln) => crossesLine(bx, ln)).length * 50
            );
          };
          shift = p(0, 0);
          let bestS = score(shift);
          if (bestS > 0) {
            const consider = (dux: number, dn: number) => {
              const d = add(mul(u, dux), mul(n, dn));
              const s = score(d) + Math.hypot(dux, dn * 1.2) / 100;
              if (s < bestS) {
                bestS = s;
                shift = d;
              }
            };
            for (let dn = -6; dn <= 6; dn += 0.25) for (let dux = -12; dux <= 12; dux += 0.5) consider(dux, dn);
            if (bestS >= 50) {
              const uLo = Math.min(...span) + block.hw - dot(sub(block.c, at0), u);
              const uHi = Math.max(...span) - block.hw - dot(sub(block.c, at0), u);
              const nLo = Math.min(...deep) + block.hh - dot(sub(block.c, at0), n);
              const nHi = Math.max(...deep) - block.hh - dot(sub(block.c, at0), n);
              for (let dn = nLo; dn <= nHi; dn += 0.5) for (let dux = uLo; dux <= uHi; dux += 1) consider(dux, dn);
            }
          }
          if (!kept || bestS < kept.bestS) kept = { bestS, shift, lines, row, nameAt, block, nameLines, nameSize };
          if (bestS < 50 || row) break;
        }
        ({ shift, lines, row, nameAt, block, nameLines, nameSize } = kept!);
        const lead = nameSize * 1.15;
        const nameW = width(nameLines, nameSize);
        const rowW = row ? textWidth(row, size, 0.12) : 0;
        const place = (q: P) => add(q, shift);
        const lineAt = (k: number) => add(nameAt, mul(n, lead * (nameLines.length - 1) + nameSize * 0.45 + 0.72 * (k + 1)));
        nameLines.forEach((ln, k) => lab(text(place(add(nameAt, mul(n, lead * k))), ln, nameSize, rot, 'middle', { face: 'label', tracking: 0.12 }), 0, 0.12));
        if (row) {
          // The name to the left, its cutting to the right, on one baseline.
          const half = (nameW + 0.8 + rowW) / 2;
          const nameMid = add(nameAt, mul(u, nameW / 2 - half));
          const rowMid = add(nameAt, mul(u, half - rowW / 2));
          labs[labs.length - 1].prim.at = place(nameMid);
          labs[labs.length - 1].box = textBox(place(nameMid), name, nameSize, rot, 0.12);
          lab(text(place(rowMid), row, size, rot, 'middle', { face: 'label', tracking: 0.12 }), 0, 0.12);
        }
        lines.forEach((ln, k) =>
          lab(text(place(lineAt(k)), ln, size, rot, 'middle', { face: 'label', tracking: 0.12, grey: k ? 0.35 : 0 }), 0, 0.12),
        );
        if (trace) lab(text(place(add(nameAt, mul(n, -nameSize * 1.2))), trace, 0.45, rot, 'middle', { face: 'label', tracking: 0.15, grey: 0.35 }), 0, 0.15);
        return;
      }
      lab(text(tl(l.at, l.size, rot), l.text, l.size, rot, 'middle', { face: 'label', tracking: 0.1 }), l.text === name ? 0 : 2, 0.1);
    });
    if (pc.meta.threadTrace && !info) {
      const l = pc.labels[0];
      if (l) lab(text(t(add(l.at, turn(p(0, -l.size * 1.2), l.rotate ?? 0))), 'THREAD-TRACE THE STITCHING LINE', 0.45, l.rotate ?? 0, 'middle', { face: 'label', tracking: 0.15, grey: 0.35 }), 2, 0.15);
    }
    settle(labs, stitch, marks);
    // A seam name left with no room is left off: the notches and the garment's own labels say it.
    for (const l of [...labs].reverse()) {
      if (l.rank !== 3 || !labs.some((o) => o !== l && overlaps(o.box, l.box))) continue;
      labs.splice(labs.indexOf(l), 1);
      prims.splice(prims.indexOf(l.prim), 1);
    }
    order = {};
  });

  // 10 cm test square so a printed copy can be checked for scale. It sits in the title block
  // rather than under the pieces, which would often add a whole extra row of pages.
  const sq = p(MARGIN, MARGIN);
  poly([sq, add(sq, p(10, 0)), add(sq, p(10, 10)), add(sq, p(0, 10))], 'stitchSolid', true);
  text(add(sq, p(5, 4.9)), '10 CM', 0.8, 0, 'middle', { face: 'label', tracking: 0.25 });
  text(add(sq, p(5, 5.9)), 'TEST SQUARE', 0.45, 0, 'middle', { face: 'label', tracking: 0.25, grey: 0.35 });

  // The title block, framed like an atelier's pattern card.
  const tx = MARGIN + 10;
  poly([p(tx, MARGIN), p(tx + TITLE_W, MARGIN), p(tx + TITLE_W, MARGIN + 10), p(tx, MARGIN + 10)], 'mark', true);
  poly([p(tx, MARGIN + 4.4), p(tx + TITLE_W, MARGIN + 4.4)], 'fine');
  const who = info ? [info.madeFor && `MADE FOR ${info.madeFor}`, info.date, info.edition].filter(Boolean) : [];
  text(p(tx + 1.2, MARGIN + 1.5), ['MAISON TRACÉ', ...who].join('   ·   ').toUpperCase(), 0.5, 0, 'start', { face: 'label', tracking: 0.3, grey: 0.35 });
  const name = title.replace(/^Maison Tracé:\s*/, '');
  text(p(tx + 1.2, MARGIN + 3.3), name.charAt(0).toUpperCase() + name.slice(1), 1.3, 0, 'start', { face: 'bodyMedium' });
  [...(info?.credit ? [info.credit] : []), ...notes].forEach((line, i) => text(p(tx + 1.2, MARGIN + 5.6 + i * 1.0), line, 0.6, 0, 'start', { face: 'body' }));

  return { prims, width: Math.max(packed.width, TITLE_BLOCK.w) + 2 * MARGIN, height: Math.max(packed.height, TITLE_BLOCK.h) + 2 * MARGIN };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function toSvg(sheet: Sheet): string {
  const { width: w, height: h } = sheet;
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${(w * 10).toFixed(1)}mm" height="${(h * 10).toFixed(1)}mm" viewBox="0 0 ${w.toFixed(3)} ${h.toFixed(3)}">`,
    `<rect width="${w.toFixed(3)}" height="${h.toFixed(3)}" fill="white"/>`,
  ];
  for (const pr of sheet.prims) {
    if (pr.kind === 'poly') {
      const st = STYLES[pr.style];
      const tag = pr.closed ? 'polygon' : 'polyline';
      const dash = st.dash ? ` stroke-dasharray="${st.dash.join(' ')}"` : '';
      const g = Math.round(st.grey * 255).toString(16).padStart(2, '0');
      const pts = pr.pts.map((q) => `${q.x.toFixed(3)},${q.y.toFixed(3)}`).join(' ');
      out.push(
        `<${tag} points="${pts}" fill="none" stroke="#${g}${g}${g}" stroke-width="${st.width}" stroke-linejoin="round"${dash}/>`,
      );
    } else {
      const tr = pr.rotate ? ` transform="rotate(${pr.rotate} ${pr.at.x.toFixed(3)} ${pr.at.y.toFixed(3)})"` : '';
      const face = pr.face ?? 'body';
      const weight = face === 'label' ? 600 : face === 'bodyMedium' ? 500 : 400;
      const g = Math.round((pr.grey ?? 0) * 255).toString(16).padStart(2, '0');
      const track = pr.tracking ? ` letter-spacing="${(pr.tracking * pr.size).toFixed(3)}"` : '';
      out.push(
        `<text x="${pr.at.x.toFixed(3)}" y="${pr.at.y.toFixed(3)}" font-family="${FONT_FAMILY[face]}" font-weight="${weight}" font-size="${pr.size}" fill="#${g}${g}${g}" text-anchor="${pr.anchor}"${track}${tr}>${esc(pr.text)}</text>`,
      );
    }
  }
  out.push('</svg>');
  return out.join('\n');
}

export type Paper = 'a4' | 'letter' | 'a0';

export const PAPER_CM: Record<Paper, [number, number]> = {
  a4: [21.0, 29.7],
  letter: [21.59, 27.94],
  a0: [84.1, 118.9],
};

export const PAGE_MARGIN = 1; // printer-safe margin, cm
export const OVERLAP = 1; // cm shared by neighbouring pages for taping

/** Page size for a sheet: home paper is always portrait; a copy-shop A0 turns sideways when that takes fewer sheets. */
export function pageSize(sheet: Sheet, paper: Paper): [number, number] {
  const [w, h] = PAPER_CM[paper];
  if (paper !== 'a0') return [w, h];
  const count = (pw: number, ph: number) => grid(sheet, pw, ph).rows * grid(sheet, pw, ph).cols;
  return count(h, w) < count(w, h) ? [h, w] : [w, h];
}

function grid(sheet: Sheet, pw: number, ph: number) {
  const stepX = pw - 2 * PAGE_MARGIN - OVERLAP;
  const stepY = ph - 2 * PAGE_MARGIN - OVERLAP;
  return {
    cols: Math.max(1, Math.ceil((sheet.width - OVERLAP) / stepX)),
    rows: Math.max(1, Math.ceil((sheet.height - OVERLAP) / stepY)),
  };
}

export function tileGrid(sheet: Sheet, paper: Paper): { rows: number; cols: number } {
  const [pw, ph] = pageSize(sheet, paper);
  return grid(sheet, pw, ph);
}

/** True when anything is drawn in the region (x, y, w, h) of the sheet. */
function inked(sheet: Sheet, x: number, y: number, w: number, h: number): boolean {
  return sheet.prims.some((pr) => {
    if (pr.kind === 'text') return pr.at.x > x - 1 && pr.at.x < x + w + 1 && pr.at.y > y && pr.at.y < y + h + pr.size;
    // Any vertex inside, or any edge crossing the region's middle lines, puts ink on the page.
    const pts = pr.closed ? [...pr.pts, pr.pts[0]] : pr.pts;
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i];
      if (q.x >= x && q.x <= x + w && q.y >= y && q.y <= y + h) return true;
      if (i === 0) continue;
      const a = pts[i - 1];
      const lo = { x: Math.min(a.x, q.x), y: Math.min(a.y, q.y) };
      const hi = { x: Math.max(a.x, q.x), y: Math.max(a.y, q.y) };
      if (hi.x < x || lo.x > x + w || hi.y < y || lo.y > y + h) continue;
      return true; // close enough: a segment's box overlapping the page almost always crosses it
    }
    return false;
  });
}

/** Which tiles have something on them. Blank ones aren't printed, which saves paper on a wide layout. */
export function usedTiles(sheet: Sheet, paper: Paper): boolean[][] {
  const [pw, ph] = pageSize(sheet, paper);
  const tw = pw - 2 * PAGE_MARGIN;
  const th = ph - 2 * PAGE_MARGIN;
  const { rows, cols } = tileGrid(sheet, paper);
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => inked(sheet, c * (tw - OVERLAP), r * (th - OVERLAP), tw, th)),
  );
}

export const pageCount = (sheet: Sheet, paper: Paper) => usedTiles(sheet, paper).flat().filter(Boolean).length;

/** Page name used on the tiles and the assembly map: row letter, column number. */
export const pageName = (r: number, c: number) => `${String.fromCharCode(65 + r)}${c + 1}`;
