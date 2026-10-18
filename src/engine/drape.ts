// Draped bodices: the one-shoulder and the cowl necklines, and the peplum at the waist seam.
//
// Both necklines are made on the drafted block, the way a pattern cutter makes them on paper:
// - one-shoulder: the half block is traced twice into a whole front (and a whole back), since the
//   two sides differ. The top edge runs from the left neck point diagonally down to under the right
//   arm, the right armhole cut away into it. It is drafted 1 cm tighter over the bare bust (closed into
//   the bust dart) and stay-taped, so it lies against the body instead of gaping.
// - cowl: the bust dart is closed and opened at the centre front, the waist dart and a spread to the
//   shoulder follow as the drape needs, and the new centre front is ruled straight from the waist up.
//   A straight top edge squared from the neck point folds back into a grown-on facing. The front is
//   cut whole on the true bias, so it falls in soft folds.
// - peplum: a half-circle ring sector (the circle skirt's own drafting) or a gathered rectangle, its
//   waist edge walked to the bodice's waist seam.
//
// Whole pieces carry meta.whole: their seams appear on both sides (meta.seams says where a seam
// appears only once), and the pattern checks walk them half a piece at a time.
import { P, Path, add, len, lerp, mul, p, sub, taggedLength, unit } from './geometry';
import { finishDart } from './darts';
import { Ring, pathOf, ringOf } from './manipulate';
import type { DraftPoint, Piece } from './piece';
import type { BodiceDraft, BodiceMeasurements, BodiceStyle } from './bodice';
import { circlePiece, cm } from './skirt';
import { facing } from './finishing';

export type Peplum = 'none' | 'flared' | 'gathered';
export type DrapeKind = 'one_shoulder' | 'cowl';

/** The cowl's drape at the centre front, in cm below the block's centre front neck: a medium cowl. */
export const COWL_DEPTH = 10;
/** How shallow and how deep a drawn cowl can hang, in cm. */
export const COWL_DEPTH_RANGE = { min: 6, max: 16 };
/** The cowl's grown-on facing, at the centre front, in cm below the fold. */
export const COWL_FACING = 8;
/** The one-shoulder edge: how far below the underarm it meets the right side seam, how far above the
 * right bust point it passes, and how much tighter it is drafted over the bust. */
export const UNDER_ARM = 1.5;
export const ABOVE_BUST = 5;
export const TIGHTEN = 1;
/** A gathered peplum is cut this many times the waist. */
export const GATHER = 1.5;

export interface DrapeInfo {
  kind: DrapeKind;
  /** One-shoulder: the shoulder is on the wearer's left; an invisible zip goes in the right side seam,
   * from the top edge to the waist. */
  zip?: { openingCm: number; zipCm: number };
  /** One-shoulder: the top edge round the body (front and back stitching lines), and how much of the
   * 1 cm tightening the bust dart took (the rest is eased onto the stay tape). */
  edgeCm?: number;
  tightenCm?: number;
  /** Cowl: how deep the drape hangs, below the block's centre front neck, and its facing. */
  depthCm?: number;
  facingCm?: number;
  /** Cowl: a lining front with a lower neckline, hidden under the drape, for a lined bodice. */
  lining?: Piece;
}

export interface PeplumInfo {
  kind: 'flared' | 'gathered';
  depthCm: number;
  /** Round the peplum's hem. */
  hemCm: number;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const deg = (a: number) => Math.round((a * 180) / Math.PI);
const mx = (q: P) => p(-q.x, q.y);
const sx = (k: number) => (q: P) => p(q.x * k, q.y);
const rotAbout = (c: P, a: number) => (q: P) => {
  const v = sub(q, c);
  return add(c, p(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a)));
};
const angleFrom = (c: P, a: P, b: P) => {
  const u = sub(a, c);
  const v = sub(b, c);
  return Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y);
};

/** Whether a style has a draped neckline (a drawn neckline replaces it). */
export const isDraped = (s: { neckline: string; neck?: unknown }) => !s.neck && (s.neckline === 'one_shoulder' || s.neckline === 'cowl');

/**
 * A draped neckline allows none of the bodice's other neck and shaping details: no moved dart or
 * princess seams (the drape is the shaping), no collar and no button front. A cowl always has its
 * bust dart drafted, since that is what opens into the drape (none of it shows).
 */
export function drapeStyle<S extends BodiceStyle>(s: S): S {
  if (!isDraped(s)) return s;
  return { ...s, princess: 'none', bustDart: 'side', collar: 'none', closure: 'back_zip', ...(s.neckline === 'cowl' && s.darts === 'none' ? { darts: 'bust' } : {}) };
}

/** The dart run that follows an edge tagged `after`: its first, peak and last index. */
function dartAfter(r: Ring, after: string): [number, number, number] | undefined {
  const n = r.tags.length;
  for (let i = 0; i < n; i++) if (r.tags[i] === 'dart' && r.tags[(i - 1 + n) % n] === after && r.tags[(i + 1) % n] === 'dart') return [i, i + 1, i + 2];
  return undefined;
}

/** Points along a cubic from a to b, finer close to each end so the directions it leaves and arrives in
 * survive (the corner checks read them). Without a. */
function cubic(a: P, c1: P, c2: P, b: P, steps = 24): P[] {
  const ts = [0.0008, 0.006, ...Array.from({ length: steps - 1 }, (_, i) => (i + 1) / steps), 0.994, 0.9992, 1];
  return ts.map((t) => {
    const m = 1 - t;
    return p(m ** 3 * a.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t ** 3 * b.x, m ** 3 * a.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t ** 3 * b.y);
  });
}

/** Square to a direction, the way that heads toward `toward`. */
const squareToward = (d: P, toward: P) => {
  const a = p(-d.y, d.x);
  return a.x * toward.x + a.y * toward.y >= 0 ? a : mul(a, -1);
};

/** A run of points, tags[i] naming the edge pts[i] -> pts[i + 1]. */
interface Run {
  pts: P[];
  tags: string[];
}

