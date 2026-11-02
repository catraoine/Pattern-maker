import { describe, expect, it } from 'vitest';
import { paletteName, paletteShop, showsPalette } from './PaletteCard';

describe('the palette card beside the form', () => {
  it('names the cloth and its colour', () => {
    expect(paletteName({ fibre: 'wool', colour: 'Navy' })).toBe('Wool · Navy');
    expect(paletteShop({ fibre: 'wool', colour: 'Navy' })).toBeUndefined();
  });
  it('shows no card for no fabric', () => {
    expect(showsPalette(undefined)).toBe(false);
    expect(showsPalette({})).toBe(false);
    expect(showsPalette({ fibre: 'linen' })).toBe(true);
  });
  it("gives a shop fabric's shop and price, the colourway's own price when it has one", () => {
    expect(paletteShop({ shop: 'mood-denim', colour: 'Night sky' })).toBe('Mood Fabrics · $15.96/yd');
    expect(paletteShop({ shop: 'mood-denim', colour: 'Indigo twill' })).toBe('Mood Fabrics · $13.96/yd');
  });
});
