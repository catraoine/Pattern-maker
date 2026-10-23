// Straight skirt block, drafted flat from waist, hip and waist-to-hip depth (Aldrich-style).
// Ported from the Python prototype in the drafting thread (pattern/skirt.py).
import { P, Path, add, len, mul, p, sub, taggedLength, unit } from './geometry';
import { finishDart } from './darts';
import { Piece, withAlternate } from './piece';
import { HemShape, isShaped, matchSides, shapeHem } from './hem';
import { Flounce, GodetCount, Pleats, VolumeDraft, addVolume, volumeOf } from './skirtVolume';
import { AsymHem, AsymPlan, quarterAsym } from './asymHem';
import { SLIP_HEM, SLIP_HIP_EASE_LESS, closeToHem, cutsWhole, cutWhole, slipSideSupp, validCut } from './slip';
import { inseamPocket, markSeam } from './pockets';
import { foldBack, wrapSkirtAllowed, wrapSkirtFront, wrapTies } from './wrapSkirt';

export interface SkirtMeasurements {
  waist: number;
  full_hip: number;
  waist_to_hip: number;
  /** Down the centre front and centre back from the waist to the hip line. Where they differ from the
   * side (a tummy, a sway back, a full seat), the centre waist is raised or lowered to match. */
  front_waist_to_hip?: number;
  back_waist_to_hip?: number;
  waist_to_knee: number;
  waist_to_floor: number;
}

export type Fit = 'fitted' | 'regular' | 'relaxed';
/** 'slip' is the bias-cut slip skirt: dartless, cut whole on the bias (see slip.ts). 'gathered' is a
 * dirndl: straight panels gathered into the waistband or the bodice. */
export type Silhouette = 'straight' | 'pencil' | 'a_line' | 'trumpet' | 'half_circle' | 'circle' | 'slip' | 'gathered';

/** Circle skirts are cut as arcs from the waist rather than drafted from the block. */
export const isCircle = (s: Silhouette) => s === 'half_circle' || s === 'circle';
export type Length = 'mini' | 'above_knee' | 'knee' | 'midi' | 'maxi';
export type NoSeam = 'sheath' | 'shift';

export interface SkirtStyle {
  fit: Fit;
  silhouette: Silhouette;
  length: Length;
  seamAllowance: number;
  hemAllowance: number;
  /** Exact proportions, read from a photo, that override the standard length and fullness. */
  shape?: SkirtShape;
  /** A length in cm set by dragging the hem, in place of the named length (or a photo's). */
  lengthCm?: number;
  /** How far the hem flares out past the hip at each side seam, in cm, set by dragging. Negative tapers in. */
  flareCm?: number;
  /** A hand-drawn hem shape. */
  hem?: HemShape;
  /** Corrections from fitting a toile, on top of the measurements. */
  fitting?: SkirtFitting;
  /**
   * For a dress: the skirt is sewn to a bodice, so its waist is drafted to the bodice's waist seam
   * rather than to the waistband. Front and back are a quarter of the waist seam each, darts closed,
   * as finished; dartAt puts the dart nearest the centre under the bodice's dart, in cm from the
   * centre; zipCm is how far the zip runs on below the waist.
   */
  joinTo?: { front: number; back: number; dartAt?: { front?: number; back?: number }; zipCm?: number };
  /** Fullness added to a straight, pencil or A-line skirt: pleats, godets, or a hem flounce or tiers.
   * One at a time; older saves have none (see skirtVolume.ts). */
  pleats?: Pleats;
  godets?: GodetCount;
  flounce?: Flounce;
  /** A high-low or diagonal hem, drafted in place of a drawn one. Older saves have none. */
  asymHem?: AsymHem;
  /** In-seam pockets in the side seams. Older saves have none. */
  pockets?: 'none' | 'inseam';
  /** A waistband with a zip, or an elastic casing that pulls on over the hips. Ignored on a dress. */
  waist?: WaistStyle;
  /** A dress only: cut with no waist seam, front and back each one piece from the shoulder to the hem
   * (see dress.ts). Ignored on a skirt. */
  noSeam?: NoSeam;
  /** Wrapped: each front reaches across the body to a free edge, and it ties at the waist (see wrapSkirt.ts). */
  wrap?: boolean;
}

export type WaistStyle = 'band' | 'elastic';

/**
 * Corrections made after trying on a toile, in cm. Ease is added to (or taken from) the fit's own; a
 * centre drop lowers the centre waist (negative raises it); darts are lengthened or shortened.
 */
export interface SkirtFitting {
  hipEase?: number;
  waistEase?: number;
  frontDrop?: number;
  backDrop?: number;
  dartLength?: number;
  /** One hip higher than the other: that side's waist is raised at the side seam, tapering to the centre. */
  highHip?: { side: Side; cm: number };
}

export type Side = 'left' | 'right';

/**
 * A skirt's shape as proportions of the body, so a shape read from a photo of one person drafts to the
 * same look on another. Positions run from the waist (0) to the floor (1).
 */
export interface SkirtShape {
  hemAt: number;
  /** Hem circumference divided by the finished hip: under 1 tapers, 1 hangs straight, 3 or more is a circle. */
  hemFullness: number;
  /** Trumpet skirts only: where the flare starts. */
  flareAt?: number;
}

// Ease in cm from styling/styling-options.json (skirt fit options).
export const FIT_EASE: Record<Fit, { waist: number; hip: number }> = {
  fitted: { waist: 1, hip: 4 },
  regular: { waist: 2, hip: 7 },
  relaxed: { waist: 3, hip: 11 },
};

// Hem position from the body landmarks, scaled to the body so a petite and a tall mini read the same.
// On the sample body (waist to knee 58, waist to floor 104) these finish at 38, 50, 58, 76 and 97 cm
// from the natural waist, in line with ready-to-wear: a mini at mid-thigh, above the knee clear of the
// kneecap, a midi at mid-calf (not the lower calf) and a maxi at the ankle.
export const LENGTHS: Record<Length, (m: SkirtMeasurements) => number> = {
  mini: (m) => Math.max(m.waist_to_hip + 12, m.waist_to_knee * 0.66),
  above_knee: (m) => m.waist_to_knee * 0.86,
  knee: (m) => m.waist_to_knee,
  midi: (m) => m.waist_to_knee + (m.waist_to_floor - m.waist_to_knee) * 0.4,
  maxi: (m) => m.waist_to_floor - 7,
};

export const DEFAULT_STYLE: SkirtStyle = {
  fit: 'regular',
  silhouette: 'a_line',
  length: 'knee',
  seamAllowance: 1.5,
  hemAllowance: 4,
};

export class DraftError extends Error {}

/** A length as printed in the drafting notes, such as 25.8 cm. */
export const cm = (v: number) => `${(Math.round(v * 10) / 10).toFixed(1)} cm`;
const centrePoint = (d: { near: P; far: P }) => p((d.near.x + d.far.x) / 2, (d.near.y + d.far.y) / 2);

function darts(supp: number, maxPerDart: number): number[] {
  if (supp <= 0.3) return [];
  const n = supp <= maxPerDart ? 1 : 2;
  return new Array(n).fill(supp / n);
}

