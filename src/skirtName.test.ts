import { describe as group, expect, it } from 'vitest';
import { describe } from './skirtChoices';
import { COLLECTION } from './collection';

// A typed or dragged length turned the Black Pleated Skirt's name into "52 cm low-rise A-line skirt with box pleats" on
// the PDF cover, booklet and account card (EH walk, Cat's call, Nov 25): the length is named by the one it's nearest.
group('a skirt with its own length', () => {
  const pleated = COLLECTION.find((c) => c.id === 'black-pleated-skirt')!.choices as never as Parameters<typeof describe>[0];
  it('is named by its nearest length, not its number', () => {
    const plain = describe({ ...pleated, look: undefined });
    const own = describe({ ...pleated, look: undefined, lengthCm: 52.5 });
    expect(own).not.toMatch(/\d/);
    expect(own).toBe(plain);
  });
});
