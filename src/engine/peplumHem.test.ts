import { describe, expect, it } from 'vitest';
import { BodiceStyle, draftBodice } from './bodice';
import { peplumBackExtra } from './drape';
import { taggedLength } from './geometry';
import { bodiceFlat } from './flat';
import { checkPattern } from './qc';
import { randomBody, rng, sweep } from './randomBodies';
import { DEFAULT_BODICE } from '../garments';

const lowest = (pts: { y: number }[]) => Math.max(...pts.map((q) => q.y));

describe('the high-low peplum (In testing)', () => {
  it('hangs longer at the centre back, its side seams still matching the front', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= sweep(30); seed++) {
      const b = randomBody(rng(seed));
      for (const peplum of ['flared', 'gathered'] as const)
        for (const length of ['waist', 'high_hip'] as const)
          for (const fit of ['fitted', 'regular'] as const) {
            const style = { ...DEFAULT_BODICE, fit, length, peplum, peplumHem: 'high_low' } as Partial<BodiceStyle>;
            const tag = `${seed} ${peplum} ${length} ${fit}`;
            let d;
            try {
              d = draftBodice(b, style);
            } catch (e) {
              failures.push(`${tag}: ${(e as Error).message}`);
              continue;
            }
            const level = draftBodice(b, { ...style, peplumHem: 'level' });
            const pf = d.pieces.find((pc) => pc.name === 'Peplum front')!;
            const pb = d.pieces.find((pc) => pc.name === 'Peplum back')!;
            const lb = level.pieces.find((pc) => pc.name === 'Peplum back')!;
            const extra = peplumBackExtra(d.peplum!.depthCm);
            if (d.peplum?.backCm !== extra) failures.push(`${tag}: backCm ${d.peplum?.backCm}`);
            // The front stays level; the back drops by the extra at its centre.
            if (Math.abs(taggedLength(pf.outline, 'side') - taggedLength(pb.outline, 'side')) > 0.05) failures.push(`${tag}: side seams ${taggedLength(pf.outline, 'side')} vs ${taggedLength(pb.outline, 'side')}`);
            const centre = (pc: typeof pb) => lowest(pc.outline.points().filter((q) => Math.abs(q.x) < 0.01));
            if (Math.abs(centre(pb) - centre(lb) - extra) > 0.3) failures.push(`${tag}: centre back ${(centre(pb) - centre(lb)).toFixed(2)} longer, wanted ${extra}`);
            if (!(d.peplum!.hemCm > level.peplum!.hemCm)) failures.push(`${tag}: hem not longer`);
            const bad = checkPattern(d.pieces.filter((pc) => !pc.kind)).filter((c) => !c.ok);
            if (bad.length) failures.push(`${tag}: ${bad.map((c) => `${c.label} ${c.detail ?? ''}`).join('; ')}`);
            for (const pc of d.pieces) if (pc.outline.points().some((q) => !Number.isFinite(q.x + q.y))) failures.push(`${tag} ${pc.name} not finite`);
          }
    }
    expect(failures).toEqual([]);
  });

  it('draws the back view longer at the centre', () => {
    const b = randomBody(rng(3));
    const style = { ...DEFAULT_BODICE, peplum: 'flared', peplumHem: 'high_low' } as Partial<BodiceStyle>;
    const hl = bodiceFlat(draftBodice(b, style));
    const lv = bodiceFlat(draftBodice(b, { ...style, peplumHem: 'level' }));
    const foot = (f: typeof hl, i: number) => lowest(f.views[i].shapes.flat());
    expect(foot(hl, 1) - foot(lv, 1)).toBeGreaterThan(6);
    expect(Math.abs(foot(hl, 0) - foot(lv, 0))).toBeLessThan(0.01);
  });
});
