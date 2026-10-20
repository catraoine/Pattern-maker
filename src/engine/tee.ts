// The T-shirt: a knit block, drafted for stretch fabric. No darts: the knit's stretch shapes it to the
// body instead, so the ease comes from how far the fabric stretches and how close the fit is.
//
// - Ease at the bust is a share of the bust (negative for a fitted tee, about none for a regular one),
//   set from the fabric's stretch: the stretchier the knit, the less room it needs.
// - Front and back share the bust's width, the same side seam length and shoulder, so they sew edge to
//   edge with nothing eased in. A fuller bust (full bust well over high bust) moves width from the back
//   to the front and lets the front's centre hang longer (see bustShaping); a small cup and the menswear
//   form are cut the same front and back, the necklines and the armholes' front scoop apart.
// - The armhole is found so it measures the person's armhole plus a little, when it is measured.
// - The sleeve is drafted to the armhole the way the woven sleeve is (sleeve.ts), with knit ease.
// - The neckband is cut shorter than the neckline, so it pulls the edge in to lie flat.
import { P, Path, add, lerp, mul, p, sub, taggedLength } from './geometry';
import type { Piece } from './piece';
import { DraftError } from './skirt';
import { SleeveDraft, SleeveMeasurements, draftSleeveTo } from './sleeve';

export type TeeFit = 'fitted' | 'regular' | 'relaxed';
/** How far the knit stretches across: 10 cm pulled to 12 to 13 cm is low, to 13 to 15 medium, past 15 high. */
export type Stretch = 'low' | 'medium' | 'high';
export type TeeNeck = 'crew' | 'scoop' | 'v';
export type TeeSleeve = 'short' | 'elbow' | 'long';
export type TeeLength = 'cropped' | 'hip' | 'tunic';

export interface TeeMeasurements extends SleeveMeasurements {
  full_bust: number;
  waist: number;
  full_hip: number;
  waist_to_hip: number;
  neck: number;
  shoulder_width: number;
  nape_to_waist: number;
  /** Used when measured, to size the armhole. */
  armscye?: number;
  /** Used for the bust shaping; estimated from the bust until it's taken. */
  high_bust?: number;
}

export interface TeeStyle {
  fit: TeeFit;
  stretch: Stretch;
  neckline: TeeNeck;
  sleeve: TeeSleeve;
  length: TeeLength;
  /** The menswear form: no bust shaping, front and back cut alike. */
  flatFront?: boolean;
}

export const DEFAULT_TEE: TeeStyle = { fit: 'regular', stretch: 'medium', neckline: 'crew', sleeve: 'short', length: 'hip' };

/**
 * Ease at the bust as a share of the bust, by fit and stretch. A fitted tee is cut smaller than the
 * body and stretches onto it; a regular one is about the body's size; a relaxed one has room. Less
 * stretchy knits get more room, since they can't give as much.
 */
export const TEE_EASE: Record<TeeFit, Record<Stretch, number>> = {
  fitted: { low: -0.02, medium: -0.05, high: -0.08 },
  regular: { low: 0.03, medium: 0, high: -0.02 },
  relaxed: { low: 0.12, medium: 0.1, high: 0.08 },
};

/** Ease round the upper arm, as a share of it: the sleeve follows the body's fit, a little roomier. */
export const TEE_SLEEVE_EASE: Record<TeeFit, Record<Stretch, number>> = {
  fitted: { low: 0.04, medium: 0, high: -0.04 },
  regular: { low: 0.1, medium: 0.07, high: 0.05 },
  relaxed: { low: 0.2, medium: 0.18, high: 0.16 },
};

/** The neckband's length as a share of the neckline it is sewn to: shorter for stretchier knits. */
export const NECKBAND_RATIO: Record<Stretch, number> = { low: 0.9, medium: 0.87, high: 0.85 };
/** The band has to pass over the head too: an adult head is about 56 cm round, and a band stretched more
 * than a quarter goes on with a fight and sags after. So the band is never shorter than 56 / 1.25 cm,
 * though it always stays a little shorter than the neckline it pulls in. */
