import { describe, expect, it } from 'vitest';
import { fullHemLevel } from './hemWidth';

// A piece's width across at a level, as garment.ts reads it from the outline.
const spanOf = (pts: { x: number; y: number }[]) => (y: number) => {
  let lo = Infinity;
  let hi = -Infinity;
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    if ((a.y - y) * (b.y - y) > 0 || a.y === b.y) return;
    const x = a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y);
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  });
  return hi > lo ? hi - lo : 0;
};

describe('the level a piece is read at below its hem', () => {
  it('is just above a level hem', () => {
    const pts = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 22, y: 60 }, { x: 0, y: 60 }];
    expect(fullHemLevel(pts, spanOf(pts))).toBeCloseTo(59.5, 1);
  });
  it('is above the drop of a hem that falls toward one corner, where the piece is still its full width', () => {
    // (A coat's side front: its hem 2.6 cm lower at one seam than the other.)
    const pts = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 22, y: 60 }, { x: 0, y: 62.6 }];
    const y = fullHemLevel(pts, spanOf(pts));
    expect(y).toBeLessThanOrEqual(60.1);
    expect(spanOf(pts)(y)).toBeGreaterThan(21);
  });
});
