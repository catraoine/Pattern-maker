import { afterEach, describe, expect, it } from 'vitest';
import { sewDesign } from '../../drapeSweep';
import { UNUSUAL_BODIES } from '../unusualBodies';
import { DEFAULT_TEE_CHOICES } from '../../garments';
import { setKnob } from './knob';

// A T-shirt on a very large body (145 cm bust): its sleeve hung on the arm while the back armhole lay further out round
// the body, and the seam was drawn 2.9 cm open, Nov 15. The sleeve is carried out onto its armhole at the end.
const tee = { ...DEFAULT_TEE_CHOICES, fit: 'regular', stretch: 'low', neckline: 'crew', sleeve: 'elbow', length: 'cropped', shoulder: 'set_in' };
const sew = () => sewDesign({ garment: 'tee', saved: { tee } as never, fibre: 'cotton' }, UNUSUAL_BODIES['very large']).quality?.problems ?? [];

describe('a sleeve carried onto its armhole', () => {
  afterEach(() => setKnob('__noSleeveSeat', undefined));
  it('closes a T-shirt sleeve seam on a very large body, which stands open without it', () => {
    expect(sew()).toEqual([]);
    setKnob('__noSleeveSeat', 1);
    expect(sew().some((p) => p.check === 'seam' && /Sleeve/.test(p.part))).toBe(true);
  });
});
