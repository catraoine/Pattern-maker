// Grading: one draft made into a run of sizes, the way a production pattern room does it. Each body
// measurement moves by a stated amount per size (the grade rules), every size is drafted from its own
// measurements, and the sizes are stacked into a graded nest, each piece lined up on its starting point
// (the centre waist or centre neck), so the spread between sizes can be checked at a glance.
import type { MeasurementId, MeasurementValues } from '../measurements';
import type { Piece } from './piece';
import { P, add, sub } from './geometry';

/** How much each measurement moves per size, in cm, with a 4 cm step at the bust, waist and hip. */
export const GRADE_RULES: { id: MeasurementId; perSize: number }[] = [
  { id: 'full_bust', perSize: 4 },
  { id: 'high_bust', perSize: 4 },
  { id: 'waist', perSize: 4 },
  { id: 'full_hip', perSize: 4 },
  { id: 'high_hip', perSize: 4 },
  { id: 'neck', perSize: 1 },
  { id: 'shoulder_width', perSize: 1.2 },
  { id: 'shoulder_length', perSize: 0.3 },
  { id: 'across_back', perSize: 1.2 },
  { id: 'across_front', perSize: 1.2 },
  { id: 'apex_separation', perSize: 0.5 },
  { id: 'armscye', perSize: 1.6 },
  { id: 'upper_arm', perSize: 1.6 },
  { id: 'wrist', perSize: 0.5 },
  { id: 'nape_to_waist', perSize: 0.4 },
  { id: 'front_hps_to_waist', perSize: 0.5 },
  { id: 'bust_depth', perSize: 0.4 },
  { id: 'front_shoulder_slope', perSize: 0.5 },
  { id: 'back_shoulder_slope', perSize: 0.5 },
  { id: 'arm_length', perSize: 0.3 },
  { id: 'waist_to_hip', perSize: 0.2 },
  { id: 'front_waist_to_hip', perSize: 0.2 },
  { id: 'back_waist_to_hip', perSize: 0.2 },
  { id: 'waist_to_knee', perSize: 0.4 },
  { id: 'waist_to_floor', perSize: 0.5 },
  { id: 'crotch_depth', perSize: 0.5 },
  { id: 'crotch_length', perSize: 2 },
];

/** The size steps either side of the base: a 4 cm step (UK and EU) or a 5 cm step (larger ranges). */
export type GradeStep = 4 | 5;

export const sizeLabel = (offset: number) => (offset === 0 ? 'Base' : offset > 0 ? `+${offset}` : `${offset}`);

/** The measurements graded `offset` sizes up (or down), with every rule scaled to the step. */
export function gradedValues(base: MeasurementValues, offset: number, step: GradeStep = 4): MeasurementValues {
  const k = (offset * step) / 4;
  const out: MeasurementValues = { ...base };
  for (const r of GRADE_RULES) {
    const v = base[r.id];
    if (typeof v === 'number') out[r.id] = Math.round((v + r.perSize * k) * 10) / 10;
  }
  return out;
}

/** The rules that apply to the measurements in use, scaled to the step, for the table. */
export function rulesFor(values: MeasurementValues, step: GradeStep = 4) {
  return GRADE_RULES.filter((r) => typeof values[r.id] === 'number').map((r) => ({ id: r.id, perSize: Math.round(((r.perSize * step) / 4) * 100) / 100 }));
}

export interface GradedSize {
  offset: number;
  label: string;
  values: MeasurementValues;
  pieces?: Piece[];
  error?: string;
}

/** Draft every size in the run. A size the block can't draft is kept with its reason. */
export function gradeRun(base: MeasurementValues, draft: (m: MeasurementValues) => Piece[], opts: { down?: number; up?: number; step?: GradeStep } = {}): GradedSize[] {
  const { down = 2, up = 2, step = 4 } = opts;
  const out: GradedSize[] = [];
  for (let o = -down; o <= up; o++) {
    const values = gradedValues(base, o, step);
    try {
      out.push({ offset: o, label: sizeLabel(o), values, pieces: draft(values) });
    } catch (e) {
      out.push({ offset: o, label: sizeLabel(o), values, error: e instanceof Error ? e.message : 'This size could not be drafted.' });
    }
  }
  return out;
}

/** One piece in every size, each moved so its starting point sits on the base size's. */
export interface NestPiece {
  name: string;
  sizes: { offset: number; label: string; pts: P[] }[];
}

export function gradedNest(run: GradedSize[]): NestPiece[] {
  const base = run.find((s) => s.offset === 0)?.pieces ?? run.find((s) => s.pieces)?.pieces ?? [];
  return base.map((bp) => {
    const anchor = bp.outline.start;
    return {
      name: bp.name,
      sizes: run.flatMap((s) => {
        const pc = s.pieces?.find((x) => x.name === bp.name);
        if (!pc) return [];
        const d = sub(anchor, pc.outline.start);
        return [{ offset: s.offset, label: s.label, pts: pc.outline.points().map((q) => add(q, d)) }];
      }),
    };
  });
}

/** Every size's pieces in one list, each named and marked with its size, for a marker or a graded DXF. */
export function allSizes(run: GradedSize[]): Piece[] {
  return run.flatMap((s) => (s.pieces ?? []).map((pc) => ({ ...pc, name: `${pc.name} (${s.label})`, meta: { ...pc.meta, size: s.label } })));
}