interface HalfArgs {
  name: string;
  hipQ: number;
  waistQ: number;
  hipDepth: number;
  length: number;
  centreDrop: number;
  /** Waist length taken into the darts because a raised or lowered centre makes the waist curve longer. */
  takeUp?: number;
  /** True when the centre drop comes from a measurement rather than the standard 1 cm at the back. */
  measuredCentre?: boolean;
  /** Front and back centre drops averaged, so the waists of both meet the side seam at the same angle. */
  meanDrop: number;
  sideSupp: number;
  dartMax: number;
  dartLen: number;
  flare: number;
  /** Trumpet skirts stay close to the body down to here, then flare. */
  flareFrom?: number;
  isFront: boolean;
  sa: number;
  hemSa: number;
  zipCm: number;
  /** Where the dart nearest the centre goes, in cm from the centre, to line up with a bodice's. */
  dartAt?: number;
  /** Cut on the fold: the front always, the back too when there is no zip in it. */
  onFold?: boolean;
}

/** Dart centres: spread across the waist, or the first set where asked and the second clear of it. */
function dartCentres(ds: number[], width: number, isFront: boolean, at?: number): number[] {
  if (ds.length === 0) return [];
  const spread = ds.length === 1 ? [width * 0.5] : (isFront ? [0.33, 0.62] : [0.3, 0.6]).map((f) => width * f);
  if (at === undefined) return spread;
  const first = Math.max(ds[0] / 2 + 2, Math.min(at, width - ds[0] / 2 - 2.5));
  if (ds.length === 1) return [first];
  const second = Math.max(spread[1], first + (ds[0] + ds[1]) / 2 + 2.5);
  return second + ds[1] / 2 + 2 <= width ? [first, second] : spread;
}

/** Draft one quarter of the skirt. Centre at x=0, side seam at x≈hipQ. */
function half(a: HalfArgs): Piece {
  const supp = a.hipQ - a.waistQ;
  const ds = darts(supp - a.sideSupp, a.dartMax);
  const sideSupp = supp - ds.reduce((s, d) => s + d, 0);
  // Keep dart tips at least 3 cm above the hip line, where the body is widest.
  const dartLen = Math.min(a.dartLen, a.hipDepth - 3);
  // Decided on the shared side shaping, so front and back rise alike even when only one has darts.
  const sideRise = a.sideSupp > 1 ? 1.25 : 0.6;

  const cw = p(0, a.centreDrop); // centre waist
  const sw = p(a.hipQ - sideSupp, -sideRise); // side waist
  const sh = p(a.hipQ, a.hipDepth); // side hip
  const ch = p(0, a.length); // centre hem
  const flareStart = a.flareFrom !== undefined ? p(a.hipQ, a.flareFrom) : sh;
  // A flared hem is an arc centred on the centre line that meets the side seam square, so front and
  // back join in a smooth curve. Its centre is where the side seam, carried on upward, meets the centre,
  // so a seam ending at angle a off vertical lifts the side hem by x tan(a/2). The angle is capped so
  // the lift stays under a quarter of the flaring part of the seam, which keeps short skirts sensible.
  let hemSide = p(a.hipQ + a.flare, a.length);
  let hemArc: { R: number; t: P } | undefined;
  let hemLift = 0;
  if (a.flare > 0) {
    const k = a.length - flareStart.y;
    let lift = 0;
    let angle = 0;
    let flare = a.flare;
    for (let i = 0; i < 40; i++) {
      const cap = 2 * Math.atan((0.25 * k) / (a.hipQ + flare));
      // A trumpet seam leaves the flare point straight down and swings out to its end angle; an
      // A-line seam is straight, so its angle is set by the flare and the drop.
      angle = Math.min(cap, a.flareFrom !== undefined ? Math.min((22 * Math.PI) / 180, Math.atan(a.flare / (0.5 * k))) : Math.atan(a.flare / (k - lift)));
      if (a.flareFrom === undefined) flare = (k - lift) * Math.tan(angle);
      else flare = Math.min(a.flare, 0.5 * (k - lift));
      lift = 0.5 * lift + 0.5 * (a.hipQ + flare) * Math.tan(angle / 2);
    }
    const t = p(Math.sin(angle), Math.cos(angle));
    hemLift = lift;
    hemSide = p(a.hipQ + flare, a.length - lift);
    hemArc = { R: hemSide.x / t.x, t };
  }

  // The waist rises to the side in a curve that leaves the centre square. Over its last few cm it
  // turns to meet the side seam at a right angle, at the same angle on front and back (halfway
  // between their natural angles, the back being dropped 1 cm at the centre), so the waist runs on
  // smoothly across the side seam once it is sewn.
  const endSlope = (2 * (sw.y - a.meanDrop)) / sw.x;
  const ownSlope = (2 * (sw.y - cw.y)) / sw.x;
  const blend = Math.min(4, sw.x * 0.3);
  const waistY = (x: number) => {
    const t = x / sw.x;
    const u = (x - (sw.x - blend)) / blend;
    return cw.y + (sw.y - cw.y) * t * t + (u > 0 ? (endSlope - ownSlope) * blend * (u ** 3 - u ** 2) : 0);
  };
  const squareOff = unit(p(-endSlope, 1)); // down the side seam, square to the waist

  // Dart centres spread across the waist, back darts biased toward centre.
  const centres = dartCentres(ds, sw.x, a.isFront, a.dartAt);

  // Darts are pressed toward the centre, trued, and the waist seam is peaked over each one.
  const finished = centres.map((c, i) => {
    const w = ds[i];
    const depth = ds.length === 1 ? dartLen : dartLen - (c > centres[0] ? 1.5 : 0);
    const near = p(c - w / 2, waistY(c - w / 2));
    const away = unit(sub(p(near.x - 0.5, waistY(near.x - 0.5)), near));
    return finishDart(p(c, waistY(c) + depth), near, p(c + w / 2, waistY(c + w / 2)), away);
  });

  const outline = new Path(cw);
  // Trued dart legs end a little off the waist curve; the waist eases onto them over the run between
  // darts, rather than stepping down at each one.
  const waistTo = (from: P, to: P) => {
    const n = Math.max(4, Math.ceil(Math.abs(to.x - from.x) * 4));
    const d0 = from.y - waistY(from.x);
    const d1 = to.y - waistY(to.x);
    // Points close to the centre and the side keep the direction the waist leaves and arrives in.
    const ts = Array.from({ length: n - 1 }, (_, i) => (i + 1) / n);
    for (const t of [...(from.x === 0 ? [0.0005, 0.004] : []), ...ts, ...(to === sw ? [0.996, 0.9995] : [])]) {
      const x = from.x + (to.x - from.x) * t;
      const h = t * t * (3 - 2 * t); // eases in and out, so the waist stays square at centre and side
      outline.line(p(x, waistY(x) + d0 * (1 - h) + d1 * h), 'waist');
    }
  };
  let from = cw;
  for (const d of finished) {
    waistTo(from, d.near);
    outline.line(d.near, 'waist').line(d.peak, 'dart').line(d.far, 'dart');
    from = d.far;
  }
  waistTo(from, sw);
  outline.line(sw, 'waist');
  outline.curve(add(sw, mul(squareOff, a.hipDepth * 0.2)), p(a.hipQ, a.hipDepth * 0.55), sh, 'side');
  if (hemArc && a.flareFrom !== undefined) {
    const { t } = hemArc;
    const k = hemSide.y - flareStart.y;
    outline.line(flareStart, 'side');
    outline.curve(p(a.hipQ, flareStart.y + k * 0.45), sub(hemSide, mul(t, k * 0.4)), hemSide, 'side');
  } else {
    outline.line(hemSide, 'side');
  }
  if (hemArc) {
    const { R, t } = hemArc;
    const angle = Math.acos(Math.min(1, t.y));
    const kk = (4 / 3) * Math.tan(angle / 4) * R;
    outline.curve(add(hemSide, mul(p(-t.y, t.x), kk)), p(kk, a.length), ch, 'hem');
  } else {
    // Square off the side seam and the centre, so the hem runs on smoothly across both.
    const down = unit(sub(hemSide, sh));
    const k = hemSide.x * 0.35;
    outline.curve(add(hemSide, mul(p(-down.y, down.x), k)), add(ch, p(k, 0)), ch, 'hem');
  }
  const onFold = a.onFold ?? a.isFront;
  outline.line(cw, onFold ? 'fold' : 'centre');
  outline.closed = true;

  const lines = finished.map((d) => new Path(d.near).line(d.tip).line(d.far));

  const cut = onFold ? 'Cut 1 on fold' : 'Cut 2 (1 pair)';
  const gx = a.hipQ * 0.45;
  const dartTotal = ds.reduce((t, d) => t + d, 0);
  const draft = {
    frame: [
      [p(0, 0), p(a.hipQ, 0)],
      [p(a.hipQ, 0), p(a.hipQ, a.length)],
      [p(0, a.length), p(a.hipQ, a.length)],
    ],
    points: [
      {
        n: '0',
        at: cw,
        note:
          Math.abs(a.centreDrop) < 0.05
            ? 'Centre waist. Square down for the centre front and across for the waist line.'
            : `Centre waist, ${cm(Math.abs(a.centreDrop))} ${a.centreDrop > 0 ? 'below' : 'above'} the waist line${
                a.measuredCentre ? `, so the centre ${a.isFront ? 'front' : 'back'} is your ${cm(a.hipDepth - a.centreDrop)} from waist to hip` : ': the back waist sits lower'
              }.`,
      },
      { n: '1', at: p(0, a.hipDepth), note: `0 to 1, waist to hip: ${cm(a.hipDepth)}. Square across for the hip line.` },
      { n: '2', at: ch, note: `0 to 2, skirt length: ${cm(a.length)}. Square across for the hem line.` },
      { n: '3', at: sh, note: `1 to 3, a quarter of the hip with ease: ${cm(4 * a.hipQ)} / 4 = ${cm(a.hipQ)}. Square up to the waist line.` },
      {
        n: '4',
        at: sw,
        note: `Side waist: a quarter of the waist with ease, ${a.isFront ? 'plus' : 'less'} 0.5 cm, is ${cm(a.waistQ + (a.takeUp ?? 0))}${a.takeUp ? ` (${cm(a.takeUp)} more goes into the darts, for the longer curve of the waist)` : ''}; with ${cm(dartTotal)} of darts it sits ${cm(sideSupp)} in from the frame, raised ${cm(sideRise)}. The side seam curves from 4 to 3.`,
      },
      {
        n: '5',
        at: hemSide,
        note:
          hemSide.x > a.hipQ + 0.05
            ? `Hem at the side: out ${cm(hemSide.x - a.hipQ)} and up ${cm(hemLift)}, so the hem meets the side seam square.${a.flareFrom !== undefined ? ` The flare starts ${cm(a.flareFrom)} below the waist.` : ''}`
            : hemSide.x < a.hipQ - 0.05
              ? `Hem at the side: in ${cm(a.hipQ - hemSide.x)} from the frame, tapering the skirt.`
              : 'Hem at the side: straight down from 3.',
      },
      ...finished.map((d, i) => ({
        n: `D${i + 1}`,
        at: d.tip,
        note: `Dart ${i + 1}: ${cm(ds[i])} wide, ${cm(len(sub(d.tip, centrePoint(d))))} long, centred ${cm(centres[i])} from the centre${a.isFront ? ' front' : ' back'}.`,
      })),
    ],
  };
  // Balance notches at the hip: single on the front, double on the back, so the pieces can't be swapped.
  const notches: [P, P][] = a.isFront ? [[sh, p(1, 0)]] : [[add(sh, p(0, -0.5)), p(1, 0)], [add(sh, p(0, 0.5)), p(1, 0)]];
  // The back centre seam holds the zip; its notch marks where the zip ends and the seam starts.
  const zipEnd = p(0, a.centreDrop + a.zipCm);
  const zipped = !a.isFront && a.zipCm > 0;
  if (zipped) notches.push([zipEnd, p(-1, 0)]);

  return {
    name: a.name,
    outline,
    lines,
    grain: [p(gx, a.hipDepth + 4), p(gx, a.length - 8)],
    fold: onFold ? [p(0, cw.y + 2), p(0, a.length - 2)] : undefined,
    notches,
    balance: [{ pts: [p(0, a.hipDepth), sh], label: 'HIP LINE' }],
    labels: [
      { at: p(a.hipQ * 0.5, a.hipDepth - 4), text: a.name.toUpperCase(), size: 1.6 },
      { at: add(p(a.hipQ * 0.5, a.hipDepth), p(0, 1)), text: cut, size: 1.0 },
      ...(zipped ? [{ at: add(zipEnd, p(3.2, 0.3)), text: 'ZIP ENDS', size: 0.7 }] : []),
    ],
    cut,
    draft,
    seamAllowance: a.sa,
    allowances: { hem: a.hemSa, fold: 0 },
    meta: {
      dartsCm: ds.map((d) => Math.round(d * 100) / 100),
      sideSuppressionCm: Math.round(sideSupp * 100) / 100,
    },
  };
}

