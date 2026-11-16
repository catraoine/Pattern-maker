import { describe, expect, it } from 'vitest';
import { COLLECTION, lookPatch } from './collection';
import { withEstimates } from './estimate';
import { printedPattern } from './patternSweep';
import type { MeasurementValues } from './measurements';

// A fit tester with 10 cm between full and high bust printed the Ice Peplum's side front with its side seam bowed out
// below the arm and hooked in at the underarm (Nov 16). The side seam of a princess-seamed side front is one fair line
// from the underarm to the waist, however full the bust.
const body = (fullBust: number, highBust: number) =>
  withEstimates({
    height: 166, waist: 76, full_hip: 108, waist_to_hip: 20.5, front_waist_to_hip: 20.5, back_waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104,
    full_bust: fullBust, underbust: fullBust - 16, high_bust: highBust, neck: 36, shoulder_width: 39, shoulder_length: 12, across_back: 36, across_front: 32,
    nape_to_waist: 41, front_hps_to_waist: 48, bust_depth: 28, apex_separation: 18, armscye: 41, arm_length: 59, upper_arm: 30, wrist: 16,
    front_shoulder_slope: 43, back_shoulder_slope: 45, torso_loop: 156,
  } as unknown as MeasurementValues);

/** The sharpest turn along a piece's side seam, in degrees between neighbouring steps. */
function sharpestSideTurn(pts: { x: number; y: number }[], tags: string[]) {
  const side = pts.filter((_, i) => tags[i] === 'side');
  let worst = 0;
  for (let i = 1; i < side.length - 1; i++) {
    const [a, b, c] = [side[i - 1], side[i], side[i + 1]];
    let d = Math.abs(Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x)) * (180 / Math.PI);
    if (d > 180) d = 360 - d;
    worst = Math.max(worst, d);
  }
  return worst;
}

describe('the Ice Peplum side front for a fuller bust', () => {
  const look = COLLECTION.find((l) => l.name === 'Ice Peplum Top')!;
  for (const [full, high] of [[99, 96], [102, 96], [106, 96], [104, 96]] as const) {
    it(`full bust ${full}, high bust ${high}: a fair side seam`, () => {
      const values = body(full, high);
      const { garment, ...saved } = lookPatch(look, values);
      const side = printedPattern({ garment, saved: saved as never }, values).made.pieces.find((pc) => pc.name === 'Bodice side front')!;
      const { pts, tags } = side.outline.taggedPoints();
      // Live before the fix: 5 degrees at 6 and 10 cm apart; the fair seam turns under 2 between its steps.
      expect(sharpestSideTurn(pts, tags)).toBeLessThan(2.5);
    });
  }
});
