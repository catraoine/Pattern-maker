import { describe, expect, it } from 'vitest';
import { fabricLines } from './fabrics';

// Fit tester walk, Nov 14: the Ice Peplum's steps said "Colour: #9CC3E6".
describe('a fabric colour on the printed steps', () => {
  it('names a house colour instead of its swatch code', () => {
    expect(fabricLines({ fibre: 'silk', colour: '#9CC3E6' }, 'bodice')).toContain('Colour: Ice');
    expect(fabricLines({ fibre: 'cotton', colour: '#3d2418' }, 'trousers')).toContain('Colour: Chocolate');
  });
  it('leaves out a picked code with no name, and keeps a named colour', () => {
    expect(fabricLines({ fibre: 'silk', colour: '#123456' }, 'bodice').some((l) => l.startsWith('Colour'))).toBe(false);
    expect(fabricLines({ fibre: 'wool', colour: 'Black' }, 'skirt')).toContain('Colour: Black');
  });
});