export interface CircleArgs {
  name: string;
  r: number; // waist radius
  /** Waist darts, in cm of intake each, for a circle cut bigger than the waist so it clears the hips. */
  darts: number[];
  dartLen: number;
  angle: number; // radians of circle this piece covers
  length: number;
  isFront: boolean;
  hipDepth: number;
  /** The front goes on the fold unless it is too wide for folded fabric, then it gets a centre seam.
   * The back has the zip in its centre seam, unless the waist is elastic. */
  onFold: boolean;
  sa: number;
  hemSa: number;
  zipCm: number;
}

/** Points on a circle centred at (0, -r) above the centre waist, measured from straight down. */
export const onCircle = (r: number, R: number, phi: number) => p(R * Math.sin(phi), -r + R * Math.cos(phi));

/** Add an arc as cubic Beziers, at most 30 degrees each. */
export function arc(path: Path, r: number, R: number, from: number, to: number, tag: string) {
  const n = Math.max(1, Math.ceil(Math.abs(to - from) / (Math.PI / 6)));
  const step = (to - from) / n;
  const k = (4 / 3) * Math.tan(step / 4) * R;
  for (let i = 0; i < n; i++) {
    const a0 = from + step * i;
    const a1 = a0 + step;
    const t0 = p(Math.cos(a0), -Math.sin(a0)); // tangent of increasing angle
    const t1 = p(Math.cos(a1), -Math.sin(a1));
    const e0 = onCircle(r, R, a0);
    const e1 = onCircle(r, R, a1);
    path.curve(add(e0, mul(t0, k)), sub(e1, mul(t1, k)), e1, tag);
  }
}

