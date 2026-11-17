import { describe, expect, it } from 'vitest';
import { COLLECTION, lookPatch } from './collection';
import { withEstimates } from './estimate';
import { walkDesign } from './patternSweep';
import type { MeasurementValues } from './measurements';

// Hand-measured bodies from the tester sweep (Nov 16) whose crotch depth and crotch length disagree past what the
// Chocolate Barrel Trouser's block can cut. The crotch seam is drafted as near as it can be and flagged, so the person
// is asked to re-measure; nothing else on the pattern may go wrong. Before the fix the small hip's front cutting line
// crossed itself at the foot of the crotch.
const measured = (height: number, hip: number, waist: number, toHip: number, toKnee: number, toFloor: number, depth: number, length: number) =>
  withEstimates({ height, full_bust: hip, high_bust: hip - 4, waist, full_hip: hip, waist_to_hip: toHip, front_waist_to_hip: toHip, back_waist_to_hip: toHip, waist_to_knee: toKnee, waist_to_floor: toFloor, crotch_depth: depth, crotch_length: length } as unknown as MeasurementValues);

describe('Chocolate Barrel Trouser on crotch depths and lengths that disagree', () => {
  const look = COLLECTION.find((l) => l.name === 'Chocolate Barrel Trouser')!;
  const cases = [
    { what: 'a crotch length short for its depth on a small hip', v: measured(178, 85, 81, 17, 63, 111, 29, 62), drafted: 'longer' },
    { what: 'a crotch length long for its depth on a full hip', v: measured(157, 154, 115, 17, 56, 98, 29, 105), drafted: 'shorter' },
  ];
  for (const c of cases)
    it(`${c.what}: the crotch seam is flagged and every other check passes`, () => {
      const { garment, ...saved } = lookPatch(look, c.v);
      const r = walkDesign({ key: look.name, garment, saved: saved as never }, c.v);
      expect(r.error).toBeUndefined();
      expect(r.problems).toHaveLength(1);
      const [, made, target] = r.problems[0].match(/^Crotch seam to your crotch length: .* = ([\d.]+) cm, drafted to ([\d.]+) cm/)!.map(Number);
      expect(made > target ? 'longer' : 'shorter').toBe(c.drafted);
    });
});
