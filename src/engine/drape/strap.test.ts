import { describe, expect, it } from 'vitest';
import { bodiceChoices } from '../../collection';
import { validDetails } from '../../garments';
import { EXAMPLE_BODY } from '../../measurements';
import { roundBodice } from '../allRound';
import { draftBodice } from '../bodice';
import { runDrape } from './run';

// A cami's straps are given on the pattern as measurements, not pieces, so the drape sewed a strapless top and All
// round showed the cami with no straps (SS27 renders, 2026-11-04). They are drawn over each shoulder from the strap points.
describe('a cami drawn with its straps', () => {
  it.each(['silk', 'cotton'] as const)('in %s, a rouleau rises from the top edge over the shoulder', (fibre) => {
    const m = EXAMPLE_BODY as never;
    const d = draftBodice(m, validDetails(bodiceChoices({ fit: 'fitted', neckline: 'cami' } as never)));
    const out = runDrape({ kind: 'bodice', draft: d, m, armhole: roundBodice(d, m).armhole, fibre });
    expect(out.quality?.ok).toBe(true);
    const strap = out.panels.find((p) => p.role === 'strap');
    expect(strap).toBeDefined();
    expect(strap!.single).toBeFalsy();
    const n = strap!.uv.length / 2;
    const cs: number[] = [];
    const zs: number[] = [];
    for (let i = 0; i < n; i++) {
      cs.push(out.pos[(strap!.base + i) * 3 + 1]);
      zs.push(out.pos[(strap!.base + i) * 3 + 2]);
    }
    // The cloth's own top: its highest point, front and back.
    let clothTop = Infinity;
    for (const p of out.panels) if (p.role !== 'strap') for (let i = 0; i < p.uv.length / 2; i++) clothTop = Math.min(clothTop, out.pos[(p.base + i) * 3 + 1]);
    // Up well above the cloth to the shoulder, front to back over it.
    expect(Math.min(...cs)).toBeLessThan(clothTop - 8);
    expect(Math.max(...zs)).toBeGreaterThan(3);
    expect(Math.min(...zs)).toBeLessThan(-3);
    // And laid smoothly: no step between one ring of the rouleau and the next.
    for (let k = 6; k < n; k += 6) expect(Math.hypot(out.pos[(strap!.base + k) * 3] - out.pos[(strap!.base + k - 6) * 3], cs[k] - cs[k - 6], zs[k] - zs[k - 6])).toBeLessThan(4);
  }, 120_000);

  it('a strapless top draws none', () => {
    const m = EXAMPLE_BODY as never;
    const d = draftBodice(m, validDetails(bodiceChoices({ fit: 'fitted', neckline: 'strapless' } as never)));
    const out = runDrape({ kind: 'bodice', draft: d, m, armhole: roundBodice(d, m).armhole, fibre: 'silk' });
    expect(out.panels.some((p) => p.role === 'strap')).toBe(false);
  }, 120_000);
});
