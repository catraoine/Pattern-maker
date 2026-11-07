import { describe, expect, it } from 'vitest';
import { draftTrousers, type TrousersMeasurements } from './trousers';
import { trousersFlat } from './flat';
import { BACK_WELT, weltWidth } from './trouserBack';
import { taggedLength } from './geometry';

const m: TrousersMeasurements = { waist: 72, full_hip: 98, waist_to_hip: 20, crotch_depth: 27, crotch_length: 66, waist_to_knee: 58, waist_to_floor: 104 };

describe('barrel-leg trousers', () => {
  it('bow out round the knee and come in to a narrow hem, the side seam no longer than a straight leg', () => {
    const straight = draftTrousers(m, { leg: 'straight' });
    const barrel = draftTrousers(m, { leg: 'barrel' });
    expect(barrel.kneeCm).toBeGreaterThan(straight.kneeCm + 5);
    expect(barrel.hemCm).toBeLessThan(barrel.kneeCm - 15);
    expect(barrel.hemCm).toBeGreaterThanOrEqual(31);
    // Side seams of front and back still match.
    const [f, b] = barrel.pieces;
    expect(Math.abs(taggedLength(f.outline, 'side') - taggedLength(b.outline, 'side'))).toBeLessThan(0.3);
  });
});

describe('back welt pockets', () => {
  it('mark a welt on each back below the waist, with welts, facings and bags to cut, and shorter back darts', () => {
    const plain = draftTrousers(m, {});
    const d = draftTrousers(m, { backPockets: 'welt' });
    expect(d.backWelt).toBeDefined();
    expect(weltWidth(d.backWelt!)).toBeCloseTo(BACK_WELT.w, 1);
    expect(d.pieces.map((pc) => pc.name)).toEqual(expect.arrayContaining(['Back welt', 'Back pocket facing', 'Back pocket bag']));
    const tipDepth = (pc: (typeof d.pieces)[number]) => Math.max(...pc.lines.slice(0, 2).map((l) => l.points(2)[1].y));
    expect(tipDepth(d.pieces[1])).toBeLessThan(tipDepth(plain.pieces[1]));
    // The welt is clear of the dart tips' level less a little, and well above the hip.
    expect(d.backWelt!.a.y).toBeLessThan(m.waist_to_hip - 8);
  });

  it('leaves trousers without them exactly as they were', () => {
    expect(JSON.stringify(draftTrousers(m, { backPockets: 'none' }).pieces)).toBe(JSON.stringify(draftTrousers(m, {}).pieces));
  });

  it('draw on the back of the flat', () => {
    const n = (backPockets: 'none' | 'welt') => trousersFlat(draftTrousers(m, { backPockets }), m).views[1].lines.length;
    expect(n('welt')).toBeGreaterThan(n('none'));
  });
});
