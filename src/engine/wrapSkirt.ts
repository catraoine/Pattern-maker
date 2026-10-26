// A wrap skirt: each front reaches right across the body, its far side a free hemmed edge, and the
// back cut on the fold with no zip. The skirt ties at the waist: on its own, with ties at the ends of a
// waistband long enough to go round once and across the front again; on a wrap dress, at the waist
// seam with the bodice's ties. Kept apart from wrap.ts so the skirt draft can use it without a cycle.
import { P, Path, p } from './geometry';
import { pathOf, ringOf } from './manipulate';
import type { Piece } from './piece';

const r1 = (v: number) => Math.round(v * 10) / 10;
const mx = (q: P) => p(-q.x, q.y);
const mirrorLine = (l: Path) => {
  const q = l.points().map(mx);
  const out = new Path(q[0]);
  q.slice(1).forEach((x) => out.line(x));
  return out;
};

/** Silhouettes a wrap skirt is drafted in: darted, cut in halves, with a side seam to wrap from. */
const WRAP_SILHOUETTES = ['straight', 'a_line'] as const;

/** Whether a skirt can wrap: a straight or A-line skirt with nothing added to it, a level hem, no
 * pockets in the side seams (one of them is the free edge) and a waistband rather than elastic. */
export const wrapSkirtAllowed = (s: { silhouette: string; pleats?: string; godets?: unknown; flounce?: string; asymHem?: string; pockets?: string; waist?: string; shape?: unknown }) =>
  (WRAP_SILHOUETTES as readonly string[]).includes(s.silhouette) &&
  (s.pleats ?? 'none') === 'none' &&
  !s.godets &&
  (s.flounce ?? 'none') === 'none' &&
  (s.asymHem ?? 'none') === 'none' &&
  (s.pockets ?? 'none') === 'none' &&
  s.waist !== 'elastic' &&
  !s.shape;

/** The ties, each finished 3 cm wide: the outer one round the waist with tails, the inner one round to the side. */
export function wrapTies(finishedWaist: number, sa: number) {
  const outer = r1(finishedWaist * 0.75 + 35);
  const inner = r1(finishedWaist * 0.4 + 21);
  return { outer, inner, cutWidth: r1(2 * 3 + 2 * sa), cut: { outer: r1(outer + 1 + sa), inner: r1(inner + 1 + sa) } };
}

/** The back with no zip: its centre back on the fold. */
export function foldBack(pc: Piece): Piece {
  const r = ringOf(pc.outline);
  if (!r.tags.includes('centre')) return pc;
  const ys = r.pts.filter((q) => Math.abs(q.x) < 1e-6).map((q) => q.y);
  const cut = 'Cut 1 on fold';
  return {
    ...pc,
    outline: pathOf({ pts: r.pts, tags: r.tags.map((t) => (t === 'centre' ? 'fold' : t)) }),
    fold: [p(0, Math.min(...ys) + 2), p(0, Math.max(...ys) - 2)],
    notches: pc.notches.filter(([q, d]) => !(Math.abs(q.x) < 1e-6 && d.x < 0)),
    labels: pc.labels.filter((l) => l.text !== 'ZIP ENDS').map((l) => (l.text === pc.cut ? { ...l, text: cut } : l)),
    cut,
    allowances: { ...pc.allowances, fold: 0 },
  };
}

/** The free front edge of a wrap skirt: turned under twice, 1 cm each time. */
const WRAP_EDGE_HEM = 2;

/**
 * A wrap skirt's front: the half front traced again, turned over, so each front reaches right across.
 * Its own side seam sews to the back; the far side becomes the free front edge, hemmed, lying at the
 * other side seam when it is tied. Cut as a pair, like the bodice's wrap fronts.
 */
export function wrapSkirtFront(front: Piece): Piece {
  const r = ringOf(front.outline);
  const iFold = r.tags.indexOf('fold');
  if (iFold < 0) return front;
  // Start the ring at the centre front waist, just after the fold edge.
  const n = r.pts.length;
  const pts = [...r.pts.slice(iFold + 1), ...r.pts.slice(0, iFold + 1)];
  const tags = [...r.tags.slice(iFold + 1), ...r.tags.slice(0, iFold + 1)];
  const own = { pts, tags: tags.slice(0, n - 1) };
  const far = { pts: [...pts].reverse().map(mx), tags: [...own.tags].reverse().map((t) => (t === 'side' ? 'opening' : t)) };
  const ring = { pts: [...own.pts, ...far.pts.slice(1, -1)], tags: [...own.tags, ...far.tags] };
  const outline = pathOf(ring);
  const xs = own.pts.map((q) => q.x);
  const ys = own.pts.map((q) => q.y);
  const top = Math.min(...ys);
  const foot = Math.max(...own.pts.filter((q) => Math.abs(q.x) < 1e-6).map((q) => q.y));
  const gx = Math.max(...xs) * 0.5;
  const cut = 'Cut 2 (1 pair)';
  return {
    ...front,
    outline,
    lines: [...front.lines, ...front.lines.map((l) => mirrorLine(l))],
    grain: [p(gx, top + 4), p(gx, foot - 4)],
    fold: undefined,
    balance: [...(front.balance ?? []), { pts: [p(0, top), p(0, foot)], label: 'CENTRE FRONT' }],
    notches: [...front.notches, ...front.notches.filter(([q]) => Math.abs(q.x) > 1e-6).map(([q, dir]): [P, P] => [mx(q), mx(dir)])],
    labels: [...front.labels.map((l) => (l.text === front.cut ? { ...l, text: cut } : l)), { at: p(-Math.max(...xs) + 2.5, (top + foot) / 2), text: 'FRONT EDGE', size: 0.6, rotate: 90 }],
    cut,
    allowances: { ...front.allowances, opening: WRAP_EDGE_HEM, fold: 0 },
    meta: { ...front.meta, whole: true, wrap: true, seams: { side: 1 } },
  };
}
