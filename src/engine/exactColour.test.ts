import { describe, expect, it } from 'vitest';
import { exactColourFile } from './exactColour';

describe('exact colour file', () => {
  it('names the file by its hex and sizes it for print at 150 dpi', () => {
    expect(exactColourFile('#b8613f')).toEqual({ name: 'maison-trace-B8613F.png', px: 1200, inches: 8 });
  });
});
