// Seam allowance styles. The draft is the same; only what is added outside the stitching line changes.
//   Home: 1.5 cm seams, 1 cm on necklines and armholes, the classic home-sewing pattern.
//   Industry: 1 cm everywhere, as a factory cuts, so curves need no trimming.
//   Couture: wide allowances on the seams that get fitted (2.5 cm at sides, shoulders and centre back),
//   with the stitching line drawn solid to thread-trace, the way a couture house cuts a toile.
import { Piece } from './piece';

export type AllowanceStyle = 'home' | 'industry' | 'couture';

export interface SeamWidths {
  /** Side, shoulder and centre seams. */
  seam: number;
  /** Waist seams. */
  waist: number;
  /** Necklines and armholes. */
  curve: number;
}

export const SEAM_WIDTHS: Record<AllowanceStyle, SeamWidths> = {
  home: { seam: 1.5, waist: 1.5, curve: 1 },
  industry: { seam: 1, waist: 1, curve: 1 },
  couture: { seam: 2.5, waist: 2, curve: 1.5 },
};

export const ALLOWANCE_LABELS: Record<AllowanceStyle, { label: string; detail: string }> = {
  home: { label: 'Home', detail: '1.5 cm seams, 1 cm on curves' },
  industry: { label: 'Industry', detail: '1 cm everywhere, no trimming' },
  couture: { label: 'Couture', detail: '2.5 cm to fit, thread-trace the line' },
};

/** The piece with its allowances for a style. Hems keep the depth their shape needs, except that a
 * couture straight hem gets 5 cm, for weight and for letting down. */
export function withAllowances(pc: Piece, style: AllowanceStyle): Piece {
  if (style === 'home') return pc;
  const w = SEAM_WIDTHS[style];
  const allowances: Record<string, number> = { ...pc.allowances };
  for (const tag of ['neck', 'armhole']) if (tag in allowances) allowances[tag] = w.curve;
  // The waist edge of a skirt is cut at the waist width, and so is the dart peak above it.
  allowances.waist = w.waist;
  allowances.dart = w.waist;
  // A pleat's underlay at the waist is cut like the waist either side of it.
  if ('pleat' in allowances) allowances.pleat = w.waist;
  // A pocket's top edge is caught in the waist seam with the garment's.
  allowances['pocket-waist'] = w.waist;
  if (style === 'couture' && allowances.hem >= 4) allowances.hem = 5;
  // A facing's free edge is neatened, not seamed, and a fold has no allowance whatever the style.
  for (const tag of ['facing', 'fold']) if (tag in pc.allowances) allowances[tag] = pc.allowances[tag];
  return {
    ...pc,
    seamAllowance: w.seam,
    allowances,
    meta: style === 'couture' ? { ...pc.meta, threadTrace: true } : pc.meta,
  };
}
