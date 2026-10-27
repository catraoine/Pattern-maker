import { describe, expect, it } from 'vitest';
import { ALL_VISITORS_PER_DAY, CountStore, PER_VISITOR_PER_DAY, TESTER_CAPS, TESTER_POOL, isTesterCode, takeAllowance } from './limit';

const memoryStore = (): CountStore & { data: Map<string, number> } => {
  const data = new Map<string, number>();
  return {
    data,
    get: async (k) => data.get(k) ?? 0,
    take: async (k, cap) => {
      // Checked and counted in one go, as the Blobs store's compare-and-swap does.
      const n = data.get(k) ?? 0;
      if (n >= cap) return false;
      data.set(k, n + 1);
      return true;
    },
  };
};

const day = new Date('2026-10-14T10:00:00Z');

describe('takeAllowance', () => {
  it('lets a visitor read photos up to the daily cap, then stops them', async () => {
    const store = memoryStore();
    for (let i = 0; i < PER_VISITOR_PER_DAY; i++) expect(await takeAllowance(store, 'a', day)).toBe('ok');
    expect(await takeAllowance(store, 'a', day)).toBe('limit_reached');
    expect(await takeAllowance(store, 'b', day)).toBe('ok');
  });

  it('starts again the next day', async () => {
    const store = memoryStore();
    for (let i = 0; i < PER_VISITOR_PER_DAY; i++) await takeAllowance(store, 'a', day);
    expect(await takeAllowance(store, 'a', new Date('2026-10-15T10:00:00Z'))).toBe('ok');
  });

  it('stops everyone once the whole site hits its daily cap', async () => {
    const store = memoryStore();
    store.data.set('2026-10-14/all', ALL_VISITORS_PER_DAY);
    expect(await takeAllowance(store, 'new', day)).toBe('busy');
    expect(store.data.get('2026-10-14/visitor/new')).toBeUndefined();
  });

  it("doesn't let a burst of requests arriving together slip past the caps", async () => {
    const store = memoryStore();
    const results = await Promise.all(Array.from({ length: 50 }, () => takeAllowance(store, 'a', day)));
    expect(results.filter((r) => r === 'ok')).toHaveLength(PER_VISITOR_PER_DAY);
    const many = await Promise.all(Array.from({ length: ALL_VISITORS_PER_DAY * 2 }, (_, i) => takeAllowance(store, `v${i}`, day)));
    expect(store.data.get('2026-10-14/all')).toBe(ALL_VISITORS_PER_DAY);
    expect(many.filter((r) => r === 'ok')).toHaveLength(ALL_VISITORS_PER_DAY - PER_VISITOR_PER_DAY);
  });

  it("doesn't let someone at their own cap use up the site's", async () => {
    const store = memoryStore();
    for (let i = 0; i < PER_VISITOR_PER_DAY + 20; i++) await takeAllowance(store, 'a', day);
    expect(store.data.get('2026-10-14/all')).toBe(PER_VISITOR_PER_DAY);
  });

  it("counts fit testers in their own pool, which the site's cap doesn't stop", async () => {
    const store = memoryStore();
    store.data.set('2026-10-14/all', ALL_VISITORS_PER_DAY);
    for (let i = 0; i < TESTER_CAPS.visitor; i++) expect(await takeAllowance(store, 'a', day, TESTER_CAPS, TESTER_POOL)).toBe('ok');
    expect(await takeAllowance(store, 'a', day, TESTER_CAPS, TESTER_POOL)).toBe('limit_reached');
    expect(store.data.get('2026-10-14/all')).toBe(ALL_VISITORS_PER_DAY);
    expect(store.data.get('2026-10-14/testers/all')).toBe(TESTER_CAPS.visitor);
  });
});

describe('isTesterCode', () => {
  it('matches any listed code, ignoring case and spaces', () => {
    expect(isTesterCode(' Atelier 26 ', 'ATELIER26, seam-two')).toBe(true);
    expect(isTesterCode('seam-two', 'ATELIER26,seam-two')).toBe(true);
    expect(isTesterCode('atelier', 'ATELIER26')).toBe(false);
  });

  it('turns nothing on when no codes are set, or for empty or too-short ones', () => {
    expect(isTesterCode('anything', undefined)).toBe(false);
    expect(isTesterCode('', 'ATELIER26')).toBe(false);
    expect(isTesterCode('ab', 'ab,ATELIER26')).toBe(false);
    expect(isTesterCode(null, 'ATELIER26')).toBe(false);
  });
});
