import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { draftBodice } from './bodice';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { POLO } from './collar';
import { bodiceGuide } from './instructions';
import { detailAllowed } from '../garments';

// The open polo collar (In testing, Cat 2026-11-02): a pointed collar over a faced centre-front slit.
describe('open polo collar', () => {
  const style = { fit: 'boxy', neckline: 'crew', collar: 'polo', sleeve: 'short', length: 'waist' } as const;

  it('goes on a crew neck that zips at the back', () => {
    expect(detailAllowed({ neckline: 'crew' } as never, 'collar', 'polo')).toBe(true);
    expect(detailAllowed({ neckline: 'crew', closure: 'front_buttons' } as never, 'collar', 'polo')).toBe(false);
    expect(detailAllowed({ neckline: 'v' } as never, 'collar', 'polo')).toBe(false);
    expect(draftBodice(randomBody(rng(1)), { ...style, closure: 'front_buttons' } as never).collar).toBe('none');
  });

  it('drafts a collar the length of the neckline, a slit and its facing, on any body', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const d = draftBodice(randomBody(rng(seed)), style as never);
      expect(d.collar).toBe('polo');
      const front = d.pieces.find((pc) => pc.fold && /front/i.test(pc.name))!;
      const back = d.pieces.find((pc) => /back/i.test(pc.name) && pc.kind !== 'facing')!;
      const collar = d.pieces.find((pc) => pc.name === 'Collar')!;
      const facing = d.pieces.find((pc) => pc.name === 'Slit facing')!;
      expect(front.meta.slitCm).toBe(POLO.slit);
      expect(facing).toBeTruthy();
      const neck = taggedLength(front.outline, 'neck') + taggedLength(back.outline, 'neck');
      expect(Math.abs(taggedLength(collar.outline, 'neck') - neck)).toBeLessThan(0.05);
      expect(checkPattern(d.pieces).filter((c) => !c.ok).map((c) => c.label)).toEqual([]);
    }
  });

  it('tells you to face the slit before the collar goes on', () => {
    const d = draftBodice(randomBody(rng(3)), style as never);
    const titles = bodiceGuide(d, { length: 'waist' }, 1.5, 1, { edges: 'facings' }).steps.map((s) => s.title);
    expect(titles.indexOf('Face the slit')).toBeGreaterThan(-1);
    expect(titles.indexOf('Face the slit')).toBeLessThan(titles.indexOf('Attach the collar'));
  });
});
