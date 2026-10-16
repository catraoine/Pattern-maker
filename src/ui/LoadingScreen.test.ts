import { describe, expect, it } from 'vitest';
import { BODICE, resample } from './LoadingScreen';
import { formOutline } from './ContourForm';

describe('loading screen bodice', () => {
  it('is one closed stroke inside its box', () => {
    const [first, last] = [BODICE[0], BODICE[BODICE.length - 1]];
    expect(last[0]).toBeCloseTo(first[0]);
    expect(last[1]).toBeCloseTo(first[1]);
    for (const [x, y] of BODICE) {
      expect(x).toBeGreaterThanOrEqual(-1e-9);
      expect(x).toBeLessThanOrEqual(1 + 1e-9);
      expect(y).toBeGreaterThanOrEqual(-1e-9);
      expect(y).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

describe('bodice to form handoff', () => {
  it('reshapes between two closed outlines with the same number of points', () => {
    const form = formOutline(366, 420).pts;
    expect(form[form.length - 1][0]).toBeCloseTo(form[0][0]);
    expect(form[form.length - 1][1]).toBeCloseTo(form[0][1]);
    const [a, b] = [resample(BODICE, 420), resample(form, 420)];
    expect(a).toHaveLength(420);
    expect(b).toHaveLength(420);
    expect(a[0][0]).toBeCloseTo(BODICE[0][0]);
    expect(a[419][1]).toBeCloseTo(BODICE[BODICE.length - 1][1]);
  });
});
