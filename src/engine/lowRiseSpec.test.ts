import { describe, expect, it } from 'vitest';
import { draftSkirt, type SkirtMeasurements } from './skirt';
import { DEFAULT_TROUSERS, draftTrousers, type TrousersMeasurements } from './trousers';
import { isWaistRow, skirtSpec, trousersSpec } from './spec';
import { finishedLines } from '../ui/FinishedTable';

// A low rise sits about 5 cm below the waist: its table reads the body there, or a tester sees "+11.6 Roomy" on a band
// with 2 cm ease, or a crotch 5 cm short that isn't (CLO tester sizes, Nov 13).
const body = { waist: 64, full_hip: 86, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };

describe('a low rise reads its table where it sits', () => {
  it('skirt: the waist row is the body 5 cm down, with the band ease', () => {
    const m = body as SkirtMeasurements;
    const spec = skirtSpec(m, draftSkirt(m, { rise: 'low', pleats: 'box' }));
    const w = spec.find((r) => isWaistRow(r.label))!;
    expect(w.label).toBe('Waist, 5.1 cm below yours');
    expect(w.body).toBeGreaterThan(70);
    expect(w.ease).toBeLessThan(4);
    expect(finishedLines(spec).find((l) => isWaistRow(l.label))?.fit).toBe('Close');
  });

  it('trousers: waist and crotch length read from where they sit', () => {
    const m = { ...body, waist: 122, full_hip: 138, crotch_depth: 31.4, crotch_length: 90.5 } as TrousersMeasurements;
    const spec = trousersSpec(m, draftTrousers(m, { ...DEFAULT_TROUSERS, rise: 'low' }));
    const w = spec.find((r) => isWaistRow(r.label))!;
    expect(w.label).toMatch(/cm below yours$/);
    expect(w.ease).toBeLessThan(6);
    const c = spec.find((r) => r.label === 'Crotch length, from where they sit')!;
    expect(c.body).toBeCloseTo(90.5 - 2 * 5.125, 0);
    expect(c.ease).toBeGreaterThan(0);
  });

  it('a natural rise keeps the plain waist row', () => {
    const m = body as SkirtMeasurements;
    expect(skirtSpec(m, draftSkirt(m, {}))[0].label).toBe('Waist');
  });
});
