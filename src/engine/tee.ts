// The T-shirt: a knit block, drafted for stretch fabric. No darts: the knit's stretch shapes it to the
// body instead, so the ease comes from how far the fabric stretches and how close the fit is.
//
// - Ease at the bust is a share of the bust (negative for a fitted tee, about none for a regular one),
//   set from the fabric's stretch: the stretchier the knit, the less room it needs.
// - Front and back are cut the same width with the same side seam and shoulder, so they sew edge to
//   edge with nothing eased in; only the necklines and the armholes' front scoop differ.
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
}

export interface TeeStyle {
  fit: TeeFit;
  stretch: Stretch;
  neckline: TeeNeck;
  sleeve: TeeSleeve;
  length: TeeLength;
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

/** Necklines in cm: how far the front drops below the crew's base, how far the neck widens along the
 * shoulder, and how far the back neck drops. */
export const TEE_NECKS: Record<TeeNeck, { frontDepth: number; width: number; backDepth: number }> = {
  crew: { frontDepth: 1, width: 1, backDepth: 0.5 },
  scoop: { frontDepth: 8, width: 3, backDepth: 1.5 },
  v: { frontDepth: 11, width: 1.5, backDepth: 0.5 },
};

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
  const ratio = NECKBAND_RATIO[s.stretch];
  const band = neckbandPiece(neckline * ratio, s.neckline === 'v');

  return {
    pieces: [front, back, ...sleeve.pieces, band],
    sleeve,
    fit: s.fit,
    stretch: s.stretch,
    neckline: s.neckline,
    length: s.length,
    sleeveLength: s.sleeve,
    easePct: pct,
    finishedBust: r1(4 * shape.bustQ),
    finishedWaist: r1(4 * shape.waistQ),
    finishedHem: r1(4 * shape.hemQ),
    backLength: r1(shape.hemY - shape.bd),
    armholeDepth: r1(scye),
    armhole: r1(shape.armhole),
    necklineCm: r1(neckline),
    neckband: { length: r1(neckline * ratio), ratio, width: NECKBAND_CM },
    warnings,
  };
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
  const nw = N / 5 - 0.2;
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
  let hemQ: number;
  let waistQ: number;
  const withWaist = hemY - NW >= 6;
  if (!withWaist) {
    hemQ = Math.max(bustQ - share * Math.max(0, bustQ - waistQ0), waistQ0);
    waistQ = hemQ;
  } else {
    hemQ = Math.max(s.length === 'tunic' ? hipQ + 1.5 : hipQ, relaxed ? bustQ + (s.length === 'tunic' ? 1 : 0) : 0);
    const straight = bustQ + (hemQ - bustQ) * ((NW - scye) / (hemY - scye));
    waistQ = straight - share * Math.max(0, straight - waistQ0);
  }

  const U = p(bustQ, scye);
  const Wt = p(waistQ, NW);
  const Hm = p(hemQ, hemY);

  /** Shoulder to underarm, through the across point, then down the side and across the hem. */
  const body = (path: Path, A: P, kUnder: number) => {
    path
      .line(sp, 'shoulder')
      .curve(add(sp, mul(perp(u), 2.5)), sub(A, p(0, 3)), A, 'armhole')
      .curve(add(A, p(0, (scye - A.y) * 0.55)), sub(U, p((U.x - A.x) * kUnder, 0)), U, 'armhole');
    if (withWaist) {
      const d1 = Wt.y - U.y;
      const d2 = Hm.y - Wt.y;
      path.curve(add(U, p(0, d1 * 0.35)), sub(Wt, p(0, d1 * 0.35)), Wt, 'side').curve(add(Wt, p(0, d2 * 0.35)), sub(Hm, p(0, d2 * 0.4)), Hm, 'side');
    } else {
      const d = Hm.y - U.y;
      path.curve(add(U, p(0, d * 0.35)), sub(Hm, p(0, d * 0.35)), Hm, 'side');
    }
    return path.line(p(0, hemY), 'hem');
  };

  // ---- back ---------------------------------------------------------------
  const bd = nl.backDepth;
  const Ab = p(acrossX, (sp.y + scye) / 2 + 1);
  const backPath = new Path(p(0, bd)).curve(p(hps.x * 0.6, bd), add(hps, mul(perp(u), 1 + bd * 0.4)), hps, 'neck');
  body(backPath, Ab, 0.6).line(p(0, bd), 'fold');
  backPath.closed = true;

  // ---- front --------------------------------------------------------------
  const cfY = Math.min(hps0.y + nw + 1 + nl.frontDepth, scye - 3);
  const cf = p(0, cfY);
  const drop = cfY - hps.y;
  const toward = (k: number) => add(hps, mul(perp(u), drop * k));
  const frontPath = new Path(cf);
  if (s.neckline === 'v') frontPath.line(lerp(cf, hps, 0.5), 'neck').curve(lerp(cf, hps, 0.75), toward(0.15), hps, 'neck');
  else if (s.neckline === 'scoop') frontPath.curve(p(hps.x * 0.7, cfY), toward(0.6), hps, 'neck');
  else frontPath.curve(p(hps.x * 0.55, cfY), toward(0.45), hps, 'neck');
  const Af = p(Math.min(SW / 2 - 2, spX - 1.5, U.x - 1.5), (sp.y + scye) / 2 + 1.5);
  body(frontPath, Af, 0.75).line(cf, 'fold');
  frontPath.closed = true;

  const allowances = { neck: KNIT_SEAM, armhole: KNIT_SEAM, fold: 0, hem: KNIT_HEM };
  const cut = 'Cut 1 on fold';
  const grainX = Math.min(bustQ, hemQ) * 0.55;
  const front: Piece = {
    name: 'Tee front',
    outline: frontPath,
    lines: [],
    grain: [p(grainX, scye + 1), p(grainX, hemY - 4)],
    fold: [p(0, cfY + 2), p(0, hemY - 2)],
    balance: [{ pts: [p(0, scye), U], label: 'UNDERARM LINE' }],
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
    grain: [p(grainX, scye + 1), p(grainX, hemY - 4)],
    fold: [p(0, bd + 2), p(0, hemY - 2)],
    balance: [{ pts: [p(0, scye), U], label: 'UNDERARM LINE' }],
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
  return { front, back, scye, armhole, bustQ, waistQ, hemQ, hemY, bd };
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

