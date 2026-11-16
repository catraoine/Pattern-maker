import { describe, expect, it } from 'vitest';
import { oldCountKeys } from './oldCounts';

describe('clearing old daily counters', () => {
  const now = new Date('2026-11-16T15:00:00Z');

  it('clears counters from before today and keeps the ones from today', () => {
    const keys = ['2026-10-22/all', '2026-11-14/visitor/abc', '2026-11-15/visitor/abc', '2026-11-16/all', '2026-11-16/testers/visitor/abc'];
    expect(oldCountKeys(keys, now)).toEqual(['2026-10-22/all', '2026-11-14/visitor/abc', '2026-11-15/visitor/abc']);
  });

  it('never touches a key that is not a daily counter', () => {
    expect(oldCountKeys(['members', 'news/0123456789abcdef', 'wish/puff-sleeve', '2026-1-1/all'], now)).toEqual([]);
  });
});
