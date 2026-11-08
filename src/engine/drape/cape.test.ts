import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_BODICE } from '../../garments';
import { GARMENT_DRAFTING } from '../../garmentDrafts';
import { EXAMPLE_BODY } from '../../measurements';
import { INITIAL } from '../../savedWork';
import { roundBodice } from '../allRound';
import { setKnob } from './knob';
import { runDrape } from './run';

/** The cape's highest point, as the drawing's levels run (down is more). */
function capeTop(): number {
  const bodice = { ...DEFAULT_BODICE, neckline: 'crew', collar: 'cape' } as never;
  const dr = GARMENT_DRAFTING.bodice.draft(EXAMPLE_BODY, { saved: { ...INITIAL, bodice }, form: 'womenswear', fabric: { fibre: 'cotton' } } as never, undefined);
  const m = EXAMPLE_BODY as never;
  const out = runDrape({ kind: 'bodice', draft: dr.bodice!, m, armhole: roundBodice(dr.bodice!, m).armhole, fibre: 'cotton' });
  let top = Infinity;
  out.panels.forEach((p) => {
    if (!p.collar) return;
    for (let i = 0; i < p.uv.length / 2; i++) top = Math.min(top, out.pos[(p.base + i) * 3 + 1]);
  });
  return top;
}

// A cape's neck edge wasn't sewn to the neckline in the drawing: the cape fell off the body to the floor, in every
// cloth, and the drawing's score passed it (2026-11-07). Sewn on, it hangs from the neck.
describe('a cape collar', () => {
  afterEach(() => setKnob('__noCapeSew', undefined));
  it('hangs from the neck instead of falling off', () => {
    const sewn = capeTop();
    setKnob('__noCapeSew', 1);
    const loose = capeTop();
    // (Levels run downward: the neck is at about -45, and the fallen cape's top was below 0, past the hips.)
    expect(sewn).toBeLessThan(-35);
    expect(loose).toBeGreaterThan(0);
  }, 240_000);
});
