import { describe, expect, it } from 'vitest';
import { squaredShoulder } from './formShoulder';

// The drawn-out form's shoulder end (2026-11-11: it came to a point that showed past a slip's strap as a fin).
describe('the drawn form shoulder, squared off', () => {
  it('leaves the form alone well inside the shoulder end', () => {
    expect(squaredShoulder(12, 10, 19)).toBe(12);
    expect(squaredShoulder(-12, -10, 19)).toBe(-12);
  });
  it('stops the drawn-out shoulder 1.5 cm short of its point, on both sides', () => {
    expect(squaredShoulder(19, 14, 19)).toBeCloseTo(17.5);
    expect(squaredShoulder(-19, -14, 19)).toBeCloseTo(-17.5);
  });
  it('never draws the form narrower than its own width', () => {
    expect(squaredShoulder(18.8, 18.2, 19)).toBeCloseTo(18.2);
  });
  it('rounds the corner without a jump', () => {
    let last = squaredShoulder(16, 14, 19);
    for (let x = 16.05; x <= 19; x += 0.05) {
      const now = squaredShoulder(x, 14, 19);
      expect(now).toBeGreaterThanOrEqual(last - 1e-9);
      expect(now - last).toBeLessThan(0.06);
      last = now;
    }
  });
});
