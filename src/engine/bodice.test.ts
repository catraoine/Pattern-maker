import { describe, expect, it } from 'vitest';
import { BodiceMeasurements, SIDE_DART_MAX, blockOf, draftBodice } from './bodice';
import { layout, toSvg } from './export';
import { taggedLength } from './geometry';
import { draftSleeve } from './sleeve';
import { withEstimates } from '../estimate';
import type { MeasurementValues } from '../measurements';

// The three sample bodies from the measurements thread (measurements/validate.test.js).
const A = { full_bust: 92, high_bust: 86, waist: 74, neck: 35, shoulder_width: 38, shoulder_length: 12, across_back: 35, across_front: 32, nape_to_waist: 41, front_hps_to_waist: 44, bust_depth: 26, apex_separation: 18, armscye: 40 };
const B = { full_bust: 102, high_bust: 100, waist: 86, neck: 39, shoulder_width: 45, shoulder_length: 15, across_back: 40, across_front: 37, nape_to_waist: 45, front_hps_to_waist: 44, bust_depth: 26, apex_separation: 20, armscye: 47 };
const C = { full_bust: 132, high_bust: 118, waist: 118, neck: 40, shoulder_width: 39, shoulder_length: 12.5, across_back: 38, across_front: 36, nape_to_waist: 40, front_hps_to_waist: 50, bust_depth: 31, apex_separation: 22, armscye: 52 };

