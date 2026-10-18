import { describe, expect, it } from 'vitest';
import { isSwimIntimates } from './swim';

describe('isSwimIntimates', () => {
  it('spots swimwear and lingerie', () => {
    for (const name of ['high-cut swimsuit', 'Bikini top', 'wire-free bralette', 'lace bodysuit', 'balconette bra', 'high-waist briefs', 'swimwear', 'one-piece with a scooped back', 'lingerie set'])
      expect(isSwimIntimates(name), name).toBe(true);
  });
  it('leaves other things alone', () => {
    for (const name of ['slip dress', 'corset top', 'knitted jumper', 'bucket hat', 'tote bag', 'bralessly cut cami', 'embroidered blouse'])
      expect(isSwimIntimates(name), name).toBe(false);
  });
});