/** Index of the centre front (or back) foot: where the edge on the centre line starts. */
const centreAt = (r: Ring) => r.tags.findIndex((t) => t === 'fold' || t === 'centre');

/** The half from its neck point round the shoulder, armhole, side and waist (or hem) to the centre. */
function coveredRun(r: Ring): Run {
  const i0 = r.tags.indexOf('shoulder');
  const iC = centreAt(r);
  return { pts: r.pts.slice(i0, iC + 1), tags: r.tags.slice(i0, iC) };
}

/** How much side seam there is below the underarm before the bust dart (or all of it). */
function sideAboveDart(r: Ring): number {
  let s = 0;
  for (let i = r.tags.indexOf('side'); i >= 0 && r.tags[i] === 'side'; i++) s += len(sub(r.pts[i + 1], r.pts[i]));
  return s;
}

/** The half from a point `u` cm down its side seam round the waist (or hem) to the centre, with the
 * seam's direction there. */
function bareRun(r: Ring, u: number): { run: Run; at: P; down: P } {
  const iC = centreAt(r);
  let k = r.tags.indexOf('side');
  let acc = 0;
  for (;;) {
    const l = len(sub(r.pts[k + 1], r.pts[k]));
    if (acc + l >= u || r.tags[k + 1] !== 'side') break;
    acc += l;
    k++;
  }
  const l = len(sub(r.pts[k + 1], r.pts[k]));
  const at = lerp(r.pts[k], r.pts[k + 1], l ? Math.min(1, (u - acc) / l) : 0);
  return { run: { pts: [at, ...r.pts.slice(k + 1, iC + 1)], tags: r.tags.slice(k, iC) }, at, down: unit(sub(r.pts[k + 1], r.pts[k])) };
}

/**
 * The one-shoulder top edge, from under the bare arm to the neck point of the covered shoulder,
 * through a point over the bare bust. It leaves the side seam square and arrives square to the
 * shoulder, so it runs on smoothly into the back's edge at both seams.
 */
export function oneShoulderEdge(U: P, inward: P, V: P, N: P, intoN: P): P[] {
  // Through V along the bisector of the two chords, so the edge neither sags nor bulges either side.
  const tV = unit(add(unit(sub(V, U)), unit(sub(N, V))));
  const a = len(sub(V, U));
  const b = len(sub(N, V));
  return [U, ...cubic(U, add(U, mul(inward, 0.45 * a)), sub(V, mul(tV, 0.35 * a)), V), ...cubic(V, add(V, mul(tV, 0.35 * b)), add(N, mul(intoN, 0.45 * b)), N)];
}

/** Two halves made into one piece: the covered half on the side `c` (+1 is x > 0), the bare half
 * mirrored to the other, and the top edge from under the bare arm to the covered neck point. */
function wholeOf(cov: Run, bare: Run, c: number, edge: P[]): Ring {
  const pts = [...cov.pts.map(sx(c)), ...[...bare.pts].reverse().slice(1).map(sx(-c)), ...edge.slice(1, -1)];
  const tags = [...cov.tags, ...[...bare.tags].reverse(), ...edge.slice(1).map(() => 'neck')];
  return { pts, tags };
}

/** The side bust dart's point: a dart whose opening runs down the piece. */
const sideTipOf = (pc: Piece) => {
  for (const ln of pc.lines) {
    const q = ln.points();
    if (q.length === 3 && Math.abs(q[2].y - q[0].y) > Math.abs(q[2].x - q[0].x)) return q[1];
  }
  return undefined;
};

const tipOf = (pc: Piece) => {
  // The waist dart (an opening across the piece) or a fish-eye: its upper point.
  for (const ln of pc.lines) {
    const q = ln.points();
    if (q.length === 3 && Math.abs(q[2].x - q[0].x) >= Math.abs(q[2].y - q[0].y)) return q[1];
    if (q.length === 5 && len(sub(q[0], q[4])) < 1e-6) return q[0];
  }
  return undefined;
};

const moveLine = (f: (q: P) => P) => (ln: Path) => {
  const q = ln.points().map(f);
  const out = new Path(q[0]);
  q.slice(1).forEach((x) => out.line(x));
  return out;
};

