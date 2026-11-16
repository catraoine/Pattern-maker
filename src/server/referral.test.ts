import { describe, expect, it } from 'vitest';
import { REF_PATTERN, confirmedAccounts, refCode, referrers } from './referral';

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
      { email: 'ada@example.com', code: ada, joined: 2, confirmed: null },
      { email: 'bea@example.com', code: bea, joined: 1, confirmed: null },
    ]);
  });

  it('counts only friends who confirmed their email towards the free year, made-up ones never do', () => {
    const ada = refCode('ada@example.com');
    const bea = refCode('bea@example.com');
    const news = [
      { email: 'ada@example.com' },
      { email: 'bea@example.com' },
      // Three made-up addresses through Ada's link, none confirmed.
      { email: 'a@x.test', ref: ada },
      { email: 'b@x.test', ref: ada },
      { email: 'c@x.test', ref: ada },
      { email: 'Cy@Example.com', ref: bea },
    ];
    expect(referrers(news, new Set(['cy@example.com']))).toEqual([
      { email: 'bea@example.com', code: bea, joined: 1, confirmed: 1 },
      { email: 'ada@example.com', code: ada, joined: 3, confirmed: 0 },
    ]);
  });

  it('reads confirmed accounts page by page, skips unconfirmed ones, and gives null when accounts can\'t be read', async () => {
    const full = Array.from({ length: 1000 }, (_, n) => ({ email: `p${n}@example.com`, email_confirmed_at: null }));
    const pages = [{ users: [...full.slice(1), { email: 'One@Example.com', email_confirmed_at: '2026-12-01T00:00:00Z' }] }, { users: [{ email: 'two@example.com', email_confirmed_at: '2026-12-02T00:00:00Z' }] }];
    const urls: string[] = [];
    const ok = async (url: string) => (urls.push(url), { ok: true, json: async () => pages[urls.length - 1] });
    expect(await confirmedAccounts('https://db.example', 'key', ok)).toEqual(new Set(['one@example.com', 'two@example.com']));
    expect(urls).toEqual(['https://db.example/auth/v1/admin/users?page=1&per_page=1000', 'https://db.example/auth/v1/admin/users?page=2&per_page=1000']);
    expect(await confirmedAccounts(undefined, 'key', ok)).toBeNull();
    expect(await confirmedAccounts('https://db.example', 'key', async () => ({ ok: false, json: async () => ({}) }))).toBeNull();
  });
});
