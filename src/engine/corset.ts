// Bodices cut below the shoulders: a strapless top edge (straight across or a sweetheart) and a cami
// edge on spaghetti straps, and the boned, corset-style bodice a strapless top needs to stay up.
//
// Drafted on the bodice block the way a couture workroom does it (Armstrong's strapless foundation):
// - the top edge is drawn across the block from the centre front to the side seam, 2 cm below the
//   underarm, square to the side seam and to the centre front, and everything above it is cut away;
// - a boned bodice is cut close, with 2 cm of ease at the bust and 2 cm less than the body at the
//   waist, held there by the boning and a grosgrain waist stay;
// - its shaping goes into princess seams running from the top edge through the bust point (the bust
//   dart closed into the seam) and down the waist darts, front and back, so there are four panels a
//   side: centre front, side front, centre back, side back;
// - a strapless top edge is drafted 1.6 cm smaller round the body than the block, taken out at the top
//   of the princess seams and tapering to nothing at the bust point, so it grips instead of gaping;
// - boning runs up every seam and the centre front, stopping 2 cm below the top edge and 1.5 cm
//   above the waist, and each panel is cut again in coutil (the interlining that takes the strain)
//   and in lining.
import { P, Path, add, len, lerp, mul, p, sub, taggedLength, unit } from './geometry';
import type { BodiceDraft, BodiceStyle } from './bodice';
import { finishDart } from './darts';
import { Ring, moveBustDart, pathOf, polyLen, ringOf } from './manipulate';
import { insidePolygon } from './marks';
import type { DraftPoint, Label, Piece } from './piece';
import { panels } from './shaping';
import { cm } from './skirt';

export type TopNeckline = 'strapless' | 'sweetheart' | 'cami' | 'halter';
/** A soft bodice, or a boned one built like a corset. */
export type Structure = 'none' | 'boned' | 'shirred';

export const TOP_NECKLINES: readonly TopNeckline[] = ['strapless', 'sweetheart', 'cami', 'halter'];
/** Necklines with a top edge below the shoulders. */
export const isTop = (n: string | undefined): n is TopNeckline => !!n && (TOP_NECKLINES as readonly string[]).includes(n);
/** Strapless necklines, which need the boning to stay up. */
export const isStrapless = (n: string | undefined) => n === 'strapless' || n === 'sweetheart';
/** Whether the bodice is boned: always when strapless, by choice on a cami. */
export const isBoned = (s: { neckline?: string; structure?: Structure }) => (isStrapless(s.neckline) && s.structure !== 'shirred') || (s.neckline === 'cami' && s.structure === 'boned');

/** A boned bodice's ease, in cm round the body: close at the bust, smaller than the body at the waist. */
export const BONED_EASE = { bust: 2, waist: -2 };
/** Taken out round the body at a strapless top edge, so it grips. */
export const GRIP_CM = 1.6;
/** Where the bones stop, in cm: below the top edge and above the waist seam line. */
export const BONE_STOP = { top: 2, waist: 1.5 };
/** The top edge meets the side seam this far below the block's underarm. */
export const SIDE_DROP = 2;
/** The top edge over the bust point, in cm above it. */
const ABOVE_BUST: Record<TopNeckline, number> = { strapless: 4.5, sweetheart: 4.5, cami: 7, halter: 7 };
/** A sweetheart dips to this far above the bust point at the centre front; a cami's V to this. */
const SWEETHEART_DIP = 1;
const CAMI_CENTRE = 5;
/**
 * A halter: the front rises to the neck and the armholes are cut in from the side, so the shoulders
 * are bare. The front's neck drops this far below the block's at the centre front, each strap end is
 * this wide along the shoulder from the neck point, and a tie is sewn to each end to knot at the back
 * of the neck: a folded band finished this wide, long enough to reach round the back neck and tie.
 */
export const HALTER = { neckDrop: 1.5, strapEnd: 3.5, tieWidth: 2.5, tieTails: 28 };
/** Extra on each strap to settle its length at the fitting (half at each end). */
export const STRAP_ADJUST = 4;
/** A rouleau strap: the bias strip cut 2.5 cm wide turns to about 6 mm. */
export const ROULEAU = { cutWidth: 2.5, finished: 0.6 };
/** The grosgrain waist stay: 2.5 cm wide, 5 cm longer than the waist to turn back for its hook and bar. */
export const WAIST_STAY = { width: 2.5, ends: 5 };
/** Standard invisible zips, as for the bodice. */
const ZIPS = [20, 22, 25, 30, 35, 40, 45, 50, 55, 60];

export interface Bone {
  where: string;
  count: number;
  lengthCm: number;
}

export interface TopDetails {
  neckline: TopNeckline;
  boned: boolean;
  /** Taken out of the top edge round the body so it grips, in cm (strapless only). */
  grip: number;
  /** Round the top edge as finished, in cm. */
  topEdge: number;
  bones: Bone[];
  /** The grosgrain waist stay of a boned bodice. */
  waistStay?: { lengthCm: number; widthCm: number };
  /** Rouleau straps: finished length (front top edge over the shoulder to the back top edge), and the strip to cut. */
  straps?: { lengthCm: number; cutLengthCm: number; cutWidthCm: number; lower?: { side: string; cm: number } };
  /** A halter's two neck ties: finished length each, and the strip to cut for each. */
  ties?: { lengthCm: number; cutLengthCm: number; cutWidthCm: number };
  /** Each strap from the top edge to the shoulder, front and back, in the block's coordinates (for the flat). */
  strapAt?: { front: [P, P]; back: [P, P] };
}

