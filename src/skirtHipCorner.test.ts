import { describe, expect, it } from 'vitest';
import { COLLECTION, lookPatch } from './collection';
import { withEstimates } from './estimate';
import { printedPattern } from './patternSweep';
import type { MeasurementValues } from './measurements';

// The Black Pleated Skirt's side panels turned a corner of 21 to 23 degrees at the hip line on a third of hand-measured
// bodies (tester sweep, Nov 16): a steep A-line's hip curve arrived straight down and then kinked out to the hem. The
// side seam now arrives at the hip along the line to the hem, up to 20 degrees, so it bends there by a few degrees only.
const measured = (waist: number, hip: number, waistToHip: number, waistToKnee: number) =>
  withEstimates({
    height: 166, full_bust: 96, high_bust: 90, underbust: 80, waist, full_hip: hip, waist_to_hip: waistToHip, front_waist_to_hip: waistToHip,
    back_waist_to_hip: waistToHip, waist_to_knee: waistToKnee, waist_to_floor: 104, neck: 36, shoulder_width: 39, shoulder_length: 12, across_back: 36,
    across_front: 32, nape_to_waist: 41, front_hps_to_waist: 46, bust_depth: 26, apex_separation: 18, armscye: 41, arm_length: 59, upper_arm: 30,
    wrist: 16, front_shoulder_slope: 43, back_shoulder_slope: 45, torso_loop: 156,
  } as unknown as MeasurementValues);

/** The sharpest single turn along a piece's side seam, in degrees. */
function sharpestSideTurn(pts: { x: number; y: number }[], tags: string[]) {
  const run = pts.filter((_, i) => tags[i] === 'side' || tags[i - 1] === 'side');
  let worst = 0;
  for (let i = 1; i + 1 < run.length; i++) {
    let d = Math.abs(Math.atan2(run[i + 1].y - run[i].y, run[i + 1].x - run[i].x) - Math.atan2(run[i].y - run[i - 1].y, run[i].x - run[i - 1].x)) * (180 / Math.PI);
    if (d > 180) d = 360 - d;
    worst = Math.max(worst, d);
  }
  return worst;
}

describe('the Black Pleated Skirt side panels at the hip on measured bodies', () => {
  const look = COLLECTION.find((l) => l.name === 'Black Pleated Skirt')!;
  const cases = [
    [64, 92, 17, 54],
    [70, 104, 20.5, 58],
    [76, 116, 19, 60],
    [86, 112, 23, 62],
    [96, 124, 18, 56],
    [100, 124, 22, 64],
  ] as const;
  for (const [waist, hip, waistToHip, waistToKnee] of cases) {
    it(`waist ${waist}, hip ${hip}, waist to hip ${waistToHip}, waist to knee ${waistToKnee}: no corner at the hip`, () => {
      const values = measured(waist, hip, waistToHip, waistToKnee);
      const { garment, ...saved } = lookPatch(look, values);
      const pieces = printedPattern({ key: look.name, garment, saved: saved as never, finish: look.finish } as never, values).made.pieces;
      for (const name of ['Skirt side front', 'Skirt side back']) {
        const pc = pieces.find((p) => p.name === name)!;
        const { pts, tags } = pc.outline.taggedPoints();
        expect(sharpestSideTurn(pts, tags), name).toBeLessThan(10);
      }
    });
  }
});
