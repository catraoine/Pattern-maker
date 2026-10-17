import { describe, expect, it } from 'vitest';
import { type Account, NEW_ACCOUNT, savePattern } from './account';
import { canPhotoDraft, countPhotoDraft, hasGarment, hasMakerTools, photoDraftsReset, photoDraftsUsed, plansPreview, plansShown, savedLimit } from './plans';

const free = { ...NEW_ACCOUNT };
const oct = new Date('2026-10-17T12:00:00Z');

describe('plans', () => {
  it('locks nothing while billing is off', () => {
    expect(hasGarment(free, 'coat', false)).toBe(true);
    expect(hasMakerTools(free, false)).toBe(true);
    expect(canPhotoDraft({ ...free, photoDrafts: { month: '2026-10', used: 9 } }, oct, false)).toBe(true);
  });

  it('with billing on, free gets skirt and bodice, packs add one garment, Premium gets them all', () => {
    expect(hasGarment(free, 'skirt', true)).toBe(true);
    expect(hasGarment(free, 'dress', true)).toBe(false);
    expect(hasGarment({ ...free, packs: ['dress'] }, 'dress', true)).toBe(true);
    expect(hasGarment({ ...free, packs: ['dress'] }, 'coat', true)).toBe(false);
    expect(hasGarment({ ...free, plan: 'premium' }, 'coat', true)).toBe(true);
    expect(hasMakerTools({ ...free, plan: 'premium' }, true)).toBe(false);
    expect(hasMakerTools({ ...free, plan: 'maker' }, true)).toBe(true);
  });

  it('counts photo drafts per month and stops free accounts at 3', () => {
    let a = free;
    for (let i = 0; i < 3; i++) {
      expect(canPhotoDraft(a, oct, true)).toBe(true);
      a = countPhotoDraft(a, oct);
    }
    expect(photoDraftsUsed(a, oct)).toBe(3);
    expect(canPhotoDraft(a, oct, true)).toBe(false);
    expect(canPhotoDraft({ ...a, plan: 'premium' }, oct, true)).toBe(true);
    const nov = new Date('2026-11-01T00:00:00Z');
    expect(photoDraftsUsed(a, nov)).toBe(0);
    expect(photoDraftsReset(oct).toISOString().slice(0, 10)).toBe('2026-11-01');
  });

  it('keeps the free saved-pattern limit, with no limit on a paid plan', () => {
    expect(savedLimit(free)).toBe(3);
    expect(savedLimit({ ...free, plan: 'maker' })).toBe(Infinity);
    let a: Account = { ...free, plan: 'premium' };
    for (let i = 0; i < 5; i++) a = savePattern(a, { garment: 'skirt', silhouette: 'aline', length: 'knee', fit: 'regular', lengthCm: 50 + i } as never, `p${i}`);
    expect(a.patterns).toHaveLength(5);
  });

  it('shows the plan screens only with billing on or ?plans=preview', () => {
    expect(plansPreview('?plans=preview')).toBe(true);
    expect(plansPreview('')).toBe(false);
    expect(plansShown(false, false)).toBe(false);
    expect(plansShown(false, true)).toBe(true);
  });
});
