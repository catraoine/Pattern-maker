import { describe, expect, it } from 'vitest';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng } from './randomBodies';
import { taggedLength } from './geometry';
import { TeeMeasurements, draftTee } from './tee';
import { teeFlat } from './flat';
import { EXAMPLE_VALUES } from '../measurements';

const m = EXAMPLE_VALUES as unknown as TeeMeasurements;
const bad = (d: ReturnType<typeof draftTee>) => checkPattern(d.pieces, {}).filter((c) => !c.ok).map((c) => `${c.label} ${c.detail}`);

describe('T-shirt hems drawn on the form', () => {
  it('raises a shirttail at the side seams, front and back alike, so the sides still match', () => {
    const level = draftTee(m, {});
    const tail = draftTee(m, { hemShape: { sides: 7 } });
    const [f, b] = tail.pieces;
    expect(taggedLength(f.outline, 'side')).toBeCloseTo(taggedLength(b.outline, 'side'), 1);
    expect(taggedLength(b.outline, 'side')).toBeLessThan(taggedLength(level.pieces[1].outline, 'side') - 5);
    expect(tail.backLength).toBeCloseTo(level.backLength, 1);
    expect(tail.hemShape).toEqual({ sides: 7, back: 0 });
    expect(bad(tail)).toEqual(bad(level));
    expect(teeFlat(tail).views.length).toBe(2);
  });

  it('lowers the centre back for a high-low hem, the side seams unchanged', () => {
    const level = draftTee(m, {});
    const hl = draftTee(m, { hemShape: { back: 8 } });
    expect(hl.backLength).toBeCloseTo(level.backLength + 8, 1);
    expect(taggedLength(hl.pieces[1].outline, 'side')).toBeCloseTo(taggedLength(level.pieces[1].outline, 'side'), 1);
    expect(bad(hl)).toEqual(bad(level));
  });

  it('drafts shaped hems for random bodies, every fit and length', () => {
    const r = rng(5);
    for (let i = 0; i < 20; i++) {
      const body = randomBody(r);
      const b = { ...body, ...randomArms(body, r) } as unknown as TeeMeasurements;
      for (const fit of ['fitted', 'regular', 'relaxed'] as const)
        for (const length of ['cropped', 'hip', 'tunic'] as const) {
          const level = draftTee(b, { fit, length });
          const d = draftTee(b, { fit, length, hemShape: { sides: r() * 10, back: r() * 12 } });
          expect(bad(d), `${i} ${fit} ${length}`).toEqual(bad(level));
        }
    }
  });
});
