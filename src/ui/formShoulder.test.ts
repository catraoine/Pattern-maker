import { describe, expect, it } from 'vitest';
import { roundedCorner, roundedShoulder } from './formShoulder';

// The drawn-out form's shoulder end (2026-11-11: it came to a point that showed past a slip's strap as a fin; squared
// off, it stood in the armhole as a block, so later that day its top corner is turned over a curve).
describe('the drawn form shoulder, rounded over', () => {
  it('leaves the form alone well inside the shoulder end', () => {
    expect(roundedShoulder(12, 10, 19, 5)).toBe(12);
    expect(roundedShoulder(-12, -10, 19, 5)).toBe(-12);
  });
  it('stops the drawn-out shoulder half a cm short of its point at the foot of the turn, on both sides', () => {
    expect(roundedShoulder(20, 14, 19, 2.5)).toBeCloseTo(18.5);
    expect(roundedShoulder(-20, -14, 19, 2.5)).toBeCloseTo(-18.5);
  });
  it('falls back in toward the body below the turn, gently, and no further than the form itself', () => {
    const at = [2.5, 5, 7.5, 10, 12.5].map((down) => roundedShoulder(19, 14, 19, down));
    for (let k = 1; k < at.length; k++) expect(at[k]).toBeLessThan(at[k - 1] + 1e-9);
    expect(at[1]).toBeGreaterThan(17.5);
    expect(at[4]).toBeCloseTo(14);
  });
  it('holds it in further toward the top of the shoulder, so the corner turns over a curve', () => {
    const at = [-1, 0, 1, 2.5].map((down) => roundedShoulder(20, 10, 19, down));
    expect(at[0]).toBeCloseTo(15);
    for (let k = 1; k < at.length; k++) expect(at[k]).toBeGreaterThan(at[k - 1]);
    expect(at[3]).toBeCloseTo(18.5);
    // (Steepest at the top, levelling off below: a quarter circle, not a chamfer.)
    expect(at[1] - at[0]).toBeGreaterThan(at[3] - at[2]);
  });
  it('never draws the form narrower than its own width', () => {
    expect(roundedShoulder(18.8, 18.2, 19, -1)).toBeCloseTo(18.2);
  });
  it('comes in to its limit without a jump', () => {
    let last = roundedShoulder(16, 14, 19, 4);
    for (let x = 16.05; x <= 19; x += 0.05) {
      const now = roundedShoulder(x, 14, 19, 4);
      expect(now).toBeGreaterThanOrEqual(last - 1e-9);
      expect(now - last).toBeLessThan(0.06);
      last = now;
    }
  });
  it('turns only the top corner of a form that is not drawn out, under a top cut below the shoulders', () => {
    // (Held to the chest's width, 15 here: the corner where that met the shoulder's slope comes in, the side below
    // the turn and the slope well inside it stay.)
    expect(roundedCorner(15, 15, 0)).toBeLessThan(14.5);
    expect(roundedCorner(15, 15, 1)).toBeGreaterThan(roundedCorner(15, 15, 0));
    expect(roundedCorner(15, 15, 2.5)).toBe(15);
    expect(roundedCorner(15, 15, 10)).toBe(15);
    expect(roundedCorner(9, 15, -1)).toBe(9);
    expect(roundedCorner(-15, 15, 0)).toBeCloseTo(-roundedCorner(15, 15, 0));
  });
});
