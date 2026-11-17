// Dart manipulation and princess seams, done the way a pattern cutter does them on paper: slash from
// the new dart position to the bust point, close the side bust dart by pivoting about the bust point,
// and let the new dart open by the same angle. A princess line carries the moved bust dart and the
// waist dart on into one seam, cutting the piece into a centre and a side panel.
//
// The sewn shape never changes. The block as drafted (side bust dart) stays on the draft as `block`,
// so sleeves, facings and the flat drawing are worked from it, and only the printed pieces move.
import { P, Path, add, len, lerp, mul, p, sub, unit } from './geometry';
import { finishDart } from './darts';

export type DartPlace = 'side' | 'french' | 'shoulder' | 'neck' | 'armhole' | 'waist';
export type PrincessLine = 'none' | 'shoulder' | 'armhole';

/** How far short of the bust point each moved dart ends, in cm. */
const DART_SHORT: Record<DartPlace, number> = { side: 2.5, french: 3, shoulder: 4, neck: 4, armhole: 3, waist: 2.5 };

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
/** A drawn position along an edge, kept within the part of it a seam or dart can start from. */
/** How far down the armhole a drawn princess seam or dart can start: higher up, the panel above it would
 * be too small to sew. */
export const ARMHOLE_AT = { min: 0.32, max: 0.6 };

export const clampAt = (at: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, at));
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

