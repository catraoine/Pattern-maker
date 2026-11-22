import { describe, expect, it } from 'vitest';
import { isNote, stepLines } from './stepLines';

describe('a step as one action per line', () => {
  it('splits at each full stop and keeps every word', () => {
    const text = 'Fold the fabric in half. Place the skirt front on the fold. Cut along the solid outer line.';
    expect(stepLines(text)).toEqual(['Fold the fabric in half.', 'Place the skirt front on the fold.', 'Cut along the solid outer line.']);
  });
  it("doesn't split a measurement or a one-sentence step", () => {
    expect(stepLines('Sew 1.5 cm from the edge, then press.')).toEqual(['Sew 1.5 cm from the edge, then press.']);
  });
  it('ends a sentence inside a closing quote', () => {
    expect(stepLines('Mark it "WAIST." Then sew the seam.')).toEqual(['Mark it "WAIST."', 'Then sew the seam.']);
  });
  it('tells a note from a thing to do', () => {
    expect(isNote('The facing is left soft.')).toBe(true);
    expect(isNote('Do not wash it.')).toBe(true);
    expect(isNote('Fold the fabric in half.')).toBe(false);
    expect(isNote('If it puckers, steam it flat.')).toBe(false);
  });
});