const r1 = (v: number) => Math.round(v * 10) / 10;
/** Unit vector square to a seam running down `d`, heading away from the centre. */
const squareTo = (d: P): P => unit(p(d.y, -d.x));

/** The first run of edges tagged `tag`: its first and last edge. */
function firstRun(r: Ring, tag: string): [number, number] | undefined {
  const n = r.tags.length;
  for (let i = 0; i < n; i++) {
    if (r.tags[i] !== tag || r.tags[(i - 1 + n) % n] === tag) continue;
    let j = i;
    while (r.tags[(j + 1) % n] === tag && j - i < n) j++;
    return [i, j];
  }
  return undefined;
}
const runLen = (r: Ring, [a, b]: [number, number]) => {
  let s = 0;
  for (let i = a; i <= b; i++) s += len(sub(r.pts[(i + 1) % r.pts.length], r.pts[i]));
  return s;
};
/** Put a point s cm along the run [a, b] and return its index. */
function insertAlong(r: Ring, [a, b]: [number, number], s: number): number {
  let acc = 0;
  for (let i = a; i <= b; i++) {
    const q0 = r.pts[i];
    const q1 = r.pts[(i + 1) % r.pts.length];
    const l = len(sub(q1, q0));
    if (acc + l >= s || i === b) {
      const t = l ? Math.min(1, Math.max(0, (s - acc) / l)) : 0;
      if (t < 1e-4) return i;
      if (t > 1 - 1e-4) return (i + 1) % r.pts.length;
      r.pts.splice(i + 1, 0, lerp(q0, q1, t));
      r.tags.splice(i + 1, 0, r.tags[i]);
      return i + 1;
    }
    acc += l;
  }
  return b;
}
/** Insert a point where the run of edges tagged `tag` crosses x = x0. */
function insertAtX(r: Ring, tag: string, x0: number): number | undefined {
  const run = firstRun(r, tag);
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

/**
 * Slide point i of the ring `d` cm along its edge, toward the next point (dir 1) or the one before
 * (dir -1), dropping any point it passes. Returns where it ends up.
 */
function slide(r: Ring, i: number, dir: 1 | -1, d: number): number {
  let rem = d;
  let at = r.pts[i];
  for (let guard = 0; guard < 50; guard++) {
    const j = i + dir;
    const q = r.pts[j];
    const l = len(sub(q, at));
    if (l > rem + 0.05) {
      r.pts[i] = add(at, mul(unit(sub(q, at)), rem));
      return i;
    }
    rem -= l;
    at = q;
    // The edges either side of the dropped point join, keeping the tag of the one nearer the point.
    if (dir > 0) {
      r.pts.splice(j, 1);
      r.tags.splice(j, 1);
    } else {
      r.pts.splice(j, 1);
      r.tags.splice(j, 1);
      i -= 1;
    }
    r.pts[i] = at;
  }
  return i;
}

/** Points along a cubic, without its start. */
function cubic(a: P, c1: P, c2: P, b: P, n: number): P[] {
  return Array.from({ length: n }, (_, k) => {
    const t = (k + 1) / n;
    const m = 1 - t;
    return p(m ** 3 * a.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t ** 3 * b.x, m ** 3 * a.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t ** 3 * b.y);
  });
}
/** Points along a straight line, without its start. */
const straight = (a: P, b: P) => {
  const n = Math.max(1, Math.ceil(len(sub(b, a)) / 0.5));
  return Array.from({ length: n }, (_, k) => lerp(a, b, (k + 1) / n));
};
/** A curve's samples, with a tiny first step along `start` and last step along `end`, so the corners
 * at each end read exactly square. */
const squared = (pts: P[], start: P | undefined, end: P | undefined) => {
  const out = [...pts];
  if (start) out.splice(1, 0, add(out[0], mul(start, 0.02)));
  if (end) out.splice(out.length - 1, 0, sub(out[out.length - 1], mul(end, 0.02)));
  return out;
};

/** The y of a polyline at x, by its first crossing. */
function yAt(pts: P[], x: number): number | undefined {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  return undefined;
}

interface Cut {
  piece: Piece;
  top: P[];
  /** Where the top edge meets the side seam. */
  side: P;
}

/**
 * Cut a block piece along a new top edge: from the centre (index 0 of the ring, where the centre
 * line meets the old neck) round to a point `drop` cm down the side seam. `edge` draws the top edge
 * from the side point given the side seam's direction there. Everything above it goes.
 */
function cutPiece(pc: Piece, drop: number, edge: (side: P, out: P) => P[], turn = 0): Cut {
  const r = ringOf(pc.outline);
  const run = firstRun(r, 'side')!;
  const iS = insertAlong(r, run, drop);
  const S = r.pts[iS];
  const down = unit(sub(r.pts[iS + 1], S));
  // The edge meets the side seam square, or turned by `turn` toward the waist (the front) and away
  // from it by as much (the back), so the two corners still add up to a straight line when sewn.
  const sq = squareTo(down);
  const out = add(mul(sq, Math.cos(turn)), mul(down, Math.sin(turn)));
  const top = edge(S, out);
  const pts = [...top.slice(0, -1), ...r.pts.slice(iS)];
  const tags = [...top.slice(0, -1).map(() => 'neck'), ...r.tags.slice(iS)];
  const ring = { pts, tags };
  const outline = pathOf(ring);
  const keep = (q: P) => insidePolygon(q, pts) || pts.some((x) => len(sub(x, q)) < 0.6);
  return {
    top,
    side: S,
    piece: {
      ...pc,
      outline,
      notches: pc.notches.filter(([q]) => keep(q)),
      balance: undefined,
      alternate: undefined,
      draft: pc.draft ? { frame: pc.draft.frame, points: pc.draft.points.filter((pt) => keep(pt.at)) } : undefined,
    },
  };
}

const dot = (a: P, b: P) => a.x * b.x + a.y * b.y;

/** Where the top edge meets the side seam, `drop` below the underarm, and the seam's direction there. */
function sideAt(pc: Piece, drop: number): { S: P; down: P } {
  const r = ringOf(pc.outline);
  const iS = insertAlong(r, firstRun(r, 'side')!, drop);
  return { S: r.pts[iS], down: unit(sub(r.pts[iS + 1], r.pts[iS])) };
}

/**
 * How far the top edge turns off square at the side seam. Above the side bust dart the front's side
 * seam leans out, so an edge square to it would have to dip below the side and rise again to meet it.
 * The edge is turned until the front falls all the way to the side (never rising at the end), and
 * toward the average of the front's fall and the back's rise, so the line runs on round the body.
 */
function sideTurn(front: Piece, back: Piece, drop: number, frontFrom: P, backFrom: P): number {
  const f = sideAt(front, drop);
  const b = sideAt(back, drop);
  const of = squareTo(f.down);
  const ob = squareTo(b.down);
  const vf = unit(sub(f.S, frontFrom));
  const vb = unit(sub(b.S, backFrom));
  // The front's chord, below square; the back's, falling from the side toward the centre back.
  const fall = Math.atan2(dot(vf, f.down), dot(vf, of));
  const rise = -Math.atan2(dot(vb, b.down), dot(vb, ob));
  // Turned at least this far, the front arrives level or falling, in its own frame.
  const level = f.down.y > 1e-6 ? Math.atan2(-of.y, f.down.y) : 0;
  return Math.max(0, level, Math.min((fall + rise) / 2, fall));
}

/** The shoulder run on the block as drafted, from the neck point to the shoulder tip. */
function runOf(pc: Piece, tag: string): [P, P] | undefined {
  const { pts, tags } = pc.outline.taggedPoints(4);
  const i = tags.indexOf(tag);
  const j = tags.lastIndexOf(tag);
  return i < 0 ? undefined : [pts[i], pts[j + 1]];
}

/** The shoulder run's middle on the block as drafted: where a strap goes over. */
function shoulderMid(pc: Piece): P | undefined {
  const { pts, tags } = pc.outline.taggedPoints(4);
  const i = tags.indexOf('shoulder');
  const j = tags.lastIndexOf('shoulder');
  return i < 0 ? undefined : lerp(pts[i], pts[j + 1], 0.5);
}

/**
 * Cut the drafted block (front and back, darts as drafted) along a strapless, sweetheart or cami top
 * edge, and work out the straps and the zip.
 */
export function cutTop(d: BodiceDraft, s: BodiceStyle & { neckline: TopNeckline }, low?: { side: string; cm: number }): BodiceDraft {
  const kind = s.neckline;
  const [front, back] = d.pieces;
  const apex = d.front.apex;
  const boned = isBoned(s);
  // The bust dart's upper leg, which the top edge must clear at the side.
  const fr = ringOf(front.outline);
  const fRun = firstRun(fr, 'side')!;
  const drop = Math.max(0.5, Math.min(SIDE_DROP, runLen(fr, fRun) - 1.2));
  const sideDart = front.lines.map((l) => l.points()).find((q) => q.length === 3 && Math.abs(q[2].y - q[0].y) > Math.abs(q[2].x - q[0].x));

  // ---- front: the top edge from the centre front out to the side ----------------------------------
  let lift = 0;
  // A halter: up from the centre front neck round to the neck point, along the shoulder to the strap
  // end, then square off it and cut in across the armhole to the side.
  const fShoulder = runOf(front, 'shoulder');
  const neckPt = fShoulder?.[0] ?? p(0, 0);
  const along = fShoulder ? unit(sub(fShoulder[1], fShoulder[0])) : p(1, 0);
  const strapEnd = add(neckPt, mul(along, HALTER.strapEnd));
  const halterEdge = (S: P, out: P): P[] => {
    const C = p(0, front.outline.start.y + HALTER.neckDrop);
    const dx = neckPt.x - C.x;
    const dy = C.y - neckPt.y;
    const neck = cubic(C, add(C, p(0.55 * dx, 0)), add(neckPt, p(-0.05 * dx, 0.55 * dy)), neckPt, 14);
    const strap = straight(neckPt, strapEnd);
    // Off the strap end square to the shoulder, down and in past the bust, then out to the side.
    const downIn = unit(p(-along.y, along.x).y > 0 ? p(-along.y, along.x) : p(along.y, -along.x));
    const k = len(sub(S, strapEnd)) * 0.45;
    const cut = cubic(strapEnd, add(strapEnd, mul(downIn, k)), sub(S, mul(out, k * 0.8)), S, Math.max(16, Math.ceil(len(sub(S, strapEnd)) / 0.4)));
    return squared([C, ...neck, ...strap, ...cut], p(1, 0), out);
  };
  const frontEdge = (S: P, out: P): P[] => {
    const yb = apex.y - ABOVE_BUST[kind] + lift;
    const B = p(apex.x, yb);
    const toSide = (from: P, start: P) => {
      const k = len(sub(S, from)) * 0.35;
      return cubic(from, add(from, mul(start, k)), sub(S, mul(out, k)), S, Math.max(8, Math.ceil(len(sub(S, from)) / 0.4)));
    };
    if (kind === 'strapless') {
      // Straight across the centre front, level to the bust point, then down to the side.
      const C = p(0, yb);
      return squared([C, ...straight(C, B), ...toSide(B, p(1, 0))], p(1, 0), out);
    }
    if (kind === 'sweetheart') {
      // From the dip at the centre front, steeply up and round over the bust to the top of the curve.
      const C = p(0, Math.max(yb + 1.5, apex.y - SWEETHEART_DIP + lift));
      const dx = B.x - C.x;
      const dy = C.y - B.y;
      const lobe = cubic(C, add(C, p(0.12 * dx, -0.85 * dy)), sub(B, p(0.5 * dx, 0)), B, 16);
      return squared([C, ...lobe, ...toSide(B, p(1, 0))], undefined, out);
    }
    if (kind === 'halter') return halterEdge(S, out);
    // A cami: a slight V from the centre front up to the strap, straight above the bust point.
    const C = p(0, Math.max(yb + 1, apex.y - CAMI_CENTRE + lift));
    return squared([C, ...straight(C, B), ...toSide(B, p(1, 0.15))], undefined, out);
  };
  // The top edge stays inside the block and above the bust dart: lowered until it does.
  const clearDart = (top: P[]) => !sideDart || top.every((q) => q.x > sideDart[0].x - 0.3 || q.x < sideDart[1].x || q.y < (yAt(sideDart, q.x) ?? Infinity) - 0.8);
  const fOk = (top: P[]) => top.slice(1, -1).every((q) => insidePolygon(q, fr.pts)) && clearDart(top);
  const tryFront = (S: P, out: P) => {
    if (kind === 'halter') return halterEdge(S, out);
    for (lift = 0; lift < ABOVE_BUST[kind] - 1.5; lift += 0.5) {
      const t = frontEdge(S, out);
      if (fOk(t)) return t;
    }
    return frontEdge(S, out);
  };
  const backFrom = (() => {
    const b = sideAt(back, drop);
    return p(0, b.S.y + 1);
  })();
  const turn = sideTurn(front, back, drop, p(apex.x, apex.y - ABOVE_BUST[kind]), backFrom);
  const fc = cutPiece(front, drop, tryFront, turn);

  // ---- back: level across the centre back, 1 cm below the side, square to both -------------------
  const backEdge = (S: P, out: P): P[] => {
    const C = p(0, S.y + 1);
    const k = len(sub(S, C)) * 0.35;
    // Rising to the side more steeply than square (see sideTurn), the last handle is kept short enough
    // that the edge never sags below its centre back level on the way.
    const k2 = out.y < -1e-6 ? Math.min(k, (0.9 * (C.y - S.y)) / -out.y) : k;
    return squared([C, ...cubic(C, add(C, p(k, 0)), sub(S, mul(out, k2)), S, Math.max(12, Math.ceil(S.x / 0.4)))], p(1, 0), out);
  };
  const bc = cutPiece(back, drop, backEdge, -turn);

  // A back waist dart that would run up past the top edge is shortened to 3 cm below it and trued again.
  let backPiece = bc.piece;
  const dl = backPiece.lines.map((l) => l.points()).find((q) => q.length === 3);
  if (dl) {
    const topY = yAt(bc.top, dl[1].x) ?? bc.top[0].y;
    if (dl[1].y < topY + 3 && !boned) {
      const r = ringOf(backPiece.outline);
      const n = r.tags.length;
      const at = r.tags.findIndex((t, i) => t === 'dart' && r.tags[(i - 1 + n) % n] === 'waist' && r.tags[(i + 1) % n] === 'dart');
      if (at >= 0) {
        const nd = finishDart(p(dl[1].x, topY + 3), r.pts[at + 2], r.pts[at], p(-1, 0));
        r.pts[at] = nd.far;
        r.pts[at + 1] = nd.peak;
        r.pts[at + 2] = nd.near;
        backPiece = {
          ...backPiece,
          outline: pathOf(r),
          lines: backPiece.lines.map((l) => (l.points().length === 3 ? new Path(nd.near).line(nd.tip).line(nd.far) : l)),
          draft: backPiece.draft && {
            ...backPiece.draft,
            points: backPiece.draft.points.map((pt) => (pt.n === 'D' ? { ...pt, at: nd.tip, note: `${pt.note.replace(/, ending .*$/, '')}, ending 3 cm below the top edge.` } : pt)),
          },
        };
      }
    }
  }

  // ---- straps -------------------------------------------------------------------------------------
  let straps: TopDetails['straps'];
  let strapAt: TopDetails['strapAt'];
  const strapF = fc.top.reduce((best, q) => (q.y < best.y ? q : best));
  const backX = dl ? dl[1].x : bc.side.x * 0.48;
  const strapB = p(backX, yAt(bc.top, backX) ?? bc.top[0].y);
  let ties: TopDetails['ties'];
  if (kind === 'halter') {
    // Each tie reaches from the strap end round half the back neck, with tails to knot.
    const backNeck = taggedLength(back.outline, 'neck');
    const lengthCm = r1(backNeck + HALTER.strapEnd / 2 + HALTER.tieTails);
    ties = { lengthCm, cutLengthCm: r1(lengthCm + 1 + s.neckArmholeAllowance), cutWidthCm: r1(2 * HALTER.tieWidth + 2 * s.neckArmholeAllowance) };
    const bShoulder = runOf(back, 'shoulder');
    const backNeckPt = bShoulder?.[0] ?? p(0, 0);
    strapAt = {
      front: [lerp(neckPt, strapEnd, 0.5), p(neckPt.x * 0.45, neckPt.y - 4)],
      back: [p(backNeckPt.x, backNeckPt.y - 1), p(0.6, backNeckPt.y + 1.5)],
    };
  }
  if (kind === 'cami') {
    const mf = shoulderMid(front);
    const mb = shoulderMid(back);
    if (mf && mb) {
      const length = len(sub(mf, strapF)) + len(sub(mb, strapB));
      straps = {
        lengthCm: r1(length),
        cutLengthCm: r1(length + STRAP_ADJUST + 2 * s.neckArmholeAllowance),
        cutWidthCm: ROULEAU.cutWidth,
        lower: low && low.cm > 0 ? { side: low.side, cm: r1(low.cm) } : undefined,
      };
      strapAt = { front: [strapF, mf], back: [strapB, mb] };
    }
  }

  // ---- labels, grain, notches and draft points on the cut pieces ---------------------------------
  const C = fc.top[0];
  const Cb = bc.top[0];
  const fBottom = d.front.hemCentre.y;
  const bBottom = d.back.hemCentre.y;
  const opening = bBottom - Cb.y;
  const below = d.drop > 0;
  const zipCm = below ? ([...ZIPS].reverse().find((z) => z <= opening - 2) ?? Math.floor(opening - 2)) : Math.floor(opening - 1);
  const zipEnd = p(0, Cb.y + zipCm);
  const fTopAt = (x: number) => yAt(fc.top, x) ?? C.y;
  const bTopAt = (x: number) => yAt(bc.top, x) ?? Cb.y;
  const pointsF: DraftPoint[] = [
    {
      n: 'T',
      at: C,
      note:
        kind === 'strapless'
          ? `Top edge: ${cm(ABOVE_BUST[kind] - lift)} above the bust point, squared out level from the centre front to the bust point line.`
          : kind === 'sweetheart'
            ? `Sweetheart dip at the centre front, ${cm(apex.y - C.y)} above the bust point. The edge rises steeply, then rounds over the bust.`
            : kind === 'halter'
              ? `Centre front neck, ${cm(HALTER.neckDrop)} below the block's, squared out from the centre front.`
            : `Centre front of the cami edge, ${cm(apex.y - C.y)} above the bust point: a ${cm(C.y - strapF.y)} V below the strap.`,
    },
    ...(kind === 'strapless'
      ? []
      : kind === 'halter'
        ? [
            { n: 'N', at: neckPt, note: 'Neck point: the halter rises to the neck here.' },
            { n: 'H', at: strapEnd, note: `Strap end, ${cm(HALTER.strapEnd)} along the shoulder from the neck point. The armhole is cut in from here, square to the shoulder, to the side.` },
          ]
        : [
          {
            n: 'U',
            at: strapF,
            note: kind === 'sweetheart' ? `Top of the sweetheart curve, ${cm(apex.y - strapF.y)} above the bust point and level there.` : `Strap point, straight above the bust point and ${cm(apex.y - strapF.y)} above it.`,
          },
        ]),
    { n: 'S', at: fc.side, note: `Side: the top edge meets the side seam ${cm(drop)} below the underarm, square to it, so it runs on into the back without a dip.` },
  ];
  const pointsB: DraftPoint[] = [
    { n: 'T', at: Cb, note: 'Centre back top: 1 cm below the side, squared out from the centre back.' },
    { n: 'S', at: bc.side, note: `Side: ${cm(drop)} below the underarm, the same as the front, square to the side seam.` },
    ...(kind === 'cami' ? [{ n: 'U', at: strapB, note: 'Strap point, on the line of the waist dart.' }] : []),
  ];
  const strapNotch = (q: P): [P, P] => [q, p(0, -1)];
  const label = (at: P, text: string, cut: string): Label[] => [
    { at, text, size: 1.2, rotate: 90 },
    { at: add(at, p(-1.6, 0)), text: cut, size: 0.8, rotate: 90 },
  ];
  const fx = Math.max(2.2, apex.x * 0.45);
  const bx = Math.max(2.2, backX * 0.45);
  const frontPc: Piece = {
    ...fc.piece,
    grain: front.grain ? [p(front.grain[0].x, Math.max(front.grain[0].y, fTopAt(front.grain[0].x) + 2)), front.grain[1]] : undefined,
    fold: front.fold ? [p(0, C.y + 2), front.fold[1]] : undefined,
    labels: label(p(fx, (Math.max(C.y, fTopAt(fx)) + fBottom) / 2), 'BODICE FRONT', front.cut),
    notches: [...fc.piece.notches, ...(straps ? [strapNotch(strapF)] : [])],
    draft: fc.piece.draft && { ...fc.piece.draft, points: [...fc.piece.draft.points, ...pointsF] },
    meta: { ...front.meta, ...(kind === 'strapless' || kind === 'halter' ? {} : { pointedAtCentre: ['neck'] }) },
  };
  const backPc: Piece = {
    ...backPiece,
    grain: back.grain ? [p(back.grain[0].x, Math.max(back.grain[0].y, bTopAt(back.grain[0].x) + 2)), back.grain[1]] : undefined,
    labels: [...label(p(bx, (Cb.y + bBottom) / 2), 'BODICE BACK', back.cut), { at: add(zipEnd, p(3.2, 0.3)), text: 'ZIP ENDS', size: 0.7 }],
    notches: [...backPiece.notches.filter(([q, dir]) => !(Math.abs(q.x) < 1e-6 && dir.x < 0)), [zipEnd, p(-1, 0)], ...(straps ? [strapNotch(strapB)] : [])],
    draft: backPiece.draft && { ...backPiece.draft, points: [...backPiece.draft.points, ...pointsB] },
  };
  if (ties) frontPc.labels.push({ at: add(lerp(neckPt, strapEnd, 0.5), p(0, 1.6)), text: 'TIE', size: 0.6 });
  if (straps) {
    frontPc.labels.push({ at: add(strapF, p(0, 1.4)), text: 'STRAP', size: 0.6 });
    backPc.labels.push({ at: add(strapB, p(0, 1.4)), text: 'STRAP', size: 0.6 });
  }
  const topEdge = 2 * (taggedLength(frontPc.outline, 'neck') + taggedLength(backPc.outline, 'neck'));
  return {
    ...d,
    pieces: [frontPc, backPc],
    armhole: 0,
    armholeTarget: undefined,
    warnings: d.warnings.filter((w) => !/^armhole|shoulder/.test(w)),
    lowShoulder: undefined,
    backLength: r1(bBottom - Cb.y),
    zipCm,
    back: { ...d.back, neckCentre: Cb, zipEnd },
    neck: r1(topEdge),
    closure: 'back_zip',
    collar: 'none',
    top: { neckline: kind, boned, grip: 0, topEdge: r1(topEdge), bones: [], straps, ties, strapAt },
  };
}

/** Index of the corner where the top edge meets a princess seam, and which way the top edge runs from it. */
function topCorner(r: Ring): { k: number; dir: 1 | -1 } | undefined {
  const n = r.tags.length;
  for (let k = 0; k < n; k++) {
    const before = r.tags[(k - 1 + n) % n];
    const after = r.tags[k];
    if (before === 'neck' && after === 'princess') return { k, dir: -1 };
    if (before === 'princess' && after === 'neck') return { k, dir: 1 };
  }
  return undefined;
}

/**
 * True the top edge into a princess seam that was taken in at the top: the last 3 cm of the edge are
 * redrawn to leave the seam square, the way a cutter blends the edge with the seams pinned closed.
 */
function squareTop(pc: Piece): Piece {
  const r = ringOf(pc.outline);
  const c = topCorner(r);
  if (!c) return pc;
  const n = r.pts.length;
  const at = (i: number) => r.pts[((i % n) + n) % n];
  const K = at(c.k);
  // Down the seam from the corner, and the square to it on the top edge's side.
  const seam = unit(sub(at(c.k - c.dir), K));
  const along = sub(at(c.k + c.dir), K);
  let w = p(-seam.y, seam.x);
  if (w.x * along.x + w.y * along.y < 0) w = mul(w, -1);
  // Walk 3 cm along the top edge.
  let acc = 0;
  let steps = 0;
  while (acc < 3 && steps < n - 4 && r.tags[((c.dir > 0 ? c.k + steps : c.k - steps - 1) % n + n) % n] === 'neck') {
    acc += len(sub(at(c.k + c.dir * (steps + 1)), at(c.k + c.dir * steps)));
    steps++;
  }
  if (steps < 2) return pc;
  const Q = at(c.k + c.dir * steps);
  const tq = unit(sub(at(c.k + c.dir * (steps + 1)), Q));
  const k = acc / 3;
  const blend = squared([K, ...cubic(K, add(K, mul(w, k)), sub(Q, mul(tq, k)), Q, 10)], w, undefined).slice(1, -1);
  // Replace the points between the corner and Q (never across the ring's start, where no top edge wraps).
  const lo = c.dir > 0 ? c.k + 1 : c.k - steps + 1;
  const hi = c.dir > 0 ? c.k + steps - 1 : c.k - 1;
  if (lo < 0 || hi >= n) return pc;
  const pts = [...r.pts];
  const tags = [...r.tags];
  const fill = c.dir > 0 ? blend : [...blend].reverse();
  pts.splice(lo, hi - lo + 1, ...fill);
  tags.splice(lo, hi - lo + 1, ...fill.map(() => 'neck'));
  return { ...pc, outline: pathOf({ pts, tags }) };
}

/** A run of the ring as a polyline, from its first edge's start to its last edge's end. */
function runPts(pc: Piece, tag: string): P[] {
  const r = ringOf(pc.outline);
  const run = firstRun(r, tag);
  if (!run) return [];
  const out: P[] = [];
  for (let i = run[0]; i <= run[1] + 1; i++) out.push(r.pts[i % r.pts.length]);
  return out;
}

/** The part of a polyline from arc length a to b. */
function between(poly: P[], a: number, b: number): P[] {
  const out: P[] = [];
  let acc = 0;
  for (let i = 1; i < poly.length; i++) {
    const l = len(sub(poly[i], poly[i - 1]));
    const s0 = acc;
    const s1 = acc + l;
    if (s1 >= a && s0 <= b) {
      if (!out.length) out.push(lerp(poly[i - 1], poly[i], l ? Math.max(0, (a - s0) / l) : 0));
      out.push(lerp(poly[i - 1], poly[i], l ? Math.min(1, (b - s0) / l) : 1));
    }
    acc = s1;
  }
  return out;
}

/** A polyline moved `d` cm into a piece, square to itself. */
function inward(poly: P[], d: number, ring: P[]): P[] {
  return poly.map((q, i) => {
    const t = unit(sub(poly[Math.min(i + 1, poly.length - 1)], poly[Math.max(i - 1, 0)]));
    const nrm = p(-t.y, t.x);
    const a = add(q, mul(nrm, d));
    return insidePolygon(a, ring) ? a : sub(q, mul(nrm, d));
  });
}

/** A bone drawn on a piece: its line in short straight lengths (so it is never read as a dart), ticks
 * square across each end, and its length written along it. */
function boneMarks(pc: Piece, line: P[], text: string): Piece {
  const lines: Path[] = [];
  for (let i = 1; i < line.length; i++) if (len(sub(line[i], line[i - 1])) > 1e-4) lines.push(new Path(line[i - 1]).line(line[i]));
  for (const [q, nb] of [
    [line[0], line[1]],
    [line[line.length - 1], line[line.length - 2]],
  ]) {
    const t = unit(sub(nb, q));
    const nrm = p(-t.y, t.x);
    lines.push(new Path(add(q, mul(nrm, 0.4))).line(sub(q, mul(nrm, 0.4))));
  }
  const L = polyLen(line);
  const mid = between(line, L / 2 - 0.5, L / 2 + 0.5);
  const u = unit(sub(mid[mid.length - 1], mid[0]));
  let rotate = (Math.atan2(u.y, u.x) * 180) / Math.PI;
  if (rotate > 90) rotate -= 180;
  if (rotate <= -90) rotate += 180;
  const ring = pc.outline.points(4);
  const at = inward([lerp(mid[0], mid[mid.length - 1], 0.5), mid[mid.length - 1]], 0.8, ring)[0];
  return { ...pc, lines: [...pc.lines, ...lines], labels: [...pc.labels, { at, text, size: 0.55, rotate }] };
}

/** Split a top piece at x along a straight princess line through `pivot`, the top taken in by `grip`. */
function splitStraight(pc: Piece, x: number, pivot: P, grip: number, names: [string, string], cuts: [string, string]) {
  const r = ringOf(pc.outline);
  let i1 = insertAtX(r, 'neck', x)!;
  let i2 = i1;
  if (grip > 0) {
    r.pts.splice(i1 + 1, 0, { ...r.pts[i1] });
    r.tags.splice(i1, 0, 'princess');
    i1 = slide(r, i1, -1, grip / 2);
    i2 = slide(r, i1 + 1, 1, grip / 2);
  }
  // The two seams walked to the same length: the point they bend through moves across until they match
  // (the dart's legs were trued to its point, which now sits at the top edge).
  const n = r.tags.length;
  const wd = r.tags.findIndex((t, i) => t === 'dart' && r.tags[(i - 1 + n) % n] === 'waist' && r.tags[(i + 1) % n] === 'dart');
  if (wd >= 0) {
    const [far, near] = [r.pts[wd], r.pts[wd + 2]];
    const diff = (px: number) => {
      const q = p(px, pivot.y);
      return len(sub(r.pts[i1], q)) + len(sub(q, near)) - len(sub(r.pts[i2], q)) - len(sub(q, far));
    };
    let lo = pivot.x - 2;
    let hi = pivot.x + 2;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (diff(mid) < 0) lo = mid;
      else hi = mid;
    }
    pivot = p((lo + hi) / 2, pivot.y);
  }
  return panels(pc, { ring: r, i1, i2, pivot, move: (q) => q, top: r.pts[i1] }, names, cuts, {});
}