export const HEAD_CM = 56;
export const NECKBAND_MAX_STRETCH = 0.25;
const NECKBAND_MAX_RATIO = 0.95;
/** The neckband's cut length (before its seam) for a neckline, in cm. */
export function neckbandLength(neckline: number, stretch: Stretch): number {
  return Math.min(neckline * NECKBAND_MAX_RATIO, Math.max(neckline * NECKBAND_RATIO[stretch], HEAD_CM / (1 + NECKBAND_MAX_STRETCH)));
}
/** The neckband's finished width, folded in half, in cm. */
export const NECKBAND_CM = 1.5;

/** Seam allowances for knits: 1 cm everywhere (an overlocker trims to it), 2.5 cm at the body hem, 2 cm at the sleeve hem. */
export const KNIT_SEAM = 1;
export const KNIT_HEM = 2.5;
export const KNIT_SLEEVE_HEM = 2;

/** Crown ease for a knit sleeve, front and back together: very little, the knit gives the rest. */
const CROWN_EASE = 0.8;
/** Shoulder slope, front and back alike. */
const SLOPE = (20 * Math.PI) / 180;
/** How far the shoulder runs past the shoulder point: a relaxed tee sits a little off the shoulder. */
const SHOULDER_EXT: Record<TeeFit, number> = { fitted: 0, regular: 0.5, relaxed: 1.5 };
/** The armhole over the body's armhole, in cm, when the armhole is measured. */
const ARMHOLE_EASE: Record<TeeFit, number> = { fitted: 1, regular: 3, relaxed: 6 };
/** Extra armhole depth by fit, without an armhole measurement. */
const DEPTH_EXTRA: Record<TeeFit, number> = { fitted: 0, regular: 1, relaxed: 2.5 };
/** How much of the way in to the waist the side seam goes: fitted follows the body, relaxed hangs straight. */
const WAIST_SHAPING: Record<TeeFit, number> = { fitted: 0.7, regular: 0.35, relaxed: 0 };

/** Necklines in cm: how far the centre front drops below the neck point beyond a fifth of the neck
 * (the crew's drop is a fifth of the neck plus 3.5 cm, about 10 cm), how far the neck widens along the
 * shoulder from the knit neck width (a fifth of the neck plus 1.6 cm, each side), and how far the back
 * neck drops below the nape line. A crew neck comes out about 48 cm round on an average body, so it
 * goes over the head with the band stretching under a quarter. */
export const TEE_NECKS: Record<TeeNeck, { frontDepth: number; width: number; backDepth: number }> = {
  crew: { frontDepth: 3.5, width: 1.2, backDepth: 1 },
  scoop: { frontDepth: 8.5, width: 3.2, backDepth: 2 },
  v: { frontDepth: 11.5, width: 1.7, backDepth: 1 },
};
/** The knit neck width over a fifth of the neck, each side of the centre (the woven block uses 0.2 less). */
export const TEE_NECK_WIDEN = 1.6;

