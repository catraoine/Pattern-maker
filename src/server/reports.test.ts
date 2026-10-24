import { describe, expect, it } from 'vitest';
import {
  Beacon,
  DayStore,
  DayTotals,
  EMPTY_DAY,
  MAX_BEACON_BYTES,
  addBeacon,
  byLanguage,
  checkBeacon,
  checkSignup,
  funnel,
  keyMatches,
  lastDays,
  scrubCrash,
  scrubText,
  updateDay,
} from './reports';

const crash = {
  message: 'TypeError: Cannot read properties of undefined (reading \'waist\')',
  stack: 'TypeError: x\n    at draft (https://maisontrace.app/assets/index-abc.js?v=2:12:345)\n    at go (https://maisontrace.app/assets/index-abc.js:1:2)',
  where: 'render' as const,
  view: 'style',
  version: '0.1.0+abc1234',
  browser: 'Safari 17 iOS',
  at: '2026-10-17T10:00:00.000Z',
};
const at = '2026-10-17T10:00:01.000Z';

/** An in-memory store with the same compare-and-set rule as Netlify Blobs' onlyIfMatch / onlyIfNew. */
const memoryDays = (): DayStore & { data: Map<string, { value: DayTotals; etag: string }>; writes: number } => {
  const data = new Map<string, { value: DayTotals; etag: string }>();
  let n = 0;
  const s = {
    data,
    writes: 0,
    read: async (k: string) => data.get(k) ?? null,
    write: async (k: string, value: DayTotals, etag?: string) => {
      s.writes++;
      if (data.get(k)?.etag !== etag) return false;
      data.set(k, { value, etag: String(++n) });
      return true;
    },
  };
  return s;
};

describe('report beacons', () => {
  it('accepts what the app sends', () => {
    const b: Beacon = { counts: { visit: 1, 'measured:skirt': 1, 'printed:trousers': 1 }, crashes: [crash] };
    expect(checkBeacon(JSON.stringify(b))).toEqual(b);
    expect(checkBeacon(JSON.stringify({ counts: { visit: 1 } }))).toEqual({ counts: { visit: 1 } });
  });

  it('refuses anything else', () => {
    expect(checkBeacon('not json')).toBeNull();
    expect(checkBeacon(JSON.stringify({ counts: { 'clicked:button': 1 } }))).toBeNull();
    expect(checkBeacon(JSON.stringify({ counts: { visit: 500 } }))).toBeNull();
    expect(checkBeacon(JSON.stringify({ counts: { visit: 1 }, user: 'abc' }))).toBeNull();
    expect(checkBeacon(JSON.stringify({ crashes: [{ ...crash, measurements: { waist: 72 } }] }))).toBeNull();
    expect(checkBeacon(JSON.stringify({ crashes: Array(6).fill(crash) }))).toBeNull();
    expect(checkBeacon(JSON.stringify({ crashes: [{ ...crash, message: 'x'.repeat(MAX_BEACON_BYTES) }] }))).toBeNull();
  });
});

describe('scrubbing crash reports', () => {
  it('keeps the shape of the error but not numbers, emails, file data or query strings', () => {
    const s = scrubCrash(
      { ...crash, message: 'Error: waist 72.5 too small for "Cat Smith" at cat@example.com, photo data:image/jpeg;base64,AAAA' },
      at,
    );
    expect(s.message).toBe('Error: waist # too small for "…" at [email], photo [data]');
    expect(s.stack).toContain('/assets/index-abc.js:12:345');
    expect(s.stack).not.toContain('?v=');
    expect(s.stack).not.toContain('maisontrace.app');
    expect(s.receivedAt).toBe(at);
  });

  it('keeps property names, trims long stacks', () => {
    expect(scrubCrash(crash, at).message).toBe("TypeError: Cannot read properties of undefined (reading 'waist')");
    const long = scrubCrash({ ...crash, stack: Array.from({ length: 40 }, (_, i) => `at f${i} (x.js:1:1)`).join('\n') }, at);
    expect(long.stack!.split('\n')).toHaveLength(12);
  });

  it('strips blob links and page addresses', () => {
    expect(scrubText('blob:https://maisontrace.app/1234 failed at https://maisontrace.app/style?name=Cat#x')).toBe('[blob] failed at /style');
  });
});