/** The one-shoulder bodice: a whole front and a whole back, the shoulder on the wearer's left. */
function oneShoulder(d: BodiceDraft): BodiceDraft {
  const [front, back] = d.pieces;
  const low = d.lowShoulder;
  // The covered shoulder is the left; a lower shoulder on either side is drafted on that side's half.
  const covF = low?.side === 'left' ? low.pieces[0] : front;
  const covB = low?.side === 'left' ? low.pieces[1] : back;
  const bareB = low?.side === 'right' ? low.pieces[1] : back;
  const rB = ringOf(bareB.outline);
  const u0 = Math.max(0.3, Math.min(UNDER_ARM, sideAboveDart(ringOf(front.outline)) - 1.5, sideAboveDart(rB) - 1.5));

  // The front: the left half (x > 0 as it lies right side up) round to the centre, the right half from
  // under the arm, and the edge between. Built once to find where the edge crosses over the bust, then
  // again with the bare half drafted tighter there.
  const bareF = low?.side === 'right' ? low.pieces[0] : front;
  const cov = coveredRun(ringOf(covF.outline));
  const N = cov.pts[0];
  const intoN = squareToward(unit(sub(cov.pts[1], N)), p(0, 1));
  const apex = d.front.apex;
  const tipS = sideTipOf(bareF) ?? apex;
  const polyLen = (q: P[]) => q.slice(1).reduce((t, x, i) => t + len(sub(x, q[i])), 0);
  const frontOf = (angle: number) => {
    // The right half, its side seam above the bust dart turned up about the bust point: the slash from
    // the edge straight down to the bust point closed, the dart opened by as much.
    const r0 = ringOf(bareF.outline);
    const sd = dartAfter(r0, 'side');
    const turn = rotAbout(apex, -angle);
    let r = r0;
    let dart: Path | undefined;
    if (sd && angle > 0) {
      const [iF, iP, iN] = sd;
      const iS = r0.tags.indexOf('side');
      const pts = r0.pts.map((q, i) => (i >= iS && i <= iF ? turn(q) : q));
      const tip = add(apex, mul(unit(sub(lerp(pts[iF], pts[iN], 0.5), apex)), len(sub(tipS, apex))));
      const dt = finishDart(tip, pts[iN], pts[iF], unit(sub(pts[iN + 1], pts[iN])));
      pts[iF] = dt.far;
      pts[iP] = dt.peak;
      pts[iN] = dt.near;
      r = { pts, tags: r0.tags };
      dart = new Path(dt.far).line(dt.tip).line(dt.near);
    }
    const bare = bareRun(r, u0);
    const inward = mx(squareToward(bare.down, p(-1, 0)));
    const V = mx(p(apex.x, apex.y - ABOVE_BUST));
    const edge = oneShoulderEdge(mx(bare.at), inward, V, N, intoN);
    return { ring: wholeOf(cov, bare.run, 1, edge), edge, bare, dart, V };
  };
  // The edge drafted about 1 cm tighter over the bare bust, so it lies flat against the body: slash
  // from the edge to the right bust point and close it, which opens the bust dart by as much. Kept
  // within 12 degrees, so the dart stays a size that sews flat; the stay tape holds the rest.
  let built = frontOf(0);
  let tightenCm = 0;
  if (d.bustDart > 0.3) {
    const base = polyLen(built.edge);
    const shorter = (a: number) => base - polyLen(frontOf(a).edge);
    const max = (12 * Math.PI) / 180;
    let lo = 0;
    let hi = max;
    if (shorter(max) > TIGHTEN)
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        if (shorter(mid) < TIGHTEN) lo = mid;
        else hi = mid;
      }
    else lo = hi;
    built = frontOf(lo);
    tightenCm = r1(base - polyLen(built.edge));
  }

  // The back: the left half mirrored (x < 0 as it lies right side up), the right from under the arm.
  const rCB = ringOf(covB.outline);
  const covRunB = coveredRun(rCB);
  const bareRB = bareRun(rB, u0);
  const NB = mx(covRunB.pts[0]);
  const uSB = mx(unit(sub(covRunB.pts[1], covRunB.pts[0])));
  const tipB = tipOf(bareB) ?? p(d.back.waistSide.x * 0.48, d.armholeDepth + 2.5);
  const VB = p(tipB.x, Math.min(tipB.y - 3, bareRB.at.y - 1.5));
  const edgeB = oneShoulderEdge(bareRB.at, squareToward(bareRB.down, p(-1, 0)), VB, NB, squareToward(uSB, p(0, 1)));
  const ringB = wholeOf(covRunB, bareRB.run, -1, edgeB);

  const edgeCm = r1(polyLen(built.edge) + polyLen(edgeB));
  // The opening: the right side seam from under the arm to the waist.
  const openingCm = r1(len(sub(d.back.waistSide, bareRB.at)));
  const zipCm = SIDE_ZIPS.find((z) => z >= openingCm - 0.5) ?? SIDE_ZIPS[SIDE_ZIPS.length - 1];
  const below = d.drop > 0;
  const whole = { whole: true, singleLayer: true, rightSideUp: true, seams: { shoulder: 1, armhole: 1 } };
  const centreY = (ring: Ring) => {
    const ys = ring.pts.filter((q, i) => Math.abs(q.x) < 0.5 || (ring.pts[i + 1] && q.x * ring.pts[(i + 1) % ring.pts.length].x < 0)).map((q) => q.y);
    return [Math.min(...ys), Math.max(...ys)];
  };
  const [topF, footF] = centreY(built.ring);
  const [topB, footB] = centreY(ringB);
  const cut = 'Cut 1, right side up';
  const zipNotch = (q: P, out: P): [P, P][] => (below ? [[q, out]] : []);

  // The right half's darts, its bust dart as opened by the tightening.
  const sideDart = (ln: Path) => {
    const q = ln.points();
    return q.length === 3 && Math.abs(q[2].y - q[0].y) > Math.abs(q[2].x - q[0].x);
  };
  const bareLinesF = [...bareF.lines.filter((ln) => !built.dart || !sideDart(ln)), ...(built.dart ? [built.dart] : [])].map(moveLine(mx));
  const points = (pc: Piece, k: number, drop: string[], extra: DraftPoint[]) => ({
    frame: pc.draft?.frame ?? [],
    points: [...(pc.draft?.points ?? []).filter((pt) => !drop.includes(pt.n)).map((pt) => ({ ...pt, at: sx(k)(pt.at) })), ...extra],
  });
  const shoulderLen = r1(len(sub(built.ring.pts[1], built.ring.pts[0])));
  const newFront: Piece = {
    ...front,
    outline: pathOf(built.ring),
    lines: [...covF.lines, ...bareLinesF],
    grain: [p(0, topF + 4), p(0, footF - 4)],
    fold: undefined,
    alternate: undefined,
    balance: [{ pts: [p(0, topF), p(0, footF)], label: 'CENTRE FRONT' }],
    notches: [...covF.notches, ...zipNotch(mx(d.front.waistSide), p(-1, 0))],
    labels: [
      { at: p(d.front.apex.x * 0.9, d.armholeDepth - 4.5), text: 'BODICE FRONT', size: 1.4 },
      { at: p(d.front.apex.x * 0.9, d.armholeDepth - 2.5), text: cut, size: 0.9 },
      { at: p(d.front.apex.x * 0.9, d.armholeDepth - 0.8), text: 'LEFT SHOULDER', size: 0.7 },
      ...(below ? [{ at: add(mx(d.front.waistSide), p(3.2, -0.6)), text: 'ZIP ENDS', size: 0.7 }] : []),
    ],
    cut,
    allowances: { ...front.allowances },
    draft: points(covF, 1, ['1'], [
      { n: 'L', at: built.ring.pts[0], note: `Left shoulder: the neck point moved 3 cm along the shoulder, leaving a strap of ${cm(shoulderLen)}. The half block is traced again, turned over, for the right side, since the two sides differ.` },
      { n: 'U', at: mx(built.bare.at), note: `Under the right arm: ${cm(u0)} down the side seam from the underarm. The top edge leaves the side seam square, so it runs on smoothly into the back's edge.` },
      {
        n: 'V',
        at: built.V,
        note: `${cm(ABOVE_BUST)} above the right bust point. The edge rises over the bust from here to the left neck point, where it arrives square to the shoulder.${tightenCm ? ` It is drafted ${cm(tightenCm)} tighter here: slash from the edge to the bust point and close it, so the right bust dart takes it.` : ''}`,
      },
    ]),
    meta: { ...front.meta, ...whole, covered: 1 },
  };
  const backCut = cut;
  const newBack: Piece = {
    ...back,
    outline: pathOf(ringB),
    lines: [...covB.lines.map(moveLine(mx)), ...bareB.lines],
    grain: [p(0, topB + 4), p(0, footB - 4)],
    alternate: undefined,
    balance: [{ pts: [p(0, topB), p(0, footB)], label: 'CENTRE BACK' }],
    // The double notch on the left armhole; no zip at the centre back.
    notches: [...covB.notches.filter(([q]) => Math.abs(q.x) > 1e-6).map(([q, dir]): [P, P] => [mx(q), mx(dir)]), ...zipNotch(d.back.waistSide, p(1, 0))],
    labels: [
      { at: p(-d.back.waistSide.x * 0.45, d.armholeDepth + 3), text: 'BODICE BACK', size: 1.4 },
      { at: p(-d.back.waistSide.x * 0.45, d.armholeDepth + 5), text: backCut, size: 0.9 },
      { at: p(-d.back.waistSide.x * 0.45, d.armholeDepth + 6.7), text: 'LEFT SHOULDER', size: 0.7 },
      ...(below ? [{ at: add(d.back.waistSide, p(-3.2, -0.6)), text: 'ZIP ENDS', size: 0.7 }] : []),
    ],
    cut: backCut,
    allowances: { ...back.allowances },
    draft: {
      frame: back.draft?.frame ?? [],
      points: [
        ...(covB.draft?.points ?? []).filter((pt) => ['3', '4', '5'].includes(pt.n)).map((pt) => ({ ...pt, at: mx(pt.at) })),
        ...(bareB.draft?.points ?? []).filter((pt) => !['0', '3', '4', '5'].includes(pt.n)),
        { n: 'U', at: bareRB.at, note: `Under the right arm: ${cm(u0)} down the side seam, as on the front, so the two side seams match.` },
        { n: 'V', at: VB, note: `Clear of the right waist dart. The edge rises across the back from here to the left neck point, square to the shoulder.` },
      ],
    },
    meta: { ...back.meta, ...whole, covered: -1 },
  };
  return {
    ...d,
    pieces: [newFront, newBack, ...d.pieces.slice(2)],
    block: [front, back],
    styleLines: undefined,
    neck: edgeCm,
    zipCm,
    drape: { kind: 'one_shoulder', zip: { openingCm, zipCm }, edgeCm, tightenCm },
  };
}