export interface TeeDraft {
  pieces: Piece[];
  sleeve: SleeveDraft;
  fit: TeeFit;
  stretch: Stretch;
  neckline: TeeNeck;
  length: TeeLength;
  sleeveLength: TeeSleeve;
  /** Bust ease as a share of the bust, and in cm round the body. */
  easePct: number;
  finishedBust: number;
  finishedWaist: number;
  finishedHem: number;
  /** One front and one back at the bust, side seam to fold: the front is the wider for a fuller bust. */
  frontBust: number;
  backBust: number;
  /** How much longer the front hangs at the centre than at the side seam, for the bust. */
  frontExtra: number;
  /** Centre back, neck edge to hem. */
  backLength: number;
  armholeDepth: number;
  /** Round one armhole, front and back together. */
  armhole: number;
  /** Round the neckline, and the neckband cut to go round it. */
  necklineCm: number;
  neckband: { length: number; ratio: number; width: number };
  warnings: string[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const perp = (u: P): P => p(-u.y, u.x);

export function draftTee(m: TeeMeasurements, style: Partial<TeeStyle> = {}): TeeDraft {
  const s: TeeStyle = { ...DEFAULT_TEE, ...style };
  for (const k of ['full_bust', 'waist', 'full_hip', 'waist_to_hip', 'neck', 'shoulder_width', 'nape_to_waist'] as const) {
    if (!(m[k] > 0)) throw new DraftError('A few measurements are missing for the T-shirt.');
  }
  if (!m.arm_length || !m.upper_arm) throw new DraftError('Add your arm length and upper arm measurements for the sleeves.');
  const B = m.full_bust;
  const warnings: string[] = [];
  const pct = TEE_EASE[s.fit][s.stretch];
  const base = 19.5 + (B - 88) * 0.1 + DEPTH_EXTRA[s.fit];
  let shape = build(m, s, base, m.armscye ? [] : warnings);
  if (m.armscye) {
    // The armhole depth that makes the armhole the person's armhole plus a little.
    const target = m.armscye + ARMHOLE_EASE[s.fit];
    let lo = base - 2;
    let hi = base + 5;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (build(m, s, mid, []).armhole < target) lo = mid;
      else hi = mid;
    }
    shape = build(m, s, (lo + hi) / 2, warnings);
    // A roomier armhole comes with a roomy fit and is harmless; a tight one is not.
    if (shape.armhole < target - 1.5) warnings.push(`armhole ${r1(shape.armhole)} cm could not reach ${r1(target)} cm within a sensible depth`);
  }
  const { front, back, scye } = shape;

  const sleeve = draftSleeveTo(front, back, m, {
    length: s.sleeve,
    shape: 'straight',
    fit: s.fit,
    seamAllowance: KNIT_SEAM,
    armholeAllowance: KNIT_SEAM,
    hemAllowance: KNIT_SLEEVE_HEM,
    ease: { bicep: m.upper_arm * TEE_SLEEVE_EASE[s.fit][s.stretch], crown: CROWN_EASE },
  });
  // A relaxed tee's wide body makes a long armhole, and a wide sleeve to fill it is part of the look.
  warnings.push(...sleeve.warnings.filter((w) => s.fit !== 'relaxed' || !/^sleeve widened/.test(w)));

  const neckline = 2 * (taggedLength(front.outline, 'neck') + taggedLength(back.outline, 'neck'));
  const bandCm = neckbandLength(neckline, s.stretch);
  const ratio = r1(bandCm / neckline * 100) / 100;
  const band = neckbandPiece(bandCm, s.neckline === 'v');

  return {
    pieces: [front, back, ...sleeve.pieces, band],
    sleeve,
    fit: s.fit,
    stretch: s.stretch,
    neckline: s.neckline,
    length: s.length,
    sleeveLength: s.sleeve,
    easePct: pct,
    finishedBust: r1(shape.bust),
    finishedWaist: r1(shape.waist),
    finishedHem: r1(shape.hem),
    frontBust: r1(shape.frontBustQ),
    backBust: r1(shape.backBustQ),
    frontExtra: r1(shape.frontExtra),
    backLength: r1(shape.hemY - shape.bd),
    armholeDepth: r1(scye),
    armhole: r1(shape.armhole),
    necklineCm: r1(neckline),
    neckband: { length: r1(bandCm), ratio, width: NECKBAND_CM },
    warnings,
  };
}

/** The cup a knit takes up with no shaping, as full bust minus high bust: about an A cup. Below it the
 * front and back are cut alike, as they always were. */
const KNIT_CUP = 2.5;
/** At most this much moves from back to front at each side seam, as on the woven bodice. */
const MAX_SHIFT = 4;
/** At most this much extra length at the centre front: past it the hem would curve too sharply to turn. */
const MAX_FRONT_EXTRA = 5;

/**
 * Bust shaping for a knit with no darts, the way a knit full-bust adjustment is made.
 *
 * - Width: the back is cut from the high bust (it has no bust to go round) and the front takes the rest,
 *   so the side seam sits under the arm instead of being dragged forward. The total round the bust is
 *   unchanged. The knit stretches over a small cup by itself, so the back is cut from the high bust
 *   plus KNIT_CUP, and only the cup past that moves to the front: a B cup barely changes.
 * - Length: the bust takes up length on the front, which lifts the hem at the centre front. The front
 *   is cut longer at its centre, curving up to the side seam, which stays the back's length so the
 *   sides still match. A side bust dart would do the same job, but a dart is bulky in jersey, puckers in
 *   a stretch fabric and is one more step to sew; a curved front hem takes the same few cm with nothing
 *   to sew. 0.4 cm of length for each cm of cup, as the bodice estimates its front length (estimate.ts).
 * - The menswear form, and a high bust as big as the full bust, get none.
 */
export function bustShaping(m: Pick<TeeMeasurements, 'full_bust' | 'high_bust'>, s: Pick<TeeStyle, 'flatFront' | 'fit' | 'stretch'>) {
  if (s.flatFront) return { cup: 0, shift: 0, length: 0 };
  const B = m.full_bust;
  // Until the high bust is taken, the cup the measurement estimates use for the same bust (estimate.ts).
  const cup = Math.max(0, B - (m.high_bust ?? B - (2.5 + Math.max(0, B - 85) * 0.075)));
  const over = Math.max(0, cup - KNIT_CUP);
  const pct = TEE_EASE[s.fit][s.stretch];
  return { cup, shift: Math.min(MAX_SHIFT, (over * (1 + pct)) / 4), length: Math.min(MAX_FRONT_EXTRA, over * 0.4) };
}

/** The front and back at armhole depth `scye` (from the nape, down). */
function build(m: TeeMeasurements, s: TeeStyle, scye: number, warnings: string[]) {
  const { full_bust: B, waist: W, full_hip: H, waist_to_hip: WH, neck: N, shoulder_width: SW, nape_to_waist: NW } = m;
  const pct = TEE_EASE[s.fit][s.stretch];
  const nl = TEE_NECKS[s.neckline];

  // ---- widths, a quarter of the body each ---------------------------------
  const bustQ0 = (B * (1 + pct)) / 4;
  const hipQ = (H * (1 + pct + 0.03)) / 4;
  const waistQ0 = (W * (1 + pct + 0.02)) / 4;
  const share = WAIST_SHAPING[s.fit];
  const hemY = s.length === 'cropped' ? NW + 1 : s.length === 'hip' ? NW + WH : NW + WH + 15;
  const relaxed = s.fit === 'relaxed';

  // ---- neck and shoulder --------------------------------------------------
  const nw = N / 5 + TEE_NECK_WIDEN;
  const hps0 = p(nw, -2);
  const u = p(Math.cos(SLOPE), Math.sin(SLOPE));
  const spX = Math.max(SW / 2, nw + 8) + SHOULDER_EXT[s.fit];
  const shoulder0 = (spX - nw) / Math.cos(SLOPE);
  const sp = add(hps0, mul(u, shoulder0));
  const widen = Math.max(0, Math.min(nl.width, shoulder0 - 7));
  const hps = add(hps0, mul(u, widen));
  if (scye < sp.y + 10) scye = sp.y + 10;

  // The underarm is never closer in than the armhole's own curve needs.
  const acrossX = Math.min(SW / 2 - 1.2, spX - 1);
  const bustQ = Math.max(bustQ0, acrossX + 2);
  if (bustQ > bustQ0 + 0.05) warnings.push(`bust widened to ${r1(4 * bustQ)} cm so the armhole fits the shoulders`);
  // The bust split between front and back, and the front's extra length (see bustShaping). The total
  // round the bust stays the same, so the ease is still what the fit and stretch set.
  const shaping = bustShaping(m, s);
  const backBustQ = Math.max(bustQ - shaping.shift, acrossX + 2);
  const frontBustQ = 2 * bustQ - backBustQ;
  const withWaist = hemY - NW >= 6;

  /** One piece's side seam points from its bust width: the underarm, the waist and the hem's width. */
  const sideOf = (bq: number) => {
    let hemQ: number;
    let waistQ: number;
    if (!withWaist) {
      hemQ = Math.max(bq - share * Math.max(0, bq - waistQ0), waistQ0);
      waistQ = hemQ;
    } else {
      hemQ = Math.max(s.length === 'tunic' ? hipQ + 1.5 : hipQ, relaxed ? bq + (s.length === 'tunic' ? 1 : 0) : 0);
      const straight = bq + (hemQ - bq) * ((NW - scye) / (hemY - scye));
      waistQ = straight - share * Math.max(0, straight - waistQ0);
    }
    return { U: p(bq, scye), Wt: p(waistQ, NW), waistQ, hemQ };
  };
  type Side = ReturnType<typeof sideOf>;
  /** The side seam, underarm to hem, ending `rise` cm above the hem line. Returns the hem corner. */
  const sideSeam = (path: Path, side: Side, rise: number) => {
    const { U, Wt } = side;
    const Hm = p(side.hemQ, hemY - rise);
    if (withWaist) {
      const d1 = Wt.y - U.y;
      const d2 = Hm.y - Wt.y;
      path.curve(add(U, p(0, d1 * 0.35)), sub(Wt, p(0, d1 * 0.35)), Wt, 'side').curve(add(Wt, p(0, d2 * 0.35)), sub(Hm, p(0, d2 * 0.4)), Hm, 'side');
    } else {
      const d = Hm.y - U.y;
      path.curve(add(U, p(0, d * 0.35)), sub(Hm, p(0, d * 0.35)), Hm, 'side');
    }
    return Hm;
  };
  const sideLength = (side: Side, rise: number) => {
    const path = new Path(side.U);
    sideSeam(path, side, rise);
    return taggedLength(path, 'side');
  };
  const backSide = sideOf(backBustQ);
  const frontSide = sideOf(frontBustQ);
  // A wider front slants its side seam differently from the back's, so the two would come out a little
  // different in length. The front's hem corner moves up or down (under a cm) until its side seam
  // is exactly the back's, so the sides sew edge to edge from underarm to hem with nothing eased.
  const backSideCm = sideLength(backSide, 0);
  let rise = 0;
  if (Math.abs(sideLength(frontSide, 0) - backSideCm) > 1e-4) {
    let lo = -3;
    let hi = 3;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (sideLength(frontSide, mid) > backSideCm) lo = mid;
      else hi = mid;
    }
    rise = (lo + hi) / 2;
  }

