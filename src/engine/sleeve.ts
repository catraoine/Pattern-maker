// The set-in sleeve, drafted to the bodice's own armhole. The crown is walked against the armhole it
// sews into: its height is found so the crown is the armhole's length plus the crown ease, and its
// top point so the ease is shared between front and back the way a tailor sets it (a little more at
// the back, over the shoulder blade). The notches sit at the armhole's own notches, with the ease
// above them. Fitted long sleeves get an elbow dart, made by turning the forearm forward from the
// front elbow, so the sleeve bends with the arm, and a vent at the back of the wrist, so the hem can
// come back close to the wrist and still let the hand through. A cap sleeve is the crown alone, a few
// centimetres below the underarm; a flutter is a short sleeve slashed from hem to crown and fanned
// open at the hem, so the crown sews into the armhole as before and the hem ripples.
import { CUFF, Cuff, CuffDraft, cuffAllowed, cuffOf, cuffPieces } from './cuffs';
import { P, Path, add, len, lerp, mul, p, sub, unit } from './geometry';
import type { Piece } from './piece';
import { BodiceDraft, BodiceFit, blockOf } from './bodice';
import { DraftError } from './skirt';
import { DROP, RaglanYoke, SHAPES_FOR_LENGTH, SleeveCut } from './sleeveCut';

export type SleeveLength = 'none' | 'short' | 'elbow' | 'three_quarter' | 'long';
/** 'tailored' is the two-piece sleeve of a jacket or coat: long only, and not offered on a bodice. */
export type SleeveShape = 'fitted' | 'straight' | 'puff' | 'bishop' | 'cap' | 'flutter' | 'tailored';

export { SHAPES_FOR_LENGTH } from './sleeveCut';

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
  /** A length set on the slider, from the crown point to the hem, in cm, in place of the named one's.
   * The named length still says which shapes and shaping the sleeve takes. Not on a cap sleeve. */
  lengthCm?: number;
  /** Ease in place of the fit's own: a knit sleeve takes less, or none, round the arm. */
  ease?: { bicep: number; crown: number };
  /** A jacket or coat sleeve, worn over other clothes: more room at the bicep and the hem, a little
   * longer, and the crown ease a tailor works into a wool armhole. */
  outer?: 'jacket' | 'coat';
  /** A cuff at the hem: a shirt cuff, elastic, or a tie band (see cuffs.ts). */
  cuff?: Cuff;
  /** Set from the bodice (see sleeveCut.ts): a dropped shoulder's flatter crown, or a raglan's
   * shoulders, cut off the bodice, to go onto the sleeve. */
  cut?: SleeveCut;
  raglan?: { front: RaglanYoke; back: RaglanYoke };
}

/** Bicep and crown ease for jacket and coat sleeves, by fit. */
const OUTER_SLEEVE_EASE: Record<'jacket' | 'coat', Record<BodiceFit, { bicep: number; crown: number }>> = {
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
/** How far a cap sleeve reaches below the underarm, in cm. */
const CAP_BELOW = 2.5;
/** A flutter's hem, as a share of the bicep: fanned open to about twice as wide. */
const FLUTTER_SPREAD = 2;
/** The shortest sleeve the slider sets: its underseam, below the underarm, in cm. */
const MIN_UNDERSEAM = 3;
/** The named lengths in order, shortest first. */
export const SLEEVE_LENGTHS = ['short', 'elbow', 'three_quarter', 'long'] as const;
type Named = (typeof SLEEVE_LENGTHS)[number];

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
  /** For the length slider: this sleeve's length as set (without a gathered sleeve's blousing), the
   * shortest and longest it can be, and where each named length falls, all from the crown point. */
  length: { cm: number; min: number; max: number; named: Record<Named, number> };
  /** Round the hem as finished: the hem, or the band on a gathered sleeve. */
  hemCm: number;
  /** Gathered sleeves: how much is gathered into the armhole (puff) and into the band. */
  gathers?: { crown?: number; hem: number };
  elbowDart?: number;
  /** A fitted long sleeve's wrist vent: the sleeve seam left open from the hem up `lengthCm`, where
   * the vent notch is, and hemmed as a slit. */
  vent?: { lengthCm: number; at: 'back seam' };
  /** The cuff, when it has one; `hemCm` is then round the cuff. */
  cuff?: CuffDraft;
  /** A sleeve that isn't set in: a dropped shoulder's, a raglan's (cut in two along the top of the
   * arm, the shoulders on it), or a kimono's, cut on with the bodice so it has no pieces of its own. */
  cut?: Exclude<SleeveCut, 'set_in'>;
  warnings: string[];
}

/** A fitted long sleeve's wrist vent, up the back of the sleeve seam from the hem, in cm. */
export const VENT_CM = 9;

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
  if (bodice.sleeveCut === 'kimono' && bodice.kimono) return kimonoSleeve(bodice.kimono);
  // The armhole as sewn: the block's, whatever seams the bodice is cut with.
  return draftSleeveTo(...blockOf(bodice), m, { ...s, cut: bodice.sleeveCut, raglan: bodice.raglan });
}

/** The pattern's note on the sleeve: its bicep and crown ease, or how a sleeve that isn't set in is cut. */
export function sleeveNote(sl: SleeveDraft): string {
  if (sl.cut === 'kimono') return `Kimono sleeves, cut in one with the bodice: ${sl.lengthCm} cm from the shoulder point, ${sl.bicep} cm round under the arm, ${sl.hemCm} cm round the hem.`;
  const crown = sl.gathers?.crown !== undefined ? `${sl.gathers.crown} cm gathered into the crown` : `crown ease ${sl.crownEase.front} cm front, ${sl.crownEase.back} cm back`;
  if (sl.cut === 'raglan') return `Raglan sleeves, each cut in two along the top of the arm with the shoulder on it: bicep ${sl.bicep} cm.`;
  if (sl.cut === 'drop') return `Dropped shoulder, ${DROP.out} cm past your shoulder point: bicep ${sl.bicep} cm, ${crown}.`;
  return `Sleeve: bicep ${sl.bicep} cm, ${crown}.`;
}

