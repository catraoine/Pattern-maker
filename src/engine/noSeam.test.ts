import { describe, expect, it } from 'vitest';
import { draftDress, noSeamAllowed } from './dress';
import { dressGuide } from './instructions';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { dressFlat } from './flat';
import { describePattern } from '../screens/describe';
import { DEFAULT_BODICE } from '../garments';

const kinds = ['sheath', 'shift'] as const;

describe('sheath and shift dresses', () => {
  it('cut front and back each in one from shoulder to hem, on 40 random bodies, every seam matching', () => {
    const failures: string[] = [];
    for (let s = 1; s <= 40; s++) {
      const noSeam = kinds[s % 2];
      const m = randomBody(rng(s));
      const d = draftDress(m, { fit: 'regular' }, { silhouette: 'a_line', length: (['above_knee', 'knee', 'midi'] as const)[s % 3], noSeam });
      expect(d.noSeam).toBe(noSeam);
      const names = d.pieces.filter((pc) => !pc.kind).map((pc) => pc.name);
      expect(names.some((n) => /skirt|bodice/i.test(n)), names.join()).toBe(false);
      expect(names).toEqual(expect.arrayContaining(['Dress front', 'Dress back']));
      // One zip down the centre back, well past the waist so the dress steps in over the hips.
      expect(d.zipCm).toBeGreaterThan(0);
      expect(d.zipBelowWaist).toBeGreaterThanOrEqual(12);
      expect(d.finishedHip).toBeGreaterThan(m.full_hip);
      for (const c of checkPattern(d.pieces.filter((pc) => !pc.kind || pc.kind === 'collar'), { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${s} ${noSeam}: ${c.label} ${c.detail}`);
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('gives a sheath a walking slit at the back, and a shift none', () => {
    const m = randomBody(rng(5));
    const sheath = draftDress(m, { fit: 'regular' }, { silhouette: 'straight', length: 'midi', noSeam: 'sheath' });
    const shift = draftDress(m, { fit: 'regular' }, { silhouette: 'straight', length: 'midi', noSeam: 'shift' });
    const back = (d: typeof sheath) => d.pieces.find((pc) => pc.name === 'Dress back')!;
    expect(back(sheath).meta.slitCm).toBe(18);
    expect(back(shift).meta.slitCm).toBeUndefined();
    // A shift hangs straight from the bust: no waist darts, and wider at the hem than a sheath.
    expect(shift.finishedWaist).toBeGreaterThan(sheath.finishedWaist);
  });

  it('keeps its waist seam with a neckline or seams it can’t be cut in one with', () => {
    expect(noSeamAllowed({ neckline: 'strapless' })).toBe(false);
    expect(noSeamAllowed({ princess: 'shoulder' })).toBe(false);
    const d = draftDress(randomBody(rng(7)), { fit: 'regular', princess: 'shoulder' }, { silhouette: 'a_line', length: 'knee', noSeam: 'sheath' });
    expect(d.noSeam).toBeUndefined();
    expect(d.pieces.some((pc) => /^Skirt/.test(pc.name))).toBe(true);
  });

  it('sews with no waist seam, and is named for its cut', () => {
    for (const noSeam of kinds) {
      const style = { silhouette: 'straight' as const, length: 'knee' as const, noSeam };
      const d = draftDress(randomBody(rng(3)), { fit: 'regular' }, style);
      for (const edges of ['binding', 'facings', 'lined'] as const) {
        const g = dressGuide(d, style, 2.5, 1, { edges });
        const titles = g.steps.map((s) => s.title);
        expect(new Set(titles).size).toBe(titles.length);
        expect(g.steps.filter((s) => /waist seam|skirt|bodice/i.test(s.title + s.text)).map((s) => s.title)).toEqual([]);
        expect(g.steps.filter((s) => /[^\x20-\x7e]/.test(s.title + s.text))).toEqual([]);
        const cb = g.steps.find((s) => s.title === 'Close the centre back');
        if (noSeam === 'sheath') expect(cb?.text).toMatch(/slit/i);
      }
      expect(dressFlat(d).views.length).toBeGreaterThan(0);
      expect(describePattern({ garment: 'dress', fit: 'regular', bodice: DEFAULT_BODICE, skirt: { fit: 'regular', ...style } } as never)).toMatch(new RegExp(`^Knee ${noSeam} dress with `));
    }
  });
});