  /** Shoulder to underarm, through the across point, then down the side and across the hem to the
   * centre at `hemCf`. A front shaped for the bust dips lower at the centre, curving into it from the side. */
  const body = (path: Path, A: P, kUnder: number, side: Side, sideRise: number, hemCf: number) => {
    const U = side.U;
    path
      .line(sp, 'shoulder')
      .curve(add(sp, mul(perp(u), 2.5)), sub(A, p(0, 3)), A, 'armhole')
      .curve(add(A, p(0, (scye - A.y) * 0.55)), sub(U, p((U.x - A.x) * kUnder, 0)), U, 'armhole');
    const Hm = sideSeam(path, side, sideRise);
    if (Math.abs(hemCf - Hm.y) < 1e-6) return path.line(p(0, hemCf), 'hem');
    // The curve leaves the side and meets the fold square, so the hem runs smooth across both when sewn.
    return path.curve(p(Hm.x * 0.6, Hm.y), p(Hm.x * 0.45, hemCf), p(0, hemCf), 'hem');
  };

  // ---- back ---------------------------------------------------------------
  const bd = nl.backDepth;
  const Ab = p(acrossX, (sp.y + scye) / 2 + 1);
  const backPath = new Path(p(0, bd)).curve(p(hps.x * 0.6, bd), add(hps, mul(perp(u), 1 + bd * 0.4)), hps, 'neck');
  body(backPath, Ab, 0.6, backSide, 0, hemY).line(p(0, bd), 'fold');
  backPath.closed = true;