describe('daily totals', () => {
  it('adds a visit’s counts to the day and stores its crash reports', () => {
    const one = addBeacon(EMPTY_DAY, { counts: { visit: 1, 'styled:skirt': 1 }, crashes: [crash] }, at);
    const two = addBeacon(one.day, { counts: { visit: 1, 'printed:skirt': 1 } }, at);
    expect(two.day).toEqual({ counts: { visit: 2, 'styled:skirt': 1, 'printed:skirt': 1 }, beacons: 2, crashes: 1 });
    expect(one.crashes).toHaveLength(1);
    expect(two.crashes).toEqual([]);
  });

  it('stops storing crash reports, then counting, at the daily caps', () => {
    const caps = { beacons: 3, crashes: 2 };
    let day = EMPTY_DAY;
    const stored: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = addBeacon(day, { counts: { visit: 1 }, crashes: [crash] }, at, caps);
      day = r.day;
      stored.push(r.crashes.length);
    }
    expect(stored).toEqual([1, 1, 0, 0]);
    expect(day).toEqual({ counts: { visit: 3 }, beacons: 3, crashes: 2 });
  });

  it('never loses a count when two requests write at once', async () => {
    const store = memoryDays();
    const add = () => updateDay(store, 'day/2026-10-17', (d) => ({ day: addBeacon(d, { counts: { visit: 1 } }, at).day, extra: true }));
    await Promise.all([add(), add(), add()]);
    expect(store.data.get('day/2026-10-17')!.value.counts.visit).toBe(3);
    expect(store.writes).toBeGreaterThan(3);
  });

  it('doesn’t write when nothing changed', async () => {
    const store = memoryDays();
    store.data.set('d', { value: { counts: {}, beacons: 5, crashes: 0 }, etag: 'e' });
    const r = await updateDay(store, 'd', (d) => ({ ...addBeacon(d, { counts: { visit: 1 } }, at, { beacons: 5, crashes: 0 }), extra: 'skipped' }));
    expect(r).toBe('skipped');
    expect(store.writes).toBe(0);
  });

  it('lists the last days, newest first', () => {
    expect(lastDays(new Date('2026-10-02T12:00:00Z'), 3)).toEqual(['2026-10-02', '2026-10-01', '2026-09-30']);
  });
});

describe('the read-out key', () => {
  it('lets in only the exact key', () => {
    expect(keyMatches('s3cret-key', 's3cret-key')).toBe(true);
    expect(keyMatches('s3cret-kez', 's3cret-key')).toBe(false);
    expect(keyMatches('s3cret', 's3cret-key')).toBe(false);
    expect(keyMatches('s3cret-key-and-more', 's3cret-key')).toBe(false);
    expect(keyMatches(null, 's3cret-key')).toBe(false);
  });

  it('refuses everyone when no key is set', () => {
    expect(keyMatches('', undefined)).toBe(false);
    expect(keyMatches('anything', undefined)).toBe(false);
    expect(keyMatches('', '')).toBe(false);
  });
});

