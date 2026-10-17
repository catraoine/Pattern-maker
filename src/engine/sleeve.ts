// The set-in sleeve, drafted to the bodice's own armhole. The crown is walked against the armhole it
// sews into: its height is found so the crown is the armhole's length plus the crown ease, and its
// top point so the ease is shared between front and back the way a tailor sets it (a little more at
// the back, over the shoulder blade). The notches sit at the armhole's own notches, with the ease
// above them. Fitted long sleeves get an elbow dart, made by turning the forearm forward from the
// front elbow, so the sleeve bends with the arm.
import { P, Path, add, len, lerp, mul, p, sub, unit } from './geometry';
import type { Piece } from './piece';
import { BodiceDraft, BodiceFit, blockOf } from './bodice';
import { DraftError } from './skirt';

export type SleeveLength = 'none' | 'short' | 'elbow' | 'three_quarter' | 'long';
export type SleeveShape = 'fitted' | 'straight' | 'puff' | 'bishop';

/** Which shapes each length allows: puff sleeves are short, bishop sleeves long. */
export const SHAPES_FOR_LENGTH: Record<SleeveLength, SleeveShape[]> = {
  none: [],
  short: ['straight', 'puff'],
  elbow: ['fitted', 'straight', 'puff'],
  three_quarter: ['fitted', 'straight', 'bishop'],
  long: ['fitted', 'straight', 'bishop'],
};

export interface SleeveMeasurements {
  /** Shoulder point to wrist bone, over a slightly bent elbow. */
  arm_length?: number;
  /** Around the fullest part of the upper arm. */
  upper_arm?: number;
  wrist?: number;
}

export interface SleeveStyle {
  length: Exclude<SleeveLength, 'none'>;
  shape: SleeveShape;
  fit: BodiceFit;
  seamAllowance: number;
  armholeAllowance: number;
  hemAllowance: number;
  /** A jacket or coat sleeve, worn over other clothes: more room at the bicep and the hem, a little
   * longer, and the crown ease a tailor works into a wool armhole. */
  outer?: 'jacket' | 'coat';
}

/** Bicep and crown ease for jacket and coat sleeves, by fit. */
export const OUTER_SLEEVE_EASE: Record<'jacket' | 'coat', Record<BodiceFit, { bicep: number; crown: number }>> = {
  jacket: { fitted: { bicep: 8, crown: 3.5 }, regular: { bicep: 10, crown: 3 }, relaxed: { bicep: 13, crown: 2.5 } },
  coat: { fitted: { bicep: 10, crown: 3.5 }, regular: { bicep: 13, crown: 3 }, relaxed: { bicep: 16, crown: 2.5 } },
};

/** Ease round the upper arm, and the crown ease eased into the armhole, by fit. */
export const SLEEVE_EASE: Record<BodiceFit, { bicep: number; crown: number }> = {
  fitted: { bicep: 5, crown: 3 },
  regular: { bicep: 6.5, crown: 2.5 },
  relaxed: { bicep: 9, crown: 1.8 },
};

/** Share of the crown ease that goes into the back half. */
const BACK_SHARE = 0.55;
/** Width of a puff or bishop sleeve's band when finished, in cm. */
export const BAND_CM = 3;