/** One piece of a circle skirt: a wedge of a ring, centre line down the y axis, side seam on the radius. */
export function circlePiece(a: CircleArgs): Piece {
  const R = a.r + a.length;
  const outline = new Path(p(0, 0));
  // Darts point straight out from the circle's centre, spread evenly along the waist, pressed toward
  // the centre front or back like the darted skirt's.
  const finished = a.darts.map((w, i) => {
    const phi = (a.angle * (i + 1)) / (a.darts.length + 1);
    const half = w / a.r / 2;
    const near = onCircle(a.r, a.r, phi - half);
    const away = p(-Math.cos(phi - half), Math.sin(phi - half));
    return { from: phi - half, to: phi + half, d: finishDart(onCircle(a.r, a.r + a.dartLen, phi), near, onCircle(a.r, a.r, phi + half), away) };
  });
  let from = 0;
  for (const f of finished) {
    arc(outline, a.r, a.r, from, f.from, 'waist');
    outline.line(f.d.peak, 'dart').line(f.d.far, 'dart');
    from = f.to;
  }
  arc(outline, a.r, a.r, from, a.angle, 'waist');
  outline.line(onCircle(a.r, R, a.angle), 'side');
  arc(outline, a.r, R, a.angle, 0, 'hem');
  outline.line(p(0, 0), a.onFold ? 'fold' : 'centre');
  outline.closed = true;

  const cut = a.onFold ? 'Cut 1 on fold' : 'Cut 2 (1 pair)';
  const mid = a.angle / 2;
  const at = (f: number, phi = mid) => onCircle(a.r, a.r + a.length * f, phi);
  const sideNotch = onCircle(a.r, a.r + Math.min(20, a.length / 3), a.angle);
  const out = p(Math.cos(a.angle), -Math.sin(a.angle));
  const along = p(Math.sin(a.angle), Math.cos(a.angle));
  const notches: [P, P][] = a.isFront ? [[sideNotch, out]] : [[sub(sideNotch, mul(along, 0.5)), out], [add(sideNotch, mul(along, 0.5)), out]];
  const hipLine = Array.from({ length: 17 }, (_, i) => onCircle(a.r, a.r + a.hipDepth, (a.angle * i) / 16));
  const zipEnd = p(0, a.zipCm);
  const zipped = !a.isFront && a.zipCm > 0;
  if (zipped) notches.push([zipEnd, p(-1, 0)]);
  // Centre front and centre back on the straight grain, so the sides fall on the bias and drape evenly.
  const gx = Math.min(8, at(0.5).x * 0.5);
  const waistSide = onCircle(a.r, a.r, a.angle);
  const draft = {
    frame: [] as P[][],
    points: [
      {
        n: '0',
        at: p(0, 0),
        note: `Centre waist. The waist is an arc of radius ${cm(a.r)}, drawn from a centre ${cm(a.r)} above this point: the cut waist divided by 2 pi times the share of a circle.`,
      },
      { n: '1', at: p(0, a.length), note: `0 to 1, skirt length: ${cm(a.length)}. The hem is an arc of radius ${cm(R)} from the same centre.` },
      {
        n: '2',
        at: waistSide,
        note: `Side waist: the waist arc covers ${Math.round(((a.angle * 180) / Math.PI) * 10) / 10} degrees, ${cm(a.r * a.angle)} of waist${a.darts.length ? ` with ${cm(a.darts.reduce((t, d) => t + d, 0))} of darts` : ''}. The side seam runs straight out along the radius.`,
      },
      { n: '3', at: onCircle(a.r, R, a.angle), note: `Hem at the side, ${cm(R)} from the centre. Every point of the hem is the same distance from the waist, so it hangs level.` },
    ],
  };
  return {
    name: a.name,
    draft,
    outline,
    lines: finished.map((f) => new Path(f.d.near).line(f.d.tip).line(f.d.far)),
    grain: [p(gx, a.length * 0.3), p(gx, a.length * 0.8)],
    fold: a.onFold ? [p(0, 2), p(0, a.length - 2)] : undefined,
    notches,
    balance: a.hipDepth < a.length ? [{ pts: hipLine, label: 'HIP LINE' }] : [],
    labels: [
      { at: at(0.35), text: a.name.toUpperCase(), size: 1.6 },
      { at: add(at(0.35), p(0, 2.4)), text: cut, size: 1.0 },
      ...(zipped ? [{ at: add(zipEnd, p(3.2, 0.3)), text: 'ZIP ENDS', size: 0.7 }] : []),
    ],
    cut,
    seamAllowance: a.sa,
    allowances: { hem: a.hemSa, fold: 0 },
    meta: {
      dartsCm: a.darts.map((d) => Math.round(d * 100) / 100),
      sideSuppressionCm: 0,
      angleDeg: Math.round((a.angle * 180) / Math.PI * 10) / 10,
      waistRadius: a.r,
    },
  };
}

// Folded 140 cm fabric leaves about 68 cm for a piece placed on the fold.
const FOLD_WIDTH_MAX = 68;

export interface SkirtDraft {
  pieces: Piece[];
  lengthCm: number;
  finishedWaist: number;
  finishedHip: number;
  /** For circle skirts, how much of a circle the skirt makes (1 is a full circle). */
  circleShare?: number;
  /** Hem circumference, to show how full the skirt is. */
  hemCm: number;
  /** For block skirts, the flare at each side seam in cm (negative tapers in), so it can be dragged from here. */
  flareCm?: number;
  /** The hem shape as drafted, after front and back were matched at the sides and kept to a wearable length. */
  hem?: HemShape;
  zipCm: number; // invisible zip in the centre back seam; 0 for an elastic waist
  waistband: Waistband;
  dartsPerSide: { front: number; back: number };
  /** With pleats, godets, a flounce or tiers: the plain skirt as it hangs, before the pleats were
   * spread into it or the flounce or tiers cut from it, for the sketch, the figure and the ease map. */
  block?: Piece[];
  /** What gives the skirt its fullness, as drafted. */
  volume?: VolumeDraft;
  /** Cut on the bias: the slip skirt. */
  bias?: boolean;
  /** Pieces cut whole, single layer (a bias slip, or a hem that differs side to side): the half
   * pieces they were mirrored from, front and back, for the sketches. */
  halves?: [Piece, Piece];
  /** Where the invisible zip goes: the centre back seam unless the back is cut whole. */
  opening?: 'centre_back' | 'left_side';
  /** A narrow faced waist in place of the waistband: the bias slip (see waistPieces in finishing.ts). */
  faced?: boolean;
  /** A high-low or diagonal hem as drafted (see asymHem.ts). */
  asym?: AsymPlan;
  /** A pull-on elastic waist: the waist is cut to pass the hips and gathered up by the elastic. */
  elastic?: Elastic;
  /** In-seam pockets: where the opening is, in cm down the side seam from the waist. */
  pocket?: [number, number];
  /** A gathered skirt: its waist round as cut, and the band, casing or bodice seam it is gathered into. */
  gathers?: { round: number; into: number };
  /** A wrap skirt: the whole front's waist (each front reaches across), and its ties (none on a dress,
   * whose bodice carries them). */
  wrap?: { frontWaist: number; ties?: ReturnType<typeof wrapTies> };
}

export const WAISTBAND_CM = 3; // finished width

/**
 * A pull-on waist is cut at least 6 cm bigger than the hip, so it slips over the hips without a zip,
 * and gathered onto elastic. The elastic is the waist less 6 cm, snug enough to hold the garment up,
 * plus 2 cm to overlap the ends; but never so short it must stretch more than 1.8 times its length to
 * pass the hips, which is about as far as ordinary 2.5 cm woven elastic goes and still recovers.
 */
