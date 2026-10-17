// Shaped hems, drawn by hand on the sketch: a curved, dipped or high-low hem.
// A hem shape is a list of offsets in cm, evenly spaced from the centre (first) to the side seam (last);
// positive makes the skirt longer there. Front and back are shaped separately, which is how a
// high-low hem is made, and both are mirrored about the centre, so the front can stay on the fold.
import { P, Path, add, len, mul, p, sub, unit } from './geometry';
import { Piece } from './piece';

export interface HemShape {
  front: number[];
  back: number[];
}

export const HEM_SAMPLES = 9;

export const flatHem = (): number[] => new Array(HEM_SAMPLES).fill(0);

/** True when a hem shape changes the hem by more than a few millimetres anywhere. */
export const isShaped = (h?: HemShape) => !!h && [...h.front, ...h.back].some((v) => Math.abs(v) > 0.3);

/** The offset at u, from 0 at the centre to 1 at the side seam. */
export function offsetAt(offsets: number[], u: number): number {
  const n = offsets.length - 1;
  const x = Math.min(n, Math.max(0, u * n));
  const i = Math.min(n - 1, Math.floor(x));
  const t = x - i;
  return offsets[i] * (1 - t) + offsets[i + 1] * t;
}

/**
 * Front and back hems have to meet at the side seams, so their side ends are brought to the same
 * height. The change fades in towards the side, so the centre keeps the shape that was drawn.
 */
export function matchSides(h: HemShape, clamp: (v: number) => number = (v) => v): HemShape {
  const side = (h.front[HEM_SAMPLES - 1] + h.back[HEM_SAMPLES - 1]) / 2;
  const fix = (offs: number[]) => {
    const d = side - offs[HEM_SAMPLES - 1];
    return offs.map((v, i) => clamp(v + d * (i / (HEM_SAMPLES - 1)) ** 2));
  };
  return { front: fix(h.front), back: fix(h.back) };
}

/** Smooth cubic Beziers through points (Catmull-Rom), added to a path. */
function through(path: Path, pts: P[], tag: string, exactEnds = false) {
  const n = pts.length;
  // At the two ends, the direction read from the end three points rather than the end two, so a
  // curving hem leaves its seams at its true angle.
  const endTangent = (a: P, b: P, c: P) => mul(add(mul(sub(b, a), 4), sub(a, c)), 1 / 6);
  for (let i = 1; i < n; i++) {
    const p0 = pts[Math.max(0, i - 2)];
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const p3 = pts[Math.min(n - 1, i + 1)];
    const c1 = exactEnds && i === 1 && n > 2 ? add(p1, endTangent(p1, p2, pts[2])) : add(p1, mul(sub(p2, p0), 1 / 6));
    const c2 = exactEnds && i === n - 1 && n > 2 ? add(p2, endTangent(p2, p1, pts[n - 3])) : sub(p2, mul(sub(p3, p1), 1 / 6));
    path.curve(c1, c2, p2, tag);
  }
}

/**
 * Reshape a piece's hem. The hem runs from the side seam to the centre; each point moves by the
 * offset for how far along the hem it is, straight down for a block skirt or out along the radius
 * for a circle skirt (whose hem is an arc around `origin`).
 */
export function shapeHem(pc: Piece, offsets: number[], origin?: P): void {
  shapeHemBy(pc, (t) => offsetAt(offsets, 1 - t), { origin });
}

/**
 * Reshape a piece's hem by a function of how far along it each point is: `at(t)` is the offset in cm,
 * t running from 0 where the hem leaves the seam before it to 1 where it meets the edge after it.
 * With `alongSeams`, the two ends move along the seams they finish (the points near them turning
 * with them), so each seam grows by exactly its offset and still matches the seam it sews to. A whole
 * piece, cut single layer, has a side seam at both ends of its hem.
 */
export function shapeHemBy(pc: Piece, at: (t: number) => number, opts: { origin?: P; alongSeams?: boolean } = {}): void {
  const { origin, alongSeams } = opts;
  const path = pc.outline;
  const first = path.tags.indexOf('hem');
  const last = path.tags.lastIndexOf('hem');
  if (first < 1) return;
  const hemPath = new Path(path.segs[first - 1].to);
  for (let i = first; i <= last; i++) {
    hemPath.segs.push(path.segs[i]);
    hemPath.tags.push('hem');
  }
  const pts = hemPath.points(24);
  const along = [0];
  for (let i = 1; i < pts.length; i++) along.push(along[i - 1] + len(sub(pts[i], pts[i - 1])));
  const total = along[along.length - 1] || 1;
  const down = (q: P) => (origin ? unit(sub(q, origin)) : p(0, 1));
  // The seams' own directions where they meet the hem, carried on past it.
  const before = path.segs[first - 1];
  const prev = first >= 2 ? path.segs[first - 2].to : path.start;
  const startDir = unit(sub(before.to, before.kind === 'C' ? before.c2 : prev));
  const next = path.segs[last + 1] ?? path.segs[0];
  const endDir = unit(sub(pts[pts.length - 1], next.kind === 'C' ? next.c1 : next.to));
  const dir = (q: P, t: number) => {
    if (!alongSeams) return down(q);
    // Eased in and out, so the direction holds steady right at each end and the corner keeps its angle.
    const ease = (u: number) => (u >= 1 ? 0 : (1 - u) ** 2 * (1 + 2 * u));
    const w0 = ease(t / 0.2);
    const w1 = ease((1 - t) / 0.2);
    const d = mul(down(q), Math.max(0, 1 - w0 - w1));
    return unit(add(add(d, mul(startDir, w0)), mul(endDir, w1)));
  };
  const moved = pts.map((q, i) => add(q, mul(dir(q, along[i] / total), at(along[i] / total))));
  // Keep every third point: plenty to follow a hand-drawn shape without wobbles. A drafted shape is
  // smooth already, so it keeps them all and meets its seams at exactly the drafted angle.
  const keep = alongSeams ? moved : moved.filter((_, i) => i % 3 === 0 || i === moved.length - 1);

  // Move the end of the side seam with the hem, keeping the seam's direction where it meets it.
  const sideEnd = path.segs[first - 1];
  const shift = sub(keep[0], sideEnd.to);
  sideEnd.to = keep[0];
  if (sideEnd.kind === 'C') sideEnd.c2 = add(sideEnd.c2, shift);
  // And the seam after it, where the hem ends on a curved seam rather than a straight centre line.
  if (next.kind === 'C' && next !== sideEnd) next.c1 = add(next.c1, sub(keep[keep.length - 1], pts[pts.length - 1]));

  const hem = new Path(keep[0]);
  through(hem, keep, 'hem', alongSeams);
  path.segs.splice(first, last - first + 1, ...hem.segs);
  path.tags.splice(first, last - first + 1, ...hem.tags);

  // Fold and grain lines stop short of the hem, wherever it now is. A bias grain line keeps its angle.
  const centre = at(1);
  const lowest = Math.min(0, ...Array.from({ length: 17 }, (_, i) => at(i / 16)));
  if (pc.fold) pc.fold = [pc.fold[0], add(pc.fold[1], p(0, centre))];
  if (pc.grain && !pc.meta.bias) pc.grain = [pc.grain[0], add(pc.grain[1], p(0, lowest))];
}
