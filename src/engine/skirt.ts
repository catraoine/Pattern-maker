// Straight skirt block, drafted flat from waist, hip and waist-to-hip depth (Aldrich-style).
// Ported from the Python prototype in the drafting thread (pattern/skirt.py).
import { P, Path, add, lerp, p, sub, unit } from './geometry';
import { finishDart } from './darts';
import { Piece } from './piece';

export interface SkirtMeasurements {
  waist: number;
  full_hip: number;
  waist_to_hip: number;
  waist_to_knee: number;
  waist_to_floor: number;
}

export type Fit = 'fitted' | 'regular' | 'relaxed';
export type Silhouette = 'straight' | 'pencil' | 'a_line';
export type Length = 'mini' | 'above_knee' | 'knee' | 'midi' | 'maxi';

export interface SkirtStyle {
  fit: Fit;
  silhouette: Silhouette;
  length: Length;
  seamAllowance: number;
  hemAllowance: number;
}

// Ease in cm from styling/styling-options.json (skirt fit options).
export const FIT_EASE: Record<Fit, { waist: number; hip: number }> = {
  fitted: { waist: 1, hip: 4 },
  regular: { waist: 2, hip: 7 },
  relaxed: { waist: 3, hip: 11 },
};

// Hem position from the body landmarks. Mid-calf and ankle are estimated from knee and floor.
export const LENGTHS: Record<Length, (m: SkirtMeasurements) => number> = {
  mini: (m) => m.waist_to_knee - 15,
  above_knee: (m) => m.waist_to_knee - 5,
  knee: (m) => m.waist_to_knee,
  midi: (m) => (m.waist_to_knee + m.waist_to_floor) / 2,
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
  sideSupp: number;
  dartMax: number;
  dartLen: number;
  flare: number;
  isFront: boolean;
  sa: number;
  hemSa: number;
  zipCm: number;
}

/** Draft one quarter of the skirt. Centre at x=0, side seam at x≈hipQ. */
function half(a: HalfArgs): Piece {
  const supp = a.hipQ - a.waistQ;
  const ds = darts(supp - a.sideSupp, a.dartMax);
  const sideSupp = supp - ds.reduce((s, d) => s + d, 0);
  // Keep dart tips at least 3 cm above the hip line, where the body is widest.
  const dartLen = Math.min(a.dartLen, a.hipDepth - 3);
  const sideRise = sideSupp > 1 ? 1.25 : 0.6;

  const cw = p(0, a.centreDrop); // centre waist
  const sw = p(a.hipQ - sideSupp, -sideRise); // side waist
  const sh = p(a.hipQ, a.hipDepth); // side hip
  const hemSide = p(a.hipQ + a.flare, a.length - Math.max(0, a.flare) * 0.08); // lift flared hem so it meets the side seam square
  const ch = p(0, a.length); // centre hem

  const waistY = (x: number) => {
    const t = x / sw.x;
    return cw.y + (sw.y - cw.y) * t * t;
  };

  // Dart centres spread across the waist, back darts biased toward centre.
  const centres =
    ds.length === 0 ? [] : ds.length === 1 ? [sw.x * 0.5] : (a.isFront ? [0.33, 0.62] : [0.3, 0.6]).map((f) => sw.x * f);

  // Darts are pressed toward the centre, trued, and the waist seam is peaked over each one.
  const finished = centres.map((c, i) => {
    const w = ds[i];
    const depth = ds.length === 1 ? dartLen : dartLen - (c > centres[0] ? 1.5 : 0);
    const near = p(c - w / 2, waistY(c - w / 2));
    const away = unit(sub(p(near.x - 0.5, waistY(near.x - 0.5)), near));
    return finishDart(p(c, waistY(c) + depth), near, p(c + w / 2, waistY(c + w / 2)), away);
  });

  const outline = new Path(cw);
  const waistTo = (fromX: number, toX: number) => {
    for (let i = 1; i < 4; i++) {
      const x = fromX + ((toX - fromX) * i) / 4;
      outline.line(p(x, waistY(x)), 'waist');
    }
  };
  let x = 0;
  for (const d of finished) {
    waistTo(x, d.near.x);
    outline.line(d.near, 'waist').line(d.peak, 'dart').line(d.far, 'dart');
    x = d.far.x;
  }
  waistTo(x, sw.x);
  outline.line(sw, 'waist');
  outline.curve(p(sw.x + sideSupp * 0.55, sw.y + a.hipDepth * 0.15), p(a.hipQ, a.hipDepth * 0.55), sh, 'side');
  outline.line(hemSide, 'side');
  outline.curve(lerp(hemSide, ch, 0.35), lerp(hemSide, ch, 0.7), ch, 'hem');
  outline.line(cw, a.isFront ? 'fold' : 'centre');
  outline.closed = true;

  const lines = finished.map((d) => new Path(d.near).line(d.tip).line(d.far));

  const cut = a.isFront ? 'Cut 1 on fold' : 'Cut 2 (1 pair)';
  const gx = a.hipQ * 0.45;
  const notches: [P, P][] = [[sh, p(1, 0)]];
  // The back centre seam holds the zip; its notch marks where the zip ends and the seam starts.
  const zipEnd = p(0, a.centreDrop + a.zipCm);
  if (!a.isFront) notches.push([zipEnd, p(-1, 0)]);

  return {
    name: a.name,
    outline,
    lines,
    grain: [p(gx, a.hipDepth + 4), p(gx, a.length - 8)],
    fold: a.isFront ? [p(0, cw.y + 2), p(0, a.length - 2)] : undefined,
    notches,
    labels: [
      { at: p(a.hipQ * 0.5, a.hipDepth - 4), text: a.name.toUpperCase(), size: 1.6 },
      { at: add(p(a.hipQ * 0.5, a.hipDepth), p(0, 1)), text: cut, size: 1.0 },
      ...(a.isFront ? [] : [{ at: add(zipEnd, p(3.2, 0.3)), text: 'ZIP ENDS', size: 0.7 }]),
    ],
    cut,
    seamAllowance: a.sa,
    allowances: { hem: a.hemSa, fold: 0 },
    meta: {
      dartsCm: ds.map((d) => Math.round(d * 100) / 100),
      sideSuppressionCm: Math.round(sideSupp * 100) / 100,
    },
  };
}

