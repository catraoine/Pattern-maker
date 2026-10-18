// The skirt all the way round, for the turning shape preview: where its seams and darts sit round the
// body, how long it is from the waist at every point, how full it is at the hem, and whether stripes
// meet at the side seams. Read from the drafted pieces, so it shows the skirt as it will be cut.
// Seams are trued as the skirt is drafted (see matchSides and shapeHem in hem.ts), so this only
// reports what is true of the draft: it never asks the sewist to fix anything.
import { P, len, sub } from './geometry';
import { asymOffset } from './asymHem';
import { offsetAt } from './hem';
import { dartsOf } from './marks';
import { Piece } from './piece';
import { checkPattern } from './qc';
import type { SkirtDraft } from './skirt';

/** Angles round the body: 0 is the centre front, pi / 2 the wearer's left side, pi the centre back. */
export interface RoundSeam {
  phi: number;
  kind: 'side' | 'centre_back';
  /** The invisible zip's length from the waist, when the zip is in this seam. */
  zipCm?: number;
}

export interface RoundDart {
  phi: number;
  lengthCm: number;
}

export interface RoundSkirt {
  /** Length from the waist to the hem at angle phi, in cm. */
  lengthAt: (phi: number) => number;
  seams: RoundSeam[];
  darts: RoundDart[];
  /** The hem's girth over the hip's: above 1 flares out, below 1 tapers in. */
  flare: number;
  waistCm: number;
  hipCm: number;
  /** Every pair of seams that sew together is the same length, and every dart is trued. */
  seamsMeet: boolean;
  /** Each side seam's angle to the straight grain, in degrees, front and back: stripes cut on the
   * grain meet at the side seam when the two match, and dip toward it as the angle grows. */
  sideAngle: { front: number; back: number };
  /** Lengths to read out: the centre front, the sides and the centre back; left and right separately
   * when the hem differs side to side. */
  readings: { front: number; back: number; left: number; right: number };
}

const ease = (u: number) => u * u * (3 - 2 * u);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const deg = (r: number) => (r * 180) / Math.PI;

/** A piece's side seam: the run of 'side' edges, from the waist down. */
function sideSeam(pc: Piece): P[] {
  const { pts, tags } = pc.outline.taggedPoints(24);
  const out: P[] = [];
  tags.forEach((t, i) => {
    if (t === 'side' && pts[i + 1]) out.push(pts[i], pts[i + 1]);
  });
  // Waist end first.
  return out.length && out[0].y > out[out.length - 1].y ? out.reverse() : out;
}

/** The angle between the lower side seam (hip to hem) and the grain, in degrees. */
function sideToGrain(pc: Piece): number {
  const s = sideSeam(pc);
  if (s.length < 2) return 0;
  const lower = s.slice(Math.floor(s.length / 2));
  const d = sub(lower[lower.length - 1], lower[0]);
  const g = pc.grain ? sub(pc.grain[1], pc.grain[0]) : { x: 0, y: 1 };
  const a = Math.abs(deg(Math.atan2(d.x, d.y) - Math.atan2(g.x, g.y)));
  const folded = a % 180;
  return Math.round(Math.min(folded, 180 - folded) * 10) / 10;
}

/** Where a piece's darts sit round the body, from how far they are from the centre to the side seam. */
function dartsRound(pc: Piece, back: boolean): RoundDart[] {
  const s = sideSeam(pc);
  const sideX = Math.abs(s[0]?.x ?? 0) || 1;
  return dartsOf(pc).flatMap(({ near, tip, far }) => {
    const mid = { x: (near.x + far.x) / 2, y: (near.y + far.y) / 2 };
    const u = Math.min(1, Math.abs(mid.x) / sideX);
    const phi = (u * Math.PI) / 2;
    const lengthCm = Math.round(len(sub(tip, mid)) * 10) / 10;
    // A half piece is cut as a pair: its darts sit on both sides of the body.
    const at = back ? Math.PI - phi : phi;
    return pc.meta.whole ? [{ phi: wrap(at), lengthCm }] : [{ phi: at, lengthCm }, { phi: wrap(-at), lengthCm }];
  });
}

export function roundSkirt(draft: SkirtDraft): RoundSkirt {
  const [front, back] = draft.pieces;
  const half = draft.halves ?? [front, back];
  const L = draft.lengthCm;
  const lengthAt = (phi: number) => {
    const a = wrap(phi);
    if (draft.asym) return L + asymOffset(draft.asym, a);
    if (!draft.hem) return L;
    const isFront = Math.abs(a) <= Math.PI / 2;
    // From the centre (0) to the side seam (1), eased the way shapeHem lays the drawn offsets on.
    const u = isFront ? Math.abs(a) / (Math.PI / 2) : (Math.PI - Math.abs(a)) / (Math.PI / 2);
    return L + offsetAt(isFront ? draft.hem.front : draft.hem.back, ease(u));
  };
  const zip = draft.zipCm > 0 ? draft.zipCm : undefined;
  const seams: RoundSeam[] = [
    { phi: Math.PI / 2, kind: 'side', zipCm: draft.opening === 'left_side' ? zip : undefined },
    { phi: -Math.PI / 2, kind: 'side' },
  ];
  // A centre back seam unless the back is cut on the fold or whole.
  if (!back.fold && !back.meta.whole) seams.push({ phi: Math.PI, kind: 'centre_back', zipCm: draft.opening === 'left_side' ? undefined : zip });
  const blocks = draft.block ?? half;
  const darts = [...dartsRound(blocks[0], false), ...dartsRound(blocks[1], true)];
  const round = (v: number) => Math.round(v);
  const checks = checkPattern(draft.pieces, { finishedWaist: draft.finishedWaist });
  return {
    lengthAt,
    seams,
    darts,
    flare: draft.hemCm / draft.finishedHip,
    waistCm: draft.finishedWaist,
    hipCm: draft.finishedHip,
    seamsMeet: checks.filter((c) => c.group !== 'Corners').every((c) => c.ok),
    sideAngle: { front: sideToGrain(half[0]), back: sideToGrain(half[1]) },
    readings: {
      front: round(lengthAt(0)),
      back: round(lengthAt(Math.PI)),
      left: round(lengthAt(Math.PI / 2)),
      right: round(lengthAt(-Math.PI / 2)),
    },
  };
}

/** Stripes meet at the side seams when the front and back cut the same angle to the grain there. */
export const stripesMeet = (r: RoundSkirt) => Math.abs(r.sideAngle.front - r.sideAngle.back) <= 1;
