import { describe, expect, it } from 'vitest';
import { checkPattern } from './qc';
import { randomBody, rng, sweep } from './randomBodies';
import { draftSkirt, lowRiseCm } from './skirt';
import { sewingGuide } from './instructions';
import { skirtFlat } from './flat';
import { describe as describeSkirt, withWaist } from '../skirtChoices';

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };

describe('the low-rise skirt', () => {
  it('sits 6 cm low, wider at its top, with the hem where it was', () => {
    for (const s of [{ silhouette: 'straight', length: 'midi', pleats: 'knife' }, { silhouette: 'a_line', length: 'knee' }, { silhouette: 'pencil', length: 'knee' }] as const) {
      const natural = draftSkirt(m, s);
      const low = draftSkirt(m, { ...s, rise: 'low' });
      expect(low.lowRise).toBe(lowRiseCm(m));
      expect(low.finishedWaist).toBeGreaterThan(natural.finishedWaist + 4);
      // The hem stays put on the body: the skirt is shorter by the rise.
      expect(natural.lengthCm - low.lengthCm).toBeCloseTo(low.lowRise!, 0);
      expect(checkPattern(low.pieces, { finishedWaist: low.finishedWaist }).filter((c) => !c.ok)).toEqual([]);
    }
    expect(describeSkirt({ fit: 'regular', silhouette: 'straight', length: 'midi', rise: 'low' } as never)).toMatch(/low-rise/);
    // A high waist puts it back at the waist; the engine ignores a low rise with one.
    expect(withWaist({ fit: 'regular', silhouette: 'pencil', length: 'knee', rise: 'low' } as never, 'high').rise).toBeUndefined();
    expect(draftSkirt(m, { silhouette: 'pencil', length: 'knee', waist: 'high', rise: 'low' }).lowRise).toBeUndefined();
    // Never more than a quarter of the way to the hip.
    expect(lowRiseCm({ waist_to_hip: 16 })).toBe(4);
  });

  it('drafts low on 20 bodies, with a flat and the sewing steps', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= sweep(20); seed++) {
      const b = randomBody(rng(seed));
      for (const s of [{ silhouette: 'straight', length: 'midi', pleats: 'knife' }, { silhouette: 'a_line', length: 'mini' }, { silhouette: 'gathered', length: 'midi' }] as const) {
        const d = draftSkirt(b, { ...s, rise: 'low' });
        const bad = checkPattern(d.pieces, { finishedWaist: d.finishedWaist }).filter((c) => !c.ok);
        if (bad.length) failures.push(`${seed} ${s.silhouette}: ${bad.map((c) => c.label).join('; ')}`);
        expect(skirtFlat(d).views.length).toBeGreaterThan(0);
        expect(sewingGuide(d, { ...s, rise: 'low' } as never, 2).steps.length).toBeGreaterThan(3);
      }
    }
    expect(failures.slice(0, 6)).toEqual([]);
  });
});