/** Invisible zips for a side opening, shortened to fit from the bottom. */
export const SIDE_ZIPS = [20, 22, 25, 30, 35, 40];

/** The cowl front's spread: closing the bust dart (always all of it), the waist dart (as much as the
 * drape needs), then a spread from the centre front to the armhole. */
interface Spread {
  /** Bust dart closed, radians about the bust point. */
  bust: number;
  /** Waist dart closed, radians about its point. */
  waist: number;
  /** Spread to the armhole, radians: the shoulder turns by as much, the armhole by less and less
   * down to its notch. */
  fan: number;
}

interface CowlHalf {
  run: Run;
  /** The neck point, the top of the new centre front, and the top of the facing. */
  N: P;
  T: P;
  Tf: P;
  move: { up: (q: P) => P; side: (q: P) => P };
  waistDart?: { near: P; tip: P; far: P };
}

/** Where the cowl's spread puts things: the block's front ring and its landmarks. */
function cowlFrame(front: Piece, apex: P) {
  const r = ringOf(front.outline);
  const side = dartAfter(r, 'side');
  const waist = dartAfter(r, 'waist');
  const tipW = tipOf(front);
  // Each dart closes about its own point, where its legs are trued to the same length.
  const tipS = sideTipOf(front) ?? apex;
  const iSh = r.tags.indexOf('shoulder');
  const iC = centreAt(r);
  const bustFull = side ? angleFrom(tipS, r.pts[side[0]], r.pts[side[2]]) : 0;
  const waistFull = waist && tipW ? angleFrom(tipW, r.pts[waist[0]], r.pts[waist[2]]) : 0;
  const moves = (sp: Spread) => {
    const sideMove = waist && tipW ? rotAbout(tipW, sp.waist) : (q: P) => q;
    const bust = rotAbout(tipS, sp.bust);
    return { side: sideMove, up: (q: P) => sideMove(bust(q)) };
  };
  // The spread to the armhole hinges on the armhole from the across front notch up: each bit of the
  // armhole turns a little more than the one below it, the shoulder and all above it by the whole spread.
  // That is many slashes from the centre front to the armhole, opened evenly: the armhole keeps its
  // length, leaves the notch in its own direction and still meets the shoulder at its own angle.
  const iF = side ? side[0] : r.tags.indexOf('side') + 1;
  const notch = front.notches[0]?.[0];
  const arm: number[] = [];
  for (let i = iSh + 1; i < iF; i++) if (r.tags[i] === 'armhole') arm.push(i);
  const iA = notch ? arm.reduce((b, i) => (len(sub(r.pts[i], notch)) < len(sub(r.pts[b], notch)) ? i : b), arm[0]) : arm[Math.floor(arm.length / 2)];
  /** The points from the neck point to the last above the bust dart (ring indices iSh to iF - 1). */
  const upper = (sp: Spread): P[] => {
    const mv = moves(sp);
    const q = r.pts.slice(iSh, iF).map(mv.up);
    const a = iA - iSh;
    let S = 0;
    for (let i = 1; i < a; i++) S += len(sub(q[i + 1], q[i]));
    const out = [...q];
    let s = 0;
    for (let i = a - 1; i >= 0; i--) {
      const l = len(sub(q[i], q[i + 1]));
      const phi = i === 0 || S < 1e-6 ? sp.fan : (sp.fan * (s + l / 2)) / S;
      s += l;
      out[i] = add(out[i + 1], rotAbout(p(0, 0), phi)(sub(q[i], q[i + 1])));
    }
    return out;
  };
  const neckAt = (sp: Spread) => upper(sp)[0];
  return { r, side, waist, tipW, iSh, iC, iF, bustFull, waistFull, moves, upper, neckAt };
}