describe('bodice block', () => {
  it('gives the expected darts and sizes for the three sample bodies', () => {
    // Started as the Python prototype's numbers (drafting/pattern/bodice.py). Since then the engine
    // draws shoulders at standard slopes, sizes the armhole from the high bust and gives the armhole
    // more room as ease grows, so the bust dart and armhole differ from the prototype's. Body C's bust
    // dart grew when the side seam was given a curve below the underarm to blend with the back's, then
    // shrank when the side seam was kept from swinging out under the arm; what is left past the side
    // dart's cap goes into the waist dart. The finished waist is the waist seam's length with darts
    // closed, a little over the pieces' width (B's moved a little with the side seam moved forward).
    const expected = {
      A: { bustDart: 3, front: 4.4, back: 2.4, armhole: 46.4, bust: 97, waist: 77.3 },
      B: { bustDart: 1, front: 2.7, back: 2.7, armhole: 53.5, bust: 107, waist: 89.6 },
      C: { bustDart: 6, front: 8.59, back: 0.5, armhole: 58.4, bust: 137, waist: 121.2 },
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

describe('bodice styles', () => {
  const hips = { full_hip: 100, waist_to_hip: 21 };
  it('lowers and widens the neckline without changing the shoulder seam match', () => {
    const crew = draftBodice(A);
    for (const neckline of ['scoop', 'v', 'square', 'boat'] as const) {
      const d = draftBodice(A, { neckline });
      expect(d.neck, neckline).toBeGreaterThan(crew.neck);
      expect(d.shoulder.back - d.shoulder.front).toBeCloseTo(1, 1);
      expect(d.shoulder.front).toBeGreaterThanOrEqual(5);
    }
  });

  it('extends to the hip with fish-eye darts and a hem cut to the hip', () => {
    const d = draftBodice({ ...A, ...hips }, { fit: 'regular', length: 'hip' });
    expect(d.finishedHem).toBeCloseTo(107, 0);
    expect(d.backLength).toBeCloseTo(41 + 21, 0);
    expect(d.pieces[0].lines.some((l) => l.segs.length === 4)).toBe(true);
    expect(Math.abs(d.sideSeam.frontLessDart - d.sideSeam.back)).toBeLessThan(0.05);
  });

  it('needs hip measurements for hip lengths', () => {
    expect(() => draftBodice(A, { length: 'high_hip' })).toThrow(/hip/);
  });

  it('drops darts on request', () => {
    expect(draftBodice(A, { fit: 'relaxed', darts: 'bust' }).waistDarts).toEqual({ front: 0, back: 0 });
    expect(draftBodice(A, { fit: 'relaxed', darts: 'none' }).bustDart).toBe(0);
  });
});

// Small, medium and large bodies, bust/high bust/waist/hip, the upper body estimated as a first pattern does.
const SML = { S: [84, 80, 66, 92], M: [96, 90, 78, 104], L: [120, 108, 104, 128] } as const;
const estimated = ([full_bust, high_bust, waist, full_hip]: readonly number[]) => {
  const v = withEstimates({ full_bust, high_bust, waist, full_hip, nape_to_waist: 41.3 } as MeasurementValues);
  return { ...v, shoulder_width: v.across_back! + 3.25 } as unknown as BodiceMeasurements;
};

describe('bodice fit across sizes', () => {
  it('caps the side bust dart and moves the rest into the waist dart', () => {
    // A full cup needs more than one dart can sew smooth: the side dart stops at the cap and the waist
    // dart opens by the rest, so the bust is rounded and the side seam lies flat.
    for (const body of [estimated(SML.L), { ...estimated(SML.L), high_bust: 104 }]) {
      const d = draftBodice(body);
      expect(d.bustDart).toBeLessThanOrEqual(SIDE_DART_MAX + 0.01);
      expect(Math.abs(d.sideSeam.frontLessDart - d.sideSeam.back)).toBeLessThan(0.05);
      // The side dart's legs are trued equal.
      const legs = blockOf(d)[0].lines.find((l) => l.points().length === 3 && Math.abs(l.points()[0].y - l.points()[2].y) > 1)!.points();
      expect(Math.abs(Math.hypot(legs[0].x - legs[1].x, legs[0].y - legs[1].y) - Math.hypot(legs[2].x - legs[1].x, legs[2].y - legs[1].y))).toBeLessThan(0.01);
    }
    const big = draftBodice({ ...estimated(SML.L), high_bust: 104 });
    expect(big.bustToWaist).toBeGreaterThan(0.5);
    // Wider than a waist dart alone is ever drafted (FRONT_DART_MAX, 6.5 cm): the rest is bust shaping.
    expect(big.waistDarts.front).toBeGreaterThan(6.5 + big.bustToWaist! / 2);
    // Small cups keep one side dart as drafted.
    expect(draftBodice(estimated(SML.S)).bustToWaist).toBeUndefined();
  });

  it('keeps the side seam from swinging out under the arm', () => {
    for (const [name, m] of Object.entries(SML)) {
      const front = draftBodice(estimated(m)).pieces[0];
      const at = (n: string) => front.draft!.points.find((q) => q.n === n)!.at;
      expect(at('6').x - at('5').x, name).toBeLessThanOrEqual(3.01);
    }
  });

  it.each(['fitted', 'regular'] as const)('makes the back armhole a little longer than the front (%s)', (fit) => {
    for (const [name, m] of Object.entries(SML)) {
      const d = draftBodice(estimated(m), { fit });
      const [f, b] = blockOf(d);
      const diff = taggedLength(b.outline, 'armhole') - taggedLength(f.outline, 'armhole');
      expect(diff, name).toBeGreaterThanOrEqual(0.3);
      expect(diff, name).toBeLessThanOrEqual(1.5);
      expect(Math.abs(d.sideSeam.frontLessDart - d.sideSeam.back), name).toBeLessThan(0.05);
      const sl = draftSleeve(d, { arm_length: 58, upper_arm: m[0] / 3.4 }, { fit, shape: 'fitted', length: 'long', seamAllowance: 1.5, armholeAllowance: 1, hemAllowance: 2.5 });
      const ease = sl.crownEase.front + sl.crownEase.back;
      expect(ease, name).toBeGreaterThanOrEqual(1.5);
      expect(ease, name).toBeLessThanOrEqual(4);
    }
  });
});