export const PULL_ON_EASE = 6;
export const ELASTIC_WIDTH = 2.5;
const ELASTIC_LESS = 6;
const ELASTIC_OVERLAP = 2;
const ELASTIC_STRETCH = 1.8;

export interface Elastic {
  widthCm: number;
  /** Round the body once joined. */
  finishedCm: number;
  /** To cut, with the overlap. */
  cutCm: number;
  /** True when the hips needed it longer than the waist less 6 cm, so it sits a little looser at the waist. */
  forHips: boolean;
}

export function elasticFor(waist: number, cutWaist: number): Elastic {
  const snug = waist - ELASTIC_LESS;
  const least = cutWaist / ELASTIC_STRETCH;
  const finishedCm = Math.round(Math.max(snug, least) * 2) / 2;
  return { widthCm: ELASTIC_WIDTH, finishedCm, cutCm: finishedCm + ELASTIC_OVERLAP, forHips: least > snug };
}

/** Pick a standard zip length that opens far enough to get over the hips. */
export function zipLength(hipDepth: number): number {
  return hipDepth < 18 ? 18 : hipDepth < 22 ? 20 : 23;
}

/**
 * The waistband is a plain rectangle, so it is given as measurements to mark straight onto the fabric
 * rather than printed (printing it would add a whole column of pages). Folded lengthwise, it ends at
 * the zip on each side.
 */
export interface Waistband {
  cutLength: number; // cm, including seam allowance at both ends
  cutWidth: number; // cm, twice the finished width plus seam allowance on both long edges
  sideMark: number; // cm from each end to the side seam marks
}

function waistband(finishedWaist: number, backQ: number, sa: number): Waistband {
  const r = (v: number) => Math.round(v * 10) / 10;
  return { cutLength: r(finishedWaist + 2 * sa), cutWidth: r(2 * WAISTBAND_CM + 2 * sa), sideMark: r(sa + backQ) };
}

/** Hem circumference: each piece is a quarter of the skirt (half of a pair, or half of a fold piece). */
const hemCm = (front: Piece, back: Piece) => Math.round(2 * (taggedLength(front.outline, 'hem') + taggedLength(back.outline, 'hem')));

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function draftSkirt(m: SkirtMeasurements, style: Partial<SkirtStyle> = {}): SkirtDraft {
  const s = validCut({ ...DEFAULT_STYLE, ...style });
  if (s.wrap && wrapSkirtAllowed(s)) return wrapped(drafted(m, { ...s, hem: undefined }), s);
  // Cut whole (a bias slip, or a hem that differs side to side): the halves are mirrored into whole
  // pieces, then hemmed and fitted to one side as whole pieces. Neither takes pleats, godets or a flounce,
  // nor in-seam pockets.
  if (cutsWhole(s)) return cutWhole(drafted(m, s), m, s);
  // Pleats, godets and flounces are drafted on the plain block, without a drawn hem. In-seam pockets
  // go in a plain side seam, so not where pleats, godets or a flounce change the skirt's pieces.
  const plain = volumeOf(s) !== 'none' ? { ...s, hem: undefined } : s;
  const draft = withHighHip(addVolume(m, s, drafted(m, plain), (st) => drafted(m, st)), s.fitting?.highHip);
  return s.pockets === 'inseam' && !draft.volume ? withPockets(draft) : draft;
}

/**
 * A wrap skirt from the plain one: each front traced again across the body, the back on the fold with
 * no zip, and on its own a waistband that goes round once and across the front again, a tie at each end.
 */
function wrapped(draft: SkirtDraft, s: SkirtStyle): SkirtDraft {
  const [front, back, ...rest] = draft.pieces;
  const whole = wrapSkirtFront(front);
  const frontWaist = taggedLength(whole.outline, 'waist');
  const band = s.joinTo ? undefined : draft.finishedWaist + frontWaist;
  const r = (v: number) => Math.round(v * 10) / 10;
  return {
    ...draft,
    pieces: [whole, foldBack(back), ...rest],
    halves: [front, foldBack(back)],
    zipCm: 0,
    waistband: band ? { cutLength: r(band + 2 * s.seamAllowance), cutWidth: draft.waistband.cutWidth, sideMark: r(s.seamAllowance + frontWaist) } : draft.waistband,
    wrap: { frontWaist: r(frontWaist), ...(band ? { ties: wrapTies(draft.finishedWaist, s.seamAllowance) } : {}) },
  };
}

/**
 * In-seam pockets: a bag drafted on the front's side seam, cut four times, and the opening notched on
 * the front and the back alike. The side seams match, so the bag fits the back's seam too.
 */
function withPockets(draft: SkirtDraft): SkirtDraft {
  const [front, back, ...rest] = draft.pieces;
  const pocket = inseamPocket(front, { hemRoom: front.allowances.hem + 3 });
  if (!pocket) return draft;
  const mark = (pc: Piece) => markSeam(pc, 'side', pocket.opening, 'POCKET');
  return { ...draft, pieces: [mark(front), mark(back), ...rest, pocket.bag], pocket: pocket.opening };
}

/**
 * One hip higher than the other: on that side the waist is raised at the side seam, tapering to
 * nothing at the centre front and back, so the skirt hangs level. A second line, cut by trimming.
 */
function withHighHip(draft: SkirtDraft, high: SkirtFitting['highHip']): SkirtDraft {
  if (!high || !(high.cm > 0)) return draft;
  const label = `${high.side.toUpperCase()} HIP`;
  // Only the pieces with a waist: a flounce or a godet hangs from the skirt, not the hip.
  return { ...draft, pieces: draft.pieces.map((pc) => (pc.outline.tags.includes('waist') ? withAlternate(pc, raisedWaist(pc, high.cm), label) : pc)) };
}

/** The outline with its waist raised `rise` cm at the side seam, easing in from nothing at the centre. */
export function raisedWaist(pc: Piece, rise: number): Path {
  const { pts, tags } = pc.outline.taggedPoints();
  const side = tags.indexOf('side');
  // Up, or for a circle skirt out from the waist circle's centre.
  const r = pc.meta.waistRadius as number | undefined;
  const up = (q: P) => (r ? unit(sub(q, p(0, -r))) : p(0, -1));
  const along = [0];
  for (let i = 1; i <= side; i++) along.push(along[i - 1] + len(sub(pts[i], pts[i - 1])));
  const raised = pts.map((q, i) => (i <= side ? add(q, mul(up(q), rise * (along[i] / along[side]) ** 2)) : q));
  const out = new Path(raised[0]);
  for (let i = 1; i < raised.length; i++) out.line(raised[i], tags[i - 1]);
  out.closed = true;
  return out;
}

function drafted(m: SkirtMeasurements, s: SkirtStyle): SkirtDraft {
  const draft = draftShape(m, s);
  // A high-low or diagonal hem takes the place of a drawn one. Pieces cut whole are hemmed once whole.
  if (s.asymHem && s.asymHem !== 'none') return cutsWhole(s) ? draft : quarterAsym(draft, m, s);
  // A drawn hem never takes the skirt above 5 cm below the hip or below the floor, and turns up
  // narrowly so the curve lies flat.
  if (!s.hem || !isShaped(s.hem)) return draft;
  const L = draft.lengthCm;
  const hem = matchSides(s.hem, (v) => Math.min(m.waist_to_floor - 1 - L, Math.max(m.waist_to_hip + 5 - L, v)));
  const [front, back] = draft.pieces;
  // Circle skirt hems are arcs round the waist circle's centre, so they move out along its radius.
  const origin = (pc: Piece) => (draft.circleShare ? p(0, -(pc.meta.waistRadius as number)) : undefined);
  shapeHem(front, hem.front, origin(front));
  shapeHem(back, hem.back, origin(back));
  // A bias hem keeps its spare for levelling: it is trimmed to a narrow roll once the skirt has hung.
  for (const pc of [front, back]) pc.allowances.hem = Math.min(pc.allowances.hem, s.silhouette === 'slip' ? SLIP_HEM : 1.5);
  return { ...draft, hem, hemCm: hemCm(front, back) };
}

