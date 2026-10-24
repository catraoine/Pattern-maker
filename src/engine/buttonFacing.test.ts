import { describe, expect, it } from 'vitest';
import { draftBodice } from './bodice';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';

describe('button-front facings', () => {
  it('meet at the shoulder seam on every neckline, short boat and square shoulders included', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      const b = randomBody(rng(seed));
      for (const neckline of ['crew', 'scoop', 'v', 'square', 'boat'] as const) {
        const d = draftBodice(b, { fit: 'regular', neckline, closure: 'front_buttons' });
        expect(d.pieces.map((pc) => pc.name)).toContain('Back neck facing');
        for (const c of checkPattern(d.pieces)) if (!c.ok) failures.push(`seed ${seed} ${neckline}: ${c.label} (${c.detail})`);
      }
    }
    expect(failures).toEqual([]);
  });
});