/** The spread that hangs the drape `depth` cm below the block's centre front neck. */
function cowlSpread(f: ReturnType<typeof cowlFrame>, N0: P, target: number): Spread {
  const solve = (lo: number, hi: number, at: (v: number) => number) => {
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid) < target) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  void N0;
  const sp: Spread = { bust: f.bustFull, waist: 0, fan: 0 };
  if (f.neckAt(sp).x >= target) return sp;
  sp.waist = f.waistFull;
  if (f.neckAt(sp).x >= target) return { ...sp, waist: solve(0, f.waistFull, (w) => f.neckAt({ ...sp, waist: w }).x) };
  const maxFan = (45 * Math.PI) / 180;
  return { ...sp, fan: f.neckAt({ ...sp, fan: maxFan }).x >= target ? solve(0, maxFan, (a) => f.neckAt({ ...sp, fan: a }).x) : maxFan };
}

/** One half of the cowl front: from the top of the facing at the centre front round to the waist. */
function cowlHalf(f: ReturnType<typeof cowlFrame>, sp: Spread, s: BodiceStyle, top?: { T: P; Tf: P }): CowlHalf {
  const { r, side, waist, tipW, iSh, iC, iF } = f;
  const mv = f.moves(sp);
  const up = f.upper(sp);
  const sh = [up[1], up[0]];
  const N = up[0];
  const T = top?.T ?? p(0, N.y);
  const Tf = top?.Tf ?? p(0, T.y - COWL_FACING);
  // The facing mirrors the top of the cowl across its fold: the shoulder for a few cm, then a curve
  // back to the centre front.
  const fu = unit(sub(N, T));
  const fold = (q: P) => {
    const v = sub(q, T);
    const k = 2 * (v.x * fu.x + v.y * fu.y);
    return add(T, sub(mul(fu, k), v));
  };
  const shLen = sh.slice(1).reduce((t, q, i) => t + len(sub(q, sh[i])), 0);
  const want = Math.min(5, shLen * 0.5);
  const near: P[] = [N];
  let acc = 0;
  for (let i = sh.length - 1; i > 0 && acc < want; i--) {
    const l = len(sub(sh[i - 1], sh[i]));
    if (acc + l >= want) {
      near.push(lerp(sh[i], sh[i - 1], (want - acc) / l));
      acc = want;
    } else {
      near.push(sh[i - 1]);
      acc += l;
    }
  }
  const facingShoulder = near.map(fold).reverse();
  const Sf = facingShoulder[0];
  const along = unit(sub(facingShoulder[1], Sf));
  const into = squareToward(along, sub(Tf, Sf));
  const facingEdge = cubic(Tf, add(Tf, p(Sf.x * 0.5, 0)), add(Sf, mul(into, len(sub(Sf, Tf)) * 0.35)), Sf);

  const pts: P[] = [Tf, ...facingEdge];
  const tags: string[] = facingEdge.map(() => 'facing');
  facingShoulder.slice(1).forEach((q) => {
    pts.push(q);
    tags.push('facing-shoulder');
  });
  // The shoulder, neck to armhole.
  [...sh].reverse().slice(1).forEach((q) => {
    pts.push(q);
    tags.push('shoulder');
  });
  // The armhole and the side seam above the bust dart, moved up with the closed darts and spread.
  // Without a bust dart the two regions are one, and nothing is left out between them.
  for (let i = iSh + 2; i < iF; i++) {
    pts.push(up[i - iSh]);
    tags.push(r.tags[i - 1]);
  }
  tags.push(r.tags[iF - 1]);
  // Below the closed bust dart: the side seam and the waist to the waist dart, moved with it.
  const iN = side ? side[2] : iF;
  const iWf = waist ? waist[0] : iC;
  const iWn = waist ? waist[2] : iC;
  const closed = waist && sp.waist >= f.waistFull - 1e-6;
  for (let i = iN; i <= iWf; i++) {
    if (i === iWf && closed) break;
    pts.push(mv.side(r.pts[i]));
    if (i < iWf) tags.push(r.tags[i]);
  }
  let waistDart: CowlHalf['waistDart'];
  if (waist && tipW && !closed) {
    // What is left of the waist dart, trued again: its point stays, its far leg swung in.
    const away = unit(sub(r.pts[iWn + 1], r.pts[iWn]));
    const dt = finishDart(tipW, r.pts[iWn], mv.side(r.pts[iWf]), away);
    pts[pts.length - 1] = dt.far;
    pts.push(dt.peak, dt.near);
    tags.push('dart', 'dart', r.tags[iWn]);
    waistDart = { near: dt.near, tip: dt.tip, far: dt.far };
  }
  // On to the centre front, which stays where it was.
  for (let i = waist ? iWn + (closed ? 0 : 1) : iWf + 1; i <= iC; i++) {
    pts.push(r.pts[i]);
    if (i < iC) tags.push(r.tags[i]);
  }
  void s;
  return { run: { pts, tags }, N, T, Tf, move: mv, waistDart };
}