interface Moved {
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
export function moveBustDart(path: Path, apex: P, to: DartPlace, opts: { armholeNotch?: P; short?: number; princess?: boolean; belowNotch?: number; waistSide?: P; along?: number; at?: number; edge?: string; fairFurther?: boolean } = {}): Moved | undefined {
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
    // `edge` opens it on another top edge the same way: a yoke seam, say.
    const run = runOf(r, opts.edge ?? to);
    if (!run) return undefined;
    // Halfway along, `along` cm from the start of the edge (a strapless top edge, over the bust point),
    // or where it was drawn: `at` of the way along, kept clear of both ends.
    iQ = insertAlong(r, run, opts.along ?? runLength(r, run) * (opts.at !== undefined ? clampAt(opts.at, 0.2, 0.8) : 0.5));
  } else if (to === 'armhole') {
    const run = runOf(r, 'armhole')!;
    const toNotch = opts.armholeNotch ? along(r, run, opts.armholeNotch) : runLength(r, run) * 0.5;
    iQ = insertAlong(
      r,
      run,
      opts.at !== undefined
        ? runLength(r, run) * clampAt(opts.at, ARMHOLE_AT.min, ARMHOLE_AT.max)
        : opts.belowNotch !== undefined
          ? Math.min(toNotch + opts.belowNotch, runLength(r, run) * 0.6)
          : toNotch * 0.8,
    );
  } else if (to === 'french') {
    const a = iN;
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
  // Where the side dart's two legs now meet on the side seam.
  const joined = iQ <= iF ? N : F;

  if (opts.princess) {
    // No dart: the opening runs to the bust point and becomes the seam.
    pts.splice(peakAt, 1);
    tags.splice(peakAt, 1);
    tags[i1] = 'princess';
    const seamAt = pts[i1];
    fairSide(pts, tags, joined, opts.fairFurther);
    return { ring: { pts, tags }, q1, q2, i1: pts.indexOf(seamAt), move, closedAt };
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
  const kept = { q1: pts[i1], q2: pts[peakAt + 1] };
  const before2 = pts.length;
  fairSide(pts, tags, joined);
  fairAboveDart(pts, tags, [d.near, d.far]);
  // The fairing changes the side seam above the new dart, and can raise the underarm and redraw the armhole's foot; the
  // dart's ends stay where they are, so find them again by value.
  const shift = pts.length - before2;
  const at1 = pts.indexOf(kept.q1);
  const out = { pts, tags };
  return { ring: out, dart: { near: d.near, tip: d.tip, far: d.far }, q1: kept.q1, q2: kept.q2, i1: at1 >= 0 ? at1 : i1 + shift, move, closedAt };
}

/**
 * The side seam where a side bust dart was closed, made one fair curve across the join. Closing the dart swings the seam
 * above it round the bust point, so it met the seam below at a corner, in then out again: on the Ice Peplum's side front
 * it printed as a kink under the armhole (a fit tester, Nov 12). The curve runs from where the seam is widest over the
 * bust to 4 cm below the join (further when it must: see below), along the seam's own line at both ends, and is as long
 * as the seam it replaces.
 */
function fairSide(pts: P[], tags: string[], joined: P, further = false) {
  // A seam that barely runs out under the arm (a princess line's side: see bodice.ts sideAt) can be longer, kinked, than
  // any fair curve over the 4 cm below the join, and the side front came up 0.1 to 0.2 cm short of the back on a big cup
  // (Nov 16). Then the curve runs on further down the seam, as far as it can short of the waist, and bows out a little to
  // keep the length: over the longer run the bow is gentlest. Only where asked (`further`: a princess-seamed top or
  // dress, not a jacket or coat, nor a moved dart), so nothing else changes in the pattern freeze to Dec 6.
  if (!further) {
    fairSideOnce(pts, tags, joined, 4, false);
    return;
  }
  if (fairToWaist(pts, tags, joined)) return;
  const plain = fairSideOnce(pts.slice(), tags.slice(), joined, 4, false);
  let below = 4;
  if (plain !== undefined && plain > SIDE_FAIR_SHORT) for (const more of [6, 8, 10, 12]) if (fairSideOnce(pts.slice(), tags.slice(), joined, more, false) !== undefined) below = more;
  fairSideOnce(pts, tags, joined, below, true);
}

/** How much of the armhole above the underarm is redrawn when the side seam's line under the arm changes, in cm. */
const ARMHOLE_RETRUE = 7;

/** How far the redrawn armhole runs straight into the underarm, in cm. */
const ARMHOLE_SQUARE = 0.5;

/** Where the armhole's redrawn stretch starts, back from the underarm at index a: ARMHOLE_RETRUE cm along it, or
 *  undefined when the armhole is too short. It stays on the armhole itself, so a princess opening or a dart in it is
 *  never redrawn away. */
function retrueFrom(pts: P[], tags: string[], a: number): number | undefined {
  const edge = tags[a - 1];
  let k = a;
  let s = 0;
  while (k > 1 && s < ARMHOLE_RETRUE && tags[k - 2] === edge) {
    s += len(sub(pts[k], pts[k - 1]));
    k--;
  }
  return s < ARMHOLE_RETRUE * 0.8 || a - k < 3 ? undefined : k;
}

/** Redraw the armhole from index k to the underarm at index a as one curve that leaves the armhole as it was and
 *  arrives square to the side seam, which now leaves the underarm along `seam`. */
function retrueArmhole(pts: P[], tags: string[], k: number, a: number, seam: P) {
  const N = pts[k];
  const A = pts[a];
  const dN = unit(sub(pts[k + 1], pts[k - 1]));
  let back = a - 1;
  while (back > k && len(sub(pts[back], A)) < 1e-6) back--;
  const arrive = unit(sub(A, pts[back]));
  // Square to the seam, on the side the armhole came in from.
  const square = p(-seam.y, seam.x);
  const dAr = square.x * arrive.x + square.y * arrive.y >= 0 ? square : mul(square, -1);
  // The last ARMHOLE_SQUARE cm runs straight and square into the seam, as the block's own underarm does, so the corner
  // reads square however the pattern is sampled.
  const E = sub(A, mul(dAr, ARMHOLE_SQUARE));
  const reach = len(sub(E, N)) / 3;
  const curve = bezier(N, add(N, mul(dN, reach)), sub(E, mul(dAr, reach)), E, 30);
  const tag = tags[a - 1];
  pts.splice(k + 1, a - k - 1, ...curve);
  tags.splice(k + 1, a - k - 1, ...curve.map(() => tag));
}

/** A cubic from a to b (controls c1, c2), as `steps` points after a, ending on b. */
function bezier(a: P, c1: P, c2: P, b: P, steps: number): P[] {
  const out: P[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const m = 1 - t;
    out.push(p(m * m * m * a.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t * t * t * b.x, m * m * m * a.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t * t * t * b.y));
  }
  return out;
}

/** How far the princess side seam holds the underarm's square line before it runs on to the waist, in cm. */
const UNDERARM_HOLD = 1;

/** The most the underarm is raised to keep the side seams matching, in cm; beyond it the seam is left as fairSideOnce
 *  drew it, in and out. A princess side seam on a full bust with a low bust point, or a front much longer than the back,
 *  needed up to 1.5 cm (0.6 left the Ice Peplum's side front waving and 1 to 2 cm longer than the back on those bodies,
 *  tester sweep Nov 16). Above a French dart the old seam's in-and-out held up to 1 cm more than a fair line (the bug
 *  hunt's sweep, Nov 16), so it may raise that far. */
const UNDERARM_RAISE_MAX = 1.5;
const UNDERARM_RAISE_DART = 1;

/**
 * A princess top's or dress's side seam (fairSide `further`), made one curve from the underarm to the waist. Closing the
 * side dart leaves the seam in, out and in again over the few cm under the arm, then straight to the waist; a curve over
 * only part of it kept an S whenever the bust point sits high for the front length (a fit tester's own bust depth and
 * front length, Nov 16: the app's estimates never showed it). It leaves the underarm square to the armhole for
 * UNDERARM_HOLD, as a pattern cutter squares off an underarm (re-truing the armhole's foot first when the underarm was
 * tipped the wrong way), meets the waist along the seam's line to it, so the waist
 * keeps its shape, and is as long as the seam it replaces, so the side seams still match. False when the seam isn't a
 * short run under the arm and one long line to the waist, and it is left to fairSideOnce.
 */
function fairToWaist(pts: P[], tags: string[], joined: P): boolean {
  const n = pts.length;
  const j = pts.findIndex((q) => len(sub(q, joined)) < 1e-6);
  if (j < 1 || j + 2 >= n || tags[j] !== 'side' || tags[j + 1] !== 'side' || tags[j - 1] !== 'side') return false;
  let a = j;
  while (a > 0 && tags[a - 1] === 'side') a--;
  if (a === 0) return false;
  // The line to the waist: the one long step after the join.
  const toWaist = len(sub(pts[j + 1], pts[j]));
  if (toWaist < 3) return false;
  return fairRun(pts, tags, a, j, UNDERARM_RAISE_MAX);
}

/**
 * The side seam from the underarm at index a to the end of the step after index j, made one curve that leaves the
 * underarm square to the armhole (see fairToWaist) and meets the end along that last step's line. False, and nothing
 * changed, when no such curve keeps the seam's length.
 */
function fairRun(pts: P[], tags: string[], a: number, j: number, raiseMax: number): boolean {
  // Skip repeated points at the underarm, so its line is read from the seam itself.
  let a1 = a + 1;
  while (a1 < j && len(sub(pts[a1], pts[a])) < 1e-6) a1++;
  let A = pts[a];
  const B = pts[j + 1];
  let dA = unit(sub(pts[a1], A));
  const dB = unit(sub(B, pts[j]));
  // Closing the dart tips the underarm with the seam above it, so the seam can leave the arm leaning the other way from
  // the line to the waist: in under the arm, then out. Then the seam leaves along that line instead, and the armhole's
  // last ARMHOLE_RETRUE cm are redrawn to meet it square, as a pattern cutter re-trues an underarm.
  const chordDir = unit(sub(B, A));
  const across = (d: P) => chordDir.x * d.y - chordDir.y * d.x;
  const turn = across(dA) * across(dB) > 0;
  if (turn) dA = chordDir;
  let was = 0;
  for (let i = a; i <= j; i++) was += len(sub(pts[i + 1], pts[i]));
  let chord = len(sub(B, A));
  // The points between the underarm and the waist (both kept as they are).
  const curveFor = (h: number): P[] => bezier(A, add(A, mul(dA, Math.min(chord / 3, Math.max(UNDERARM_HOLD, h)))), sub(B, mul(dB, h)), B, 40).slice(0, -1);
  const lengthOf = (c: P[]) => polyLen([A, ...c, B]);
  // As long as the seam it replaces, by how far the curve holds the waist's line. Where even the longest hold falls
  // short (the in-and-out under the arm was longer than any smooth line), the underarm is raised along the seam by the
  // difference and the armhole's foot re-trued to it, as a pattern cutter walks a side seam and corrects the underarm:
  // a bow long enough to make up the same few mm would stand a full cm off the line.
  let raise = 0;
  if (lengthOf(curveFor(chord / 3)) < was) {
    for (let i = 0; i < 4; i++) {
      raise += was - lengthOf(curveFor(chord / 3));
      A = sub(pts[a], mul(dA, raise));
      chord = len(sub(B, A));
    }
  }
  let lo = 0;
  let hi = chord / 3;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (lengthOf(curveFor(mid)) < was) lo = mid;
    else hi = mid;
  }
  const curve = curveFor((lo + hi) / 2);
  if (Math.abs(lengthOf(curve) - was) > 0.02 || raise > raiseMax) return false;
  // (The armhole is redrawn only once the seam is sure to be, so a seam left as it was keeps its armhole.)
  const k = turn || raise ? retrueFrom(pts, tags, a) : undefined;
  if ((turn || raise) && k === undefined) return false;
  pts[a] = A;
  pts.splice(a + 1, j - a, ...curve);
  tags.splice(a + 1, j - a, ...curve.map(() => 'side'));
  if (k !== undefined) retrueArmhole(pts, tags, k, a, dA);
  return true;
}

/**
 * A dart moved into the side seam below the bust (a French or side dart), with the seam from the underarm down to its
 * upper leg made one curve (fairRun). Closing the old side dart leaves that seam bowing out, standing straight where the
 * old dart closed, and bowing out again before the new dart: on the Blush Shift's front it waved under the arm on
 * measured bust depths and front lengths (the bug hunt's sweep, Nov 16). The seam still meets the dart along its old line,
 * so the dart folds to the seam as before.
 */
function fairAboveDart(pts: P[], tags: string[], legs: P[]) {
  for (const leg of legs) {
    const at = pts.indexOf(leg);
    let e = at - 1;
    if (e < 1 || tags[e] !== 'side' || tags[e + 1] !== 'dart') continue;
    let a = e;
    while (a > 0 && tags[a - 1] === 'side') a--;
    if (a === 0 || tags[a - 1] !== 'armhole') continue;
    // The seam's line into the dart, read over a step long enough to have one.
    while (e > a + 2 && len(sub(leg, pts[e])) < 0.3) e--;
    fairRun(pts, tags, a, e, UNDERARM_RAISE_DART);
    return;
  }
}

/** Up to this much shorter than the seam it replaces (cm), the fair curve needs no bow: well inside the seams' 0.1 cm. */
const SIDE_FAIR_SHORT = 0.05;

/** One go at fairSide, the curve running on `below` cm under the join (bowing out to keep its length when `bow`): how
 *  much shorter the seam came out, or undefined when there was nothing to fair or too little seam left below (the curve
 *  stops 3 cm clear of the seam's end, so the corner at the waist stays as drafted). */
function fairSideOnce(pts: P[], tags: string[], joined: P, below: number, bow: boolean): number | undefined {
  const n = pts.length;
  const j = pts.findIndex((q) => len(sub(q, joined)) < 1e-6);
  if (j < 0 || tags[j] !== 'side' || tags[(j - 1 + n) % n] !== 'side') return undefined;
  // The side run's start: the underarm.
  let a0 = j;
  while (tags[(a0 - 1 + n) % n] === 'side' && a0 > 0) a0--;
  if (a0 === 0 && tags[n - 1] === 'side') return undefined;
  let end = j;
  while (end + 1 < pts.length - 1 && tags[end] === 'side') end++;
  let toEnd = 0;
  for (let i = j; i < end; i++) toEnd += len(sub(pts[i + 1], pts[i]));
  if (below > 4 && below > toEnd - 3) return undefined;
  // A point put in on the seam `cm` along it from index i (back up it when cm is negative), or i if it runs out first.
  const putIn = (i: number, cm: number): number => {
    const dir = cm < 0 ? -1 : 1;
    let at = i;
    let acc = 0;
    for (;;) {
      const nx = at + dir;
      if (nx <= a0 || nx >= pts.length - 1 || tags[Math.min(at, nx)] !== 'side') return at;
      const l = len(sub(pts[nx], pts[at]));
      if (acc + l > Math.abs(cm)) {
        const q = lerp(pts[at], pts[nx], (Math.abs(cm) - acc) / l);
        const k = Math.max(at, nx);
        pts.splice(k, 0, q);
        tags.splice(k, 0, 'side');
        return k;
      }
      acc += l;
      at = nx;
    }
  };
  // From where the seam is widest over the bust (the block swings it out to the bust's width there), to `below` cm on
  // below the join. Above that the underarm curve stays as drafted.
  const b = putIn(j, below);
  let a = a0;
  for (let i = a0; i < j - 1; i++) if (pts[i].x > pts[a].x) a = i;
  if (b - a < 3 || b + 1 >= pts.length || a < 1) return undefined;
  const A = pts[a];
  const B = pts[b];
  // At the underarm itself (the seam widest there), the way it leaves it, square to the armhole.
  const dA = unit(sub(pts[a + 1], a === a0 ? pts[a] : pts[a - 1]));
  const dB = unit(sub(pts[b + 1], B));
  let was = 0;
  for (let i = a; i < b; i++) was += len(sub(pts[i + 1], pts[i]));
  // Out from the piece, square to the chord (the side seam is the piece's outer edge, at its greatest x).
  const chord = unit(sub(B, A));
  const outward = chord.y >= 0 ? p(chord.y, -chord.x) : p(-chord.y, chord.x);
  // How far the curve holds each end's line is set so it is as long as the seam it replaces: the side seams still match.
  // A bow swells out as sin² along it, so it still leaves A and meets B along their lines.
  const curveFor = (f: number, out = 0): P[] => {
    const c1 = add(A, mul(dA, len(sub(B, A)) * f));
    const c2 = sub(B, mul(dB, len(sub(B, A)) * f));
    const res: P[] = [];
    for (let i = 1; i < 24; i++) {
      const t = i / 24;
      const m = 1 - t;
      const q = p(m * m * m * A.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t * t * t * B.x, m * m * m * A.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t * t * t * B.y);
      res.push(add(q, mul(outward, out * Math.sin(Math.PI * t) ** 2)));
    }
    return res;
  };
  const lengthOf = (c: P[]) => [A, ...c, B].reduce((t, q, i, all) => (i ? t + len(sub(q, all[i - 1])) : 0), 0);
  let lo = 0.05;
  let hi = 0.6;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (lengthOf(curveFor(mid)) < was) lo = mid;
    else hi = mid;
  }
  const f = (lo + hi) / 2;
  let curve = curveFor(f);
  if (bow && lengthOf(curve) < was - SIDE_FAIR_SHORT) {
    let lb = 0;
    let hb = 2;
    for (let i = 0; i < 30; i++) {
      const mid = (lb + hb) / 2;
      if (lengthOf(curveFor(f, mid)) < was) lb = mid;
      else hb = mid;
    }
    curve = curveFor(f, (lb + hb) / 2);
  }
  pts.splice(a + 1, b - a - 1, ...curve);
  tags.splice(a + 1, b - a - 1, ...curve.map(() => 'side'));
  return was - lengthOf(curve);
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

/**
 * A corner of a polyline rounded with a curve that still passes through it: it leaves the two sides
 * r before and after the corner along their own lines and swells out to the corner point, the way a
 * pattern cutter blends a princess seam over the bust point instead of cutting across it.
 */
function roundThrough(poly: P[], k: number, r: number): P[] {
  const a = poly[k - 1];
  const c = poly[k];
  const b = poly[k + 1];
  const ra = Math.min(r, len(sub(a, c)) * 0.45);
  const rb = Math.min(r, len(sub(b, c)) * 0.45);
  if (ra < 0.05 || rb < 0.05) return poly;
  const ua = unit(sub(c, a));
  const ub = unit(sub(c, b));
  const s = sub(c, mul(ua, ra));
  const e = sub(c, mul(ub, rb));
  // A cubic whose handles run on along each side: 4/3 of the way to the corner puts its middle on it.
  const h1 = add(s, mul(ua, (4 * ra) / 3));
  const h2 = add(e, mul(ub, (4 * rb) / 3));
  const curve: P[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const m = 1 - t;
    const w = [m * m * m, 3 * m * m * t, 3 * m * t * t, t * t * t];
    curve.push(p(w[0] * s.x + w[1] * h1.x + w[2] * h2.x + w[3] * e.x, w[0] * s.y + w[1] * h1.y + w[2] * h2.y + w[3] * e.y));
  }
  return [...poly.slice(0, k), ...curve, ...poly.slice(k + 1)];
}

/** The two seams of a princess line, blended over the bust (or blade) and walked to the same length. */
export function trueSeams(centre: P[], side: P[], at: number, extra: number[] = []): { centre: P[]; side: P[] } {
  const R = 4;
  const R_MIN = 2.5;
  const shape = (poly: P[], r: number) => {
    // Round the lower corners first (indices shift once the upper one is rounded).
    let out = poly;
    for (const k of [...extra].sort((x, y) => y - x)) out = roundCorner(out, k, 2);
    return roundThrough(out, at, r);
  };
  const c = shape(centre, R);
  const target = polyLen(c);
  // The blend changes the seam's length a little as it widens: the side seam's is sized to match the
  // centre's. It is never narrower than R_MIN, though: when the centre runs nearly straight through
  // the bust point its blend changes nothing, and a side seam blended to match would be left with a
  // hairpin over the bust (its cutting line crossing itself). The length left over is a few
  // hundredths at most, within the seam check's tolerance.
  let lo = R_MIN;
  let hi = 10;
  const atLo = polyLen(shape(side, lo));
  const atHi = polyLen(shape(side, hi));
  if ((target - atLo) * (target - atHi) > 0) {
    const r = Math.abs(polyLen(shape(side, R)) - target) <= 0.05 ? R : Math.abs(atLo - target) <= Math.abs(atHi - target) ? lo : hi;
    return { centre: c, side: shape(side, r) };
  }
  const longer = atLo > atHi;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (polyLen(shape(side, mid)) > target === longer) lo = mid;
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

export { polyLen };
