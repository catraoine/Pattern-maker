// Asymmetric hems: high-low (short at the front, long at the back) and diagonal (short on the left,
// long on the right). Each is drafted as a hem cut by a tilted plane: unrolled round the body, the
// hem rises and falls as one smooth wave, so it runs on unbroken across every seam. Round the body,
// at angle phi from the centre front (positive toward the wearer's left), the hem is
// shift - amp cos(phi) longer than the named length for a high-low, and shift - amp sin(phi) for a
// diagonal. A high-low is the same both sides, so it is cut as half pieces like any other skirt;
// a diagonal differs side to side, so its pieces are cut whole (slip.ts).
import { P, p, taggedLength } from './geometry';
import { HEM_SAMPLES, HemShape, shapeHemBy } from './hem';
import type { Piece } from './piece';
import type { SkirtDraft, SkirtMeasurements, SkirtStyle } from './skirt';

export type AsymHem = 'none' | 'high_low' | 'diagonal';

export interface AsymPlan {
  kind: Exclude<AsymHem, 'none'>;
  /** Half the difference between the shortest and the longest point, in cm. */
  amp: number;
  /** How far the middle of the wave sits below the named length (negative above), in cm. */
  shift: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * How much the hem rises and falls. A high-low rises at the centre front by about a fifth of the skirt
 * below the hip (5 to 15 cm) and falls as much at the centre back; a diagonal swings a little more.
 * The short end never comes within 8 cm of the hip line, and the long end stops 1.5 cm off the floor,
 * taking the difference from the long side.
 */
export function asymPlan(kind: Exclude<AsymHem, 'none'>, m: SkirtMeasurements, length: number): AsymPlan {
  const below = length - m.waist_to_hip;
  const want = kind === 'high_low' ? clamp(0.22 * below, 5, 15) : clamp(0.28 * below, 6, 18);
  const rise = Math.max(0, Math.min(want, below - 8));
  const fall = Math.max(0, Math.min(want, m.waist_to_floor - 1.5 - length));
  return { kind, amp: (rise + fall) / 2, shift: (fall - rise) / 2 };
}

/** The hem's offset at angle phi round the body: 0 is the centre front, pi / 2 the wearer's left side. */
export function asymOffset(a: AsymPlan, phi: number): number {
  return a.shift - a.amp * (a.kind === 'high_low' ? Math.cos(phi) : Math.sin(phi));
}

/** The plan for a style, or none when the hem is level. */
export function planFor(s: Pick<SkirtStyle, 'asymHem'>, m: SkirtMeasurements, length: number): AsymPlan | undefined {
  return s.asymHem && s.asymHem !== 'none' ? asymPlan(s.asymHem, m, length) : undefined;
}

/**
 * A high-low hem on half pieces (front on the fold, back a pair): shaped in place, with the hem
 * shape kept for the sketches. A narrow hem turns up neatly on the curve. The skirts cut whole are
 * hemmed in slip.ts instead.
 */
export function quarterAsym(draft: SkirtDraft, m: SkirtMeasurements, s: SkirtStyle): SkirtDraft {
  const plan = planFor(s, m, draft.lengthCm);
  if (!plan) return draft;
  const [front, back] = draft.pieces;
  // Circle skirt hems are arcs round the waist circle's centre, so they move out along its radius.
  const origin = (pc: Piece) => (draft.circleShare ? p(0, -(pc.meta.waistRadius as number)) : undefined);
  shapeAsymHems(front, back, plan, origin);
  for (const pc of [front, back]) pc.allowances.hem = Math.min(pc.allowances.hem, 1.5);
  const hemCm = Math.round(2 * (taggedLength(front.outline, 'hem') + taggedLength(back.outline, 'hem')));
  return { ...draft, hem: planShape(plan), asym: plan, hemCm };
}

/**
 * Shape the hems of a front and a back, each a whole piece (cut single layer, its hem running from
 * the side seam on +x round to the one on -x) or a half (its hem from the side seam to the centre).
 * Seen right side up, a front's +x side is the wearer's left and a back's +x side the wearer's right.
 * Each point of the hem is placed round the body by how far along the hems it is, and moved by the
 * wave there; the ends move along the side seams, so front and back still sew together.
 */
export function shapeAsymHems(front: Piece, back: Piece, plan: AsymPlan, origin: (pc: Piece) => P | undefined = () => undefined): void {
  const whole = (pc: Piece) => !!pc.meta.whole;
  const lf = taggedLength(front.outline, 'hem') / (whole(front) ? 2 : 1);
  const lb = taggedLength(back.outline, 'hem') / (whole(back) ? 2 : 1);
  const round = 2 * (lf + lb);
  const at = (sigma: number) => asymOffset(plan, (2 * Math.PI * sigma) / round);
  // Arc lengths round the body from the centre front, toward the wearer's left.
  shapeHemBy(front, whole(front) ? (t) => at(lf - 2 * lf * t) : (t) => at(lf * (1 - t)), { alongSeams: true, origin: origin(front) });
  shapeHemBy(back, whole(back) ? (t) => at(-lf - 2 * lb * t) : (t) => at(lf + lb * t), { alongSeams: true, origin: origin(back) });
}

/** The hem as a hem shape, for the sketch and the figure: the wearer's left half, front and back. */
export function planShape(plan: AsymPlan): HemShape {
  const u = (i: number) => i / (HEM_SAMPLES - 1);
  return {
    front: Array.from({ length: HEM_SAMPLES }, (_, i) => asymOffset(plan, (u(i) * Math.PI) / 2)),
    back: Array.from({ length: HEM_SAMPLES }, (_, i) => asymOffset(plan, Math.PI - (u(i) * Math.PI) / 2)),
  };
}
