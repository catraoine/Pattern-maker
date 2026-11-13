import { describe, expect, it } from 'vitest';
import { printedPattern } from './patternSweep';
import { INITIAL } from './savedWork';
import { COLLECTION } from './collection';
import { isBodice } from './garments';
import { bigPrintCut } from './engine/prints';

// The Leopard Shirt Dress's printed pack, as read before the toile was sewn (2026-11-13): nothing listed that no step
// uses, and no two steps that say opposite things.
const look = COLLECTION.find((l) => l.id === 'leopard-shirt-dress')!;
const pack = () => {
  if (!isBodice(look.choices)) throw new Error('the leopard shirt dress is a top carried to a mini');
  return printedPattern({ garment: 'bodice', saved: { bodice: { ...INITIAL.bodice, ...look.choices } } }).made;
};

describe("the house shirt's printed pack", () => {
  it('asks for no bias binding: the collar stand and the facings finish the neck, the sleeves the armholes', () => {
    const made = pack();
    expect(made.guide.notions.join(' | ')).not.toMatch(/bias binding/);
    expect(made.guide.steps.some((s) => /bias binding/.test(s.text))).toBe(false);
    expect(made.notes.join(' ')).not.toMatch(/bias-bound/);
    expect(made.notes.join(' ')).toMatch(/a shirt collar\. Sewing steps/);
  });

  it('still lists the binding where a neckline is bound', () => {
    const made = printedPattern({ garment: 'bodice', saved: { bodice: { ...INITIAL.bodice, sleeve: 'short' } } }).made;
    expect(made.guide.notions.join(' | ')).toMatch(/bias binding/);
    expect(made.notes.join(' ')).toMatch(/bias-bound neckline/);
  });

  it('presses a shirt at the end, not a bodice', () => {
    const steps = pack().guide.steps;
    expect(steps[steps.length - 1].text).toContain('Give the shirt a final press');
  });

  it('says that placing a big print single layer takes the place of the folded layout', () => {
    const words = bigPrintCut(26);
    expect(words).toContain('cut single layer');
    expect(words).toContain('takes the place of folding the fabric in the cutting layout and the cutting step');
    expect(words).not.toContain('rather than on a fold');
  });
});
