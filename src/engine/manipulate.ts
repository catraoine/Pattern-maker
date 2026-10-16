// Dart manipulation and princess seams, done the way a pattern cutter does them on paper: slash from
// the new dart position to the bust point, close the side bust dart by pivoting about the bust point,
// and let the new dart open by the same angle. A princess line carries the moved bust dart and the
// waist dart on into one seam, cutting the piece into a centre and a side panel.
//
// The sewn shape never changes. The block as drafted (side bust dart) stays on the draft as `block`,
// so sleeves, facings and the flat drawing are worked from it, and only the printed pieces move.
import { P, Path, add, len, lerp, mul, p, sub, unit } from './geometry';
import { finishDart } from './darts';
import { DraftPoint, Piece } from './piece';

export type DartPlace = 'side' | 'french' | 'shoulder' | 'neck' | 'armhole' | 'waist';
export type PrincessLine = 'none' | 'shoulder' | 'armhole';

/** How far short of the bust point each moved dart ends, in cm. */
export const DART_SHORT: Record<DartPlace, number> = { side: 2.5, french: 3, shoulder: 4, neck: 4, armhole: 3, waist: 2.5 };

/** A closed outline as points: tags[i] names the edge pts[i] -> pts[i + 1] (the last edge closes it). */
export interface Ring {
  pts: P[];
  tags: string[];
}

export function ringOf(path: Path, steps = 24): Ring {
  // Curves are flattened with extra points close to each end, so the directions they leave and arrive
  // in (which the corner checks read) survive.
  const ts = [0.0008, 0.006, ...Array.from({ length: steps - 1 }, (_, i) => (i + 1) / steps), 0.994, 0.9992, 1];
  const pts: P[] = [path.start];
  const tags: string[] = [];
  let cur = path.start;
  path.segs.forEach((sg, i) => {
    if (sg.kind === 'L') {
      pts.push(sg.to);
      tags.push(path.tags[i]);
    } else {
      for (const t of ts) {
        const m = 1 - t;
        pts.push(p(m ** 3 * cur.x + 3 * m * m * t * sg.c1.x + 3 * m * t * t * sg.c2.x + t ** 3 * sg.to.x, m ** 3 * cur.y + 3 * m * m * t * sg.c1.y + 3 * m * t * t * sg.c2.y + t ** 3 * sg.to.y));
        tags.push(path.tags[i]);
      }
    }
    cur = sg.to;
  });
  const P2: P[] = [];
  const T2: string[] = [];
  const n = len(sub(pts[0], pts[pts.length - 1])) < 1e-6 ? pts.length - 1 : pts.length;
  for (let i = 0; i < n; i++) {
    const next = pts[(i + 1) % n];
    if (len(sub(next, pts[i])) < 1e-7) continue;
    P2.push(pts[i]);
    T2.push(tags[i] ?? tags[tags.length - 1]);
  }
  return { pts: P2, tags: T2 };
}

export function pathOf(r: Ring): Path {
  const path = new Path(r.pts[0]);
  const n = r.pts.length;
  for (let i = 0; i < n; i++) path.line(r.pts[(i + 1) % n], r.tags[i]);
  path.closed = true;
  return path;
}

const rotAbout = (c: P, a: number) => (q: P) => {
  const v = sub(q, c);
  return add(c, p(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a)));
};
const angleFrom = (c: P, a: P, b: P) => {
  const u = sub(a, c);
  const v = sub(b, c);
  return Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y);
};
const polyLen = (pts: P[]) => pts.slice(1).reduce((s, q, i) => s + len(sub(q, pts[i])), 0);

/** The first and last edge of the longest run of edges tagged `tag`. */
function runOf(r: Ring, tag: string): [number, number] | undefined {
  const n = r.tags.length;
  let best: [number, number] | undefined;
  for (let i = 0; i < n; i++) {
    if (r.tags[i] !== tag || r.tags[(i - 1 + n) % n] === tag) continue;
    let j = i;
    while (r.tags[(j + 1) % n] === tag && j - i < n) j++;
    if (!best || j - i > best[1] - best[0]) best = [i, j];
  }
  return best;
}

