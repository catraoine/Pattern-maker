import { describe, expect, it } from 'vitest';
import { FREE_SAVED_LIMIT, NEW_ACCOUNT, profileName, removePattern, renamePattern, savePattern } from './account';

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
});