/** A kimono sleeve is cut on with the bodice: no pieces of its own, its sizes for the notes and spec. */
function kimonoSleeve(k: NonNullable<BodiceDraft['kimono']>): SleeveDraft {
  const named = { short: 0, elbow: 0, three_quarter: 0, long: 0, [k.length]: k.lengthCm };
  return {
    pieces: [],
    cut: 'kimono',
    capHeight: 0,
    bicep: k.bicepCm,
    crownEase: { front: 0, back: 0 },
    armhole: { front: 0, back: 0 },
    lengthCm: k.lengthCm,
    length: { cm: k.lengthCm, min: k.lengthCm, max: k.lengthCm, named },
    hemCm: k.hemCm,
    warnings: [],
  };
}

/** Draft the sleeve to a front and back's armholes (tagged 'armhole', with their notches). */
export function draftSleeveTo(bf: Piece, bb: Piece, m: SleeveMeasurements, s: SleeveStyle): SleeveDraft {
  if (!m.arm_length || !m.upper_arm) throw new DraftError('Add your arm length and upper arm measurements to add sleeves.');
  const tailored = s.shape === 'tailored';
  if (tailored ? s.length !== 'long' : !SHAPES_FOR_LENGTH[s.length].includes(s.shape)) throw new DraftError(`A ${s.shape} sleeve can't be ${s.length.replace('_', ' ')} length.`);
  // A two-piece sleeve is the fitted sleeve's crown and widths, cut in two rather than darted.
  const shape: SleeveShape = tailored ? 'fitted' : s.shape;
  const warnings: string[] = [];
  const front = armholeOf(bf);
  const back = armholeOf(bb);
  const depth = (front.depth + back.depth) / 2;
  const ease0 = s.ease ?? (s.outer ? OUTER_SLEEVE_EASE[s.outer][s.fit] : SLEEVE_EASE[s.fit]);
  // A dropped shoulder or raglan sleeve sews in with next to no ease; a dropped shoulder's sleeve starts
  // past the shoulder point, so it is that much shorter.
  const sleeveCut = s.cut === 'drop' || (s.cut === 'raglan' && s.raglan) ? s.cut : undefined;
  const ease = sleeveCut ? { ...ease0, crown: DROP.crownEase } : ease0;
  const arm = m.arm_length - (sleeveCut === 'drop' ? DROP.out : 0);
  const wrist = m.wrist ?? Math.max(13, m.upper_arm * 0.55);
  // A hand closed as to go through a sleeve is about 1.3 times the wrist.
  const hand = Math.max(19, wrist * 1.3);
  const elbowY = arm * 0.58;
  const gathered = shape === 'puff' || shape === 'bishop';
  // A cuff takes the hem in, on a straight or bishop sleeve of a length that can have one.
  const cuff = s.cuff && s.cuff !== 'none' && !tailored && !s.outer && cuffAllowed(s.cuff, s.length, shape) ? cuffOf(s.cuff, s.length as Named, wrist, m.upper_arm) : undefined;

  // Length from the crown point for each named length, and the hem width before any shaping.
  const longCm = arm + 1 + (s.outer === 'coat' ? 2.5 : s.outer ? 1.5 : 0);
  const namedAt = (h: number): Record<Named, number> => ({ short: h + 6, elbow: Math.max(elbowY + 2, h + 6), three_quarter: Math.max(arm * 0.8, h + 6), long: Math.max(longCm, h + 6) });
  const cap_ = shape === 'cap';
  const flutter = shape === 'flutter';

  let w = m.upper_arm + ease.bicep;
  if (shape === 'puff') w *= 1.3;
  const target = front.length + back.length + (shape === 'puff' ? 0 : ease.crown);

  // Find the crown height for the length, and the crown point for the split; widen or narrow the
  // sleeve when no sensible height fits.
  // A dropped shoulder's crown is low and flat, as its armhole is.
  const hMin = depth * (sleeveCut === 'drop' ? 0.15 : 0.35);
  const hMax = depth * (sleeveCut === 'drop' ? 0.55 : 0.95);
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
    if (shape === 'puff') {
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
    const lo = total < target ? w : m.upper_arm! + Math.min(3, ease.bicep);
    const hi = total < target ? w + 40 : w;
    w = bisect(lo, hi, (v) => totalOf(cap(v, h, fit.cx, ...dirs)) < target);
    return solve(w, h);
  };

  /** The length as set, before a gathered sleeve's blousing: the named one, or the slider's. */
  const setFor = (h: number) => {
    if (cap_) return h + CAP_BELOW;
    const named = namedAt(h)[s.length as Named];
    return s.lengthCm === undefined ? named : Math.min(namedAt(h).long, Math.max(h + MIN_UNDERSEAM, s.lengthCm));
  };
  // A cuff ends the sleeve: the sleeve stops short of the hem by its depth, and blouses over it.
  const lengthFor = (h: number) => (cuff ? setFor(h) - (cuff.kind === 'elastic' ? 0 : cuff.depth) + CUFF.blouse : setFor(h) + (gathered ? 2.5 : 0));
  // Hem width, as cut: at a named length, or between the two named ones either side of the slider's.
  const hemWidth = (h: number) => {
    if (cuff) return cuffHem(hemAt(s.length as Named));
    if (s.lengthCm === undefined || gathered || cap_ || flutter || tailored || s.outer) return hemAt(s.length as Named);
    const L = setFor(h);
    const named = namedAt(h);
    const ok = SLEEVE_LENGTHS.filter((l) => SHAPES_FOR_LENGTH[l].includes(shape));
    const hi = ok.find((l) => named[l] >= L) ?? ok[ok.length - 1];
    const lo = [...ok].reverse().find((l) => named[l] <= L) ?? ok[0];
    if (hi === lo || named[hi] === named[lo]) return hemAt(hi);
    return hemAt(lo) + ((hemAt(hi) - hemAt(lo)) * (L - named[lo])) / (named[hi] - named[lo]);
  };
  // Into a cuff, the hem is a little fuller than the cuff, to gather or pleat into it; elastic needs a
  // hem the hand passes through.
  const cuffHem = (plain: number) => (!cuff ? plain : cuff.kind === 'elastic' ? Math.max(plain, hand + 4) : Math.max(plain, cuff.round + 6));
  const hemAt = (length: Named) => {
    if (shape === 'puff' || cap_ || flutter) return w;
    if (shape === 'bishop') return w * 1.5;
    if (s.outer && length === 'long') return shape === 'fitted' ? Math.max(wrist + (s.outer === 'coat' ? 14 : 11), hand + 5) : Math.max(w * 0.85, hand + 8);
    if (shape === 'fitted') {
      // A fitted long sleeve is woven (a knit tee's sleeve is drafted straight), so without an
      // opening the hand would have to pass through the hem as cut. It gets a vent at the back of the
      // wrist instead, so the hem comes back to the wrist plus 6 cm, and no less than 20 cm round.
      if (length === 'long') return Math.max(wrist + 6, 20);
      if (length === 'three_quarter') return Math.max(w + (wrist + 6 - w) * 0.6, hand + 2);
      return w * 0.86;
    }
    const k = { short: 0.98, elbow: 0.93, three_quarter: 0.88, long: 0.82 }[length];
    return Math.max(w * k, length === 'long' ? hand + 2 : 0);
  };

  let { h, cx } = fitCrown();
  // Second pass, with the underseams as they really run.
  {
    const L0 = lengthFor(h);
    const hw = hemWidth(h);
    dirs = [unit(sub(p(hw / 2, L0), p(w / 2, h))), unit(sub(p(-hw / 2, L0), p(-w / 2, h)))];
    ({ h, cx } = fitCrown());
  }
  if (shape !== 'puff') {
    // A block sleeve is often roomier than the arm plus ease; only say so when it is a lot roomier.
    if (w > m.upper_arm + ease.bicep + 8) warnings.push(`sleeve widened to ${r1(w)} cm so the crown reaches the armhole: the armhole is large for the arm`);
    if (w < m.upper_arm + ease.bicep - 0.5) warnings.push(`sleeve narrowed to ${r1(w)} cm so the crown is not longer than the armhole needs`);
  }

  const L = lengthFor(h);
  const hemW = hemWidth(h);
  const mid = 0;
  let Wf = p(mid + hemW / 2, L);
  let Wb = p(mid - hemW / 2, L);
  const Uf = p(w / 2, h);
  const Ub = p(-w / 2, h);
  const uf = unit(sub(Wf, Uf));
  const ub = unit(sub(Wb, Ub));
  const c = cap(w, h, cx, uf, ub);

  // Elbow dart: the forearm turned forward about the front elbow, opening a dart at the back seam.
  // Only where the sleeve runs well past the elbow, wherever the slider has set it.
  const dartW = !tailored && shape === 'fitted' && (s.length === 'long' || s.length === 'three_quarter') && L > elbowY + 5 ? (s.length === 'long' ? 2 : 1.5) : 0;
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

  // The wrist vent: the back seam is left open from the hem up to a notch, so the hand passes a hem
  // cut close to the wrist. Marked by the notch, a tick across the seam line at its top, and its name.
  // A tie cuff closes round the wrist over a short slit left the same way.
  const vented = shape === 'fitted' && s.length === 'long' && !tailored && !s.outer;
  const ventCm = vented ? VENT_CM : cuff?.slitCm;
  const ventTop = ventCm ? add(Wb, mul(unit(sub(Eb2 ?? Ub, Wb)), ventCm)) : undefined;

  // The hem meets each underseam square, so it runs on smoothly round the sewn sleeve.
  const sqF = unit(sub(Wf, Ef ?? Uf));
  const sqB = unit(sub(Wb, Eb2 ?? Ub));
  const hemSpan = len(sub(Wf, Wb));
  const hemC1 = add(Wf, mul(p(-sqF.y, sqF.x), hemSpan * 0.3));
  const hemC2 = add(Wb, mul(p(sqB.y, -sqB.x), hemSpan * 0.3));

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
  let notches: [P, P][] = [
    [c.crown, p(0, -1)],
    [notchF, out(notchF, centre)],
    [add(notchB, mul(p(-backDir.y, backDir.x), 0.5)), backDir],
    [add(notchB, mul(p(-backDir.y, backDir.x), -0.5)), backDir],
  ];

  let outline: Path;
  let hemRun: P[];
  let place = (q: P) => q;
  if (flutter) {
    // The crown and its notches go where the slashes take them; its length, and so its ease, stays.
    const fan = flutterSpread(c, Ub, Uf, L, w * FLUTTER_SPREAD);
    // From the crown point round the front, as the plain sleeve runs.
    outline = new Path(fan.crown[fan.mid]);
    fan.crown.slice(fan.mid + 1).forEach((q) => outline.line(q, 'armhole'));
    outline.line(fan.hem[0], 'sleeve-front');
    fan.hem.slice(1).forEach((q) => outline.line(q, 'hem'));
    outline.line(fan.crown[0], 'sleeve-back');
    fan.crown.slice(1, fan.mid + 1).forEach((q) => outline.line(q, 'armhole'));
    // Both underseams keep their length, so they still sew together.
    notches = notches.map(([q, d]) => [fan.place(q), fan.turn(q, d)]);
    hemRun = fan.hem;
    place = fan.place;
  } else {
    outline = new Path(c.crown).curve(c.front.c1, c.front.c2, Uf, 'armhole');
    if (Ef) outline.line(Ef, 'sleeve-front');
    outline.line(Wf, 'sleeve-front').curve(hemC1, hemC2, Wb, 'hem');
    if (Eb && Eb2) outline.line(Eb2, 'sleeve-back').line(Eb, 'dart');
    outline.line(Ub, 'sleeve-back').curve(c.back.c1, c.back.c2, c.crown, 'armhole');
    hemRun = cubicPts(Wf, hemC1, hemC2, Wb);
  }
  outline.closed = true;

  const lines: Path[] = [];
  if (tip && Eb && Eb2) lines.push(new Path(Eb).line(tip).line(Eb2));
  // The vent: a tick 1.2 cm into the sleeve at its top, with a notch on the seam there.
  // Square to the back seam, into the sleeve: the seam runs down the sleeve's left, so toward +x.
  const ventIn = ventTop ? p(sqB.y, -sqB.x) : undefined;
  if (ventTop && ventIn) {
    lines.push(new Path(ventTop).line(add(ventTop, mul(ventIn, 1.2))));
    notches.push([ventTop, mul(ventIn, -1)]);
  }
  // A shirt cuff's placket: a slit up from the hem a quarter of the way in from the back seam, cut
  // when it is bound.
  let placketAt: P | undefined;
  if (cuff?.kind === 'shirt') {
    placketAt = at(hemRun.slice().reverse(), polyLen(hemRun) / 4);
    const up = unit(sub(lerp(Ub, Uf, 0.25), placketAt));
    lines.push(new Path(placketAt).line(add(placketAt, mul(up, cuff.placketCm!))));
  }
  // Gathering marks: between the notches on a puff sleeve's crown.
  const cut = 'Cut 2 (1 pair)';
  const sleeve: Piece = {
    name: 'Sleeve',
    outline,
    lines,
    grain: [p(cx * 0.3, h * 0.55), p(0, L - 4)],
    notches,
    // A flutter's bicep line is slashed apart, so it has none.
    balance: flutter ? [] : [{ pts: [Ub, Uf], label: 'BICEP LINE' }, ...(Ef && Eb ? [{ pts: [Eb, Ef], label: 'ELBOW LINE' }] : [])],
    labels: [
      // Kept inside a short sleeve, above its hem.
      { at: p(0, Math.min(h + 4, L - 3.5)), text: 'SLEEVE', size: 1.4 },
      { at: p(0, Math.min(h + 6, L - 1.5)), text: cut, size: 0.9 },
      { at: place(add(notchF, p(-2.6, 1.6))), text: 'FRONT', size: 0.6 },
      { at: place(add(notchB, p(2.6, 1.6))), text: 'BACK', size: 0.6 },
      ...(shape === 'puff' ? [{ at: p(cx, h * 0.45), text: 'GATHER BETWEEN NOTCHES', size: 0.55 }] : []),
      ...(cuff && cuff.kind !== 'elastic'
        ? [{ at: p(0, L - 3), text: `GATHER TO FIT THE ${cuff.kind === 'shirt' ? 'CUFF' : 'TIE CUFF'}`, size: 0.55 }]
        : gathered && !cuff
          ? [{ at: p(0, L - 3), text: 'GATHER TO FIT THE BAND', size: 0.55 }]
          : []),
      ...(placketAt ? [{ at: add(placketAt, p(1.4, -cuff!.placketCm! / 2)), text: 'PLACKET', size: 0.5, rotate: 90 }] : []),
      ...(ventTop && ventIn ? [{ at: add(lerp(ventTop, Wb, 0.5), mul(ventIn, 1.6)), text: cuff ? 'SLIT' : 'VENT', size: 0.5, rotate: ventRotate(sqB) }] : []),
    ],
    cut,
    seamAllowance: s.seamAllowance,
    // A flutter's curved hem only turns as a narrow hem; a cap sleeve's is kept small too.
    // An elastic cuff's casing is turned up from the hem allowance: its depth and 0.5 cm to turn under.
    allowances: {
      armhole: s.armholeAllowance,
      hem: cuff?.kind === 'elastic' ? cuff.depth + 0.5 : gathered || cuff ? s.seamAllowance : flutter ? 1 : cap_ ? Math.min(1.5, s.hemAllowance) : s.hemAllowance,
    },
    meta: { capHeight: r1(h), ...(shape === 'puff' ? { gatheredCrown: true } : {}), ...(flutter ? { flutter: true } : {}), ...(cap_ ? { cap: true } : {}) },
  };
  const named = namedAt(h);
  const lengthInfo = { cm: r1(setFor(h)), min: r1(h + MIN_UNDERSEAM), max: r1(named.long), named: Object.fromEntries(SLEEVE_LENGTHS.map((l) => [l, r1(named[l])])) as Record<Named, number> };

  if (tailored) {
    const pieces = twoPiece({ crown: c.crown, frontCap, backCap, Uf, Ub, Wf, Wb, hem: cubicPts(Wf, hemC1, hemC2, Wb, 60), notchB, backDir, elbowY, h, L, hemW, cx, s });
    return {
      pieces,
      capHeight: r1(h),
      bicep: r1(w),
      crownEase: { front: r1(easeF), back: r1(easeB) },
      armhole: { front: r1(front.length), back: r1(back.length) },
      lengthCm: r1(L),
      length: lengthInfo,
      hemCm: r1(polyLen(cubicPts(Wf, hemC1, hemC2, Wb))),
      warnings,
    };
  }
  const band = gathered && !cuff ? bandPiece(shape === 'puff' ? m.upper_arm + 4 : hand + 1, s.seamAllowance) : undefined;
  // A raglan: the sleeve cut in two along the top of the arm, the shoulders cut off the bodice joined on.
  const own: Piece[] = sleeveCut === 'raglan' ? toRaglan(sleeve, { crown: c.crown, frontCap: cubicPts(c.crown, c.front.c1, c.front.c2, Uf, 400), backCap: cubicPts(Ub, c.back.c1, c.back.c2, c.crown, 400), Uf, Ub, Wf, Wb, hem: cubicPts(Wf, hemC1, hemC2, Wb, 60), h, L, w, yokes: s.raglan!, s }) : [sleeve];
  const cutOf = sleeveCut ? { cut: sleeveCut } : {};
  const crownLen = c.lenF + c.lenB;
  const hemLen = polyLen(cubicPts(Wf, hemC1, hemC2, Wb));
  if (cuff) {
    // Gathered into the cuff (or drawn up by the elastic), the sleeve's hem shows as gathers.
    return {
      pieces: [...own, ...cuffPieces(cuff, s.seamAllowance)],
      capHeight: r1(h),
      bicep: r1(w),
      crownEase: { front: r1(easeF), back: r1(easeB) },
      armhole: { front: r1(front.length), back: r1(back.length) },
      lengthCm: r1(L),
      length: lengthInfo,
      hemCm: cuff.round,
      gathers: { hem: r1(hemLen - cuff.round) },
      cuff,
      ...(ventTop ? { vent: { lengthCm: ventCm!, at: 'back seam' as const } } : {}),
      ...cutOf,
      warnings,
    };
  }
  return {
    pieces: band ? [...own, band] : own,
    capHeight: r1(h),
    bicep: r1(w),
    crownEase: { front: r1(easeF), back: r1(easeB) },
    armhole: { front: r1(front.length), back: r1(back.length) },
    lengthCm: r1(L),
    length: lengthInfo,
    hemCm: r1(band ? (band.meta.lengthCm as number) : polyLen(hemRun)),
    gathers: gathered
      ? {
          crown: shape === 'puff' ? r1(crownLen - front.length - back.length) : undefined,
          hem: r1(hemLen - (band!.meta.lengthCm as number)),
        }
      : undefined,
    elbowDart: dartW || undefined,
    ...(ventTop ? { vent: { lengthCm: VENT_CM, at: 'back seam' as const } } : {}),
    ...cutOf,
    warnings,
  };
}

