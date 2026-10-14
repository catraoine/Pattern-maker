import { describe, expect, it } from 'vitest';
import { ALL_VISITORS_PER_DAY, CountStore, PER_VISITOR_PER_DAY, takeAllowance } from './limit';

const memoryStore = (): CountStore & { data: Map<string, number> } => {
  const data = new Map<string, number>();
  return { data, get: async (k) => data.get(k) ?? 0, set: async (k, n) => void data.set(k, n) };
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
});