/** The bodice cut as a corset: four panels a side, princess seams from the top edge, boned. */
export function bonedPanels(d: BodiceDraft, s: BodiceStyle & { neckline: TopNeckline }): BodiceDraft {
  const [front, back] = d.pieces;
  const apex = d.front.apex;
  const grip = isStrapless(s.neckline) ? GRIP_CM / 4 : 0;
  // Front: the bust dart closed into a princess line rising straight from the bust point to the top edge.
  const fTop = runPts(front, 'neck');
  const arcTo = (poly: P[], x: number) => {
    let acc = 0;
    for (let i = 1; i < poly.length; i++) {
      const l = len(sub(poly[i], poly[i - 1]));
      if ((poly[i - 1].x - x) * (poly[i].x - x) <= 0 && poly[i].x !== poly[i - 1].x) return acc + (l * (x - poly[i - 1].x)) / (poly[i].x - poly[i - 1].x);
      acc += l;
    }
    return acc / 2;
  };
  const names = { f: ['Bodice centre front', 'Bodice side front'] as [string, string], b: ['Bodice centre back', 'Bodice side back'] as [string, string] };
  const m = moveBustDart(front.outline, apex, 'neck', { princess: true, along: arcTo(fTop, apex.x) });
  let f: ReturnType<typeof panels>;
  if (m) {
    const r = m.ring;
    let i1 = m.i1;
    if (grip > 0) {
      i1 = slide(r, i1, -1, grip / 2);
      slide(r, i1 + 1, 1, grip / 2);
    }
    f = panels(front, { ring: r, i1, i2: i1 + 1, pivot: apex, move: m.move, top: m.closedAt }, names.f, ['Cut 1 on fold', 'Cut 2 (1 pair)'], {});
  } else {
    // No bust dart to close (a very small bust): the princess line is cut straight through the bust point.
    f = splitStraight(front, apex.x, apex, grip, names.f, ['Cut 1 on fold', 'Cut 2 (1 pair)']);
  }
  // Back: from the top edge straight down the waist dart, which becomes the seam.
  const dl = back.lines.map((l) => l.points()).find((q) => q.length === 3);
  const bTop = runPts(back, 'neck');
  const xd = dl ? dl[1].x : bTop[bTop.length - 1].x * 0.48;
  const topY = yAt(bTop, xd) ?? bTop[0].y;
  const waistMid = dl ? lerp(dl[0], dl[2], 0.5) : p(xd, d.back.waistCentre.y);
  const b = splitStraight(back, xd, p(xd, (topY + waistMid.y) / 2), grip, names.b, ['Cut 2 (1 pair)', 'Cut 2 (1 pair)']);

  const fabric = 'Self fabric, coutil and lining';
  let pieces: Piece[] = [f.centre, f.side, b.centre, b.side].map((pc) => ({ ...(grip > 0 ? squareTop(pc) : pc), fabric }));

  // ---- boning ------------------------------------------------------------------------------------
  const bones: Bone[] = [];
  const bone = (i: number, poly: P[], where: string, count: number, offset = 0.6) => {
    const L = polyLen(poly);
    const length = L - BONE_STOP.top - BONE_STOP.waist;
    if (length < 4) return;
    const line = inward(between(poly, BONE_STOP.top, L - BONE_STOP.waist), offset, pieces[i].outline.points(4));
    pieces[i] = boneMarks(pieces[i], line, `BONE ${r1(length)} CM`);
    bones.push({ where, count, lengthCm: r1(length) });
  };
  const [cf, sf, cb] = pieces;
  // Down each seam from its top end: the runs go from the top edge to the waist.
  const fold = runPts(cf, 'fold').reverse();
  bone(0, fold, 'Centre front', 1);
  bone(0, runPts(cf, 'princess'), 'Front princess seams', 2);
  bone(1, runPts(sf, 'side'), 'Side seams', 2);
  bone(2, runPts(cb, 'princess'), 'Back princess seams', 2);
  const cbLine = runPts(cb, 'centre').reverse().map((q) => p(q.x + 1.5, q.y));
  bone(2, cbLine, 'Beside the zip', 2, 0);
  // Each bone is drawn just inside its seam (the one at the centre front just off the fold), to stand clear of the stitching line.
  pieces = pieces.map((pc, i) => (i === 0 ? { ...pc, draft: pc.draft && { ...pc.draft, points: [...pc.draft.points, { n: 'K', at: lerp(fold[0], fold[fold.length - 1], 0.5), note: `Boning: one bone down the centre front and one up every seam, centred over the seam, stopping ${cm(BONE_STOP.top)} below the top edge and ${cm(BONE_STOP.waist)} above the waist. A pair more sit ${cm(1.5)} in from the zip.` }] } } : pc));

  // The lines to draw on the flat, in the block's coordinates: the seams, and each channel beside them.
  const channel = (poly: P[]) => {
    const L = polyLen(poly);
    return between(poly, BONE_STOP.top, L - BONE_STOP.waist);
  };
  const off = (poly: P[], dx: number) => poly.map((q, i) => {
    const t = unit(sub(poly[Math.min(i + 1, poly.length - 1)], poly[Math.max(i - 1, 0)]));
    return add(q, mul(p(-t.y, t.x), dx));
  });
  const fFold = runPts(front, 'fold').reverse();
  const bCentre = runPts(back, 'centre').reverse();
  const stitch = (pts: P[]) => ({ pts, kind: 'stitch' as const });
  const styleLines: NonNullable<BodiceDraft['styleLines']> = {
    skip: 'all',
    front: [{ pts: f.line, kind: 'seam' }, stitch(off(channel(f.line), 0.5)), stitch(off(channel(f.line), -0.5)), stitch(channel(fFold).map((q) => p(0.5, q.y)))],
    back: [{ pts: b.line, kind: 'seam' }, stitch(off(channel(b.line), 0.5)), stitch(off(channel(b.line), -0.5)), stitch(channel(bCentre).map((q) => p(1.5, q.y)))],
  };
  const waistStay = { lengthCm: r1(d.finishedWaist + WAIST_STAY.ends), widthCm: WAIST_STAY.width };
  const topEdge = 2 * pieces.reduce((t, pc) => t + taggedLength(pc.outline, 'neck'), 0);
  return {
    ...d,
    block: [front, back],
    pieces,
    styleLines,
    neck: r1(topEdge),
    top: { ...d.top!, boned: true, grip: grip > 0 ? GRIP_CM : 0, topEdge: r1(topEdge), bones, waistStay },
  };
}

/** The style a top neckline is drafted with: no collar, buttons, sleeves or drawn neck, a back zip,
 * and for a boned bodice, waist length with bust and waist darts to carry into its seams. A lower
 * shoulder or a neck gape from a toile has no shoulder or neck to correct here (the straps take it). */
export function topStyle(s: BodiceStyle): BodiceStyle & { neckline: TopNeckline } {
  const fitting = s.fitting && { ...s.fitting, lowShoulder: undefined, neckGape: undefined };
  const out: BodiceStyle & { neckline: TopNeckline } = {
    ...s,
    neckline: s.neckline as TopNeckline,
    closure: 'back_zip',
    collar: 'none',
    neck: undefined,
    shoulderPad: undefined,
    fitting,
    bustDart: s.bustDart === 'shoulder' || s.bustDart === 'armhole' ? 'side' : s.bustDart,
    princess: 'none',
  };
  return isBoned(s) ? { ...out, length: 'waist', dropCm: undefined, darts: 'bust_waist', bustEase: undefined, bustDart: 'side' } : out;
}
