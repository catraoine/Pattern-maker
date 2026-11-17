import { describe, expect, it } from 'vitest';
import { skirtForm, torsoForm } from './DrawOnForm';
import { SQUEEZE, squeezeX, unsqueezeX } from './FormSketch';

// The form is drawn narrower than the pattern's flat girths, but a shoulder and a neck are straight widths across
// (Nov 17: a long-sleeve dress read as a coat with padded shoulders and its crew neck as a deep U).
const m = { full_bust: 82, waist: 62, full_hip: 90, waist_to_hip: 21.5, neck: 33 };
const body = torsoForm({ neckPoint: { x: 6.2, y: -2 }, shoulderTip: { x: 17.8, y: 2.7 }, apex: { x: 9, y: 22 }, waistY: 42.4 }, m);

describe('the form drawn at true width at the neck and shoulders', () => {
  it('draws the neck point at its true width, and the shoulder tip at about its own', () => {
    expect(squeezeX(body, 6.2, -2)).toBeCloseTo(6.2);
    expect(squeezeX(body, -17.8, 2.7)).toBeLessThan(-0.95 * 17.8);
    expect(squeezeX(body, 17.8, 2.7)).toBeLessThanOrEqual(17.8);
  });
  it('narrows evenly at the bust and below, and up the neck where the head sits', () => {
    for (const [x, y] of [[20, 27.4], [15, 42], [22, 60], [4, -8]]) expect(squeezeX(body, x, y)).toBeCloseTo(SQUEEZE * x);
  });
  it('moves the arm out with the shoulder, keeping its own width', () => {
    const y = 10;
    expect(squeezeX(body, 27, y) - squeezeX(body, 20, y)).toBeCloseTo(SQUEEZE * 7);
  });
  it('reads a line drawn on the form back to the same cm, both sides', () => {
    for (const y of [-3, 0, 4, 12, 20, 30]) for (const x of [-25, -12, -3, 0, 5, 17.8, 26]) expect(unsqueezeX(body, squeezeX(body, x, y), y)).toBeCloseTo(x);
  });
  it('leaves a form without shoulders (a skirt) narrowed evenly', () => {
    const skirt = skirtForm(m);
    expect(squeezeX(skirt, 20, -5)).toBeCloseTo(SQUEEZE * 20);
    expect(unsqueezeX(skirt, SQUEEZE * 20, -5)).toBeCloseTo(20);
  });
});
