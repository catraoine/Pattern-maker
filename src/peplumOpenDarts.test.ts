import { describe, expect, it } from 'vitest';
import { COLLECTION, lookPatch } from './collection';
import { withEstimates } from './estimate';
import { printedPattern } from './patternSweep';
import { taggedLength } from './engine/geometry';
import { openDarts } from './engine/peplumDarts';
import type { MeasurementValues } from './measurements';

// A fit tester with a full bust over a much smaller waist sewed the Ice Peplum's side seams hooking in just above the
// peplum seam (round 1 fit report, Nov 23): 2.3 cm in over the last 8 cm on her numbers, because the princess darts
// were closed 3 cm under the waist and the side seams had to take the seam back to its length. The darts are now left
// part open at the seam and the side seams run straight down.
const body = (bust: number, high: number, waist: number, hip: number) =>
  withEstimates({
    height: 163, full_bust: bust, high_bust: high, waist, full_hip: hip, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 101,
    nape_to_waist: 41, front_hps_to_waist: 47 + (bust - high) * 0.4, bust_depth: 26 + (bust - 88) * 0.12, shoulder_width: 39, arm_length: 57, upper_arm: 32, wrist: 16,
  } as unknown as MeasurementValues);

/** How far a side seam comes in over its last 6 cm above the peplum seam: its widest point there less its end. */
function hookIn(pts: { x: number; y: number }[], tags: string[]) {
  const side = pts.filter((_, i) => tags[i] === 'side' || tags[i - 1] === 'side');
  const end = side[side.length - 1];
  return Math.max(...side.filter((q) => q.y > end.y - 6).map((q) => q.x)) - end.x;
}

describe('the Ice Peplum below the waist on a full bust', () => {
  const look = COLLECTION.find((l) => l.name === 'Ice Peplum Top')!;
  // bust, high bust, waist, hip: the tester's shape, and fuller busts over smaller waists from the round 1 applications.
  for (const [bust, high, waist, hip] of [[117, 107, 99, 112], [88, 84, 64, 95], [104, 97, 80, 107], [112, 104, 91, 112], [126, 121, 114, 138], [84, 81, 66, 86]] as const) {
    it(`${bust} / ${waist} / ${hip}: straight side seams, matched seams, and a peplum the length of the bodice's hem`, () => {
      const values = body(bust, high, waist, hip);
      const { garment, ...saved } = lookPatch(look, values);
      const pieces = printedPattern({ garment, saved: saved as never }, values).made.pieces;
      const pc = (n: string) => pieces.find((x) => x.name === n)!;
      for (const n of ['Bodice side front', 'Bodice side back']) {
        const { pts, tags } = pc(n).outline.taggedPoints(10);
        // Live before the fix: 2.3 cm on the tester's shape; straight, the waist's blend leaves a millimetre or two.
        expect(hookIn(pts, tags), n).toBeLessThan(0.5);
      }
      const len = (n: string, tag: string) => taggedLength(pc(n).outline, tag);
      expect(Math.abs(len('Bodice centre front', 'princess') - len('Bodice side front', 'princess'))).toBeLessThan(0.1);
      expect(Math.abs(len('Bodice centre back', 'princess') - len('Bodice side back', 'princess'))).toBeLessThan(0.1);
      expect(Math.abs(len('Bodice side front', 'side') - len('Bodice side back', 'side'))).toBeLessThan(0.1);
      expect(len('Bodice centre front', 'hem') + len('Bodice side front', 'hem')).toBeCloseTo(len('Peplum front', 'waist'), 1);
      expect(len('Bodice centre back', 'hem') + len('Bodice side back', 'hem')).toBeCloseTo(len('Peplum back', 'waist'), 1);
    });
  }
});

describe('the waist darts left open at a peplum seam', () => {
  it('take what the side seams would have taken in, shared by the size of each dart', () => {
    const o = openDarts(-1.5, 4, 2);
    expect(o.back + o.front).toBeCloseTo(3);
    expect(o.back).toBeCloseTo(2);
    expect(o.out).toBeCloseTo(0);
  });
  it('leave the darts closed where the side seams already run out', () => {
    expect(openDarts(0.8, 4, 2)).toEqual({ back: 0, front: 0, out: 0.8 });
  });
  it('never open a dart right up: past that, the side seams take the rest', () => {
    const o = openDarts(-5, 3, 2);
    expect(o.back).toBeLessThan(3);
    expect(o.out).toBeLessThan(0);
    expect(o.back + o.front - 2 * o.out).toBeCloseTo(10);
  });
});
