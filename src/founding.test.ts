import { describe, expect, it } from 'vitest';
import { EARLY_ACCESS_FROM, FOUNDING_LINE, earlyAccessOpen, foundingLines } from './founding';

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
    expect(tester).toContain('$34 a year instead of $49, locked in for as long as you stay');
    expect(tester).toContain('vote on what we make next');
    const member = foundingLines({ n: 60, kind: 'founding' }).join(' ');
    expect(member).toContain('Early access');
    expect(member).toContain('$34 a year instead of $49, locked in for as long as you stay');
    expect(member).toContain('next fit round');
    expect(member).toContain('a say in what we draft next');
  });

  it('keeps the discount in the one line strangers read true to the two prices', () => {
    // The line says 30% off; the prices a member sees must give at least that (Cat, Nov 16: $34 against $49 is 31%).
    const [, founding, usual] = /\$(\d+) a year instead of \$(\d+)/.exec(foundingLines({ n: 60, kind: 'founding' }).join(' '))!;
    const claimed = Number(/(\d+)% off/.exec(FOUNDING_LINE)![1]);
    expect(1 - Number(founding) / Number(usual)).toBeGreaterThanOrEqual(claimed / 100);
  });
});
