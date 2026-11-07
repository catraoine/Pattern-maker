import { describe, expect, it } from 'vitest';
import { draftSkirt, type SkirtMeasurements } from './skirt';
import { skirtFlat } from './flat';
import { madeUpSkirt, SKIRT_PATCH } from './skirtPockets';
import { taggedLength } from './geometry';

const m: SkirtMeasurements = { waist: 72, full_hip: 98, waist_to_hip: 20, waist_to_knee: 58, waist_to_floor: 104 };

describe('patch and slant pockets on a skirt', () => {
  it('sews a patch pocket on each front below the dart, clear of the side seam and the hem', () => {
    for (const silhouette of ['a_line', 'pencil', 'straight', 'gathered'] as const) {
      const d = draftSkirt(m, { silhouette, pockets: 'patch' });
      expect(d.frontPocket?.kind).toBe('patch');
      if (d.frontPocket?.kind !== 'patch') continue;
      const { x, y, w, h } = d.frontPocket.place;
      expect(y).toBeGreaterThanOrEqual(SKIRT_PATCH.top);
      expect(x).toBeGreaterThan(0);
      expect(y + h).toBeLessThan(d.lengthCm - 4);
      expect(d.pieces.filter((pc) => pc.name === 'Patch pocket')).toHaveLength(1);
      expect(d.pieces[0].lines.length).toBeGreaterThan(0);
      expect(w).toBeGreaterThanOrEqual(SKIRT_PATCH.minWidth);
    }
  });

  it('cuts slant pockets into the front, with a lining and a facing that fill it back in', () => {
    const plain = draftSkirt(m, { silhouette: 'a_line' });
    const d = draftSkirt(m, { silhouette: 'a_line', pockets: 'slant' });
    expect(d.frontPocket?.kind).toBe('slant');
    expect(d.pieces.map((pc) => pc.name)).toEqual(['Skirt front', 'Skirt back', 'Pocket lining', 'Pocket facing']);
    // The front loses the corner at the waist, which the facing carries; made up, the front is whole again.
    expect(taggedLength(d.pieces[0].outline, 'waist')).toBeLessThan(taggedLength(plain.pieces[0].outline, 'waist'));
    expect(taggedLength(madeUpSkirt(d.pieces, d)[0].outline, 'waist')).toBeCloseTo(taggedLength(plain.pieces[0].outline, 'waist'), 6);
    // The back is untouched.
    expect(taggedLength(d.pieces[1].outline, 'side')).toBeCloseTo(taggedLength(plain.pieces[1].outline, 'side'), 6);
  });

  it('keeps no slant pocket beside a side zip or under a high waist, and none of either on a circle skirt', () => {
    expect(draftSkirt(m, { silhouette: 'a_line', pockets: 'slant', waist: 'high' }).frontPocket).toBeUndefined();
    expect(draftSkirt(m, { silhouette: 'circle', pockets: 'patch' }).frontPocket).toBeUndefined();
    expect(draftSkirt(m, { silhouette: 'circle', pockets: 'slant' }).frontPocket).toBeUndefined();
  });

  it('leaves a skirt without these pockets exactly as it was', () => {
    const a = draftSkirt(m, { silhouette: 'a_line' });
    const b = draftSkirt(m, { silhouette: 'a_line', pockets: 'none' });
    expect(JSON.stringify(b.pieces)).toBe(JSON.stringify(a.pieces));
  });

  it('draws the pockets on the front of the flat', () => {
    const lines = (pockets: 'none' | 'patch' | 'slant') => skirtFlat(draftSkirt(m, { silhouette: 'a_line', pockets })).views[0].lines.length;
    expect(lines('patch')).toBeGreaterThan(lines('none'));
    expect(lines('slant')).toBeGreaterThan(lines('none'));
  });
});
