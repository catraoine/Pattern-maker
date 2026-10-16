import { describe, expect, it } from 'vitest';
import { draftBodice, dropRange } from './bodice';
import { bodiceFacings } from './finishing';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { DraftError, draftSkirt } from './skirt';

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };

describe('pattern checks', () => {
  it('walks the seams of a skirt', () => {
    const d = draftSkirt(m, { silhouette: 'a_line' });
    const checks = checkPattern(d.pieces, { finishedWaist: d.finishedWaist });
    const labels = checks.map((c) => c.label);
    expect(labels).toContain('Side seams');
    expect(labels).toContain('Waist blends across the side seam');
    expect(labels).toContain('Hem square at centre front');
    expect(labels.filter((l) => /dart/.test(l))).toHaveLength(4);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
  });

  it('catches seams that do not match', () => {
    const d = draftSkirt(m);
    const longBack = draftSkirt({ ...m, waist_to_knee: 66 });
    const checks = checkPattern([d.pieces[0], longBack.pieces[1]]);
    expect(checks.find((c) => c.label === 'Side seams')?.ok).toBe(false);
  });

  it('passes every check for 300 random bodies, every skirt shape and bodice style', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 300; seed++) {
      const body = randomBody(rng(seed));
      for (const fit of ['fitted', 'regular', 'relaxed'] as const) {
        for (const silhouette of ['straight', 'pencil', 'a_line', 'trumpet', 'half_circle', 'circle'] as const) {
          for (const length of ['mini', 'midi'] as const) {
            let d;
            try {
              d = draftSkirt(body, { fit, silhouette, length });
            } catch (e) {
              if (e instanceof DraftError) continue;
              throw e;
            }
            for (const c of checkPattern(d.pieces, { finishedWaist: d.finishedWaist }))
              if (!c.ok) failures.push(`seed ${seed} ${fit} ${silhouette} ${length}: ${c.label} (${c.detail})`);
          }
        }
        // Every bodice style in turn: necklines, lengths and dart choices.
        const style = {
          fit,
          neckline: (['crew', 'scoop', 'v', 'square', 'boat'] as const)[seed % 5],
          length: (['waist', 'high_hip', 'hip'] as const)[(seed >> 1) % 3],
          darts: (['bust_waist', 'bust', 'none'] as const)[(seed >> 2) % 3],
        };
        const bd = draftBodice(body, style);
        for (const c of checkPattern(bd.pieces, { finishedWaist: bd.finishedWaist }))
          if (!c.ok) failures.push(`seed ${seed} bodice ${JSON.stringify(style)}: ${c.label} (${c.detail})`);
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('passes every check for 300 random bodices shaped by hand, with facings for the drawn necklines', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 300; seed++) {
      const r = rng(seed + 7000);
      const body = randomBody(r);
      const range = dropRange(body);
      const style = {
        fit: (['fitted', 'regular', 'relaxed'] as const)[seed % 3],
        darts: seed % 3 === 0 ? ('bust' as const) : ('bust_waist' as const),
        dropCm: seed % 2 ? 0 : range.min + r() * (range.max - range.min),
        bustEase: 3 + r() * 19,
        neck: { frontDepth: r() * 20, width: r() * 8, backDepth: r() * 12, fullness: r() },
      };
      const bd = draftBodice(body, style);
      for (const c of checkPattern(bd.pieces, { finishedWaist: bd.finishedWaist }))
        if (!c.ok) failures.push(`seed ${seed} bodice ${JSON.stringify(style)}: ${c.label} (${c.detail})`);
      if (bodiceFacings(bd.pieces[0], bd.pieces[1]).length < 2) failures.push(`seed ${seed}: facings missing`);
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});
