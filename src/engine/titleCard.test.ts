import { describe, expect, it } from 'vitest';
import { textWidth, titleCard } from './export';

const ROOM = 46 - 2.4;
const LONG = 'oversized button-front shirt-collar back-yoke bodice with elbow-length sleeves with turned-back cuffs, 47 cm below the waist, with a shaped hem';

describe('title card', () => {
  it('keeps a short description as the one big line', () => {
    expect(titleCard('knee a-line skirt')).toEqual([{ text: 'Knee a-line skirt', size: 1.3, y: 3.3 }]);
  });
  it('never prints wider than the card', () => {
    for (const [d, n] of [[LONG, undefined], [LONG, 'Leopard Shirt Dress'], [`${LONG} ${LONG}`, undefined]] as const)
      for (const l of titleCard(d, n)) expect(textWidth(l.text, l.size)).toBeLessThanOrEqual(ROOM);
  });
  it('heads a long description with the look name, the description small beneath', () => {
    const [head, ...rest] = titleCard(LONG, 'Leopard Shirt Dress');
    expect(head).toMatchObject({ text: 'Leopard Shirt Dress', size: 1.3 });
    expect(rest.length).toBeGreaterThan(0);
    expect(rest.length).toBeLessThanOrEqual(2);
    expect(rest.every((l) => l.y < 4.4)).toBe(true);
  });
  it('without a look, heads it with the description up to its first "with"', () => {
    expect(titleCard(LONG)[0].text).toBe('Oversized button-front shirt-collar back-yoke bodice');
  });
});