/** A half run and its mirror, as one ring, the centre line inside it. */
function mirrored(run: Run): Ring {
  const back = [...run.pts].reverse().slice(1, -1).map(mx);
  return { pts: [...run.pts, ...back], tags: [...run.tags, ...[...run.tags].reverse()] };
}

/** The cowl bodice: the front opened into a drape and cut whole on the bias; the back as drafted. */
function cowl(d: BodiceDraft, s: BodiceStyle, redraft: (s: BodiceStyle) => BodiceDraft): BodiceDraft {
  const [front, back] = d.pieces;
  const apex = d.front.apex;
  const f = cowlFrame(front, apex);
  const N0 = f.r.pts[f.iSh];
  // The top edge hangs between the two neck points: to fall `COWL_DEPTH` below the block's neck at the
  // centre front, half of it must be as long as from the neck point to there.
  const fall = d.neckBlock.front.neckY + Math.min(COWL_DEPTH_RANGE.max, Math.max(COWL_DEPTH_RANGE.min, s.cowlDepth ?? COWL_DEPTH)) - N0.y;
  const target = Math.hypot(N0.x, fall);
  const sp = cowlSpread(f, N0, target);
  const half = cowlHalf(f, sp, s);
  const ring = mirrored(half.run);
  const L = half.N.x;
  const depthCm = r1(N0.y + Math.sqrt(Math.max(0, L * L - N0.x * N0.x)) - d.neckBlock.front.neckY);

  // A lower shoulder: the other half drafted from that side's block with the same spread, drawn as a
  // second line on the wearer's left (x > 0) or right.
  let alternate: Piece['alternate'];
  if (d.lowShoulder && front.alternate) {
    const fa = cowlFrame({ ...front, outline: front.alternate.outline }, apex);
    const ha = cowlHalf(fa, sp, s, { T: half.T, Tf: half.Tf });
    const k = d.lowShoulder.side === 'left' ? 1 : -1;
    const main = half.run;
    const pts = [...ha.run.pts.map(sx(k)), ...[...main.pts].reverse().slice(1, -1).map(sx(-k))];
    alternate = { outline: pathOf({ pts, tags: [...ha.run.tags, ...[...main.tags].reverse()] }), label: front.alternate.label };
  }

  const W0 = half.run.pts[half.run.pts.length - 1];
  const g = unit(p(1, 1));
  const gc = p(0, (half.T.y + W0.y) / 2 + 2);
  const notch = front.notches[0];
  const notches: [P, P][] = notch ? [[half.move.up(notch[0]), sub(half.move.up(add(notch[0], notch[1])), half.move.up(notch[0]))]] : [];
  const cut = 'Cut 1, single layer, on the bias';
  const lines: Path[] = [
    // A top below the waist keeps its fish-eye darts, which the spread leaves where they are.
    ...front.lines.filter((ln) => ln.points().length === 5),
    ...(half.waistDart ? [new Path(half.waistDart.near).line(half.waistDart.tip).line(half.waistDart.far)] : []),
    // The bust point.
    new Path(sub(apex, p(0.5, 0))).line(add(apex, p(0.5, 0))),
    new Path(sub(apex, p(0, 0.5))).line(add(apex, p(0, 0.5))),
  ];
  const keep = (n: string) => ['0', '2', '4', '5', '6'].includes(n);
  const blockPts = front.draft?.points ?? [];
  const fanWords = sp.fan > 1e-3 ? `, then slash from the centre front to the armhole above the notch and spread ${deg(sp.fan)} degrees more, the armhole hinging as it opens` : '';
  const darts = sp.waist > 1e-3 ? `the bust dart and ${sp.waist >= f.waistFull - 1e-6 ? 'the' : 'part of the'} waist dart` : 'the bust dart';
  const points: DraftPoint[] = [
    ...blockPts.filter((pt) => keep(pt.n)).map((pt) => ({ ...pt, at: half.move.up(pt.at) })),
    ...blockPts.filter((pt) => pt.n === '3' || pt.n === '7' || (pt.n === 'D' && half.waistDart)),
    ...blockPts.filter((pt) => pt.n === '8').map((pt) => ({ ...pt, at: half.move.side(pt.at) })),
    {
      n: 'C',
      at: p(0, d.neckBlock.front.neckY + COWL_DEPTH),
      note: `Cowl depth: ${cm(COWL_DEPTH)} below the block's centre front neck, a medium drape. Slash from here to the bust point.`,
    },
    {
      n: 'S',
      at: half.N,
      note: `Close ${darts}, so the slash opens at the centre front${fanWords}, until the neck point is ${cm(L)} from the centre front: the top edge then hangs about ${cm(depthCm)} below the block's neck in soft folds.`,
    },
    { n: 'T', at: half.T, note: 'Rule the new centre front straight up from the waist, and square across from it to the neck point. This straight top edge is the fold of the cowl.' },
    { n: 'F', at: half.Tf, note: `Facing: ${cm(COWL_FACING)} above the fold at the centre front, the shoulder traced across the fold for its first few cm, so the facing is caught in the shoulder seam.` },
  ];
  const newFront: Piece = {
    ...front,
    outline: pathOf(ring),
    lines: [...lines, ...lines.map(moveLine(mx))],
    grain: [sub(gc, mul(g, 9)), add(gc, mul(g, 9))],
    fold: undefined,
    alternate,
    balance: [
      { pts: [p(-L, half.T.y), p(L, half.T.y)], label: 'FOLD LINE' },
      { pts: [W0, half.Tf], label: 'CENTRE FRONT' },
    ],
    notches: [...notches, ...notches.map(([q, dir]): [P, P] => [mx(q), mx(dir)]), [W0, p(0, 1)]],
    labels: [
      { at: p(0, half.T.y + 6), text: 'BODICE FRONT', size: 1.4 },
      { at: p(0, half.T.y + 8), text: cut, size: 0.9 },
      { at: p(0, half.T.y + 9.6), text: 'TRUE BIAS: GRAIN AT 45 DEGREES', size: 0.6 },
    ],
    cut,
    allowances: { neck: s.neckArmholeAllowance, armhole: s.neckArmholeAllowance, facing: 0, hem: s.hemAllowance },
    draft: front.draft ? { frame: front.draft.frame, points } : undefined,
    meta: { ...front.meta, whole: true, bias: true, singleLayer: true, unlined: true },
  };

  // Lined, the front lining sits under the drape with a lower neckline of its own.
  const lowered = redraft({ ...s, neckline: 'scoop', neck: { frontDepth: depthCm + 2, width: 3, backDepth: 1.5, fullness: 0.6 } });
  const lp = lowered.pieces[0];
  const lining: Piece = {
    ...lp,
    name: 'Bodice front lining',
    kind: 'lining',
    fabric: 'Lining',
    labels: lp.labels.map((l) => (l.text === 'BODICE FRONT' ? { ...l, text: 'FRONT LINING' } : l)),
    draft: undefined,
    alternate: undefined,
  };
  return {
    ...d,
    pieces: [newFront, ...d.pieces.slice(1)],
    block: [front, back],
    styleLines: undefined,
    neck: r1(2 * taggedLength(back.outline, 'neck')),
    drape: { kind: 'cowl', depthCm, facingCm: COWL_FACING, lining },
  };
}