/** Put a point on the run of edges [a, b] at `s` cm along it, and return its index. */
function insertAlong(r: Ring, [a, b]: [number, number], s: number): number {
  let acc = 0;
  for (let i = a; i <= b; i++) {
    const q0 = r.pts[i];
    const q1 = r.pts[(i + 1) % r.pts.length];
    const l = len(sub(q1, q0));
    if (acc + l >= s || i === b) {
      const t = l ? Math.min(1, Math.max(0, (s - acc) / l)) : 0;
      if (t < 1e-3) return i;
      if (t > 1 - 1e-3) return (i + 1) % r.pts.length;
      r.pts.splice(i + 1, 0, lerp(q0, q1, t));
      r.tags.splice(i + 1, 0, r.tags[i]);
      return i + 1;
    }
    acc += l;
  }
  return b;
}
const runLength = (r: Ring, [a, b]: [number, number]) => {
  let s = 0;
  for (let i = a; i <= b; i++) s += len(sub(r.pts[(i + 1) % r.pts.length], r.pts[i]));
  return s;
};
/** Arc length along the run [a, b] to the point nearest q. */
function along(r: Ring, [a, b]: [number, number], q: P): number {
  let s = 0;
  let best = Infinity;
  let at = 0;
  for (let i = a; i <= b + 1; i++) {
    if (i > a) s += len(sub(r.pts[i % r.pts.length], r.pts[i - 1]));
    const d = len(sub(r.pts[i % r.pts.length], q));
    if (d < best) {
      best = d;
      at = s;
    }
  }
  return at;
}

/** Insert a point where the edge run tagged `tag` crosses x = x0. */
function insertAtX(r: Ring, tag: string, x0: number): number | undefined {
  const run = runOf(r, tag);
  if (!run) return undefined;
  for (let i = run[0]; i <= run[1]; i++) {
    const q0 = r.pts[i];
    const q1 = r.pts[(i + 1) % r.pts.length];
    if ((q0.x - x0) * (q1.x - x0) > 0 || q0.x === q1.x) continue;
    const t = (x0 - q0.x) / (q1.x - q0.x);
    if (t < 1e-4) return i;
    if (t > 1 - 1e-4) return i + 1;
    r.pts.splice(i + 1, 0, lerp(q0, q1, t));
    r.tags.splice(i + 1, 0, r.tags[i]);
    return i + 1;
  }
  return undefined;
}

/** The dart run that follows an edge tagged `after`: its first, peak and last index. */
function dartAfter(r: Ring, after: string): [number, number, number] | undefined {
  const n = r.tags.length;
  for (let i = 0; i < n; i++)
    if (r.tags[i] === 'dart' && r.tags[(i - 1 + n) % n] === after && r.tags[(i + 1) % n] === 'dart') return [i, i + 1, i + 2];
  return undefined;
}

export interface Moved {
  ring: Ring;
  /** The new dart, as near leg, point, far leg; undefined for a princess line, which has none. */
  dart?: { near: P; tip: P; far: P };
  /** The two ends of the opening on the outline (for a princess line, where the seam starts). */
  q1: P;
  q2: P;
  /** Index of q1 in the ring (q2 follows it, or the peak and then q2). */
  i1: number;
  /** Moves a point of the old piece to where it lies on the new one. */
  move: (q: P) => P;
  /** The old (closed) position of the new dart's opening, for drawing it on the sewn garment. */
  closedAt: P;
}

/**
 * Close the side bust dart about the bust point and open it at `to`. With `short` 0 the dart is left
 * open to the bust point with no peak, ready to become a princess seam.
 */
