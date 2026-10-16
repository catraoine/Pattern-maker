// Small step diagrams for the sewing guide, in the Contour Line style: a few fine lines on a
// 40 x 24 box. Plain data, so the app draws them as SVG and the PDF draws the same lines.
import { P, add, lerp, mul, p, sub, unit } from './geometry';

export type DiagramId =
  | 'trace'
  | 'staystitch'
  | 'baste'
  | 'press'
  | 'pickzip'
  | 'french'
  | 'hongkong'
  | 'pinked'
  | 'overcast'
  | 'overlock'
  | 'understitch'
  | 'slipstitch'
  | 'catch';

/**
 * cloth: the fabric, filled. fold: a second layer or a turned-back edge, filled a little lighter.
 * edge: a cut or folded edge, or a seam. machine: machine stitching. hand: hand stitches, drawn one
 * by one. thread: tacking thread, in long stitches. under: something underneath, seen through.
 */
export type PartKind = 'cloth' | 'fold' | 'edge' | 'machine' | 'hand' | 'thread' | 'under';

export interface DiagramPart {
  pts: P[];
  kind: PartKind;
  closed?: boolean;
}

export interface Diagram {
  w: number;
  h: number;
  parts: DiagramPart[];
  /** What it shows, for screen readers and under the drawing in print. */
  caption: string;
}

const W = 40;
const H = 24;

const rect = (x0: number, y0: number, x1: number, y1: number, kind: PartKind = 'cloth'): DiagramPart => ({
  pts: [p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)],
  kind,
  closed: true,
});
const line = (kind: PartKind, ...pts: P[]): DiagramPart => ({ pts, kind });

/** A quadratic curve through `c`'s pull, as points. */
function curve(a: P, c: P, b: P, n = 16): P[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return lerp(lerp(a, c, t), lerp(c, b, t), t);
  });
}

/** An arrowhead at the end of a run, pointing along it. */
function arrow(pts: P[], kind: PartKind = 'edge'): DiagramPart[] {
  const tip = pts[pts.length - 1];
  const u = unit(sub(tip, pts[pts.length - 2]));
  const n = p(-u.y, u.x);
  return [line(kind, ...pts), line(kind, add(add(tip, mul(u, -1.2)), mul(n, 0.7)), tip, add(add(tip, mul(u, -1.2)), mul(n, -0.7)))];
}

/** Hand stitches: short separate strokes from each point of `from` to the matching point of `to`. */
const strokes = (from: P[], to: P[]): DiagramPart[] => from.map((a, i) => line('hand', a, to[i]));

const range = (a: number, b: number, step: number) => Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => a + i * step);

/** A seam pressed open, seen from the inside: the two allowances either side of the seam line. */
function pressedOpen(edge: (x: number, side: -1 | 1) => DiagramPart[]): DiagramPart[] {
  return [rect(2, 2, 38, 22), rect(13, 2, 27, 22, 'fold'), line('edge', p(20, 2), p(20, 22)), ...edge(13, -1), ...edge(27, 1)];
}