/** How deep the peplum is: about 85% of the waist to hip, between 15 and 20 cm. */
export const peplumDepth = (m: { waist_to_hip?: number }) => Math.max(15, Math.min(20, Math.round(0.85 * (m.waist_to_hip ?? 20))));

/** A gathered peplum piece: a rectangle, its waist edge gathered to the bodice's. */
function rectPiece(name: string, w: number, h: number, isFront: boolean, sa: number): Piece {
  const outline = new Path(p(0, 0)).line(p(w, 0), 'waist').line(p(w, h), 'side').line(p(0, h), 'hem').line(p(0, 0), isFront ? 'fold' : 'centre');
  outline.closed = true;
  const cut = isFront ? 'Cut 1 on fold' : 'Cut 2 (1 pair)';
  return {
    name,
    outline,
    lines: [],
    grain: [p(w * 0.6, h * 0.25), p(w * 0.6, h * 0.75)],
    fold: isFront ? [p(0, 2), p(0, h - 2)] : undefined,
    notches: isFront ? [[p(w, h * 0.4), p(1, 0)]] : [[p(w, h * 0.4 - 0.5), p(1, 0)], [p(w, h * 0.4 + 0.5), p(1, 0)]],
    labels: [
      { at: p(w * 0.35, h * 0.45), text: name.toUpperCase(), size: 1.2 },
      { at: p(w * 0.35, h * 0.45 + 2), text: cut, size: 0.8 },
      { at: p(w * 0.35, 1.6), text: 'GATHER', size: 0.6 },
    ],
    cut,
    seamAllowance: sa,
    allowances: { hem: 1, fold: 0 },
    meta: { gathered: GATHER },
  };
}

/** The peplum's pieces, their waist walked to the bodice's waist seam, front to front and back to back. */
function withPeplum(d: BodiceDraft, kind: 'flared' | 'gathered', s: BodiceStyle, m: BodiceMeasurements): BodiceDraft {
  const half = (pc: Piece) => taggedLength(pc.outline, 'waist') / (pc.meta.whole ? 2 : 1);
  const own = d.pieces.filter((pc) => !pc.kind);
  const F = own.filter((pc) => /front/i.test(pc.name)).reduce((t, pc) => t + half(pc), 0);
  const B = own.filter((pc) => /back/i.test(pc.name)).reduce((t, pc) => t + half(pc), 0);
  const depth = peplumDepth(m);
  let pieces: Piece[];
  let hemCm: number;
  if (kind === 'flared') {
    // A half circle: the waist round the body is half of a circle's, so its radius is the waist over pi.
    const r = (2 * (F + B)) / Math.PI;
    const common = { r, darts: [], dartLen: 0, length: depth, hipDepth: depth + 100, sa: s.seamAllowance, hemSa: 1, zipCm: 0 };
    const tidy = (pc: Piece, isFront: boolean): Piece => ({
      ...pc,
      notches: pc.notches.filter(([q]) => len(q) > 1e-6),
      labels: pc.labels.filter((l) => l.text !== 'ZIP ENDS'),
      draft: {
        frame: [],
        points: [
          { n: '0', at: p(0, 0), note: `Centre ${isFront ? 'front' : 'back'} waist. The waist is an arc of radius ${cm(r)}: the bodice's waist seam round the body, ${cm(2 * (F + B))}, over pi, for a half circle.` },
          { n: '1', at: p(0, depth), note: `0 to 1, peplum depth: ${cm(depth)}, about 85% of your waist to hip. The hem is an arc from the same centre.` },
          { n: '2', at: pc.draft!.points[2].at, note: `Side waist: the arc is ${cm(isFront ? F : B)} long, the bodice ${isFront ? 'front' : 'back'}'s waist seam with its darts closed, so the two sew together exactly.` },
        ],
      },
    });
    pieces = [tidy(circlePiece({ ...common, name: 'Peplum front', angle: F / r, isFront: true, onFold: true }), true), tidy(circlePiece({ ...common, name: 'Peplum back', angle: B / r, isFront: false, onFold: false }), false)];
    hemCm = r1((2 * (F + B) * (r + depth)) / r);
  } else {
    const point = (pc: Piece, isFront: boolean): Piece => ({
      ...pc,
      draft: {
        frame: [],
        points: [
          { n: '0', at: p(0, 0), note: `Centre ${isFront ? 'front' : 'back'} waist. A rectangle ${cm(depth)} deep, about 85% of your waist to hip.` },
          { n: '1', at: p(GATHER * (isFront ? F : B), 0), note: `Side waist: ${GATHER} times the bodice ${isFront ? 'front' : 'back'}'s waist seam, ${cm(isFront ? F : B)}, gathered to fit it.` },
        ],
      },
    });
    pieces = [point(rectPiece('Peplum front', GATHER * F, depth, true, s.seamAllowance), true), point(rectPiece('Peplum back', GATHER * B, depth, false, s.seamAllowance), false)];
    hemCm = r1(2 * GATHER * (F + B));
  }
  // A peplum hangs single, its hem narrow, so it isn't lined with the bodice.
  pieces = pieces.map((pc) => ({ ...pc, meta: { ...pc.meta, unlined: true } }));
  return { ...d, pieces: [...d.pieces, ...pieces], peplum: { kind, depthCm: depth, hemCm } };
}

