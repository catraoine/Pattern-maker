import { describe, expect, it } from 'vitest';
import { COLLECTION } from '../collection';
import { draftSkirt } from './skirt';
import { waistbandPiece } from './finishing';
import { selfCrossing } from '../patternSweep';
import { randomBody, rng } from './randomBodies';
import { EXAMPLE_BODY } from '../measurements';

// A low rise's curved band wrapped past a full circle and overlapped itself on a body much bigger at the hip than the
// waist with a short hip depth (nightly bug hunt, Nov 25: 1 in 150 random bodies, the Black Pleated Skirt too).
const pleated = COLLECTION.find((c) => c.id === 'black-pleated-skirt')!.choices as never;
const plain = { fit: 'regular', silhouette: 'a_line', length: 'knee', rise: 'low' } as never;

describe('a low-rise skirt band', () => {
  it('never overlaps itself, however curvy the body', () => {
    const r = rng(777);
    for (let i = 0; i < 300; i++) {
      const body = { ...EXAMPLE_BODY, ...randomBody(r) } as never;
      for (const style of [pleated, plain]) {
        const d = draftSkirt(body, style);
        expect(d.bandTop).toBeDefined();
        expect(selfCrossing(waistbandPiece(d, 1.5).outline.points())).toBeUndefined();
      }
    }
  });

  it('keeps the band it had on an everyday body', () => {
    const d = draftSkirt(EXAMPLE_BODY as never, pleated);
    expect(d.bandTop).toBe(69.8);
  });
});