export function moveBustDart(path: Path, apex: P, to: DartPlace, opts: { armholeNotch?: P; short?: number; princess?: boolean; belowNotch?: number; waistSide?: P } = {}): Moved | undefined {
  const r = ringOf(path);
  const side = dartAfter(r, 'side');
  if (!side || to === 'side') return undefined;
  let [iF, , iN0] = side;
  // Take the side dart's peak out: the dart closes.
  r.pts.splice(iF + 1, 1);
  r.tags.splice(iF + 1, 1);
  r.tags[iF] = 'side';
  let iN = iN0 - 1;
  const F = r.pts[iF];
  const N = r.pts[iN];
  const before = r.pts.length;
  const phi = angleFrom(apex, F, N);
  const short = opts.short ?? DART_SHORT[to];

  // Where the new dart opens.
  let iQ: number;
  let merge = false;
  if (to === 'shoulder' || to === 'neck') {
    const run = runOf(r, to)!;
    iQ = insertAlong(r, run, runLength(r, run) / 2);
  } else if (to === 'armhole') {
    const run = runOf(r, 'armhole')!;
    const toNotch = opts.armholeNotch ? along(r, run, opts.armholeNotch) : runLength(r, run) * 0.5;
    iQ = insertAlong(r, run, opts.belowNotch !== undefined ? Math.min(toNotch + opts.belowNotch, runLength(r, run) * 0.6) : toNotch * 0.8);
  } else if (to === 'french') {
    let a = iN;
    let b = iN;
    while (r.tags[b + 1] === 'side') b++;
    // Low on the side seam: a few cm above the waist (which may be part way down a longer top's side).
    const total = opts.waistSide ? along(r, [a, b], opts.waistSide) : runLength(r, [a, b]);
    iQ = insertAlong(r, [a, b], Math.max(total * 0.4, total - 5));
  } else {
    const wd = dartAfter(r, 'waist');
    if (wd && wd[0] > iN) {
      // Merge into the waist dart: its peak comes out, the side leg swings round with the side.
      r.pts.splice(wd[1], 1);
      r.tags.splice(wd[1], 1);
      iQ = wd[0];
      merge = true;
    } else {
      const at = insertAtX(r, 'waist', apex.x);
      if (at === undefined) return undefined;
      iQ = at;
    }
  }

  // A point put in above the side dart moves it along one.
  if (r.pts.length > before && iQ <= iF) {
    iF++;
    iN++;
  }
  const n = r.pts.length;
  let pts: P[];
  let tags: string[];
  let q1: P;
  let q2: P;
  let i1: number;
  let move: (q: P) => P;
  let near: P;
  let far: P;
  let away: P;
  if (iQ <= iF) {
    // Above the side dart: the piece from the new dart round to the side dart swings down onto the rest.
    const rot = rotAbout(apex, phi);
    const region = r.pts.slice(iQ, iF + 1).map(rot);
    region[region.length - 1] = N;
    q1 = r.pts[iQ];
    q2 = region[0];
    i1 = iQ;
    pts = [...r.pts.slice(0, iQ + 1), q1, ...region.slice(0, -1), ...r.pts.slice(iN)];
    tags = [...r.tags.slice(0, iQ), 'dart', 'dart', ...r.tags.slice(iQ, iF), ...r.tags.slice(iN)];
    // pts holds q1 twice: the second is the peak, set below.
    const lo = iQ;
    const hi = iF;
    const inRegion = nearIndex(r, lo, hi);
    move = (q) => (inRegion(q) ? rot(q) : q);
    if (to === 'armhole') {
      near = q2;
      far = q1;
      away = unit(sub(region[1] ?? N, q2));
    } else {
      near = q1;
      far = q2;
      away = unit(sub(r.pts[(iQ - 1 + n) % n], q1));
    }
  } else {
    // Below: the piece from the side dart round to the new dart swings up.
    const rot = rotAbout(apex, -phi);
    const region = r.pts.slice(iN, iQ + 1).map(rot);
    region[0] = F;
    q1 = region[region.length - 1];
    q2 = merge ? r.pts[iQ + 1] : r.pts[iQ];
    i1 = iF + region.length - 1;
    const rest = merge ? r.pts.slice(iQ + 1) : r.pts.slice(iQ);
    pts = [...r.pts.slice(0, iF), ...region, q1, ...rest];
    tags = [...r.tags.slice(0, iF), ...r.tags.slice(iN, iQ), 'dart', 'dart', ...(merge ? r.tags.slice(iQ + 1) : r.tags.slice(iQ))];
    const inRegion = nearIndex(r, iN, iQ);
    move = (q) => (inRegion(q) ? rot(q) : q);
    near = q2;
    far = q1;
    const after = merge ? r.pts[(iQ + 2) % n] : r.pts[(iQ + 1) % n];
    away = unit(sub(after, q2));
  }
  const closedAt = r.pts[iQ];
  const peakAt = i1 + 1;

  if (opts.princess) {
    // No dart: the opening runs to the bust point and becomes the seam.
    pts.splice(peakAt, 1);
    tags.splice(peakAt, 1);
    tags[i1] = 'princess';
    return { ring: { pts, tags }, q1, q2, i1, move, closedAt };
  }
  const mid = lerp(q1, q2, 0.5);
  const tip = add(apex, mul(unit(sub(mid, apex)), short));
  const d = finishDart(tip, near, far, away);
  const swap = (from: P, to2: P) => {
    const k = pts.indexOf(from);
    if (k >= 0) pts[k] = to2;
  };
  swap(near, d.near);
  swap(far, d.far);
  pts[peakAt] = d.peak;
  const out = { pts, tags };
  return { ring: out, dart: { near: d.near, tip: d.tip, far: d.far }, q1: pts[i1], q2: pts[peakAt + 1], i1, move, closedAt };
}

