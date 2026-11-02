import { describe, expect, it } from 'vitest';
import { draftTrousers, TROUSER_RUFFLE } from './trousers';
import { checkPattern } from './qc';
import { trousersGuide } from './trousersGuide';
import { describeTrousers, DEFAULT_TROUSERS_CHOICES } from '../garments';

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104, crotch_depth: 27, inside_leg: 77 } as never;

// A ruffled trouser hem (In testing, Cat 2026-11-02): the leg cut shorter, a strip gathered onto it.
describe('ruffled trouser hem', () => {
  it('ends where the plain trousers do, the leg shorter by the ruffle, with a strip 1.8 times the hem', () => {
    for (const leg of ['flare', 'straight', 'wide'] as const)
      for (const length of ['cropped', 'ankle', 'full'] as const) {
        const plain = draftTrousers(m, { leg, length });
        const d = draftTrousers(m, { leg, length, hemRuffle: true });
        expect(d.lengthCm).toBeCloseTo(plain.lengthCm, 0);
        expect(d.ruffle?.depth).toBe(TROUSER_RUFFLE.depth);
        const strip = d.pieces.find((pc) => pc.name === 'Hem ruffle')!;
        expect(strip.cut).toBe('Cut 2');
        expect(d.ruffle!.cutLength).toBeGreaterThan(d.hemCm * 1.7);
        expect(checkPattern(d.pieces).filter((c) => !c.ok).map((c) => c.label)).toEqual([]);
      }
  });

  it('is sewn on in place of the hem, and named', () => {
    const d = draftTrousers(m, { leg: 'flare', length: 'cropped', hemRuffle: true });
    const titles = trousersGuide(d, 1.5).steps.map((s) => s.title);
    expect(titles).toContain('Add the hem ruffles');
    expect(titles).not.toContain('Hem');
    expect(describeTrousers({ ...DEFAULT_TROUSERS_CHOICES, leg: 'flare', length: 'cropped', hemRuffle: true })).toMatch(/ruffled at the hem/);
  });
});
