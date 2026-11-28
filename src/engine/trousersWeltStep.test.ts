import { describe, expect, it } from 'vitest';
import { EXAMPLE_BODY } from '../measurements';
import { DEFAULT_TROUSERS_CHOICES, MENSWEAR_TROUSERS_CHOICES } from '../garments';
import { draftTrousers } from './trousers';
import { trousersGuide } from './trousersGuide';
import { draftOuter } from './outerwear';
import { outerGuide } from './outerGuide';

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

// "Raw edges up to the box's lower line" put the welt's stitching 1 cm below the box: the welt and facing are cut with
// 1 cm allowances, so their stitching lines go on the box's lines (UX/UI's step diagrams and the fit audit, Nov 27).
describe('the welt and facing are stitched on the box lines', () => {
  it('in the trousers', () => {
    const text = trousersGuide(draftTrousers(EXAMPLE_BODY as never, { ...DEFAULT_TROUSERS_CHOICES, backPockets: 'welt' } as never), 2).steps.find((s) => s.title === 'Make the back welt pockets')!.text;
    expect(text).toContain("raw edges toward the box, with its stitching line on the box's lower line");
    expect(text).toContain("Lay a back pocket facing above the box, raw edge toward it, with its stitching line on the box's upper line");
    expect(text).not.toContain('raw edges up to');
  });
  it('in the vest and jackets', () => {
    const d = draftOuter(EXAMPLE_BODY as never, { kind: 'jacket', pockets: 'welt' } as never);
    const text = outerGuide(d, 2, {}).steps.find((s) => /welt pockets/i.test(s.title))!.text;
    expect(text).toContain("Lay it on the front below its box, raw edges toward the box, with its stitching line on the box's lower line");
    expect(text).toContain("Lay a pocket facing above the box, raw edge toward it, with its stitching line on the box's upper line");
  });
  it('in a coat chest pocket', () => {
    const d = draftOuter(EXAMPLE_BODY as never, { kind: 'coat', chest: 'welt' } as never);
    const text = outerGuide(d, 2, {}).steps.find((s) => s.title === 'Make the chest pocket')!.text;
    expect(text).toContain("Lay it below the box, raw edges toward the box, with its stitching line on the box's lower line");
    expect(text).toContain('Lay the facing above the box, raw edge toward it, with its stitching line on the upper line');
  });
});