/** Whether a point lies on the ring between indices lo and hi (inclusive), within 0.6 cm. */
function nearIndex(r: Ring, lo: number, hi: number) {
  return (q: P) => {
    let best = Infinity;
    let at = -1;
    r.pts.forEach((x, i) => {
      const d = len(sub(x, q));
      if (d < best) {
        best = d;
        at = i;
      }
    });
    return best < 0.6 && at >= lo && at <= hi;
  };
}

/** A corner of a polyline rounded with a quadratic curve from r before it to r after it. */
export function roundCorner(poly: P[], k: number, r: number): P[] {
  const a = poly[k - 1];
  const c = poly[k];
  const b = poly[k + 1];
  const ra = Math.min(r, len(sub(a, c)) * 0.45);
  const rb = Math.min(r, len(sub(b, c)) * 0.45);
  if (ra < 0.05 || rb < 0.05) return poly;
  const s = add(c, mul(unit(sub(a, c)), ra));
  const e = add(c, mul(unit(sub(b, c)), rb));
  const curve: P[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const m = 1 - t;
    curve.push(p(m * m * s.x + 2 * m * t * c.x + t * t * e.x, m * m * s.y + 2 * m * t * c.y + t * t * e.y));
  }
  return [...poly.slice(0, k), ...curve, ...poly.slice(k + 1)];
}

/** The two seams of a princess line, rounded over the bust (or blade) and walked to the same length. */
export function trueSeams(centre: P[], side: P[], at: number, extra: number[] = []): { centre: P[]; side: P[] } {
  const R = 4;
  const shape = (poly: P[], r: number) => {
    // Round the lower corners first (indices shift once the upper one is rounded).
    let out = poly;
    for (const k of [...extra].sort((x, y) => y - x)) out = roundCorner(out, k, 2);
    return roundCorner(out, at, r);
  };
  const c = shape(centre, R);
  const target = polyLen(c);
  let lo = 0;
  let hi = 10;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    // Rounding cuts the corner, so a bigger radius shortens the seam.
    if (polyLen(shape(side, mid)) > target) lo = mid;
    else hi = mid;
  }
  return { centre: c, side: shape(side, (lo + hi) / 2) };
}

/** Points at given arc lengths along a polyline, with the direction square to it (to its left). */
export function marksAlong(poly: P[], at: number[]): [P, P][] {
  const out: [P, P][] = [];
  for (const s of at) {
    let acc = 0;
    for (let i = 1; i < poly.length; i++) {
      const l = len(sub(poly[i], poly[i - 1]));
      if (acc + l >= s) {
        const q = lerp(poly[i - 1], poly[i], l ? (s - acc) / l : 0);
        const u = unit(sub(poly[i], poly[i - 1]));
        out.push([q, p(-u.y, u.x)]);
        break;
      }
      acc += l;
    }
  }
  return out;
}

/** A point of the draft moved with the piece, and a note added for the manipulation. */
export function movePoints(points: DraftPoint[], move: (q: P) => P): DraftPoint[] {
  return points.map((pt) => ({ ...pt, at: move(pt.at) }));
}

export { polyLen };

/** The pieces' waist seam, front or back: every piece of that side summed (two panels, or one piece). */
export function waistOf(pieces: Piece[], side: 'front' | 'back'): Piece[] {
  return pieces.filter((pc) => new RegExp(side, 'i').test(pc.name));
}