/**
 * A raglan sleeve: the set-in sleeve, drafted with next to no ease to the armhole as it was before the
 * shoulders were cut off, cut in two down the middle, from the crown point to the middle of the hem.
 * Each half takes its shoulder piece, turned so the armhole notch it was cut at sits on the sleeve's
 * own notch and its shoulder point toward the crown; above the notch the crown gives way to the
 * shoulder piece and the raglan line. The shoulder runs on into a seam down the top of the arm, curving
 * into the middle line, so the two halves sew together over the shoulder and down to the hem; the back's
 * meets the middle line a little higher or lower so the two are the same length.
 */
/** Ease in the crown below a raglan line, each side, in cm. */
const RAGLAN_EASE = 0.15;

function toRaglan(
  sleeve: Piece,
  o: { crown: P; frontCap: P[]; backCap: P[]; Uf: P; Ub: P; Wf: P; Wb: P; hem: P[]; h: number; L: number; w: number; yokes: { front: RaglanYoke; back: RaglanYoke }; s: SleeveStyle },
): Piece[] {
  const { crown, h, w } = o;
  const cross = (a: P, b: P) => a.x * b.y - a.y * b.x;
  const centroid = (pts: P[]) => mul(pts.reduce((t, q) => add(t, q), p(0, 0)), 1 / pts.length);
  const hemLen = polyLen(o.hem);
  const [hemF, hemB] = splitAt(o.hem, hemLen / 2);
  const M = hemB[0];
  const cl = unit(sub(M, crown));
  /** The shoulder piece turned onto the sleeve at `notch`, on the far side of the crown from the sleeve. */
  const place = (y: RaglanYoke, notch: P) => {
    const inner = centroid([crown, notch, p(0, h)]);
    const flip = Math.sign(cross(sub(y.sp, y.notch), sub(centroid(y.ring.pts), y.notch))) === Math.sign(cross(sub(crown, notch), sub(inner, notch)));
    const f = (q: P) => (flip ? p(-q.x, q.y) : q);
    const R = f(y.notch);
    const a = Math.atan2(crown.y - notch.y, crown.x - notch.x) - Math.atan2(f(y.sp).y - R.y, f(y.sp).x - R.x);
    return (q: P) => {
      const d = sub(f(q), R);
      return add(notch, p(d.x * Math.cos(a) - d.y * Math.sin(a), d.x * Math.sin(a) + d.y * Math.cos(a)));
    };
  };
  /** The seam down the top of the arm: on from the shoulder, into the middle line `kd` below the crown, and down it to the hem. */
  const overarm = (hps: P, sp: P, kd: number, k = 1) => {
    const K = add(crown, mul(cl, kd));
    const t = unit(sub(sp, hps));
    const a = (len(sub(K, sp)) / 3) * k;
    return [...cubicPts(sp, add(sp, mul(t, a)), sub(K, mul(cl, a)), K, 24), ...Array.from({ length: 8 }, (_, i) => lerp(K, M, (i + 1) / 8))];
  };
  const sides = (['front', 'back'] as const).map((side) => {
    const y = o.yokes[side];
    // Where the raglan line meets the crown: as far up from the underarm as it is on the bodice, with a
    // little ease below it.
    const fromUnder = y.under + RAGLAN_EASE;
    const notch = side === 'front' ? at([...o.frontCap].reverse(), fromUnder) : at(o.backCap, fromUnder);
    const T = place(y, notch);
    const ring = y.ring.pts.map(T);
    const iSp = y.ring.pts.findIndex((q) => len(sub(q, y.sp)) < 1e-6);
    const iHps = y.ring.pts.findIndex((q) => len(sub(q, y.hps)) < 1e-6);
    // The crown below the notch stays: it sews to the bodice's armhole below the raglan line.
    const lower = side === 'front' ? [...splitAt(o.frontCap, nearestAlong(o.frontCap, notch))[1]].reverse() : splitAt(o.backCap, nearestAlong(o.backCap, notch))[0];
    return { side, y, T, ring, iSp, iHps, lower, notch };
  });
  const kd = Math.min(h * 0.5, o.L * 0.4);
  const lengthOf = (sd: (typeof sides)[number], k: number) => polyLen(overarm(sd.ring[sd.iHps], sd.ring[sd.iSp], kd, k));
  // The shorter seam is drawn out in a fuller curve until it is as long as the other.
  const [lf, lb] = sides.map((sd) => lengthOf(sd, 1));
  const short = lf < lb ? 0 : 1;
  const want = Math.max(lf, lb);
  let lo = 1;
  let hi = 3;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (lengthOf(sides[short], mid) < want) lo = mid;
    else hi = mid;
  }
  const ks = [1, 1];
  ks[short] = (lo + hi) / 2;
  return sides.map((sd, i) => {
    const front = sd.side === 'front';
    const over = overarm(sd.ring[sd.iHps], sd.ring[sd.iSp], kd, ks[i]);
    const hem = front ? [...hemF].reverse() : hemB;
    const U = front ? o.Uf : o.Ub;
    const line = [...sd.y.line].reverse().map(sd.T);
    const pts = [...sd.ring.slice(0, sd.iSp + 1), ...over.slice(1), ...hem.slice(1), U, ...sd.lower.slice(1), ...line.slice(1, -1)];
    const tags = [
      ...sd.y.ring.tags.slice(0, sd.iSp),
      ...over.slice(1).map(() => 'overarm'),
      ...hem.slice(1).map(() => 'hem'),
      'underarm',
      ...sd.lower.slice(1).map(() => 'armhole'),
      ...line.slice(1).map(() => 'raglan'),
    ];
    const outline = ringPath(pts, tags);
    const inside = centroid(pts);
    const outward = (q: P, along: P) => {
      const n = unit(p(-along.y, along.x));
      return (q.x - inside.x) * n.x + (q.y - inside.y) * n.y < 0 ? mul(n, -1) : n;
    };
    // A notch halfway along the raglan seam (two at the back), and one where the shoulder meets the seam down the arm.
    const half = at(line, polyLen(line) / 2);
    const hd = unit(sub(at(line, polyLen(line) / 2 + 0.5), at(line, polyLen(line) / 2 - 0.5)));
    const out = outward(half, hd);
    const sp = sd.ring[sd.iSp];
    const notches: [P, P][] = [
      ...(front ? [[half, out] as [P, P]] : [[add(half, mul(hd, 0.5)), out] as [P, P], [add(half, mul(hd, -0.5)), out] as [P, P]]),
      [sp, outward(sp, unit(sub(over[2], sp)))],
    ];
    const name = front ? 'Raglan sleeve front' : 'Raglan sleeve back';
    const x = (front ? 1 : -1) * w * 0.22;
    const onSide = (q: P) => (cross(cl, sub(q, crown)) < 0) === front;
    const lines = sleeve.lines.filter((l) => onSide(l.start));
    const labels = sleeve.labels.filter((l) => !/^(SLEEVE|FRONT|BACK|Cut )/.test(l.text) && onSide(l.at));
    return {
      ...sleeve,
      name,
      outline,
      lines,
      grain: [p(x, h * 0.75), p(x, o.L - 4)] as [P, P],
      notches,
      balance: [{ pts: [p(0, h), U], label: 'BICEP LINE' }],
      labels: [
        { at: p(x, Math.min(h + 3, o.L - 4)), text: name.toUpperCase(), size: 0.8 },
        { at: p(x, Math.min(h + 5, o.L - 2)), text: sleeve.cut ?? 'Cut 2 (1 pair)', size: 0.7 },
        ...labels,
      ],
      allowances: { ...sleeve.allowances, neck: o.s.armholeAllowance },
      meta: { ...sleeve.meta, raglan: sd.side },
    };
  });
}

