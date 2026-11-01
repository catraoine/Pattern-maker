import { describe, expect, it } from 'vitest';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng, sweep } from './randomBodies';
import { OUTER_LENGTHS, OuterKind, draftOuter } from './outerwear';
import { outerFlat } from './flat';
import { outerGuide } from './outerGuide';
import { EXAMPLE_VALUES } from '../measurements';

const m = EXAMPLE_VALUES as Parameters<typeof draftOuter>[0];

describe('flared jackets and coats', () => {
  it('flares every length, fit and shaping from the waist on 20 bodies, passing every pattern check', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= sweep(20); seed++) {
      const r = rng(seed);
      const body = randomBody(r);
      const b = { ...body, ...randomArms(body, r), waist_to_knee: body.waist_to_knee ?? 58 };
      for (const kind of ['jacket', 'coat'] as OuterKind[])
        for (const length of OUTER_LENGTHS[kind].filter((l) => l !== 'cropped'))
          for (const shaping of ['princess', 'darts', 'boxy'] as const) {
            const fit = shaping === 'boxy' ? 'relaxed' : (['fitted', 'regular', 'relaxed'] as const)[(seed + length.length) % 3];
            const collar = (['peak', 'notched', 'shawl', 'stand'] as const)[(seed + shaping.length) % 4];
            const vent = (['centre', 'none'] as const)[seed % 2];
            const style = { kind, fit, shaping, length, collar, vent, flare: 'flared' as const, lapel: seed % 3 === 0 ? ('plunge' as const) : undefined };
            const tag = `${seed} ${JSON.stringify(style)}`;
            let d;
            try {
              d = draftOuter(b, style);
            } catch (e) {
              failures.push(`${tag}: ${(e as Error).message}`);
              continue;
            }
            const bad = checkPattern(d.pieces.filter((pc) => !pc.kind || pc.kind === 'collar')).filter((c) => !c.ok);
            if (bad.length) failures.push(`${tag}: ${bad.map((c) => `${c.label} ${c.detail ?? ''}`).join('; ')}`);
            for (const pc of d.pieces) if (pc.outline.points().some((q) => !Number.isFinite(q.x + q.y))) failures.push(`${tag} ${pc.name} not finite`);
            if (seed <= 2) {
              expect(outerFlat(d).views).toHaveLength(2);
              expect(outerGuide(d, 2).steps.length).toBeGreaterThan(10);
            }
          }
    }
    expect(failures.slice(0, 6)).toEqual([]);
  });

  it('cinches a fitted waist, runs a long one longer, and widens the hem', () => {
    const base = { kind: 'jacket' as const, fit: 'fitted' as const, shaping: 'princess' as const, length: 'long' as const };
    const straight = draftOuter(m, { ...base, flare: 'straight' });
    const flared = draftOuter(m, { ...base, flare: 'flared' });
    // Fitted and flared, it's cinched like a basque: 4 cm less ease at the waist; a regular fit keeps its own.
    expect(straight.finishedWaist - flared.finishedWaist).toBeCloseTo(4, 0);
    const regular = { ...base, fit: 'regular' as const };
    expect(Math.abs(draftOuter(m, { ...regular, flare: 'flared' }).finishedWaist - draftOuter(m, { ...regular, flare: 'straight' }).finishedWaist)).toBeLessThan(0.5);
    // Long and flared, it runs 6 cm longer, past a drop-yoke skirt's seam.
    expect(flared.drop - straight.drop).toBeCloseTo(6, 0);
    expect(flared.finishedHem).toBeGreaterThan(straight.finishedHem + 30);
  });
});
