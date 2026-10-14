// Lay out pieces and export them at true scale: SVG and tiled PDF for home printing.
import { P, add, mul, p, sub, unit } from './geometry';
import { Piece, bounds, cutLine } from './piece';

const GAP = 4; // cm between pieces
const MARGIN = 3; // cm around the sheet

export type LineStyle = 'cut' | 'stitch' | 'stitchSolid' | 'mark' | 'notch';

/** Drafting order, for showing a pattern being drawn: the stitching line, darts, grain and fold
 * marks, seam allowance, then notches and labels. */
export type DraftStep = 'outline' | 'darts' | 'grain' | 'allowance' | 'labels';
type Order = { piece?: number; step?: DraftStep };

export type Prim =
  | ({ kind: 'poly'; pts: P[]; style: LineStyle; closed: boolean } & Order)
  | ({ kind: 'text'; at: P; text: string; size: number; rotate: number; anchor: 'middle' | 'start' } & Order);

export interface Sheet {
  prims: Prim[];
  width: number; // cm
  height: number; // cm
}

export const STYLES: Record<LineStyle, { width: number; dash?: [number, number]; grey: number }> = {
  cut: { width: 0.05, grey: 0 },
  stitch: { width: 0.025, dash: [0.4, 0.25], grey: 0.35 },
  stitchSolid: { width: 0.03, grey: 0 },
  mark: { width: 0.03, grey: 0.1 },
  notch: { width: 0.05, grey: 0 },
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

export function layout(pieces: Piece[], title: string, notes: string[]): Sheet {
  const prims: Prim[] = [];
  let order: Order = {};
  const poly = (pts: P[], style: LineStyle, closed = false) => prims.push({ kind: 'poly', pts, style, closed, ...order });
  const text = (at: P, t: string, size: number, rotate = 0, anchor: 'middle' | 'start' = 'middle') =>
    prims.push({ kind: 'text', at, text: t, size, rotate, anchor, ...order });

  let x = MARGIN;
  // Title block: the 10 cm test square at top left, title and notes beside it.
  const top = MARGIN + 10 + GAP;
  let height = 0;
  pieces.forEach((pc, piece) => {
    const [x0, y0, x1, y1] = bounds(pc);
    const off = p(x - x0, top - y0);
    const t = (q: P) => add(q, off);
    order = { piece, step: 'allowance' };
    poly(cutLine(pc).map(t), 'cut', true);
    order = { piece, step: 'outline' };
    poly(pc.outline.points().map(t), 'stitch', true);
    order = { piece, step: 'darts' };
    pc.lines.forEach((ln) => poly(ln.points().map(t), 'mark'));
    order = { piece, step: 'grain' };
    if (pc.grain) {
      const [a, b] = pc.grain.map(t);
      poly([a, b], 'mark');
      arrowHeads(a, b).forEach((h) => poly(h, 'mark'));
      text(t(p(pc.grain[0].x + 0.6, (pc.grain[0].y + pc.grain[1].y) / 2)), 'GRAIN', 0.8, 90);
    }
    if (pc.fold) {
      const [a, b] = pc.fold.map(t);
      const inset = p(2, 0);
      poly([a, add(a, inset), add(b, inset), b], 'mark');
      arrowHeads(add(add(a, mul(inset, 0.5)), p(0, 1)), sub(add(b, mul(inset, 0.5)), p(0, 1)), 0.9).forEach((h) =>
        poly(h, 'mark'),
      );
      text(t(p(pc.fold[0].x + 2.6, (pc.fold[0].y + pc.fold[1].y) / 2)), 'PLACE ON FOLD', 0.8, 90);
    }
    order = { piece, step: 'labels' };
    pc.notches.forEach(([pt, d]) => poly([t(pt), t(add(pt, mul(unit(d), pc.seamAllowance)))], 'notch'));
    pc.labels.forEach((l) => text(t(l.at), l.text, l.size));
    order = {};
    x += x1 - x0 + GAP;
    height = Math.max(height, y1 - y0);
  });

  // 10 cm test square so a printed copy can be checked for scale. It sits in the title block
  // rather than under the pieces, which would often add a whole extra row of pages.
  const sq = p(MARGIN, MARGIN);
  poly([sq, add(sq, p(10, 0)), add(sq, p(10, 10)), add(sq, p(0, 10))], 'stitchSolid', true);
  text(add(sq, p(5, 5.4)), '10 cm test square', 0.7);

  const tx = MARGIN + 10 + 2;
  text(p(tx, MARGIN + 1.5), title, 1.6, 0, 'start');
  notes.forEach((line, i) => text(p(tx, MARGIN + 3.3 + i * 1.1), line, 0.8, 0, 'start'));

  return { prims, width: Math.max(x - GAP + MARGIN, 60), height: top + height + MARGIN };
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
      const dash = st.dash ? ` stroke-dasharray="${st.dash[0]} ${st.dash[1]}"` : '';
      const g = Math.round(st.grey * 255).toString(16).padStart(2, '0');
      const pts = pr.pts.map((q) => `${q.x.toFixed(3)},${q.y.toFixed(3)}`).join(' ');
      out.push(
        `<${tag} points="${pts}" fill="none" stroke="#${g}${g}${g}" stroke-width="${st.width}" stroke-linejoin="round"${dash}/>`,
      );
    } else {
      const tr = pr.rotate ? ` transform="rotate(${pr.rotate} ${pr.at.x.toFixed(3)} ${pr.at.y.toFixed(3)})"` : '';
      out.push(
        `<text x="${pr.at.x.toFixed(3)}" y="${pr.at.y.toFixed(3)}" font-family="Helvetica, Arial, sans-serif" font-size="${pr.size}" text-anchor="${pr.anchor}"${tr}>${esc(pr.text)}</text>`,
      );
    }
  }
  out.push('</svg>');
  return out.join('\n');
}

export type Paper = 'a4' | 'letter';

export const PAPER_CM: Record<Paper, [number, number]> = {
  a4: [21.0, 29.7],
  letter: [21.59, 27.94],
};

export const PAGE_MARGIN = 1; // printer-safe margin, cm
export const OVERLAP = 1; // cm shared by neighbouring pages for taping

export function tileGrid(sheet: Sheet, paper: Paper): { rows: number; cols: number } {
  const [pw, ph] = PAPER_CM[paper];
  const stepX = pw - 2 * PAGE_MARGIN - OVERLAP;
  const stepY = ph - 2 * PAGE_MARGIN - OVERLAP;
  return {
    cols: Math.ceil((sheet.width - OVERLAP) / stepX),
    rows: Math.ceil((sheet.height - OVERLAP) / stepY),
  };
}

