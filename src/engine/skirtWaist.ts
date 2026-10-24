// The skirt's waist, beyond the straight waistband: a faced waist with no band, sitting at the waist;
// a high waist, the skirt carried 6 cm up past the waist and faced; and the zip moved to the left side
// seam, so the back can be cut whole on the fold. Facings are traced from the top of the skirt itself
// with its darts closed, so they curve exactly as the skirt does once its darts are sewn.
import { P, Path, add, len, lerp, mul, p, sub, unit } from './geometry';
import { pathOf, ringOf } from './manipulate';
import { markSeam } from './pockets';
import { facing } from './finishing';
import { foldBack } from './wrapSkirt';
import type { Piece } from './piece';

/** How the waist is finished: a band, a facing, a high faced waist, elastic, or a wrap's tied band. */
export type WaistFinish = 'faced' | 'high';

/**
 * The high waist: how far above the waist it rises, how much the side seam swings out over that rise
 * (the body widens again toward the ribs), and how much narrower the darts are at the top for the same.
 */
export const HIGH = { rise: 6, sideOut: 0.5, dartLess: 0.5 };
/** A facing at the waist, 5 cm deep; a high waist's facing reaches down to the waist. */
export const FACING_DEPTH = 5;

interface WaistStyleish {
  silhouette: string;
  pleats?: string;
  godets?: unknown;
  flounce?: string;
  asymHem?: string;
  wrap?: boolean;
  shape?: unknown;
}
const plain = (s: WaistStyleish) => (s.pleats ?? 'none') === 'none' && !s.godets && (s.flounce ?? 'none') === 'none' && !s.wrap && !s.shape;
const whole = (s: WaistStyleish) => s.silhouette === 'slip' || s.asymHem === 'diagonal';

/** A faced waist suits any plain skirt cut in halves, circles too; gathers, pleats and the rest need a band. */
export const facedAllowed = (s: WaistStyleish) => plain(s) && !whole(s) && s.silhouette !== 'gathered';
/** A high waist rises from a darted block: pencil, straight, A-line or trumpet. */
export const highAllowed = (s: WaistStyleish) => plain(s) && !whole(s) && ['pencil', 'straight', 'a_line', 'trumpet'].includes(s.silhouette);
/** The zip moves to the side on a darted block, where the back can then be cut on the fold; not where an
 * in-seam pocket takes the side seam. */
export const sideZipAllowed = (s: WaistStyleish & { waist?: string; pockets?: string }) => highAllowed(s) && s.waist !== 'elastic' && s.pockets !== 'inseam';

interface Dart {
  /** Ring indices of the near leg's waist point, the peak, and the far leg's waist point. */
  i: number;
  near: P;
  far: P;
  tip: P;
}

/** The waist darts of a half piece, from the centre out, each with its point. */
function waistDarts(pc: Piece, r: { pts: P[]; tags: string[] }, upTo: number): Dart[] {
  const lines = pc.lines.map((l) => l.points(1));
  const out: Dart[] = [];
  for (let i = 1; i < upTo; i++) {
    if (r.tags[i] !== 'dart' || r.tags[i - 1] === 'dart') continue;
    const near = r.pts[i];
    const far = r.pts[i + 2];
    const line = lines.find((l) => l.length === 3 && len(sub(l[0], near)) < 0.3 && len(sub(l[2], far)) < 0.3);
    out.push({ i, near, far, tip: line ? line[1] : add(lerp(near, far, 0.5), p(0, 10)) });
  }
  return out;
}

/**
 * A half skirt piece carried up `rise` cm past the waist. The centre runs straight up, the side seam
 * swings out a little, and each dart runs on up to the top edge a little narrower, so it is shaped like
 * a diamond open at the top. The waist is marked across the piece.
 */
export function raiseWaist(pc: Piece, rise = HIGH.rise): Piece {
  const r = ringOf(pc.outline);
  const n = r.pts.length;
  const s = r.tags.indexOf('side');
  if (s < 0) return pc;
  const darts = waistDarts(pc, r, s);
  const peaks = new Set(darts.map((d) => d.i + 1));
  const lastFar = darts.length ? darts[darts.length - 1].i + 2 : 0;
  const S = r.pts[s];
  const C = r.pts[0];
  const up = (q: P, j: number) => {
    // Out to the side over the last stretch, so the side seam swings out by HIGH.sideOut at the top.
    const k = j > lastFar ? (q.x - r.pts[lastFar].x) / Math.max(1e-6, S.x - r.pts[lastFar].x) : 0;
    return p(q.x + HIGH.sideOut * Math.max(0, Math.min(1, k)), q.y - rise);
  };
  const top: P[] = [];
  const topOf = new Map<number, P>();
  for (let j = 0; j <= s; j++) {
    if (peaks.has(j)) continue;
    const d = darts.find((dd) => dd.i === j || dd.i + 2 === j);
    let q = up(r.pts[j], j);
    if (d) {
      // The dart runs on up its own line, narrower at the top.
      const mid = lerp(d.near, d.far, 0.5);
      const axis = unit(sub(mid, d.tip));
      const midTop = add(mid, mul(axis, rise / Math.max(0.5, Math.abs(axis.y))));
      const w = Math.max(0.3, len(sub(d.far, d.near)) - HIGH.dartLess / darts.length);
      const across = unit(sub(d.far, d.near));
      q = add(midTop, mul(across, (j === d.i ? -w : w) / 2));
    }
    top.push(q);
    topOf.set(j, q);
  }
  const centreTag = r.tags[n - 1];
  const pts = [...top, ...r.pts.slice(s), C];
  const tags = [...top.slice(1).map(() => 'top'), 'side', ...r.tags.slice(s, n - 1), r.tags[n - 1], centreTag];
  // The last edge closes from C back up to the top centre, along the centre line.
  const outline = pathOf({ pts, tags: tags.slice(0, pts.length) });
  const waistLine = r.pts.slice(0, s + 1).filter((_, j) => !peaks.has(j));
  const lines = pc.lines.map((l) => {
    const q = l.points(1);
    const d = darts.find((dd) => q.length === 3 && len(sub(q[0], dd.near)) < 0.3 && len(sub(q[2], dd.far)) < 0.3);
    if (!d) return l;
    return new Path(topOf.get(d.i)!).line(d.near).line(d.tip).line(d.far).line(topOf.get(d.i + 2)!);
  });
  const topY = Math.min(...top.map((q) => q.y));
  return {
    ...pc,
    outline,
    lines,
    fold: pc.fold ? [p(0, topY + 2), pc.fold[1]] : undefined,
    balance: [...(pc.balance ?? []), { pts: waistLine, label: 'WAIST' }],
    allowances: { ...pc.allowances, top: pc.allowances.waist ?? pc.seamAllowance },
    meta: { ...pc.meta, rise },
  };
}

