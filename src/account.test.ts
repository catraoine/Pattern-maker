import { describe, expect, it } from 'vitest';
import { FREE_SAVED_LIMIT, NEW_ACCOUNT, makeBackup, profileName, readBackup, removePattern, renamePattern, sameChoices, savePattern } from './account';

const skirt = (length: 'mini' | 'knee' | 'midi' | 'maxi' | 'above_knee') => ({ fit: 'regular' as const, silhouette: 'a_line' as const, length });

describe('account', () => {
  it('saves, renames and removes patterns', () => {
    let a = savePattern(NEW_ACCOUNT, skirt('knee'), 'Knee a-line skirt');
    expect(a.patterns).toHaveLength(1);
    a = renamePattern(a, a.patterns[0].id, 'Wedding skirt');
    expect(a.patterns[0].name).toBe('Wedding skirt');
    expect(removePattern(a, a.patterns[0].id).patterns).toHaveLength(0);
  });

  it('ignores duplicates and stops at the free limit', () => {
    let a = savePattern(NEW_ACCOUNT, skirt('knee'), 'x');
    expect(savePattern(a, skirt('knee'), 'x')).toBe(a);
    for (const l of ['mini', 'midi', 'maxi', 'above_knee'] as const) a = savePattern(a, skirt(l), l);
    expect(a.patterns).toHaveLength(FREE_SAVED_LIMIT);
  });

  it('falls back to "Me" when no name is given', () => {
    expect(profileName({ ...NEW_ACCOUNT, name: '  ' })).toBe('Me');
    expect(profileName({ ...NEW_ACCOUNT, name: 'Cat' })).toBe('Cat');
  });

  it('round-trips a backup and rejects other files', () => {
    const acc = savePattern({ ...NEW_ACCOUNT, name: 'Cat', onboarded: true }, skirt('midi'), 'Midi');
    const text = JSON.stringify(makeBackup({ unit: 'in', values: { waist: 70 } }, acc));
    expect(readBackup(text)?.account.patterns[0].name).toBe('Midi');
    expect(readBackup('{"hello":1}')).toBeNull();
    expect(readBackup('not json')).toBeNull();
  });
});

describe('bodice patterns', () => {
  const bodice = { garment: 'bodice' as const, fit: 'regular' as const, neckline: 'scoop' as const, length: 'waist' as const, darts: 'bust_waist' as const };
  it('saves a bodice alongside skirts and tells them apart', () => {
    let a = savePattern(NEW_ACCOUNT, skirt('knee'), 'Skirt');
    a = savePattern(a, bodice, 'Top');
    expect(a.patterns).toHaveLength(2);
    expect(sameChoices(a.patterns[0].choices, bodice)).toBe(true);
    expect(sameChoices(a.patterns[1].choices, bodice)).toBe(false);
    expect(sameChoices(bodice, { ...bodice, neckline: 'v' })).toBe(false);
  });
});