  // ---- front --------------------------------------------------------------
  const cfY = Math.min(hps0.y + N / 5 + nl.frontDepth, scye - 3);
  const cf = p(0, cfY);
  const drop = cfY - hps.y;
  const toward = (k: number) => add(hps, mul(perp(u), drop * k));
  const frontPath = new Path(cf);
  if (s.neckline === 'v') frontPath.line(lerp(cf, hps, 0.5), 'neck').curve(lerp(cf, hps, 0.75), toward(0.15), hps, 'neck');
  else if (s.neckline === 'scoop') frontPath.curve(p(hps.x * 0.7, cfY), toward(0.6), hps, 'neck');
  else frontPath.curve(p(hps.x * 0.55, cfY), toward(0.45), hps, 'neck');
  const Af = p(Math.min(SW / 2 - 2, spX - 1.5, frontBustQ - 1.5), (sp.y + scye) / 2 + 1.5);
  body(frontPath, Af, 0.75, frontSide, rise, hemY + shaping.length).line(cf, 'fold');
  frontPath.closed = true;

  const allowances = { neck: KNIT_SEAM, armhole: KNIT_SEAM, fold: 0, hem: KNIT_HEM };
  const cut = 'Cut 1 on fold';
  const grainOf = (side: Side) => Math.min(side.U.x, side.hemQ) * 0.55;
  const [gf, gb] = [grainOf(frontSide), grainOf(backSide)];
  const front: Piece = {
    name: 'Tee front',
    outline: frontPath,
    lines: [],
    grain: [p(gf, scye + 1), p(gf, hemY - 4)],
    fold: [p(0, cfY + 2), p(0, hemY - 2)],
    balance: [{ pts: [p(0, scye), frontSide.U], label: 'UNDERARM LINE' }],
    notches: [[Af, p(1, 0)]],
    labels: [
      { at: p(bustQ * 0.4, scye - 4.5), text: 'TEE FRONT', size: 1.4 },
      { at: p(bustQ * 0.4, scye - 2.5), text: cut, size: 0.9 },
      { at: p(bustQ * 0.4, scye + 5), text: 'GRAIN ALONG THE RIBS', size: 0.6 },
    ],
    cut,
    seamAllowance: KNIT_SEAM,
    allowances,
    meta: s.neckline === 'v' ? { pointedAtCentre: ['neck'], knit: true } : { knit: true },
  };
  const back: Piece = {
    name: 'Tee back',
    outline: backPath,
    lines: [],
    grain: [p(gb, scye + 1), p(gb, hemY - 4)],
    fold: [p(0, bd + 2), p(0, hemY - 2)],
    balance: [{ pts: [p(0, scye), backSide.U], label: 'UNDERARM LINE' }],
    notches: [
      [add(Ab, p(0, -0.5)), p(1, 0)], // double notch = back
      [add(Ab, p(0, 0.5)), p(1, 0)],
    ],
    labels: [
      { at: p(bustQ * 0.4, scye - 4.5), text: 'TEE BACK', size: 1.4 },
      { at: p(bustQ * 0.4, scye - 2.5), text: cut, size: 0.9 },
    ],
    cut,
    seamAllowance: KNIT_SEAM,
    allowances,
    // Front and back shoulders are the same length: nothing is eased in on a knit.
    meta: { shoulderEase: 0, foldAt: 'centre back', knit: true },
  };
  const armhole = taggedLength(frontPath, 'armhole') + taggedLength(backPath, 'armhole');
  // The finished widths round the body: front and back together, twice over.
  const round = (f: number, b: number) => 2 * (f + b);
  return {
    front,
    back,
    scye,
    armhole,
    bust: round(frontBustQ, backBustQ),
    waist: round(frontSide.waistQ, backSide.waistQ),
    hem: round(frontSide.hemQ, backSide.hemQ),
    frontBustQ,
    backBustQ,
    frontExtra: shaping.length,
    hemY,
    bd,
  };
}

