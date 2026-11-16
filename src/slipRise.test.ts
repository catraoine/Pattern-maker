import { describe, expect, it } from 'vitest';
import { COLLECTION, lookChoices } from './collection';
import { EXAMPLE_BODY } from './measurements';
import { slipRise } from './slipRise';
import type { DressChoices } from './garments';

const slip = COLLECTION.find((l) => l.id === 'ivory-slip')!;

describe('a slip rises with the bust', () => {
  it('leaves the example body and smaller busts as the look draws them', () => {
    expect(slipRise(EXAMPLE_BODY)).toBe(0);
    expect(slipRise({ ...EXAMPLE_BODY, full_bust: 78 })).toBe(0);
    expect(lookChoices(slip, EXAMPLE_BODY)).toEqual(slip.choices);
  });

  it('rises 1 cm per 10 cm of bust over the example, at most 4 cm', () => {
    expect(slipRise({ ...EXAMPLE_BODY, full_bust: 102 })).toBe(2);
    expect(slipRise({ ...EXAMPLE_BODY, full_bust: 130 })).toBe(4);
    expect(slipRise({ ...EXAMPLE_BODY, full_bust: 150 })).toBe(4);
  });

  it('raises both the scoop and the armhole of the Ivory Slip', () => {
    const c = lookChoices(slip, { ...EXAMPLE_BODY, full_bust: 130 }) as DressChoices;
    const was = (slip.choices as DressChoices).bodice;
    expect(c.bodice.neck?.rise).toBe(4);
    expect(c.bodice.armholeLower).toBe((was.armholeLower ?? 0) - 4);
  });

  it('leaves dresses without a slip strap alone', () => {
    for (const look of COLLECTION.filter((l) => l.id !== 'ivory-slip')) expect(lookChoices(look, { ...EXAMPLE_BODY, full_bust: 130 })).toEqual(lookChoices(look, EXAMPLE_BODY));
  });
});
