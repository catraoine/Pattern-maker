import { describe, expect, it } from 'vitest';
import { EARLY_ACCESS_FROM, earlyAccessOpen, foundingLines } from './founding';

describe('founding promises', () => {
  it('opens early access at midnight on Feb 9, Vancouver time', () => {
    expect(EARLY_ACCESS_FROM.toISOString()).toBe('2027-02-09T08:00:00.000Z');
    expect(earlyAccessOpen(new Date('2027-02-08T23:59:00-08:00'))).toBe(false);
    expect(earlyAccessOpen(new Date('2027-02-09T00:00:00-08:00'))).toBe(true);
  });

  it('says what each group was promised on Nov 12', () => {
    const tester = foundingLines({ n: 3, kind: 'tester' }).join(' ');
    expect(tester).toContain('Feb 9');
    expect(tester).toContain('free first year of Premium');
    expect(tester).toContain('$35 a year instead of $49, locked in for as long as you stay');
    expect(tester).toContain('vote on what we make next');
    const member = foundingLines({ n: 60, kind: 'founding' }).join(' ');
    expect(member).toContain('Early access');
    expect(member).toContain('$35 a year instead of $49, locked in for as long as you stay');
    expect(member).toContain('next fit round');
    expect(member).toContain('a say in what we draft next');
  });
});
