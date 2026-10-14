import { describe, expect, it } from 'vitest';
import { BODICE } from './LoadingScreen';

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