/** How full a gathered skirt is, by fit: its waist as cut, over the waist it gathers into. */
export const GATHER_RATIO: Record<Fit, number> = { fitted: 1.6, regular: 2, relaxed: 2.5 };
/** A gathered skirt always clears the hips by this much, however small the waist. */
const GATHER_HIP_ROOM = 20;

/**
 * A gathered (dirndl) skirt: straight panels, a quarter of the round each, gathered into the waist. The
 * front is cut on the fold and the back in two with the zip, or on the fold too on elastic. The round
 * is the waist times the fit's fullness, never less than the hip plus 20 cm, and never so wide a
 * quarter won't lie on folded 140 cm fabric.
 */
function gatheredSkirt(
  m: SkirtMeasurements,
  s: SkirtStyle,
  o: { length: number; into: number; zipCm: number; quarter: { front: number; back: number }; elastic?: Elastic },
): SkirtDraft {
  const sa = s.seamAllowance;
  const most = 4 * (FOLD_WIDTH_MAX - 2 * sa);
  const round = Math.round(clamp(Math.max(o.into * GATHER_RATIO[s.fit], m.full_hip + GATHER_HIP_ROOM), 0, most) * 2) / 2;
  const q = round / 4;
  const L = o.length;
  const hipDepth = m.waist_to_hip;
  const hemSa = s.hemAllowance;
  const piece = (isFront: boolean): Piece => {
    const name = isFront ? 'Skirt front' : 'Skirt back';
    const onFold = isFront || !!o.elastic;
    const outline = new Path(p(0, 0)).line(p(q, 0), 'waist').line(p(q, L), 'side').line(p(0, L), 'hem').line(p(0, 0), onFold ? 'fold' : 'centre');
    outline.closed = true;
    const cut = onFold ? 'Cut 1 on fold' : 'Cut 2 (1 pair)';
    // Halfway along the waist, to share the gathers out evenly; single at the front hip, double at the back.
    const notches: [P, P][] = [
      [p(q / 2, 0), p(0, -1)],
      ...(isFront ? [[p(q, hipDepth), p(1, 0)] as [P, P]] : [[p(q, hipDepth - 0.5), p(1, 0)] as [P, P], [p(q, hipDepth + 0.5), p(1, 0)] as [P, P]]),
    ];
    const zipped = !isFront && o.zipCm > 0;
    if (zipped) notches.push([p(0, o.zipCm), p(-1, 0)]);
    const gx = Math.min(q * 0.45, 12);
    return {
      name,
      outline,
      lines: [],
      grain: [p(gx, hipDepth + 4), p(gx, L - 8)],
      fold: onFold ? [p(0, 2), p(0, L - 2)] : undefined,
      notches,
      balance: [{ pts: [p(0, hipDepth), p(q, hipDepth)], label: 'HIP LINE' }],
      labels: [
        { at: p(q * 0.5, hipDepth - 4), text: name.toUpperCase(), size: 1.6 },
        { at: p(q * 0.5, hipDepth + 1), text: cut, size: 1.0 },
        { at: p(q * 0.5, 3), text: 'GATHER', size: 0.8 },
        ...(zipped ? [{ at: p(3.2, o.zipCm + 0.3), text: 'ZIP ENDS', size: 0.7 }] : []),
      ],
      cut,
      draft: {
        frame: [],
        points: [
          { n: '0', at: p(0, 0), note: `Centre ${isFront ? 'front' : 'back'} waist. The skirt is a plain rectangle, gathered at the waist.` },
          { n: '1', at: p(q, 0), note: `0 to 1, a quarter of the skirt's round: ${cm(round)} / 4 = ${cm(q)}. It gathers into ${cm(isFront ? o.quarter.front : o.quarter.back)} of waist, ${Math.round((round / o.into) * 10) / 10} times as much.` },
          { n: '2', at: p(0, L), note: `0 to 2, skirt length: ${cm(L)}. Square across for the hem; the side seam runs straight down from 1.` },
        ],
      },
      seamAllowance: sa,
      allowances: { hem: hemSa, fold: 0 },
      // How much longer the waist is than the seam it gathers into, as for a peplum.
      meta: { dartsCm: [], sideSuppressionCm: 0, gathered: q / (isFront ? o.quarter.front : o.quarter.back) },
    };
  };
  const front = piece(true);
  const back = piece(false);
  return {
    pieces: [front, back],
    lengthCm: Math.round(L * 10) / 10,
    finishedWaist: o.into,
    finishedHip: round,
    hemCm: Math.round(round),
    zipCm: o.zipCm,
    waistband: waistband(o.into, o.quarter.back, sa),
    dartsPerSide: { front: 0, back: 0 },
    gathers: { round, into: Math.round(o.into * 10) / 10 },
    ...(o.elastic ? { elastic: o.elastic } : {}),
  };
}

