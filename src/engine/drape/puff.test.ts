import { describe, expect, it } from 'vitest';
import { sewDesign } from '../../drapeSweep';
import { DEFAULT_BODICE } from '../../garments';

// A puff sleeve's crown is gathered to stand out. In a soft cloth the sleeve tube was drawn in close round the arm, as a
// plain silk sleeve falls, and a short puff in silk or viscose tore at the sleeve and failed the drawing check, so All
// round couldn't show it (2026-11-07). It stands round in every cloth.
describe('a puff sleeve in a soft cloth', () => {
  it.each(['silk', 'viscose'] as const)('a short puff in %s draws clean', (fibre) => {
    const r = sewDesign({ garment: 'bodice', saved: { bodice: { ...DEFAULT_BODICE, neckline: 'crew', sleeve: 'short', sleeveShape: 'puff' } as never }, fibre });
    expect(r.error).toBeUndefined();
    expect(r.quality?.problems ?? []).toEqual([]);
  }, 120_000);
});
