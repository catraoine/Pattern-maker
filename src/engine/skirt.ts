// Straight skirt block, drafted flat from waist, hip and waist-to-hip depth (Aldrich-style).
// Ported from the Python prototype in the drafting thread (pattern/skirt.py).
import { P, Path, add, lerp, p } from './geometry';
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
}

/** Draft one quarter of the skirt. Centre at x=0, side seam at x≈hipQ. */
function half(a: HalfArgs): Piece {
  const supp = a.hipQ - a.waistQ;
  const ds = darts(supp - a.sideSupp, a.dartMax);
  const sideSupp = supp - ds.reduce((s, d) => s + d, 0);
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
    ds.length === 1 ? [sw.x * 0.5] : (a.isFront ? [0.33, 0.62] : [0.3, 0.6]).map((f) => sw.x * f);

  const outline = new Path(cw);
  for (let i = 1; i <= 8; i++) {
    const x = (sw.x * i) / 8;
    outline.line(p(x, waistY(x)), 'waist');
  }
  outline.curve(p(sw.x + sideSupp * 0.55, sw.y + a.hipDepth * 0.15), p(a.hipQ, a.hipDepth * 0.55), sh, 'side');
  outline.line(hemSide, 'side');
  outline.curve(lerp(hemSide, ch, 0.35), lerp(hemSide, ch, 0.7), ch, 'hem');
  outline.line(cw, a.isFront ? 'fold' : 'centre');
  outline.closed = true;

  const lines = centres.map((c, i) => {
    const w = ds[i];
    const l = p(c - w / 2, waistY(c - w / 2));
    const r = p(c + w / 2, waistY(c + w / 2));
    const depth = ds.length === 1 ? a.dartLen : a.dartLen - (c > centres[0] ? 1.5 : 0);
    return new Path(l).line(p(c, waistY(c) + depth)).line(r);
  });

  const cut = a.isFront ? 'Cut 1 on fold' : 'Cut 2 (1 pair)';
  const gx = a.hipQ * 0.45;
  const notches: [P, P][] = [[sh, p(1, 0)]];
  if (!a.isFront) notches.push([p(0, a.hipDepth), p(-1, 0)]);

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
  // Shift 0.5 cm of waist from back to front, take up to 3 cm at each side seam; darts take the rest.
  const sideSupp = Math.min(3, (hipQ - waistQ) * 0.4);
  const common = { hipQ, hipDepth, length, sideSupp, flare, sa: s.seamAllowance, hemSa: s.hemAllowance };
  const front = half({ ...common, name: 'Skirt front', waistQ: waistQ + 0.5, centreDrop: 0, dartMax: 2.5, dartLen: 9, isFront: true });
  const back = half({ ...common, name: 'Skirt back', waistQ: waistQ - 0.5, centreDrop: 1, dartMax: 3.5, dartLen: 14, isFront: false });

  return {
    pieces: [front, back],
    lengthCm: Math.round(length * 10) / 10,
    finishedWaist: m.waist + ease.waist,
    finishedHip: m.full_hip + ease.hip,
  };
}
