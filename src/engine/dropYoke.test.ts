import { describe, expect, it } from 'vitest';
import { checkPattern } from './qc';
import { randomBody, rng, sweep } from './randomBodies';
import { draftSkirt } from './skirt';
import { sewingGuide } from './instructions';
import { skirtFlat } from './flat';
import { layPlan } from './layplan';
import { waistbandPiece } from './finishing';
import { layoutExtras } from './skirtVolume';
import { describe as describeSkirt } from '../skirtChoices';

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };

describe('the drop-yoke skirt', () => {
  it('fits a yoke past the hip and gathers one deep skirt below it, as full as chosen', () => {
    for (const gathers of ['soft', 'full', 'dramatic'] as const) {
      const d = draftSkirt(m, { silhouette: 'straight', length: 'midi', flounce: 'tiers', dropYoke: true, gathers });
      const bands = d.volume!.tiers!.bands;
      expect(bands).toHaveLength(1);
      expect(bands[0].ratio).toBe({ soft: 1.6, full: 2.2, dramatic: 2.8 }[gathers]);
      expect(d.volume!.tiers!.yoke).toBeGreaterThanOrEqual(m.waist_to_hip + 5);
      expect(Math.abs(d.volume!.tiers!.yoke + bands[0].depth - d.lengthCm)).toBeLessThan(0.3);
      expect(checkPattern(d.pieces, { finishedWaist: d.finishedWaist }).filter((c) => !c.ok)).toEqual([]);
      expect(layPlan([...d.pieces, ...layoutExtras(d), waistbandPiece(d, 1.5)], 140)).toBeDefined();
    }
    const full = draftSkirt(m, { silhouette: 'straight', length: 'midi', flounce: 'tiers', dropYoke: true });
    expect(full.volume!.tiers!.bands[0].ratio).toBe(2.2);
    expect(describeSkirt({ fit: 'regular', silhouette: 'straight', length: 'midi', flounce: 'tiers', dropYoke: true } as never)).toMatch(/drop yoke/);
  });

  it('drafts on random bodies, every shape and length, with its sewing steps and flat', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= sweep(20); seed++) {
      const b = randomBody(rng(seed));
      for (const silhouette of ['straight', 'pencil', 'a_line'] as const)
        for (const length of ['above_knee', 'knee', 'midi', 'maxi'] as const) {
          const fit = (['fitted', 'regular', 'relaxed'] as const)[(seed + length.length) % 3];
          const style = { fit, silhouette, length, flounce: 'tiers' as const, dropYoke: true };
          const tag = `${seed} ${JSON.stringify(style)}`;
          let d;
          try {
            d = draftSkirt(b, style);
          } catch (e) {
            failures.push(`${tag}: ${(e as Error).message}`);
            continue;
          }
          if (d.volume?.tiers?.bands.length !== 1) failures.push(`${tag}: ${d.volume?.tiers?.bands.length} tiers`);
          const bad = checkPattern(d.pieces, { finishedWaist: d.finishedWaist }).filter((c) => !c.ok);
          if (bad.length) failures.push(`${tag}: ${bad.map((c) => `${c.label} ${c.detail ?? ''}`).join('; ')}`);
          if (seed <= 2) {
            expect(skirtFlat(d).views.length).toBeGreaterThan(0);
            expect(JSON.stringify(sewingGuide(d, style as never, 2))).toMatch(/Lower skirt/);
          }
        }
    }
    expect(failures.slice(0, 6)).toEqual([]);
  });
});
