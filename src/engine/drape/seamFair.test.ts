import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_BODICE } from '../../garments';
import { GARMENT_DRAFTING } from '../../garmentDrafts';
import { EXAMPLE_BODY } from '../../measurements';
import { INITIAL } from '../../savedWork';
import { roundDress } from '../allRound';
import { setKnob } from './knob';
import { runDrape } from './run';

/** The biggest step out, as drawn on the form, from one side-seam point to the next within 4 cm of the waist seam. */
function worstStep(waistSeam: 'dropped' | 'low'): { step: number; ok?: boolean } {
  const dress = { garment: 'dress', fit: 'regular', bodice: { ...DEFAULT_BODICE, sleeve: 'none', length: 'waist' }, skirt: { ...INITIAL.choices }, waistSeam } as never;
  const dr = GARMENT_DRAFTING.dress.draft(EXAMPLE_BODY, { saved: { ...INITIAL, dress }, form: 'womenswear', fabric: { fibre: 'cotton' } } as never, undefined);
  const m = EXAMPLE_BODY as never;
  const out = runDrape({ kind: 'dress', draft: dr.dress!, m, armhole: roundDress(dr.dress!, m).armhole, fibre: 'cotton' });
  const seamC = dr.dress!.seamDrop;
  const side = [...new Set(out.lines.filter((l) => l.kind === 'side').flatMap((l) => l.ids))]
    .map((i) => ({ c: out.pos[i * 3 + 1], r: out.pos[i * 3] / (out.hang?.[i] || 1) }))
    .filter((p) => p.r > 0 && Math.abs(p.c - seamC) < 4)
    .sort((a, b) => a.c - b.c);
  let step = 0;
  for (let k = 1; k < side.length; k++) if (side[k].c - side[k - 1].c > 0.3) step = Math.max(step, (side[k].r - side[k - 1].r) / (side[k].c - side[k - 1].c));
  return { step, ok: out.quality?.ok };
}

// A dropped or low waist seam: the pattern's side seams run on smoothly through it, but the drawing left the skirt's top
// standing out past the bodice, a ledge round the hip (SS27 drop-waist renders, 2026-11-04). Faired through the seam,
// the side runs out as the hip does, with no step at the seam.
describe('a dropped waist seam drawn without a ledge', () => {
  afterEach(() => setKnob('__noSeamFair', undefined));
  it.each(['dropped', 'low'] as const)('%s: the side runs smoothly through the seam', (ws) => {
    setKnob('__noSeamFair', 1);
    const old = worstStep(ws);
    setKnob('__noSeamFair', undefined);
    const now = worstStep(ws);
    expect(now.ok).toBe(true);
    // (Form units per cm of height: the hip itself widens about 0.01 a cm here; the ledge was 0.024 to 0.04.)
    expect(old.step).toBeGreaterThan(0.02);
    expect(now.step).toBeLessThan(0.015);
    expect(now.step).toBeLessThan(old.step / 2.5);
  }, 120_000);
});
