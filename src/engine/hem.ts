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
function through(path: Path, pts: P[], tag: string) {
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 2)];
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const p3 = pts[Math.min(pts.length - 1, i + 1)];
    path.curve(add(p1, mul(sub(p2, p0), 1 / 6)), sub(p2, mul(sub(p3, p1), 1 / 6)), p2, tag);
  }
}

/**
 * Reshape a piece's hem. The hem runs from the side seam to the centre; each point moves by the
 * offset for how far along the hem it is, straight down for a block skirt or out along the radius
 * for a circle skirt (whose hem is an arc around `origin`).
 */
export function shapeHem(pc: Piece, offsets: number[], origin?: P): void {
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
  const dir = (q: P) => (origin ? unit(sub(q, origin)) : p(0, 1));
  const moved = pts.map((q, i) => add(q, mul(dir(q), offsetAt(offsets, 1 - along[i] / total))));
  // Keep every third point: plenty to follow a hand-drawn shape without wobbles.
  const keep = moved.filter((_, i) => i % 3 === 0 || i === moved.length - 1);

  // Move the end of the side seam with the hem, keeping the seam's direction where it meets it.
  const sideEnd = path.segs[first - 1];
  const shift = sub(keep[0], sideEnd.to);
  sideEnd.to = keep[0];
  if (sideEnd.kind === 'C') sideEnd.c2 = add(sideEnd.c2, shift);

  const hem = new Path(keep[0]);
  through(hem, keep, 'hem');
  path.segs.splice(first, last - first + 1, ...hem.segs);
  path.tags.splice(first, last - first + 1, ...hem.tags);

  // Fold and grain lines stop short of the hem, wherever it now is.
  const centre = offsetAt(offsets, 0);
  const lowest = Math.min(0, ...offsets);
  if (pc.fold) pc.fold = [pc.fold[0], add(pc.fold[1], p(0, centre))];
  if (pc.grain) pc.grain = [pc.grain[0], add(pc.grain[1], p(0, lowest))];
}