/** How far along a polyline its nearest point to `q` is. */
function nearestAlong(pts: P[], q: P): number {
  let best = 0;
  let bestD = Infinity;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const ab = sub(pts[i], a);
    const l = len(ab);
    const t = l ? Math.max(0, Math.min(1, ((q.x - a.x) * ab.x + (q.y - a.y) * ab.y) / (l * l))) : 0;
    const d = len(sub(add(a, mul(ab, t)), q));
    if (d < bestD) {
      bestD = d;
      best = acc + t * l;
    }
    acc += l;
  }
  return best;
}

/**
 * A flutter: the short sleeve slashed straight down from the crown to the hem many times, and each
 * slash opened at the hem and hinged at the crown, so the crown keeps its length (and its ease) while
 * the hem fans out to `hemLength`. The middle stays put; each strip toward the underarms turns a
 * little more. Returns the crown from the back underarm to the front, the hem from the front
 * underseam to the back, and where any point of the unspread sleeve goes.
 */
function flutterSpread(c: Cap, Ub: P, Uf: P, L: number, hemLength: number) {
  const n = 120;
  const top = [...cubicPts(Ub, c.back.c1, c.back.c2, c.crown, n), ...cubicPts(c.crown, c.front.c1, c.front.c2, Uf, n).slice(1)];
  const mid = n;
  const rot = (q: P, o: P, a: number) => rotateAbout(q, o, a);
  type Move = { place: (q: P) => P; angle: number };
  const spread = (step: number) => {
    // moves[j] places strip j, between top[j] and top[j + 1].
    const moves: Move[] = [];
    moves[mid] = { place: (q) => q, angle: 0 };
    for (let j = mid + 1; j < top.length - 1; j++) {
      const prev = moves[j - 1];
      const hinge = prev.place(top[j]);
      moves[j] = { place: (q) => rot(prev.place(q), hinge, -step), angle: prev.angle - step };
    }
    for (let j = mid - 1; j >= 0; j--) {
      const next = moves[j + 1];
      const hinge = next.place(top[j + 1]);
      moves[j] = { place: (q) => rot(next.place(q), hinge, step), angle: next.angle + step };
    }
    // Each slash runs straight down; the underseams leave the crown square to it, so the underarm
    // runs smoothly across the sewn seam.
    const last = top.length - 1;
    const square = (a: P, b: P) => {
      const t = unit(sub(b, a));
      const n = p(-t.y, t.x);
      return n.y > 0 ? n : mul(n, -1);
    };
    const down = (i: number) =>
      i === 0 ? add(top[0], mul(square(top[0], top[1]), L - top[0].y)) : i === last ? add(top[last], mul(square(top[last - 1], top[last]), L - top[last].y)) : p(top[i].x, L);
    const hem: P[] = [];
    for (let j = 0; j < last; j++) hem.push(moves[j].place(down(j)), moves[j].place(down(j + 1)));
    const crown = top.map((q, i) => moves[Math.min(i, top.length - 2)].place(q));
    return { moves, hem: hem.reverse(), crown, mid };
  };
  let lo = 0;
  let hi = 0.015;
  for (let k = 0; k < 30; k++) {
    const m = (lo + hi) / 2;
    if (polyLen(spread(m).hem) < hemLength) lo = m;
    else hi = m;
  }
  const { moves, hem, crown } = spread((lo + hi) / 2);
  // The hem leaves each underseam square, so it runs on smoothly round the sewn sleeve.
  const squareOff = (end: P, from: P, next: P) => {
    const t = unit(sub(end, from));
    const n = p(-t.y, t.x);
    const inward = (next.x - end.x) * n.x + (next.y - end.y) * n.y > 0 ? n : mul(n, -1);
    return add(end, mul(inward, len(sub(next, end))));
  };
  hem[1] = squareOff(hem[0], crown[crown.length - 1], hem[1]);
  hem[hem.length - 2] = squareOff(hem[hem.length - 1], crown[0], hem[hem.length - 2]);
  const strip = (q: P) => {
    const j = top.findIndex((t, i) => i < top.length - 1 && q.x >= t.x && q.x <= top[i + 1].x);
    return moves[j < 0 ? (q.x < 0 ? 0 : top.length - 2) : j];
  };
  return {
    crown,
    mid,
    hem,
    place: (q: P) => strip(q).place(q),
    turn: (q: P, d: P) => rotateAbout(d, p(0, 0), strip(q).angle),
  };
}