function draftShape(m: SkirtMeasurements, s: SkirtStyle): SkirtDraft {
  const fit = s.fitting ?? {};
  // Cut on the bias, the cloth gives round the body, so a slip takes less hip ease.
  const slip = s.silhouette === 'slip';
  const ease = { waist: FIT_EASE[s.fit].waist + (fit.waistEase ?? 0), hip: FIT_EASE[s.fit].hip + (fit.hipEase ?? 0) - (slip ? SLIP_HIP_EASE_LESS : 0) };
  const hipDepth = m.waist_to_hip;
  // A pull-on elastic waist has no zip, so the waist is cut to the hip (at least 6 cm over it) with no
  // darts, and the elastic gathers it in. A pencil skirt's shape is all in its darts, so it keeps its zip.
  const elastic = s.waist === 'elastic' && !s.joinTo;
  if (elastic && s.silhouette === 'pencil') throw new DraftError('A pencil skirt is shaped by its darts, so it needs a waistband and zip. Choose a straighter or fuller shape for an elastic waist.');
  const pullOn = Math.max(m.full_hip + ease.hip, m.full_hip + PULL_ON_EASE);
  const shape = s.shape;
  const length =
    s.lengthCm !== undefined
      ? lengthRange(m).clamp(s.lengthCm)
      : shape
        ? clamp(shape.hemAt * m.waist_to_floor, hipDepth + 8, m.waist_to_floor - 2)
        : LENGTHS[s.length](m);
  if (!(length > hipDepth + 5)) throw new DraftError('The skirt length must reach well below the hip line.');

  const finishedHip = elastic ? pullOn : m.full_hip + ease.hip;
  const hipQ = finishedHip / 4;
  // Joined to a bodice, the waist is the bodice's; otherwise 0.5 cm moves from the back to the front.
  const join = s.joinTo;
  const waistQ = join ? (join.front + join.back) / 2 : elastic ? pullOn / 4 : (m.waist + ease.waist) / 4;
  const split = elastic ? { front: 0, back: 0 } : { front: join ? join.front - waistQ : 0.5, back: join ? join.back - waistQ : -0.5 };

  const finishedWaist = join ? 4 * waistQ : elastic ? pullOn : m.waist + ease.waist;
  const zipCm = elastic ? 0 : (join?.zipCm ?? zipLength(hipDepth));
  const band = elastic ? { elastic: elasticFor(m.waist, finishedWaist) } : {};
  const targetHem = shape ? shape.hemFullness * finishedHip : undefined;

  if (s.silhouette === 'gathered') {
    // Into a band or a bodice seam the waist is its own; on elastic it is gathered into a casing cut to
    // pass the hips, and the elastic gathers that in again.
    const into = join ? 4 * waistQ : elastic ? pullOn : m.waist + ease.waist;
    return gatheredSkirt(m, s, { length, into, zipCm, quarter: { front: into / 4 + split.front, back: into / 4 + split.back }, elastic: (band as { elastic?: Elastic }).elastic });
  }

  // A circle skirt's waist is part of a circle: all of one for a full circle, half for a half circle.
  // Its hem is the waist plus 2 pi x share x length, so a target hem sets the share directly. The
  // 0.5 cm front and back split is kept, so the waist seam matches a bodice drafted from the same
  // measurements. Where the hip is much bigger than the waist, the circle opens up a little more
  // (never past a full circle) until it fits over the hips.
  const hipRoom = finishedHip + 2;
  const circleSkirt = (share: number, cutWaist = finishedWaist): SkirtDraft => {
    const r = cutWaist / (2 * Math.PI * share);
    if (2 * Math.PI * share * (r + hipDepth) < finishedHip - 0.01) {
      throw new DraftError('Your hip is too much bigger than your waist for a circle skirt to fit over it.');
    }
    // A circle cut bigger than the waist takes the difference in darts, like the darted skirt.
    const intake = (cutWaist - finishedWaist) / 4;
    const darts = (max: number) => (intake < 0.3 ? [] : intake <= max ? [intake] : [intake / 2, intake / 2]);
    const hemSa = Math.min(s.hemAllowance, 1.5); // a narrow hem turns neatly on a curve
    const common = { r, length, sa: s.seamAllowance, hemSa, zipCm, hipDepth };
    const angleF = (cutWaist / 4 + split.front) / r;
    const angleB = (cutWaist / 4 + split.back) / r;
    const fits = (angle: number) => (r + length) * Math.sin(Math.min(angle, Math.PI / 2)) + s.seamAllowance <= FOLD_WIDTH_MAX;
    const onFold = fits(angleF);
    const dartLen = Math.max(4, Math.min(9 + (fit.dartLength ?? 0), hipDepth - 3));
    const front = circlePiece({ ...common, name: 'Skirt front', angle: angleF, isFront: true, onFold, darts: darts(2.5), dartLen });
    const back = circlePiece({ ...common, name: 'Skirt back', angle: angleB, isFront: false, onFold: elastic && onFold && fits(angleB), darts: darts(3.5), dartLen });
    return {
      pieces: [front, back],
      lengthCm: Math.round(length * 10) / 10,
      finishedWaist,
      finishedHip,
      hemCm: hemCm(front, back),
      circleShare: Math.round(share * 1000) / 1000,
      zipCm,
      waistband: waistband(finishedWaist, finishedWaist / 4 + split.back, s.seamAllowance),
      dartsPerSide: { front: (front.meta.dartsCm as number[]).length, back: (back.meta.dartsCm as number[]).length },
      ...band,
    };
  };
  // A circle skirt's waist is part of a circle: all of one for a full circle, half for a half circle.
  // The 0.5 cm front and back split is kept, so the waist seam matches a bodice drafted from the same
  // measurements. Where the hip is much bigger than the waist, the circle opens up a little more
  // (never past a full circle) until it fits over the hips.
  const standardCircle = (share: number) => circleSkirt(Math.min(1, Math.max(share, (hipRoom - finishedWaist) / (2 * Math.PI * hipDepth))));
  // To match a hem from a photo: hem = cut waist + 2 pi x share x length, and the room at the hip line
  // is cut waist + 2 pi x share x hip depth. Take the biggest share that still leaves room over the hips,
  // and cut the waist bigger with darts if the hips need it.
  const matchedCircle = (hem: number) => {
    const share = clamp(Math.min((hem - hipRoom) / (2 * Math.PI * (length - hipDepth)), (hem - finishedWaist) / (2 * Math.PI * length)), 0.02, 1);
    // Past a full circle the hem can't get any wider, so the waist is cut only as big as the hips need.
    const cutWaist = Math.max(finishedWaist, share < 1 ? hem - 2 * Math.PI * share * length : 0, hipRoom - 2 * Math.PI * share * hipDepth);
    // Under 0.3 cm a dart isn't worth sewing; the 2 cm spare at the hip covers the difference.
    return circleSkirt(share, cutWaist - finishedWaist < 1.2 ? finishedWaist : cutWaist);
  };

  // Without a photo, circle skirts are exactly a full or a half circle. Matching a photo, every shape
  // but the trumpet is drafted the same way: as a darted skirt flared to the photo's hem, switching to
  // part of a circle when that's fuller than darts and side seams can manage (below).
  if (isCircle(s.silhouette) && (!targetHem || waistQ > hipQ)) {
    return targetHem ? matchedCircle(targetHem) : standardCircle(s.silhouette === 'circle' ? 1 : 0.5);
  }

  if (waistQ > hipQ) {
    throw new DraftError('Your waist is larger than your hip, so this shape can’t be drafted for you yet. A circle skirt will work.');
  }

  // Trumpet skirts flare from a little above the knee; the hem is never shorter than the flare.
  const flareFrom =
    s.silhouette !== 'trumpet'
      ? undefined
      : shape?.flareAt !== undefined
        ? clamp(shape.flareAt * m.waist_to_floor, hipDepth + TRUMPET_MIN_BELOW_HIP, Math.max(hipDepth + TRUMPET_MIN_BELOW_HIP, length - 10))
        : trumpetFrom(m, length);
  const range = flareRange(m, length, s.silhouette);
  const standardFlare = s.flareCm !== undefined ? clamp(s.flareCm, range.min, range.max) : defaultFlare(s.silhouette, length, hipDepth, flareFrom);
  // Shift 0.5 cm of waist from back to front, take up to 3 cm at each side seam; darts take the rest,
  // at most two per piece. A big hip-to-waist difference puts the extra into the side seams (front
  // and back alike, so they still match) rather than making darts too wide to sew flat.
  // A slip has no darts: its side seams take the most they can, and the rest goes into one dart a
  // piece that is then closed into the hem (closeToHem).
  const FRONT_DART_MAX = slip ? Infinity : 2.5;
  const BACK_DART_MAX = slip ? Infinity : 3.5;
  const sideSupp = slip
    ? slipSideSupp(hipQ - (waistQ + split.front), hipQ - (waistQ + split.back))
    : Math.max(
        Math.min(3, (hipQ - waistQ) * 0.4),
        hipQ - (waistQ + split.front) - 2 * FRONT_DART_MAX,
        hipQ - (waistQ + split.back) - 2 * BACK_DART_MAX,
      );
  // A flared hem is wider round its edge than the skirt a few cm up, so a deep turn-up has too much
  // cloth to lie flat and ripples: an A-line or trumpet hem, or a straight one flared out to a photo,
  // turns up no more than 2 cm. Straight and pencil skirts keep the deep hem that weights them.
  const FLARED_HEM = 2;
  const hemFor = (flare: number) => (slip ? SLIP_HEM : s.silhouette === 'a_line' || s.silhouette === 'trumpet' || flare >= 4 ? Math.min(s.hemAllowance, FLARED_HEM) : s.hemAllowance);
  const drops = centreDrops(m, fit);
  const dartAdj = fit.dartLength ?? 0;
  // A centre moved at the fitting is no longer simply the measurement, so its note says so.
  const measured = { front: m.front_waist_to_hip !== undefined && !fit.frontDrop, back: m.back_waist_to_hip !== undefined && !fit.backDrop };
  const block = (flare: number): SkirtDraft => {
    const common = { hipQ, hipDepth, length, sideSupp, flare, flareFrom, sa: s.seamAllowance, hemSa: hemFor(flare), zipCm };
    const frontArgs = { ...common, name: 'Skirt front', waistQ: waistQ + split.front, dartMax: FRONT_DART_MAX, dartLen: 9 + dartAdj, isFront: true, dartAt: join?.dartAt?.front };
    const backArgs = { ...common, name: 'Skirt back', waistQ: waistQ + split.back, dartMax: BACK_DART_MAX, dartLen: 14 + dartAdj, isFront: false, dartAt: join?.dartAt?.back, onFold: elastic };
    const at = (d: { front: number; back: number }) => ({ meanDrop: (d.front + d.back) / 2 });
    let front = half({ ...frontArgs, ...at(drops), centreDrop: drops.front, measuredCentre: measured.front });
    let back = half({ ...backArgs, ...at(drops), centreDrop: drops.back, measuredCentre: measured.back });
    // A centre raised or lowered makes the waist curve steeper, and so longer. Take the extra length
    // into the darts, so the waist seam still fits the waistband as a standard draft's does.
    const std = { front: 0, back: 1 };
    if (drops.front !== std.front || drops.back !== std.back) {
      const waistLen = (pc: Piece) => taggedLength(pc.outline, 'waist');
      const extraF = waistLen(front) - waistLen(half({ ...frontArgs, ...at(std), centreDrop: std.front }));
      const extraB = waistLen(back) - waistLen(half({ ...backArgs, ...at(std), centreDrop: std.back }));
      if (extraF > 0.05) front = half({ ...frontArgs, ...at(drops), waistQ: frontArgs.waistQ - extraF, takeUp: extraF, centreDrop: drops.front, measuredCentre: measured.front });
      if (extraB > 0.05) back = half({ ...backArgs, ...at(drops), waistQ: backArgs.waistQ - extraB, takeUp: extraB, centreDrop: drops.back, measuredCentre: measured.back });
    }
    if (slip) {
      front = closeToHem(front, hipDepth);
      back = closeToHem(back, hipDepth);
    }
    return {
      pieces: [front, back],
      lengthCm: Math.round(length * 10) / 10,
      finishedWaist,
      finishedHip,
      hemCm: hemCm(front, back),
      flareCm: Math.round(flare * 10) / 10,
      zipCm,
      waistband: waistband(finishedWaist, waistQ + split.back, s.seamAllowance),
      dartsPerSide: { front: (front.meta.dartsCm as number[]).length, back: (back.meta.dartsCm as number[]).length },
      ...band,
    };
  };
  // A slip takes its flare from the darts it closes, so a photo sets only its length.
  if (!targetHem || slip) return block(standardFlare);

  // Match the hem to the photo: start from the flare that would give it, then correct for the curve
  // of the hem until the drafted hem comes out right.
  let flare = clamp(targetHem / 4 - hipQ, -3, 60);
  let draft = block(flare);
  for (let i = 0; i < 3 && flare > 0; i++) {
    flare = clamp(flare + (targetHem - draft.hemCm) / 4, 0, 60);
    draft = block(flare);
  }
  // A darted skirt can only flare so far before its side seams swing out too steeply. Past that, a
  // pattern cutter switches to part of a circle, which reaches any fullness smoothly.
  if (s.silhouette !== 'trumpet' && draft.hemCm < targetHem * 0.97 && targetHem > finishedHip * 1.15) {
    return matchedCircle(targetHem);
  }
  return draft;
}

