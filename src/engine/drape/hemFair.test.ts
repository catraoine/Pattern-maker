import { afterEach, describe, expect, it } from 'vitest';
import { COLLECTION } from '../../collection';
import { drapeDesign } from '../../drapeSweep';
import { setKnob } from './knob';

// The Leopard Shirt Dress's shirttail hem came out as small saw-teeth in All round (bug hunt, Nov 14): its edge, read
// along its length, jumped up and down by most of a unit from one point to the next.
const roughest = () => {
  const look = COLLECTION.find((x) => x.id === 'leopard-shirt-dress')!;
  const d = drapeDesign({ garment: 'bodice', saved: { bodice: look.choices } as never, fibre: 'cotton' });
  let worst = 0;
  for (const ln of d.lines.filter((x) => x.kind === 'hem'))
    for (let k = 1; k < ln.ids.length - 1; k++) {
      const y = (i: number) => d.pos[ln.ids[i] * 3 + 1];
      worst = Math.max(worst, Math.abs(y(k - 1) - 2 * y(k) + y(k + 1)));
    }
  return worst;
};

describe('All round: a top hem drawn smooth', () => {
  afterEach(() => setKnob('__noHemFair', undefined));

  it('draws the shirttail hem without saw-teeth', () => {
    expect(roughest()).toBeLessThan(0.35);
  }, 120_000);

  it('(the check sees the saw-teeth without the fix)', () => {
    setKnob('__noHemFair', 1);
    expect(roughest()).toBeGreaterThan(0.6);
  }, 120_000);
});
