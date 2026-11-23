import { describe, expect, it } from 'vitest';
import { aLineShare } from './aLineSide';
import { draftDress } from './dress';
import { taggedLength } from './geometry';
import { randomBody, rng } from './randomBodies';

// The Blush Shift on a body whose hip is much bigger than its bust (CLO, Nov 22): the side seam swelled out from the
// waist to the hip and the dress stood out there like a bell. From 30 cm of hip over bust the seam is one straight
// line from the underarm to the hip, and the hem keeps the shift's own flare below it.
const shift = (m: Parameters<typeof draftDress>[0]) =>
  draftDress(m, { fit: 'regular', neckline: 'crew', sleeve: 'none', darts: 'bust', bustDart: 'french', bustEase: 5, shiftBack: 'shaped' }, { silhouette: 'straight', length: 'mini', noSeam: 'shift', flareCm: 4 });
/** A random body with its hip set `over` cm bigger than its bust. */
const body = (seed: number, over: number) => {
  const m = randomBody(rng(seed));
  return { ...m, full_hip: m.full_bust + over, high_hip: undefined };
};
/** How far the back's side seam strays from a straight line between the underarm and the hip, in cm. */
function bow(d: ReturnType<typeof shift>, waistToHip: number) {
  const back = d.pieces.find((pc) => pc.name === 'Dress back')!;
  const { pts, tags } = back.outline.taggedPoints(16);
  const hipY = d.bodice.back.waistCentre.y + waistToHip;
  const side = pts.filter((q, i) => (tags[i] === 'side' || tags[i - 1] === 'side') && q.y <= hipY + 0.5);
  const [a, b] = [side[0], side[side.length - 1]];
  const l = Math.hypot(b.x - a.x, b.y - a.y);
  return Math.max(...side.map((q) => Math.abs((b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x)) / l));
}

describe("a shift's side seam on a much fuller hip", () => {
  it('is one straight line from the underarm to the hip once the hip is 30 cm or more over the bust', () => {
    for (let s = 1; s <= 12; s++) {
      for (const over of [30.5, 34, 40]) {
        const m = body(s, over);
        const d = shift(m);
        // (To within 3 mm over its 40 cm or more.)
        expect(bow(d, m.waist_to_hip)).toBeLessThan(0.3);
        const [front, back] = ['Dress front', 'Dress back'].map((n) => d.pieces.find((pc) => pc.name === n)!);
        // Front and back still sew together down the side.
        expect(Math.abs(taggedLength(front.outline, 'side') - taggedLength(back.outline, 'side'))).toBeLessThan(0.1);
      }
    }
  });

  it('never cuts the hem narrower than the shift as it was: its own 4 cm of flare at each side seam', () => {
    for (let s = 1; s <= 12; s++) {
      for (const over of [10, 20, 26, 34]) {
        const d = shift(body(s, over));
        expect(d.skirt.hemCm).toBeGreaterThanOrEqual(d.finishedHip + 16 - 0.11);
      }
    }
  });

  it('leaves the shift as it was up to 18 cm of hip over bust: the waist stays the width of the bust', () => {
    for (let s = 1; s <= 12; s++) {
      for (const over of [-4, 8, 17.9]) {
        const d = shift(body(s, over));
        expect(d.finishedWaist).toBeLessThanOrEqual(d.finishedBust);
      }
    }
  });

  it('changes over little by little, so bodies a centimetre apart are not cut two different dresses', () => {
    expect(aLineShare(4.5)).toBe(0);
    expect(aLineShare(7.5)).toBe(1);
    for (let s = 1; s <= 6; s++) {
      for (let over = 17; over < 32; over += 0.5) {
        const [a, b] = [shift(body(s, over)), shift(body(s, over + 0.5))];
        expect(Math.abs(a.finishedWaist - b.finishedWaist)).toBeLessThan(1.5);
        expect(Math.abs(a.skirt.hemCm - b.skirt.hemCm)).toBeLessThan(1.5);
      }
    }
  });
});
