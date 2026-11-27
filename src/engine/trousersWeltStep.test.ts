import { describe, expect, it } from 'vitest';
import { EXAMPLE_BODY } from '../measurements';
import { DEFAULT_TROUSERS_CHOICES, MENSWEAR_TROUSERS_CHOICES } from '../garments';
import { draftTrousers } from './trousers';
import { trousersGuide } from './trousersGuide';

// A barrel trouser tester could not tack the back pocket bags to the waist edge: they are sewn at the opening, 7 cm below
// the waist, and hang down from it (fit audit, findings row 162). No step may ask for it.
describe('the back welt pocket step', () => {
  const steps = (choices: object) => trousersGuide(draftTrousers(EXAMPLE_BODY as never, { ...DEFAULT_TROUSERS_CHOICES, ...choices } as never), 2).steps;
  for (const [name, choices] of [
    ['womenswear', { backPockets: 'welt' }],
    ['menswear', MENSWEAR_TROUSERS_CHOICES],
    ['shorts', { backPockets: 'welt', length: 'shorts' }],
  ] as const)
    it(`says the bags hang free, and nothing asks to catch them at the waist (${name})`, () => {
      const all = steps(choices);
      expect(all.find((s) => s.title === 'Make the back welt pockets')!.text).toContain('The bags hang free from the opening and do not reach the waist.');
      for (const s of all) expect(s.text).not.toMatch(/bags? to the waist|waistband holds them/i);
    });
});