export interface SkirtDraft {
  pieces: Piece[];
  lengthCm: number;
  finishedWaist: number;
  finishedHip: number;
  zipCm: number; // invisible zip in the centre back seam
  waistband: Waistband;
  dartsPerSide: { front: number; back: number };
}

export const WAISTBAND_CM = 3; // finished width

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

export function draftSkirt(m: SkirtMeasurements, style: Partial<SkirtStyle> = {}): SkirtDraft {
  const s = { ...DEFAULT_STYLE, ...style };
  const ease = FIT_EASE[s.fit];
  const hipDepth = m.waist_to_hip;
  const length = LENGTHS[s.length](m);
  if (!(length > hipDepth + 5)) throw new DraftError('The skirt length must reach well below the hip line.');

  const hipQ = (m.full_hip + ease.hip) / 4;
  const waistQ = (m.waist + ease.waist) / 4;
  if (waistQ > hipQ) {
    throw new DraftError('Your waist is larger than your hip, which this skirt block can’t draft yet. An elastic-waist skirt is coming.');
  }

  const flare = { straight: 0, pencil: -2, a_line: Math.max(6, (length - hipDepth) * 0.15) }[s.silhouette];
  // Shift 0.5 cm of waist from back to front, take up to 3 cm at each side seam; darts take the rest,
  // at most two per piece. A big hip-to-waist difference puts the extra into the side seams (front
  // and back alike, so they still match) rather than making darts too wide to sew flat.
  const FRONT_DART_MAX = 2.5;
  const BACK_DART_MAX = 3.5;
  const sideSupp = Math.max(
    Math.min(3, (hipQ - waistQ) * 0.4),
    hipQ - (waistQ + 0.5) - 2 * FRONT_DART_MAX,
    hipQ - (waistQ - 0.5) - 2 * BACK_DART_MAX,
  );
  const zipCm = zipLength(hipDepth);
  const common = { hipQ, hipDepth, length, sideSupp, flare, sa: s.seamAllowance, hemSa: s.hemAllowance, zipCm };
  const front = half({ ...common, name: 'Skirt front', waistQ: waistQ + 0.5, centreDrop: 0, dartMax: FRONT_DART_MAX, dartLen: 9, isFront: true });
  const back = half({ ...common, name: 'Skirt back', waistQ: waistQ - 0.5, centreDrop: 1, dartMax: BACK_DART_MAX, dartLen: 14, isFront: false });

  const finishedWaist = m.waist + ease.waist;

  return {
    pieces: [front, back],
    lengthCm: Math.round(length * 10) / 10,
    finishedWaist,
    finishedHip: m.full_hip + ease.hip,
    zipCm,
    waistband: waistband(finishedWaist, waistQ - 0.5, s.seamAllowance),
    dartsPerSide: { front: (front.meta.dartsCm as number[]).length, back: (back.meta.dartsCm as number[]).length },
  };
}
