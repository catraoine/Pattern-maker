// Lay out pieces and export them at true scale: SVG and tiled PDF for home printing.
import { P, add, lerp, mul, p, sub, unit } from './geometry';
import { allNotches, drillHoles, edgeLabels, notchSlit } from './marks';
import { Piece, bounds, cutLine } from './piece';

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
  ) => prims.push({ kind: 'text', at, text: t, size, rotate, anchor, ...opts, ...order });

  // Title block: the 10 cm test square at top left, title and notes beside it.
  const top = MARGIN + 10 + GAP;
  // Pieces go left to right. A piece short enough to fit under the one before it, in the height the
  // row already takes, stacks there instead (facings, a waistband), which keeps the sheet compact.
  let x = MARGIN;
  let height = 0;
  let col = { x: MARGIN, width: 0, used: 0 };
  pieces.forEach((pc, piece) => {
    const [x0, y0, x1, y1] = bounds(pc);
    const w = x1 - x0;
    const h = y1 - y0;
    let at: P;
    if (piece > 0 && col.used + GAP + h <= height) {
      at = p(col.x, top + col.used + GAP);
      col.used += GAP + h;
      col.width = Math.max(col.width, w);
    } else {
      at = p(x, top);
      col = { x, width: w, used: h };
    }
    x = col.x + col.width + GAP;
    height = Math.max(height, h);
    const off = sub(at, p(x0, y0));
    const t = (q: P) => add(q, off);
    order = { piece, step: 'allowance' };
    poly(cutLine(pc).map(t), 'cut', true);
    order = { piece, step: 'outline' };
    // A couture pattern is thread-traced along the stitching line, so it is drawn solid.
    poly(pc.outline.points().map(t), pc.meta.threadTrace ? 'stitchSolid' : 'stitch', true);
    // A second line for one side of the body: drawn only where it leaves the main one, and named
    // between the two lines.
    if (pc.alternate) {
      const stitch = leaving(pc.alternate.outline.points(), pc.outline.points());
      stitch.forEach((run) => poly(run.map(t), pc.meta.threadTrace ? 'stitchSolid' : 'stitch'));
      leaving(cutLine(pc, pc.alternate.outline), cutLine(pc)).forEach((run) => poly(run.map(t), 'cut'));
      const run = stitch[0];
      if (run && run.length > 1) {
        const k = Math.floor(run.length / 2);
        const at = run[k];
        const near = nearest(at, pc.outline.points());
        const u = unit(sub(run[Math.min(run.length - 1, k + 1)], run[Math.max(0, k - 1)]));
        let rot = (Math.atan2(u.y, u.x) * 180) / Math.PI;
        if (rot > 90) rot -= 180;
        if (rot <= -90) rot += 180;
        text(t(add(lerp(at, near, 0.5), p(0, 0.18))), `${pc.alternate.label} LINE`, 0.45, rot, 'middle', { face: 'label', tracking: 0.12 });
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
    pc.lines.forEach((ln) => poly(ln.points().map(t), 'mark'));
    drillHoles(pc).forEach((h) => drill(t(h)).forEach((ring) => poly(ring, 'mark')));
    order = { piece, step: 'grain' };
    (pc.balance ?? []).forEach((b) => {
      poly(b.pts.map(t), 'fine');
      const [a, c] = [b.pts[0], b.pts[b.pts.length - 1]];
      const u = unit(sub(c, a));
      const rot = (Math.atan2(u.y, u.x) * 180) / Math.PI;
      text(t(add(lerp(a, c, 0.75), mul(p(u.y, -u.x), 0.35))), b.label, 0.5, rot, 'middle', { face: 'label', tracking: 0.15, grey: 0.35 });
    });
    if (pc.grain) {
      const [a, b] = pc.grain.map(t);
      poly([a, b], 'mark');
      arrowHeads(a, b).forEach((h) => poly(h, 'mark'));
      const u = unit(sub(pc.grain[1], pc.grain[0]));
      const rot = (Math.atan2(u.y, u.x) * 180) / Math.PI;
      text(t(add(lerp(pc.grain[0], pc.grain[1], 0.5), mul(p(-u.y, u.x), -0.6))), 'GRAIN', 0.7, rot, 'middle', { face: 'label', tracking: 0.2 });
    }
    if (pc.fold) {
      const [a, b] = pc.fold.map(t);
      const inset = p(2, 0);
      const long = b.y - a.y > 9;
      poly([a, add(a, inset), add(b, inset), b], 'mark');
      if (long) {
        arrowHeads(add(add(a, mul(inset, 0.5)), p(0, 1)), sub(add(b, mul(inset, 0.5)), p(0, 1)), 0.9).forEach((h) => poly(h, 'mark'));
      }
      text(t(p(pc.fold[0].x + 2.6, (pc.fold[0].y + pc.fold[1].y) / 2)), long ? 'PLACE ON FOLD' : 'FOLD', 0.7, 90, 'middle', { face: 'label', tracking: 0.2 });
    }
    order = { piece, step: 'labels' };
    allNotches(pc).forEach(([pt, d]) => poly(notchSlit(pc, pt, d).map(t), 'notch'));
    // Facings are too narrow for seam names; their notches and the garment's own labels say it.
    if (pc.kind !== 'facing') edgeLabels(pc).forEach((l) => text(t(l.at), l.text, 0.45, l.rotate, 'middle', { face: 'label', tracking: 0.12, grey: 0.3 }));
    const name = pc.name.toUpperCase();
    const fabric = (pc.fabric ?? 'Self fabric').toUpperCase();
    pc.labels.forEach((l) => {
      const rot = l.rotate ?? 0;
      if (info && l.text === pc.cut) return; // part of the information block
      if (info && l.text === name) {
        // The piece's information block: name, piece number and cutting, the pattern and its owner.
        // Small finishing pieces carry just the first line.
        const lines = [
          `${pc.kind ? `PIECE ${piece + 1}/${pieces.length}` : `PIECE ${piece + 1} OF ${pieces.length}`} · ${pc.cut.toUpperCase()} · ${fabric}`,
          ...(pc.alternate ? [`TRIM YOUR ${pc.alternate.label.split(' ')[0]} SIDE TO THE ${pc.alternate.label} LINE`] : []),
          ...(pc.kind
            ? []
            : [info.pattern.toUpperCase(), [info.madeFor && `MADE FOR ${info.madeFor}`, info.date, info.edition].filter(Boolean).join(' · ').toUpperCase()]),
        ].filter(Boolean);
        text(t(l.at), name, l.size, rot, 'middle', { face: 'label', tracking: 0.12 });
        lines.forEach((ln, i) =>
          text(t(add(l.at, turn(p(0, l.size * 0.45 + 0.72 * (i + 1)), rot))), ln, pc.kind ? 0.42 : 0.5, rot, 'middle', {
            face: 'label',
            tracking: 0.12,
            grey: i ? 0.35 : 0,
          }),
        );
        return;
      }
      text(t(l.at), l.text, l.size, rot, 'middle', { face: 'label', tracking: 0.1 });
    });
    if (pc.meta.threadTrace) {
      const l = pc.labels[0];
      if (l) text(t(add(l.at, turn(p(0, -l.size * 1.2), l.rotate ?? 0))), 'THREAD-TRACE THE STITCHING LINE', 0.45, l.rotate ?? 0, 'middle', { face: 'label', tracking: 0.15, grey: 0.35 });
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

  return { prims, width: Math.max(x - GAP + MARGIN, tx + TITLE_W + MARGIN), height: top + height + MARGIN };
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
