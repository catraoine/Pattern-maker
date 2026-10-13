import { describe, expect, it } from 'vitest';
import { draftBodice } from './bodice';
import { layout, toSvg } from './export';

// The three sample bodies from the measurements thread (measurements/validate.test.js).
const A = { full_bust: 92, high_bust: 86, waist: 74, neck: 35, shoulder_width: 38, shoulder_length: 12, across_back: 35, across_front: 32, nape_to_waist: 41, front_hps_to_waist: 44, bust_depth: 26, apex_separation: 18, armscye: 40 };
const B = { full_bust: 102, high_bust: 100, waist: 86, neck: 39, shoulder_width: 45, shoulder_length: 15, across_back: 40, across_front: 37, nape_to_waist: 45, front_hps_to_waist: 44, bust_depth: 26, apex_separation: 20, armscye: 47 };
const C = { full_bust: 132, high_bust: 118, waist: 118, neck: 40, shoulder_width: 39, shoulder_length: 12.5, across_back: 38, across_front: 36, nape_to_waist: 40, front_hps_to_waist: 50, bust_depth: 31, apex_separation: 22, armscye: 52 };

describe('bodice block', () => {
  it('matches the Python prototype for the three sample bodies', () => {
    // Values printed by the Python prototype (drafting/pattern/bodice.py), fitted ease.
    const expected = {
      A: { bustDart: 3, front: 4.4, back: 2.4, armhole: 45.5, bust: 97, waist: 77 },
      B: { bustDart: 1, front: 2.7, back: 2.7, armhole: 52.5, bust: 107, waist: 89 },
      C: { bustDart: 7.81, front: 6.6, back: 0.6, armhole: 57.4, bust: 137, waist: 121 },
    };
    for (const [name, body] of Object.entries({ A, B, C })) {
      const d = draftBodice(body);
      const e = expected[name as keyof typeof expected];
      expect(d.bustDart, name).toBeCloseTo(e.bustDart, 1);
      expect(d.waistDarts.front, name).toBeCloseTo(e.front, 1);
      expect(d.waistDarts.back, name).toBeCloseTo(e.back, 1);
      expect(d.armhole, name).toBeCloseTo(e.armhole, 0);
      expect(d.finishedBust, name).toBe(e.bust);
      expect(d.finishedWaist, name).toBe(e.waist);
    }
  });

  it.each(['fitted', 'regular', 'relaxed'] as const)('seams match and ease is applied (%s)', (fit) => {
    for (const body of [A, B, C]) {
      const d = draftBodice(body, { fit });
      expect(Math.abs(d.sideSeam.frontLessDart - d.sideSeam.back)).toBeLessThan(0.05);
      expect(d.shoulder.back - d.shoulder.front).toBeCloseTo(1, 1);
      expect(Math.abs(d.armhole - (d.armholeTarget ?? 0))).toBeLessThan(1);
    }
  });

  it('warns when the front length is shorter than the back length', () => {
    expect(draftBodice(B).warnings.join(' ')).toMatch(/re-measure/);
    expect(draftBodice(A).warnings).toEqual([]);
  });

  it('exports SVG', () => {
    const sheet = layout(draftBodice(A).pieces, 'Bodice block', []);
    expect(toSvg(sheet)).toContain('BODICE FRONT');
  });
});