/** The vent label's turn: along the seam, reading up the sleeve. */
function ventRotate(seamDir: P): number {
  let rot = (Math.atan2(seamDir.y, seamDir.x) * 180) / Math.PI;
  if (rot > 90) rot -= 180;
  if (rot <= -90) rot += 180;
  return rot;
}

/** Splits a polyline at distance `d` along it: the part before (ending at the split) and after (starting there). */
function splitAt(pts: P[], d: number): [P[], P[]] {
  let left = d;
  for (let i = 1; i < pts.length; i++) {
    const seg = len(sub(pts[i], pts[i - 1]));
    if (left <= seg) {
      const q = lerp(pts[i - 1], pts[i], seg ? left / seg : 0);
      return [[...pts.slice(0, i), q], [q, ...pts.slice(i)]];
    }
    left -= seg;
  }
  return [pts, [pts[pts.length - 1]]];
}

const signedArea = (pts: P[]) => pts.reduce((a, q, i) => {
  const r = pts[(i + 1) % pts.length];
  return a + q.x * r.y - r.x * q.y;
}, 0);

/** A closed run of points as a path, each edge tagged, wound the same way as the one-piece sleeve. */
function ringPath(pts: P[], tags: string[]): Path {
  let P2 = pts;
  let T2 = tags;
  if (signedArea(pts) < 0) {
    // Reverse: edge i (pts[i] to pts[i+1]) becomes the edge from pts[i+1] back to pts[i].
    const n = pts.length;
    P2 = [...pts].reverse();
    T2 = P2.map((_, i) => tags[(n - 2 - i + n) % n]);
  }
  const path = new Path(P2[0]);
  for (let i = 1; i < P2.length; i++) path.line(P2[i], T2[i - 1]);
  path.line(P2[0], T2[P2.length - 1]);
  path.closed = true;
  return path;
}