/** The neckband: a strip folded in half lengthwise, cut on the fold, its length across the fabric so it
 * stretches along its length. Crew and scoop bands join at the centre back; a V's ends cross at the point. */
function neckbandPiece(length: number, v: boolean): Piece {
  const L = length / 2;
  const Hh = 2 * NECKBAND_CM;
  const outline = new Path(p(0, 0)).line(p(L, 0), 'band').line(p(L, Hh), 'end').line(p(0, Hh), 'band').line(p(0, 0), 'fold');
  outline.closed = true;
  const cut = 'Cut 1 on fold';
  return {
    name: 'Neckband',
    kind: 'band',
    outline,
    lines: [],
    grain: [p(L * 0.8, 0.4), p(L * 0.8, Hh - 0.4)],
    fold: [p(0, 0.5), p(0, Hh - 0.5)],
    notches: [
      [p(L / 2, 0), p(0, -1)],
      [p(L / 2, Hh), p(0, 1)],
    ],
    balance: [{ pts: [p(0, Hh / 2), p(L, Hh / 2)], label: 'FOLD LINE' }],
    labels: [
      { at: p(L * 0.35, Hh * 0.32), text: 'NECKBAND', size: 0.7 },
      { at: p(L * 0.35, Hh * 0.85), text: `${cut}, stretch along it`, size: 0.45 },
    ],
    cut,
    seamAllowance: KNIT_SEAM,
    allowances: { fold: 0 },
    meta: { lengthCm: r1(length), neckband: true, foldAt: v ? 'centre back' : 'centre front' },
  };
}

/** Plain words for the stretch choice and its test. */
export const STRETCH_TEST =
  'Fold the knit across, mark 10 cm along the fold and stretch it gently crosswise against a ruler. To 12 to 13 cm is low stretch, 13 to 15 cm medium, past 15 cm high. Let go: it should spring back.';

/** "-5%" or "+3%" ease at the bust. */
export const pctWords = (v: number) => `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.abs(Math.round(v * 100))}%`;