/** The draped neckline and the peplum, made on the drafted bodice. */
export function drapeBodice(d: BodiceDraft, s: BodiceStyle, m: BodiceMeasurements, redraft: (s: BodiceStyle) => BodiceDraft): BodiceDraft {
  let out = d;
  if (isDraped(s)) out = s.neckline === 'cowl' ? cowl(d, s, redraft) : oneShoulder(d);
  if (s.peplum && s.peplum !== 'none' && d.drop === 0) out = withPeplum(out, s.peplum, s, m);
  return out;
}

/** Facings for a draped neckline: a one-shoulder's top edge and its one armhole, cut from the whole
 * pieces (each cut once, the fabric right side down, so it lies the right way inside); a cowl's back
 * neck and its armholes, its front faced by the cowl's own facing. */
export function drapeFacings(d: BodiceDraft, armholes = true, neck = true): Piece[] {
  if (!d.drape) return [];
  if (d.drape.kind === 'one_shoulder') {
    const [front, back] = d.pieces;
    const once = (pc: Piece | undefined): Piece | undefined =>
      pc && { ...pc, cut: 'Cut 1, right side down', fold: undefined, labels: pc.labels.map((l, i) => (i === 1 ? { ...l, text: 'Cut 1, right side down' } : l)) };
    return [
      ...(neck ? [once(facing(front, 'neck', 5, 'Front facing')), once(facing(back, 'neck', 5, 'Back facing'))] : []),
      ...(armholes ? [once(facing(front, 'armhole', 4, 'Front armhole facing')), once(facing(back, 'armhole', 4, 'Back armhole facing'))] : []),
    ].filter((pc): pc is Piece => !!pc);
  }
  // The front armhole facing follows the cowl's own (spread) armhole, on the bias like the front.
  const [cf] = d.pieces;
  const [, bb] = d.block ?? d.pieces;
  const fa = facing(cf, 'armhole', 4, 'Front armhole facing');
  return [
    ...(neck ? [facing(bb, 'neck', 5, 'Back neck facing')] : []),
    ...(armholes ? [fa && { ...fa, meta: { ...fa.meta, bias: true } }, facing(bb, 'armhole', 4, 'Back armhole facing')] : []),
  ].filter((pc): pc is Piece => !!pc);
}

/** The draped bodice's own rows for the measurements table. */
export function drapeSpec(d: BodiceDraft): { label: string; finished: number | string }[] {
  return [
    ...(d.drape?.kind === 'cowl' ? [{ label: 'Cowl drape, below the neck', finished: d.drape.depthCm ?? '' }] : []),
    ...(d.drape?.kind === 'one_shoulder' ? [{ label: 'Top edge, front and back', finished: d.drape.edgeCm ?? '' }] : []),
    ...(d.peplum ? [{ label: `Peplum (${d.peplum.kind}), depth`, finished: d.peplum.depthCm }, { label: 'Peplum hem, round', finished: d.peplum.hemCm }] : []),
  ];
}

/**
 * A draped bodice's pieces for a lined bodice. Most are cut in both fabrics; a one-shoulder's whole
 * pieces have a lining of their own, cut right side down so it turns in the right way round; the cowl
 * front and the peplum are not lined, and the cowl has its own lower lining front.
 */
export function drapeLined(pieces: Piece[], d: BodiceDraft): Piece[] {
  const out = pieces.flatMap((pc): Piece[] => {
    if (pc.kind || pc.meta.unlined || /coutil/.test(pc.fabric ?? '')) return [pc];
    if (pc.meta.covered) {
      const cut = 'Cut 1, right side down';
      const lining: Piece = {
        ...pc,
        name: `${pc.name} lining`,
        kind: 'lining',
        fabric: 'Lining',
        cut,
        notches: pc.notches,
        // Cut printed side down, so it is laid turned over.
        meta: { ...pc.meta, rightSideUp: false },
        labels: pc.labels
          .filter((l) => l.text !== 'ZIP ENDS')
          .map((l) => (l.text === pc.cut ? { ...l, text: cut } : l.text.startsWith('BODICE') ? { ...l, text: `${l.text} LINING` } : l)),
        draft: undefined,
      };
      return [pc, lining];
    }
    return [{ ...pc, fabric: 'Self fabric and lining' }];
  });
  return d.drape?.lining ? [...out, d.drape.lining] : out;
}

/** A line for the printed notes on how a draped bodice is cut. */
export function drapeNote(d: BodiceDraft): string | undefined {
  if (d.drape?.kind === 'one_shoulder')
    return `One shoulder, on the left. The front and back are cut whole, each in a single layer with the fabric right side up. The top edge, ${cm(d.drape.edgeCm ?? 0)} round, is drafted a little tight and stay-taped.`;
  if (d.drape?.kind === 'cowl')
    return `Cowl neck, about ${cm(d.drape.depthCm ?? COWL_DEPTH)} deep. The front is cut whole on the true bias, in a single layer, with its facing cut in one with it. Use a fluid fabric.`;
  return undefined;
}
