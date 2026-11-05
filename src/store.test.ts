import { describe, expect, it } from 'vitest';
import { fillMissing } from './store';
import { INITIAL } from './savedWork';

describe('fillMissing', () => {
  it('fills a setting added since the work was saved, at any depth', () => {
    const old = { ...INITIAL, bodice: { garment: 'bodice', fit: 'fitted' } };
    const back = fillMissing(INITIAL, JSON.parse(JSON.stringify(old)));
    expect(back.bodice.fit).toBe('fitted');
    expect(back.bodice.neckline).toBe(INITIAL.bodice.neckline);
    expect(back.bodice.sleeve).toBe(INITIAL.bodice.sleeve);
  });

  it('keeps everything that was saved, including settings it does not know', () => {
    const saved = { unit: 'in', values: { waist: 70 }, garment: 'dress', extra: [1, 2] };
    const back = fillMissing(INITIAL, saved) as typeof INITIAL & { extra: number[] };
    expect(back.unit).toBe('in');
    expect(back.values).toEqual({ waist: 70 });
    expect(back.garment).toBe('dress');
    expect(back.extra).toEqual([1, 2]);
    expect(back.choices).toEqual(INITIAL.choices);
  });

  it('takes the defaults when nothing was saved', () => {
    expect(fillMissing(INITIAL, undefined)).toBe(INITIAL);
    expect(fillMissing(INITIAL, null)).toBe(INITIAL);
  });
});
