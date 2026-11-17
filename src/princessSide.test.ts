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

// Testers measure their own bust depth and front length, and the app's estimates of them never showed this: with a bust
// point high for a long front, the same side seam ran in under the arm and then out (Nov 16), even at 2 cm between full
// and high bust. Measured the way testers measure, from a high bust point to a low one and short to long fronts, the
// seam from the underarm to the waist bends one way only.
const measured = (high: number, diff: number, waist: number, hip: number, bustDepth: number, front: number, back: number) =>
  withEstimates({
    height: 166, full_bust: high + diff, high_bust: high, underbust: high - 6, waist, full_hip: hip, waist_to_hip: 20.5, front_waist_to_hip: 20.5, back_waist_to_hip: 20.5,
    waist_to_knee: 58, waist_to_floor: 104, neck: 36, shoulder_width: 39, shoulder_length: 12, across_back: 36, across_front: 32, nape_to_waist: back,
    front_hps_to_waist: front, bust_depth: bustDepth, apex_separation: 17 + diff * 0.15, armscye: 41, arm_length: 59, upper_arm: 30, wrist: 16,
    front_shoulder_slope: 43, back_shoulder_slope: 45, torso_loop: 156,
  } as unknown as MeasurementValues);

/** How a side seam turns above the waist, read every 0.5 cm, in degrees: the most it turns one way and then the other
 *  (an S turns well both ways, a fair seam only one), and its sharpest single turn (a kink). */
function sideS(pts: { x: number; y: number }[], tags: string[]) {
  const s = tags.indexOf('side');
  let e = s;
  while (e + 1 < pts.length && tags[e + 1] === 'side') e++;
  const all = pts.slice(s, e + 2);
  const hemY = Math.max(...all.map((q) => q.y));
  // The top runs on 6 cm below the waist, where the seam turns out for the hip: that turn is shaping, not a wave.
  const run = all.filter((q) => q.y < hemY - 6.5);
  const even: { x: number; y: number }[] = [run[0]];
  let carry = 0;
  for (let i = 1; i < run.length; i++) {
    const [a, b] = [run[i - 1], run[i]];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    let t = 0.5 - carry;
    for (; t <= l; t += 0.5) even.push({ x: a.x + ((b.x - a.x) * t) / l, y: a.y + ((b.y - a.y) * t) / l });
    carry = l - (t - 0.5);
  }
  let pos = 0;
  let neg = 0;
  let cur = 0;
  let sign = 0;
  let sharp = 0;
  for (let i = 2; i < even.length; i++) {
    const [a, b, c] = [even[i - 2], even[i - 1], even[i]];
    let d = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    const deg = (d * 180) / Math.PI;
    sharp = Math.max(sharp, Math.abs(deg));
    if (Math.abs(deg) < 0.05) continue;
    if (Math.sign(deg) !== sign) [cur, sign] = [0, Math.sign(deg)];
    cur += deg;
    if (sign > 0) pos = Math.max(pos, cur);
    else neg = Math.min(neg, cur);
  }
  return { both: Math.min(pos, -neg), sharp };
}

describe('the Ice Peplum side front on measured bust depths and front lengths', () => {
  const look = COLLECTION.find((l) => l.name === 'Ice Peplum Top')!;
  const cases = [
    [84, 2, 70, 92, 22, 47, 38],
    [84, 4, 70, 92, 34, 47, 38],
    [90, 6, 74, 100, 26, 49, 44],
    [96, 10, 86, 112, 34, 47, 38],
    [104, 14, 96, 124, 22, 42, 41],
    [106, 10, 98, 112, 30, 53, 44],
  ] as const;
  for (const [high, diff, waist, hip, bustDepth, front, back] of cases) {
    it(`high bust ${high} (+${diff}), bust depth ${bustDepth}, front ${front}, back ${back}: no S under the arm`, () => {
      const values = measured(high, diff, waist, hip, bustDepth, front, back);
      const { garment, ...saved } = lookPatch(look, values);
      const side = printedPattern({ garment, saved: saved as never }, values).made.pieces.find((pc) => pc.name === 'Bodice side front')!;
      const { pts, tags } = side.outline.taggedPoints();
      // Live before the fix: 20 to 36 degrees each way on these bodies.
      const { both, sharp } = sideS(pts, tags);
      expect(both).toBeLessThan(5);
      expect(sharp).toBeLessThan(4);
    });
  }
});
