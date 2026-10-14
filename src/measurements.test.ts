import { describe, expect, it } from 'vitest';
import { EXAMPLE_VALUES, checkMeasurements, isComplete } from './measurements';

describe('measurements per garment', () => {
  // A skirt-only profile saved before bodices existed.
  const skirtOnly = { waist: 70, full_hip: 98, waist_to_hip: 21, waist_to_knee: 57, waist_to_floor: 102 };

  it('keeps old skirt measurements complete and asks for the rest for a bodice', () => {
    expect(isComplete(skirtOnly, 'skirt')).toBe(true);
    expect(checkMeasurements(skirtOnly, 'cm', 'skirt')).toEqual([]);
    expect(isComplete(skirtOnly, 'bodice')).toBe(false);
    expect(checkMeasurements(skirtOnly, 'cm', 'bodice').some((c) => c.id === 'full_bust' && c.level === 'error')).toBe(true);
  });

  it('treats the hip measurements as optional for a bodice', () => {
    const { full_hip, waist_to_hip, ...rest } = EXAMPLE_VALUES;
    expect(isComplete(rest, 'bodice')).toBe(true);
    expect(checkMeasurements(rest, 'cm', 'bodice').filter((c) => c.level === 'error')).toEqual([]);
    expect(full_hip && waist_to_hip).toBeTruthy();
  });

  it('catches a bust depth longer than the front length', () => {
    const v = { ...EXAMPLE_VALUES, bust_depth: 46 - 1, front_hps_to_waist: 44 };
    expect(checkMeasurements(v, 'cm', 'bodice').some((c) => c.id === 'bust_depth' && c.level === 'error')).toBe(true);
  });
});