export interface SleeveDraft {
  pieces: Piece[];
  capHeight: number;
  /** Width across the bicep line, finished. */
  bicep: number;
  /** Crown length less armhole length, front and back: eased in, or gathered on a puff sleeve. */
  crownEase: { front: number; back: number };
  armhole: { front: number; back: number };
  /** Centre of the crown to the hem. */
  lengthCm: number;
  /** Round the hem as finished: the hem, or the band on a gathered sleeve. */
  hemCm: number;
  /** Gathered sleeves: how much is gathered into the armhole (puff) and into the band. */
  gathers?: { crown?: number; hem: number };
  elbowDart?: number;
  warnings: string[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** The armhole of a bodice piece, from the shoulder point round to the underarm. */
function armholeOf(pc: Piece) {
  const { pts, tags } = pc.outline.taggedPoints(48);
  const first = tags.indexOf('armhole');
  const last = tags.lastIndexOf('armhole');
  if (first < 0) throw new DraftError('The bodice has no armhole to fit a sleeve to.');
  const run = pts.slice(first, last + 2);
  const along = [0];
  for (let i = 1; i < run.length; i++) along.push(along[i - 1] + len(sub(run[i], run[i - 1])));
  const length = along[along.length - 1];
  // The armhole notch (single at the front, double at the back): how far it is above the underarm.
  const notchAt = pc.notches.map(([q]) => q).filter((q) => run.some((r) => len(sub(r, q)) < 1));
  const mid = notchAt.length ? mul(notchAt.reduce((s, q) => add(s, q), p(0, 0)), 1 / notchAt.length) : run[Math.round(run.length * 0.6)];
  let best = 0;
  run.forEach((q, i) => {
    if (len(sub(q, mid)) < len(sub(run[best], mid))) best = i;
  });
  return { length, notchFromUnder: length - along[best], depth: run[run.length - 1].y - run[0].y };
}

const cubicPts = (a: P, c1: P, c2: P, b: P, n = 20): P[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const m = 1 - t;
    return p(m ** 3 * a.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t ** 3 * b.x, m ** 3 * a.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t ** 3 * b.y);
  });
const polyLen = (pts: P[]) => pts.slice(1).reduce((s, q, i) => s + len(sub(q, pts[i])), 0);

/** Point at distance `d` along a polyline. */
function at(pts: P[], d: number): P {
  let left = d;
  for (let i = 1; i < pts.length; i++) {
    const seg = len(sub(pts[i], pts[i - 1]));
    if (left <= seg) return lerp(pts[i - 1], pts[i], seg ? left / seg : 0);
    left -= seg;
  }
  return pts[pts.length - 1];
}

const rotateAbout = (q: P, o: P, a: number) => {
  const d = sub(q, o);
  return add(o, p(d.x * Math.cos(a) - d.y * Math.sin(a), d.x * Math.sin(a) + d.y * Math.cos(a)));
};

interface Cap {
  front: { c1: P; c2: P; to: P };
  back: { c1: P; c2: P; from: P };
  crown: P;
  lenF: number;
  lenB: number;
}

/**
 * The crown for a bicep `w` wide at height `h` below the crown point, which sits `cx` forward of the
 * middle. Each half leaves the crown level and meets the underarm square to its underarm seam, so
 * the crown runs smoothly over the top and into the seam once sewn.
 */
function cap(w: number, h: number, cx: number, uf: P, ub: P): Cap {
  const crown = p(cx, 0);
  const Uf = p(w / 2, h);
  const Ub = p(-w / 2, h);
  const spanF = Uf.x - cx;
  const spanB = cx - Ub.x;
  // Square to the underseam, pointing in and up.
  const inF = p(-uf.y, uf.x);
  const inB = p(ub.y, -ub.x);
  const front = { c1: add(crown, p(spanF * 0.55, 0)), c2: add(Uf, mul(inF, spanF * 0.5)), to: Uf };
  const back = { c1: add(Ub, mul(inB, spanB * 0.42)), c2: sub(crown, p(spanB * 0.58, 0)), from: Ub };
  return {
    front,
    back,
    crown,
    lenF: polyLen(cubicPts(crown, front.c1, front.c2, Uf)),
    lenB: polyLen(cubicPts(Ub, back.c1, back.c2, crown)),
  };
}

export function needsArms(m: SleeveMeasurements): boolean {
  return !(m.arm_length && m.upper_arm);
}

/** Draft the sleeve for a bodice. */
export function draftSleeve(bodice: BodiceDraft, m: SleeveMeasurements, s: SleeveStyle): SleeveDraft {
  if (!m.arm_length || !m.upper_arm) throw new DraftError('Add your arm length and upper arm measurements to add sleeves.');
  if (!SHAPES_FOR_LENGTH[s.length].includes(s.shape)) throw new DraftError(`A ${s.shape} sleeve can't be ${s.length.replace('_', ' ')} length.`);
  const warnings: string[] = [];
  // The armhole as sewn: the block's, whatever seams the bodice is cut with.
  const [bf, bb] = blockOf(bodice);
  const front = armholeOf(bf);
  const back = armholeOf(bb);
  const depth = (front.depth + back.depth) / 2;
  const ease = s.outer ? OUTER_SLEEVE_EASE[s.outer][s.fit] : SLEEVE_EASE[s.fit];
  const arm = m.arm_length;
  const wrist = m.wrist ?? Math.max(13, m.upper_arm * 0.55);
  // A hand closed as to go through a sleeve is about 1.3 times the wrist.
  const hand = Math.max(19, wrist * 1.3);
  const elbowY = arm * 0.58;
  const gathered = s.shape === 'puff' || s.shape === 'bishop';

  // Length from the crown point, and the hem width before any shaping.
  const lengthCm = { short: 0, elbow: elbowY + 2, three_quarter: arm * 0.8, long: arm + 1 + (s.outer === 'coat' ? 2.5 : s.outer ? 1.5 : 0) }[s.length];

  let w = m.upper_arm + ease.bicep;
  if (s.shape === 'puff') w *= 1.3;
  const target = front.length + back.length + (s.shape === 'puff' ? 0 : ease.crown);

  // Find the crown height for the length, and the crown point for the split; widen or narrow the
  // sleeve when no sensible height fits.
  const hMin = depth * 0.35;
  const hMax = depth * 0.95;
  // Underseam directions at the underarm, worked out from a first pass and then from the real hem.
  let dirs: [P, P] = [unit(p(-0.08, 1)), unit(p(0.08, 1))];
  const bisect = (lo: number, hi: number, grows: (v: number) => boolean) => {
    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2;
      if (grows(mid)) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const totalOf = (c: Cap) => c.lenF + c.lenB;
  /** The crown point that gives the front its share of the ease. */
  const split = (width: number, h: number, cx0: number) => {
    const c0 = cap(width, h, cx0, ...dirs);
    const wantF = front.length + (totalOf(c0) - front.length - back.length) * (1 - BACK_SHARE);
    return bisect(-width * 0.2, width * 0.2, (cx) => cap(width, h, cx, ...dirs).lenF > wantF);
  };
  /** Crown height (or, with `height`, just the split) for a bicep `width`. */
  const solve = (width: number, height?: number) => {
    let h = height ?? depth * 0.7;
    let cx = 0.5;
    for (let iter = 0; iter < 2; iter++) {
      if (height === undefined) h = bisect(hMin, hMax, (v) => totalOf(cap(width, v, cx, ...dirs)) < target);
      cx = split(width, h, cx);
    }
    return { h, cx, c: cap(width, h, cx, ...dirs) };
  };

  const fitCrown = () => {
    if (s.shape === 'puff') {
      // A puff sleeve's crown is raised for the fullness and gathered in.
      const base = solve(m.upper_arm! + ease.bicep);
      return solve(w, Math.min(depth * 1.05, base.h + 4));
    }
    const fit = solve(w);
    const total = totalOf(fit.c);
    if (Math.abs(total - target) <= 0.2) return fit;
    // No sensible crown height reaches: a bigger armhole than the arm needs widens the sleeve (the
    // way a block sleeve is found from its armhole); a small one narrows it, to no less than 3 cm ease.
    const h = total < target ? hMax : hMin;
    const lo = total < target ? w : m.upper_arm! + 3;
    const hi = total < target ? w + 40 : w;
    w = bisect(lo, hi, (v) => totalOf(cap(v, h, fit.cx, ...dirs)) < target);
    return solve(w, h);
  };

  const lengthFor = (h: number) => (s.length === 'short' ? h + 6 : Math.max(lengthCm, h + 6) + (gathered ? 2.5 : 0));
  // Hem width, as cut.
  const hemWidth = () => {
    if (s.shape === 'puff') return w;
    if (s.shape === 'bishop') return w * 1.5;
    if (s.outer && s.length === 'long') return s.shape === 'fitted' ? Math.max(wrist + (s.outer === 'coat' ? 14 : 11), hand + 5) : Math.max(w * 0.85, hand + 8);
    if (s.shape === 'fitted') {
      if (s.length === 'long') return Math.max(wrist + 6, hand + 1);
      if (s.length === 'three_quarter') return Math.max(w + (wrist + 6 - w) * 0.6, hand + 2);
      return w * 0.86;
    }
    const k = { short: 0.98, elbow: 0.93, three_quarter: 0.88, long: 0.82 }[s.length];
    return Math.max(w * k, s.length === 'long' ? hand + 2 : 0);
  };

  let { h, cx } = fitCrown();
  // Second pass, with the underseams as they really run.
  {
    const L0 = lengthFor(h);
    const hw = hemWidth();
    dirs = [unit(sub(p(hw / 2, L0), p(w / 2, h))), unit(sub(p(-hw / 2, L0), p(-w / 2, h)))];
    ({ h, cx } = fitCrown());
  }
  if (s.shape !== 'puff') {
    // A block sleeve is often roomier than the arm plus ease; only say so when it is a lot roomier.
    if (w > m.upper_arm + ease.bicep + 8) warnings.push(`sleeve widened to ${r1(w)} cm so the crown reaches the armhole: the armhole is large for the arm`);
    if (w < m.upper_arm + ease.bicep - 0.5) warnings.push(`sleeve narrowed to ${r1(w)} cm so the crown is not longer than the armhole needs`);
  }

  const L = lengthFor(h);
  const hemW = hemWidth();
  const mid = 0;
  let Wf = p(mid + hemW / 2, L);
  let Wb = p(mid - hemW / 2, L);
  const Uf = p(w / 2, h);
  const Ub = p(-w / 2, h);
  const uf = unit(sub(Wf, Uf));
  const ub = unit(sub(Wb, Ub));
  const c = cap(w, h, cx, uf, ub);

  // Elbow dart: the forearm turned forward about the front elbow, opening a dart at the back seam.
  const dartW = s.shape === 'fitted' && (s.length === 'long' || s.length === 'three_quarter') ? (s.length === 'long' ? 2 : 1.5) : 0;
  let Ef: P | undefined;
  let Eb: P | undefined;
  let Eb2: P | undefined;
  let tip: P | undefined;
  if (dartW) {
    const atY = (a: P, b: P, y: number) => lerp(a, b, (y - a.y) / (b.y - a.y));
    Ef = atY(Uf, Wf, elbowY);
    Eb = atY(Ub, Wb, elbowY);
    const turn = -dartW / len(sub(Eb, Ef));
    Eb2 = rotateAbout(Eb, Ef, turn);
    Wf = rotateAbout(Wf, Ef, turn);
    Wb = rotateAbout(Wb, Ef, turn);
    const m2 = mul(add(Eb, Eb2), 0.5);
    const inward = unit(p(-(Eb2.y - Eb.y), Eb2.x - Eb.x));
    const toward = inward.x > 0 ? inward : mul(inward, -1);
    tip = add(m2, mul(toward, len(sub(Ef, Eb)) * 0.36));
  }

  // The hem meets each underseam square, so it runs on smoothly round the sewn sleeve.
  const sqF = unit(sub(Wf, Ef ?? Uf));
  const sqB = unit(sub(Wb, Eb2 ?? Ub));
  const hemSpan = len(sub(Wf, Wb));
  const hemC1 = add(Wf, mul(p(-sqF.y, sqF.x), hemSpan * 0.3));
  const hemC2 = add(Wb, mul(p(sqB.y, -sqB.x), hemSpan * 0.3));

  const outline = new Path(c.crown).curve(c.front.c1, c.front.c2, Uf, 'armhole');
  if (Ef) outline.line(Ef, 'sleeve-front');
  outline.line(Wf, 'sleeve-front').curve(hemC1, hemC2, Wb, 'hem');
  if (Eb && Eb2) outline.line(Eb2, 'sleeve-back').line(Eb, 'dart');
  outline.line(Ub, 'sleeve-back').curve(c.back.c1, c.back.c2, c.crown, 'armhole');
  outline.closed = true;

  // Notches at the armhole's own notches, measured up from the underarm, with a little of the ease
  // below them. A notch at the crown point marks the shoulder seam.
  const frontCap = cubicPts(c.crown, c.front.c1, c.front.c2, Uf, 96);
  const backCap = cubicPts(Ub, c.back.c1, c.back.c2, c.crown, 96);
  const easeF = c.lenF - front.length;
  const easeB = c.lenB - back.length;
  const notchF = at([...frontCap].reverse(), front.notchFromUnder + easeF * 0.15);
  const notchB = at(backCap, back.notchFromUnder + easeB * 0.15);
  const out = (q: P, from: P) => unit(sub(q, from));
  const centre = p(0, h);
  const backDir = out(notchB, centre);
  const notches: [P, P][] = [
    [c.crown, p(0, -1)],
    [notchF, out(notchF, centre)],
    [add(notchB, mul(p(-backDir.y, backDir.x), 0.5)), backDir],
    [add(notchB, mul(p(-backDir.y, backDir.x), -0.5)), backDir],
  ];

  const lines: Path[] = [];
  if (tip && Eb && Eb2) lines.push(new Path(Eb).line(tip).line(Eb2));
  // Gathering marks: between the notches on a puff sleeve's crown.
  const cut = 'Cut 2 (1 pair)';
  const sleeve: Piece = {
    name: 'Sleeve',
    outline,
    lines,
    grain: [p(cx * 0.3, h * 0.55), p(0, L - 4)],
    notches,
    balance: [{ pts: [Ub, Uf], label: 'BICEP LINE' }, ...(Ef && Eb ? [{ pts: [Eb, Ef], label: 'ELBOW LINE' }] : [])],
    labels: [
      { at: p(0, h + 4), text: 'SLEEVE', size: 1.4 },
      { at: p(0, h + 6), text: cut, size: 0.9 },
      { at: add(notchF, p(-2.6, 1.6)), text: 'FRONT', size: 0.6 },
      { at: add(notchB, p(2.6, 1.6)), text: 'BACK', size: 0.6 },
      ...(s.shape === 'puff' ? [{ at: p(cx, h * 0.45), text: 'GATHER BETWEEN NOTCHES', size: 0.55 }] : []),
      ...(gathered ? [{ at: p(0, L - 3), text: 'GATHER TO FIT THE BAND', size: 0.55 }] : []),
    ],
    cut,
    seamAllowance: s.seamAllowance,
    allowances: { armhole: s.armholeAllowance, hem: gathered ? s.seamAllowance : s.hemAllowance },
    meta: { capHeight: r1(h), ...(s.shape === 'puff' ? { gatheredCrown: true } : {}) },
  };

  const band = gathered ? bandPiece(s.shape === 'puff' ? m.upper_arm + 4 : hand + 1, s.seamAllowance) : undefined;
  const crownLen = c.lenF + c.lenB;
  return {
    pieces: band ? [sleeve, band] : [sleeve],
    capHeight: r1(h),
    bicep: r1(w),
    crownEase: { front: r1(easeF), back: r1(easeB) },
    armhole: { front: r1(front.length), back: r1(back.length) },
    lengthCm: r1(L),
    hemCm: r1(band ? (band.meta.lengthCm as number) : polyLen(cubicPts(Wf, hemC1, hemC2, Wb))),
    gathers: gathered
      ? {
          crown: s.shape === 'puff' ? r1(crownLen - front.length - back.length) : undefined,
          hem: r1(polyLen(cubicPts(Wf, hemC1, hemC2, Wb)) - (band!.meta.lengthCm as number)),
        }
      : undefined,
    elbowDart: dartW || undefined,
    warnings,
  };
}

/** A straight band, folded in half lengthwise, that a gathered sleeve's hem is sewn into. */
function bandPiece(round: number, sa: number): Piece {
  const W = 2 * BAND_CM;
  const L = round;
  const outline = new Path(p(0, 0)).line(p(W, 0), 'end').line(p(W, L), 'band').line(p(0, L), 'end').line(p(0, 0), 'band');
  outline.closed = true;
  const cut = 'Cut 2';
  return {
    name: 'Sleeve band',
    kind: 'band',
    outline,
    lines: [],
    grain: [p(W * 0.25, 2), p(W * 0.25, Math.max(6, L - 2))],
    notches: [
      [p(W, L / 2), p(1, 0)],
      [p(0, L / 2), p(-1, 0)],
    ],
    balance: [{ pts: [p(W / 2, 0), p(W / 2, L)], label: 'FOLD LINE' }],
    labels: [
      { at: p(W * 0.62, L * 0.3), text: 'SLEEVE BAND', size: 0.9, rotate: 90 },
      { at: p(W * 0.38, L * 0.3), text: cut, size: 0.6, rotate: 90 },
    ],
    cut,
    seamAllowance: sa,
    allowances: {},
    meta: { finishedWidth: BAND_CM, lengthCm: r1(L) },
  };
}