/**
 * The piece with its darts closed along the `tag` edge, so a facing traced from it is one smooth curve.
 * Each dart closes by turning the part of the piece beyond it about its point: a waist dart about its
 * point, a high waist's dart (narrower at the top) about where its two legs meet, above the piece.
 */
function closedAlong(pc: Piece, tag: 'waist' | 'top'): Piece {
  const r = ringOf(pc.outline);
  const pts = [...r.pts];
  const tags = [...r.tags];
  const s = tags.indexOf('side');
  const lastSide = tags.lastIndexOf('side');
  if (s < 0) return pc;
  const lines = pc.lines.map((l) => l.points(1));
  type Close = { from: number; to: number; pivot: P; a: P; b: P };
  const closes: Close[] = [];
  if (tag === 'waist') {
    for (const d of waistDarts(pc, r, s)) closes.push({ from: d.i, to: d.i + 2, pivot: d.tip, a: d.near, b: d.far });
  } else {
    for (const l of lines.filter((q) => q.length === 5)) {
      const a = pts.findIndex((q) => len(sub(q, l[0])) < 0.05);
      const b = pts.findIndex((q) => len(sub(q, l[4])) < 0.05);
      if (a < 0 || b < 0) continue;
      // Where the two legs, carried on up, meet.
      const u = sub(l[0], l[1]);
      const v = sub(l[4], l[3]);
      const den = u.x * v.y - u.y * v.x;
      if (Math.abs(den) < 1e-9) continue;
      const w = sub(l[3], l[1]);
      const t = (w.x * v.y - w.y * v.x) / den;
      closes.push({ from: a, to: b, pivot: add(l[1], mul(u, t)), a: l[0], b: l[4] });
    }
  }
  // From the side inward, so each turn carries the darts already closed beyond it.
  for (const c of [...closes].sort((x, y) => y.from - x.from)) {
    const fa = sub(c.b, c.pivot);
    const fb = sub(c.a, c.pivot);
    const th = Math.atan2(fa.x * fb.y - fa.y * fb.x, fa.x * fb.x + fa.y * fb.y);
    const cos = Math.cos(th);
    const sin = Math.sin(th);
    for (let i = c.to; i <= lastSide + 1 && i < pts.length; i++) {
      const d = sub(pts[i], c.pivot);
      pts[i] = add(c.pivot, p(d.x * cos - d.y * sin, d.x * sin + d.y * cos));
    }
  }
  // Drop each dart's peak and its far point, now on the near one, and run the edge straight on.
  const drop = new Set(closes.flatMap((c) => Array.from({ length: c.to - c.from }, (_, k) => c.from + 1 + k)));
  const P2: P[] = [];
  const T2: string[] = [];
  pts.forEach((q, i) => {
    if (drop.has(i)) return;
    P2.push(q);
    T2.push(closes.some((c) => c.from === i) ? tag : tags[i]);
  });
  return { ...pc, outline: pathOf({ pts: P2, tags: T2 }) };
}

/** The waist facings, front and back, traced from the skirt's top with its darts closed. */
export function waistFacings(pieces: Piece[], high: boolean): Piece[] {
  return pieces.flatMap((pc) => {
    const tag = high ? 'top' : 'waist';
    const depth = high ? ((pc.meta.rise as number | undefined) ?? HIGH.rise) : FACING_DEPTH;
    const name = /back/i.test(pc.name) ? 'Back waist facing' : 'Front waist facing';
    const f = facing(closedAlong(pc, tag), tag, depth, name);
    return f ? [f] : [];
  });
}

/** The zip in the left side seam: its end notched on both side seams, `cm` down from the top. */
export function sideZipped(front: Piece, back: Piece, cm: number, keepBackSeam: boolean): [Piece, Piece] {
  const clear = (pc: Piece): Piece => ({ ...pc, notches: pc.notches.filter(([q, d]) => !(Math.abs(q.x) < 1e-6 && d.x < 0)), labels: pc.labels.filter((l) => l.text !== 'ZIP ENDS') });
  const b = keepBackSeam ? clear(back) : foldBack(back);
  return [markSeam(front, 'side', [cm], 'ZIP ENDS'), markSeam(b, 'side', [cm], 'ZIP ENDS')];
}