export const DIAGRAMS: Record<DiagramId, Diagram> = {
  trace: {
    w: W,
    h: H,
    caption: 'Thread tracing: long tacking stitches along the stitching line and the dart, with a tailor\'s tack at the point.',
    parts: [
      rect(2, 3, 38, 21),
      line('thread', p(4, 17), p(36, 17)),
      line('thread', p(13, 17), p(17, 6.5), p(21, 17)),
      { pts: curve(p(16.3, 6.5), p(17, 4.2), p(17.7, 6.5), 6), kind: 'hand' },
      { pts: curve(p(16.5, 6.6), p(17, 8.4), p(17.5, 6.6), 6), kind: 'hand' },
    ],
  },
  staystitch: {
    w: W,
    h: H,
    caption: 'Staystitching: a line of machine stitches just inside the curve, sewn from the shoulder toward the centre.',
    parts: [
      { pts: [p(2, 22), p(2, 4), ...curve(p(2, 4), p(20, 22), p(38, 4)), p(38, 22)], kind: 'cloth', closed: true },
      { pts: curve(p(3.5, 6.5), p(20, 23.2), p(36.5, 6.5)), kind: 'machine' },
      ...arrow(curve(p(4, 2.5), p(7, 6), p(10, 7.5), 6)),
      ...arrow(curve(p(36, 2.5), p(33, 6), p(30, 7.5), 6)),
    ],
  },
  baste: {
    w: W,
    h: H,
    caption: 'Basting to fit: the seam tacked by hand along the traced line, to try on before machining.',
    parts: [rect(2, 7, 38, 22), rect(2, 2, 38, 17, 'fold'), line('thread', p(4, 12), p(36, 12))],
  },
  press: {
    w: W,
    h: H,
    caption: 'Pressing over a tailor\'s ham, so a dart or a curved seam keeps its shape.',
    parts: [
      { pts: range(0, 1, 1 / 32).map((t) => p(20 + 15 * Math.cos(t * 2 * Math.PI), 17 + 5.5 * Math.sin(t * 2 * Math.PI))), kind: 'fold', closed: true },
      { pts: curve(p(4, 16.5), p(20, 6), p(36, 16.5)), kind: 'edge' },
      line('machine', p(17, 11.6), p(21, 13.6)),
      { pts: [p(12, 7.5), p(15, 2.5), p(29, 2.5), p(29, 7.5)], kind: 'cloth', closed: true },
      line('edge', p(18, 2.5), p(19.5, 0.6), p(27, 0.6), p(27, 2.5)),
    ],
  },
  pickzip: {
    w: W,
    h: H,
    caption: 'A hand-picked zip: the folded edges meet over the teeth, held by tiny prick stitches.',
    parts: [
      rect(14.5, 1, 25.5, 23, 'under'),
      rect(2, 2, 19.7, 22),
      rect(20.3, 2, 38, 22),
      ...range(3.5, 20.5, 2.2).flatMap((y) => [line('hand', p(17.6, y), p(17.6, y + 0.5)), line('hand', p(22.4, y), p(22.4, y + 0.5))]),
    ],
  },
  french: {
    w: W,
    h: H,
    caption: 'A French seam: the raw edges sewn inside a narrow second seam, pressed to one side.',
    parts: [rect(2, 2, 38, 22), rect(20, 2, 23, 22, 'fold'), line('edge', p(20, 2), p(20, 22)), line('machine', p(22.2, 2), p(22.2, 22))],
  },
  hongkong: {
    w: W,
    h: H,
    caption: 'A Hong Kong finish: each allowance pressed open and its edge bound in bias strip.',
    parts: pressedOpen((x, s) => [rect(Math.min(x, x - 1.6 * s), 2, Math.max(x, x - 1.6 * s), 22, 'cloth'), line('machine', p(x - 1.9 * s, 2), p(x - 1.9 * s, 22))]),
  },
  pinked: {
    w: W,
    h: H,
    caption: 'Pinked: the allowances pressed open and their edges cut with pinking shears, for a lined garment or a firm wool.',
    parts: [
      rect(2, 2, 38, 22),
      { pts: [p(20, 2), ...range(2, 22, 1).map((y, i) => p(i % 2 ? 13.6 : 12.8, y)), p(20, 22)], kind: 'fold', closed: true },
      { pts: [p(20, 2), ...range(2, 22, 1).map((y, i) => p(i % 2 ? 26.4 : 27.2, y)), p(20, 22)], kind: 'fold', closed: true },
      line('edge', p(20, 2), p(20, 22)),
    ],
  },
  overcast: {
    w: W,
    h: H,
    caption: 'Overcast by hand: slanted stitches over each raw edge, soft and flat under a lining.',
    parts: pressedOpen((x, s) => strokes(range(3, 21, 1.5).map((y) => p(x - 1.2 * s, y)), range(3, 21, 1.5).map((y) => p(x + 0.5 * s, y + 1)))),
  },
  overlock: {
    w: W,
    h: H,
    caption: 'Overlocked or zigzagged: the edge wrapped in machine stitches so it cannot fray.',
    parts: [rect(2, 2, 30, 22), line('hand', ...range(2, 22, 0.8).map((y, i) => p(i % 2 ? 30 : 27.6, y)))],
  },
  understitch: {
    w: W,
    h: H,
    caption: 'Understitching: the facing stitched to the seam allowances just beside the seam, so it rolls out of sight.',
    parts: [rect(2, 2, 38, 10), rect(2, 10, 38, 14.5, 'under'), rect(2, 10, 38, 22, 'fold'), line('edge', p(2, 10), p(38, 10)), line('machine', p(2, 11.4), p(38, 11.4))],
  },
  slipstitch: {
    w: W,
    h: H,
    caption: 'Slip-stitching: a folded edge sewn down by hand, the thread running inside the fold between stitches.',
    parts: [
      rect(2, 12, 38, 22),
      rect(2, 2, 38, 12.2, 'fold'),
      line('edge', p(2, 13.4), p(38, 13.4)),
      ...strokes(range(4, 36, 3).map((x) => p(x, 11.6)), range(4, 36, 3).map((x) => p(x + 0.4, 13.4))),
    ],
  },
  catch: {
    w: W,
    h: H,
    caption: 'A catch-stitched hem: crossed stitches over the hem edge, each catching a single thread of the skirt.',
    parts: [
      rect(2, 2, 38, 22),
      rect(2, 10, 38, 22, 'fold'),
      line('edge', p(2, 10), p(38, 10)),
      // A zigzag whose strokes run a little past each turn, so they cross in small Xs.
      ...range(4, 33.5, 2.5).map((x, i) => {
        const a = p(x, i % 2 ? 11.8 : 8.4);
        const b = p(x + 2.5, i % 2 ? 8.4 : 11.8);
        const u = mul(unit(sub(b, a)), 0.6);
        return line('hand', sub(a, u), add(b, u));
      }),
    ],
  },
};
