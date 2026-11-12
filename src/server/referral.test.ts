import { describe, expect, it } from 'vitest';
import { REF_PATTERN, refCode, referrers } from './referral';

describe('referral links', () => {
  it('gives each email its own short code, the same every time and whatever the case', () => {
    const a = refCode('ada@example.com');
    expect(a).toMatch(REF_PATTERN);
    expect(refCode(' Ada@Example.com ')).toBe(a);
    expect(refCode('bea@example.com')).not.toBe(a);
  });

  it('counts friends who joined through a link, most first, and not a sign-up with their own code', () => {
    const ada = refCode('ada@example.com');
    const bea = refCode('bea@example.com');
    const news = [
      { email: 'ada@example.com' },
      { email: 'bea@example.com', ref: ada },
      { email: 'cy@example.com', ref: ada },
      { email: 'di@example.com', ref: bea },
      { email: 'ed@example.com', ref: refCode('ed@example.com') },
      { email: 'fi@example.com', ref: 'zzzzzzzz' },
      null,
    ];
    expect(referrers(news)).toEqual([
      { email: 'ada@example.com', code: ada, joined: 2 },
      { email: 'bea@example.com', code: bea, joined: 1 },
    ]);
  });
});