describe('sign-ups', () => {
  const tester = { kind: 'tester', name: ' Ada ', email: 'Ada@Example.com', sews: 'Trousers', consent: true, website: '' };

  it('accepts a fit tester and a news sign-up, tidied', () => {
    expect(checkSignup(JSON.stringify(tester))).toEqual({ kind: 'tester', name: 'Ada', email: 'ada@example.com', sews: 'Trousers', consent: true });
    expect(checkSignup(JSON.stringify({ ...tester, size: 'UK 12-16' }))).toMatchObject({ size: 'UK 12-16' });
    expect(checkSignup(JSON.stringify({ kind: 'news', email: 'a@b.co' }))).toEqual({ kind: 'news', email: 'a@b.co' });
    expect(checkSignup(JSON.stringify({ kind: 'news', email: 'a@b.co', src: 'ig' }))).toEqual({ kind: 'news', email: 'a@b.co', src: 'ig' });
    expect(checkSignup(JSON.stringify({ kind: 'news', email: 'a@b.co', src: 'http://x' }))).toBeNull();
  });

  it('keeps the language a waitlist sign-up sews in, from the list only, and counts them', () => {
    expect(checkSignup(JSON.stringify({ kind: 'news', email: 'a@b.co', lang: 'de' }))).toEqual({ kind: 'news', email: 'a@b.co', lang: 'de' });
    expect(checkSignup(JSON.stringify({ kind: 'news', email: 'a@b.co', lang: 'klingon' }))).toBeNull();
    expect(byLanguage([{ lang: 'de' }, { lang: 'de' }, { lang: 'fr' }, {}, null])).toEqual({ de: 2, fr: 1, en: 2 });
  });

  it('accepts an interest sign-up for a known offer only', () => {
    expect(checkSignup(JSON.stringify({ kind: 'interest', offer: 'founding', email: 'A@b.co', website: '' }))).toEqual({ kind: 'interest', offer: 'founding', email: 'a@b.co' });
    expect(checkSignup(JSON.stringify({ kind: 'interest', offer: 'printed', email: 'a@b.co', pattern: 'A-line skirt' }))).toMatchObject({ pattern: 'A-line skirt' });
    expect(checkSignup(JSON.stringify({ kind: 'interest', offer: 'lottery', email: 'a@b.co' }))).toBeNull();
    expect(checkSignup(JSON.stringify({ kind: 'interest', offer: 'deadstock', email: 'a@b.co', cut: true }))).toMatchObject({ offer: 'deadstock', cut: true });
    expect(checkSignup(JSON.stringify({ kind: 'interest', offer: 'deadstock', email: 'a@b.co', cut: 'yes' }))).toBeNull();
    expect(checkSignup(JSON.stringify({ kind: 'interest', offer: 'kit', email: 'a@b.co', website: 'spam.example' }))).toBeNull();
    expect(checkSignup(JSON.stringify({ kind: 'interest', offer: 'nights', email: 'a@b.co', city: 'berlin' }))).toMatchObject({ offer: 'nights', city: 'berlin' });
    expect(checkSignup(JSON.stringify({ kind: 'interest', offer: 'nights', email: 'a@b.co', city: 'atlantis' }))).toBeNull();
    expect(checkSignup(JSON.stringify({ kind: 'interest', offer: 'engine', email: 'a@b.co' }))).toMatchObject({ offer: 'engine' });
  });

  it('refuses one without consent, a bad email, extra fields, or a filled-in bot box', () => {
    expect(checkSignup(JSON.stringify({ ...tester, consent: false }))).toBeNull();
    expect(checkSignup(JSON.stringify({ ...tester, email: 'not-an-email' }))).toBeNull();
    expect(checkSignup(JSON.stringify({ ...tester, sews: '' }))).toBeNull();
    expect(checkSignup(JSON.stringify({ ...tester, measurements: { waist: 70 } }))).toBeNull();
    expect(checkSignup(JSON.stringify({ ...tester, website: 'spam.example' }))).toBeNull();
    expect(checkSignup(JSON.stringify({ kind: 'news', email: 'a@b.co', name: 'x' }))).toBeNull();
    expect(checkSignup('{')).toBeNull();
  });
});

describe('the weekly funnel', () => {
  it('adds up sign-ups by source, printed, fit reported and paid over the days given', () => {
    const days: { counts: Record<string, number> }[] = [
      { counts: { visit: 40, 'visit:pinterest': 10, 'signup:pinterest': 3, signup: 1, 'printed:skirt': 5, 'fit_reported:skirt': 2 } },
      { counts: { visit: 20, 'signup:class-vancouver': 2, 'printed:dress': 1, paid: 1 } },
    ];
    expect(funnel(days)).toEqual({
      visits: 60,
      signups: 6,
      printed: 6,
      fitReported: 2,
      paid: 1,
      signupsBySource: { pinterest: 3, direct: 1, 'class-vancouver': 2 },
      visitsBySource: { direct: 60, pinterest: 10 },
    });
  });

  it('accepts the four events from the beacon, with a source on a sign-up', () => {
    expect(checkBeacon(JSON.stringify({ counts: { 'signup:pinterest': 1, 'fit_reported:bodice': 1, paid: 1, 'printed:skirt': 1 } }))).not.toBeNull();
    expect(checkBeacon(JSON.stringify({ counts: { 'signup:Pin terest': 1 } }))).toBeNull();
  });
});
