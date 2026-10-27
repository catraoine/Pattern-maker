import { describe, expect, it } from 'vitest';
import { checkFitReport, MAX_REPORT_BYTES } from './fitReport';
import { emptyFit, fitReport } from '../fit';
import { DEFAULT_BODICE } from '../garments';
import { CountStore, takeAllowance } from '../photo/limit';

const good = fitReport({ ...emptyFit(), verdict: 'tweaks', areas: { bust: -1 }, notes: 'Bust too snug' }, DEFAULT_BODICE, { full_bust: 92, waist: 72 });

describe('sent fit reports', () => {
  it('accepts what the app sends', () => {
    expect(checkFitReport(JSON.stringify(good))).toMatchObject({ garment: 'bodice', verdict: 'tweaks', areas: { bust: -1 } });
  });

  it('says which measurements a friend held the tape for, only those in the report', () => {
    const r = fitReport(emptyFit(), DEFAULT_BODICE, { full_bust: 92, waist: 72 }, ['full_bust', 'nape_to_waist']);
    expect(r.helped).toEqual(['full_bust']);
    expect(checkFitReport(JSON.stringify(r))).toMatchObject({ helped: ['full_bust'] });
    expect(good.helped).toBeUndefined();
  });

  it('refuses anything else', () => {
    expect(checkFitReport('not json')).toBeNull();
    expect(checkFitReport(JSON.stringify({ ...good, name: 'Cat' }))).toBeNull();
    expect(checkFitReport(JSON.stringify({ ...good, areas: { bust: 3 } }))).toBeNull();
    expect(checkFitReport(JSON.stringify({ ...good, measurements: { waist: 'big' } }))).toBeNull();
    expect(checkFitReport(JSON.stringify({ ...good, choices: { pad: 'x'.repeat(MAX_REPORT_BYTES) } }))).toBeNull();
  });

  it('caps how many a sender can send a day', async () => {
    const counts = new Map<string, number>();
    const store: CountStore = {
      get: async (k) => counts.get(k) ?? 0,
      take: async (k, cap) => (counts.get(k) ?? 0) < cap && !!counts.set(k, (counts.get(k) ?? 0) + 1),
    };
    const caps = { visitor: 2, all: 10 };
    const day = new Date('2026-10-16T10:00:00Z');
    expect(await takeAllowance(store, 'a', day, caps)).toBe('ok');
    expect(await takeAllowance(store, 'a', day, caps)).toBe('ok');
    expect(await takeAllowance(store, 'a', day, caps)).toBe('limit_reached');
  });
});