/**
 * How far below the waist line the centre front and back waist sit. Standard: level at the front and
 * 1 cm lower at the back. Measured: the side's waist to hip less the centre's, so a tummy (longer at the
 * front) raises the centre front and a sway back (shorter at the back) lowers the centre back. Kept
 * within 4 cm either way; more than that is a toile fitting, not a measurement.
 */
export function centreDrops(m: SkirtMeasurements, fit: SkirtFitting = {}): { front: number; back: number } {
  const drop = (centre: number | undefined, standard: number) => (centre === undefined ? standard : clamp(m.waist_to_hip - centre, -4, 4));
  // A toile correction moves it further, up to 5 cm either way in all.
  return {
    front: clamp(drop(m.front_waist_to_hip, 0) + (fit.frontDrop ?? 0), -5, 5),
    back: clamp(drop(m.back_waist_to_hip, 1) + (fit.backDrop ?? 0), -5, 5),
  };
}

/** How long a skirt can be: from 6 cm below the hip line to 2 cm off the floor. */
export function lengthRange(m: SkirtMeasurements) {
  const min = m.waist_to_hip + 6;
  const max = m.waist_to_floor - 2;
  return { min, max, clamp: (v: number) => clamp(v, min, max) };
}

/** Trumpet skirts stay close to the body down to a little above the knee, never closer than 15 cm to the
 * hem; on a short skirt the flare starts as low as the length allows. */
const trumpetFrom = (m: SkirtMeasurements, length: number) => Math.max(m.waist_to_hip + TRUMPET_MIN_BELOW_HIP, Math.min(m.waist_to_hip + (m.waist_to_knee - m.waist_to_hip) * 0.6, length - 15));
/** On a short skirt the flare starts as low as the length allows, never above 2 cm below the hip. */
const TRUMPET_MIN_BELOW_HIP = 2;

function defaultFlare(sil: Silhouette, length: number, hipDepth: number, flareFrom?: number): number {
  return {
    straight: 0,
    pencil: -2,
    a_line: Math.max(6, (length - hipDepth) * 0.15),
    trumpet: Math.max(8, (length - (flareFrom ?? 0)) * 0.35),
    half_circle: 0,
    circle: 0,
    slip: 0,
    gathered: 0,
  }[sil];
}

/** The flare each block silhouette starts with, so a dragged shape can snap back to it. */
export function presetFlare(m: SkirtMeasurements, length: number, sil: Silhouette): number {
  return defaultFlare(sil, length, m.waist_to_hip, sil === 'trumpet' ? trumpetFrom(m, length) : undefined);
}

/** How far the side seam can be dragged in or out at the hem. Pencil skirts taper in by up to 4 cm;
 * past about 45% of the drop below the hip a skirt is better cut as a circle. */
export function flareRange(m: SkirtMeasurements, length: number, sil: Silhouette) {
  if (sil === 'trumpet') return { min: 4, max: Math.max(5, (length - trumpetFrom(m, length)) * 0.5) };
  // A slip flares from the darts it closes; dragging adds a little more from the hip, never less.
  if (sil === 'slip') return { min: 0, max: Math.max(1, (length - m.waist_to_hip) * 0.2) };
  return { min: -4, max: Math.max(1, (length - m.waist_to_hip) * 0.45) };
}