/**
 * The two-piece tailored sleeve, cut from the one-piece sleeve without its elbow dart. The front seam
 * runs down the inside of the arm, about 6 cm in from the underarm and 3.5 cm at the hem, so it is hidden;
 * the back seam from a fifth of the way round the back down to the back of the wrist. Both edges of the
 * front seam are hollowed at the elbow, so the sewn sleeve bends forward with the arm. The under
 * sleeve's two parts are joined along the old underseam, which then disappears.
 */
function twoPiece(o: {
  crown: P;
  frontCap: P[];
  backCap: P[];
  Uf: P;
  Ub: P;
  Wf: P;
  Wb: P;
  hem: P[];
  notchB: P;
  backDir: P;
  elbowY: number;
  h: number;
  L: number;
  hemW: number;
  cx: number;
  s: SleeveStyle;
}): Piece[] {
  const { crown, Uf, Ub, Wf, Wb, s } = o;
  // Where each seam leaves the crown: the front seam 6.5 cm in from the front underarm, the back seam
  // a fifth of the bicep in from the back, so the top sleeve is about three fifths of the sleeve.
  const w = Uf.x - Ub.x;
  const upTo = (pts: P[], done: (q: P) => boolean) => {
    const i = Math.max(1, pts.findIndex(done));
    return polyLen(pts.slice(0, i + 1));
  };
  const fUp = [...o.frontCap].reverse();
  const [fUnder, fTop] = splitAt(fUp, upTo(fUp, (q) => q.x <= Uf.x - 6.5));
  const bSplit = upTo(o.backCap, (q) => q.x >= Ub.x + w * 0.2);
  const [bUnder, bTop] = splitAt(o.backCap, bSplit);
  // The back armhole's double notch, on whichever piece it falls.
  const bn = o.backCap.reduce((bi, r, i) => (len(sub(r, o.notchB)) < len(sub(o.backCap[bi], o.notchB)) ? i : bi), 0);
  const bd = o.backDir;
  const backNotches: [P, P][] = [
    [add(o.notchB, mul(p(-bd.y, bd.x), 0.5)), bd],
    [add(o.notchB, mul(p(-bd.y, bd.x), -0.5)), bd],
  ];
  const notchOnUnder = polyLen(o.backCap.slice(0, bn + 1)) < bSplit;
  const Ft = fTop[0];
  const Bt = bTop[0];
  // The hem split 3.5 cm in from the front underseam and 30% of the way in from the back.
  const hemLen = polyLen(o.hem);
  const [hFront, hMid0] = splitAt(o.hem, 3.5);
  const [hMid, hBack] = splitAt(hMid0, hemLen - 3.5 - o.hemW * 0.3);
  const Fh = hMid[0];
  const Bh = hBack[0];

  // The front seam, hollowed at the elbow on both pieces: mirror curves about the chord, so the same length.
  const chord = sub(Fh, Ft);
  const nrm = unit(p(-chord.y, chord.x)); // toward the back
  const te = Math.min(0.8, Math.max(0.2, (o.elbowY - Ft.y) / (Fh.y - Ft.y)));
  const bow = 0.8;
  const bump = (t: number) => bow * Math.sin(Math.PI * (t < te ? (0.5 * t) / te : 0.5 + (0.5 * (t - te)) / (1 - te)));
  const N = 24;
  const seam = (side: number) => Array.from({ length: N + 1 }, (_, i) => add(add(Ft, mul(chord, i / N)), mul(nrm, side * bump(i / N))));
  const topFront = seam(1);
  const underFront = seam(-1);
  const elbowAt = Math.round(te * N);

  // The under sleeve's front part turned about the underarm so its underseam lies along the back's.
  const a = Math.atan2(Wb.y - Ub.y, Wb.x - Ub.x) - Math.atan2(Wf.y - Uf.y, Wf.x - Uf.x);
  const T = (q: P) => add(Ub, rotateAbout(sub(q, Uf), p(0, 0), a));

  const topPts = [...[...fTop].reverse().slice(0, -1), ...topFront.slice(0, -1), ...hMid.slice(0, -1), Bh, ...bTop.slice(0, -1)];
  const topTags = [
    ...fTop.slice(1).map(() => 'armhole'),
    ...topFront.slice(1).map(() => 'front-seam'),
    ...hMid.slice(1).map(() => 'hem'),
    'back-seam',
    ...bTop.slice(1).map(() => 'armhole'),
  ];
  const underPts = [
    ...[...bUnder].reverse().slice(0, -1),
    ...fUnder.map(T).slice(0, -1),
    ...underFront.map(T).slice(0, -1),
    ...[...hFront].reverse().map(T).slice(0, -1),
    ...[...hBack].reverse(),
  ];
  const underTags = [
    ...bUnder.slice(1).map(() => 'armhole'),
    ...fUnder.slice(1).map(() => 'armhole'),
    ...underFront.slice(1).map(() => 'front-seam'),
    ...hFront.slice(1).map(() => 'hem'),
    ...hBack.slice(1).map(() => 'hem'),
    'back-seam',
  ];
  // The back seam's elbow, where the two pieces' back edges are matched.
  const backElbow = lerp(Bh, Bt, Math.min(0.9, Math.max(0.1, (Bh.y - o.elbowY) / (Bh.y - Bt.y))));
  const toBack = p(-1, 0);
  const cut = 'Cut 2 (1 pair)';
  const allowances = { armhole: s.armholeAllowance, hem: s.hemAllowance, 'front-seam': s.seamAllowance, 'back-seam': s.seamAllowance };
  const top: Piece = {
    name: 'Top sleeve',
    outline: ringPath(topPts, topTags),
    lines: [],
    grain: [p(o.cx * 0.3, o.h * 0.55), p(0, o.L - 4)],
    notches: [
      [crown, p(0, -1)],
      [topFront[elbowAt], mul(nrm, -1)],
      [backElbow, toBack],
      ...(notchOnUnder ? [] : backNotches),
    ],
    balance: [],
    labels: [
      { at: p(0, o.h + 4), text: 'TOP SLEEVE', size: 1.2 },
      { at: p(0, o.h + 6), text: cut, size: 0.9 },
    ],
    cut,
    seamAllowance: s.seamAllowance,
    allowances,
    meta: { capHeight: r1(o.h), tailored: 'top' },
  };
  const underMid = lerp(Ub, T(Ft), 0.5);
  const under: Piece = {
    name: 'Under sleeve',
    outline: ringPath(underPts, underTags),
    lines: [],
    grain: [p(Ub.x, o.h + 3), p(Ub.x, o.L - 4)],
    notches: [
      [T(underFront[elbowAt]), unit(sub(T(add(underFront[elbowAt], nrm)), T(underFront[elbowAt])))],
      [backElbow, mul(toBack, -1)],
      ...(notchOnUnder ? backNotches : []),
    ],
    balance: [],
    labels: [
      { at: p(underMid.x + 1, o.h + 8), text: 'UNDER SLEEVE', size: 0.9 },
      { at: p(underMid.x + 1, o.h + 9.6), text: cut, size: 0.7 },
    ],
    cut,
    seamAllowance: s.seamAllowance,
    allowances,
    meta: { tailored: 'under' },
  };
  return [top, under];
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
