import { describe, expect, it } from 'vitest';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng, sweep } from './randomBodies';
import { OUTER_LENGTHS, OuterKind, draftOuter } from './outerwear';
import { outerFlat } from './flat';
import { outerGuide } from './outerGuide';
import { EXAMPLE_VALUES } from '../measurements';

const m = EXAMPLE_VALUES as Parameters<typeof draftOuter>[0];

describe('jacket and coat collars and lapels', () => {
  it('drafts peak, shawl and funnel collars with classic, wide and plunging lapels, on 20 bodies', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= sweep(20); seed++) {
      const r = rng(seed);
      const body = randomBody(r);
      const b = { ...body, ...randomArms(body, r), waist_to_knee: body.waist_to_knee ?? 58 };
      for (const kind of ['jacket', 'coat'] as OuterKind[])
        for (const collar of ['peak', 'shawl', 'funnel', 'notched'] as const)
          for (const lapel of ['classic', 'wide', 'plunge'] as const)
            for (const front of ['single', 'double'] as const) {
              if (lapel === 'plunge' && front === 'double') continue;
              if (collar === 'funnel' && lapel !== 'classic') continue;
              const fit = (['fitted', 'regular', 'relaxed', 'oversized'] as const)[(seed + collar.length) % 4];
              const length = OUTER_LENGTHS[kind][(seed + lapel.length) % 3];
              const style = { kind, fit, front, collar, lapel, length };
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
              if (collar === 'funnel' && d.lapel) failures.push(`${tag}: a funnel neck has no lapel`);
              if (collar !== 'funnel' && !d.lapel) failures.push(`${tag}: lost its lapel`);
              if (lapel === 'plunge' && d.buttons.at.length !== 1) failures.push(`${tag}: ${d.buttons.at.length} buttons on a plunge`);
              if (seed <= 2) {
                expect(outerFlat(d).views).toHaveLength(2);
                expect(outerGuide(d, 2).steps.length).toBeGreaterThan(10);
              }
            }
    }
    expect(failures.slice(0, 6)).toEqual([]);
  });

  it('breaks a plunging lapel near the waist and widens a wide one', () => {
    const base = { kind: 'jacket' as const, fit: 'regular' as const, front: 'single' as const, collar: 'notched' as const };
    const classic = draftOuter(m, { ...base, lapel: 'classic' });
    const wide = draftOuter(m, { ...base, lapel: 'wide' });
    const plunge = draftOuter(m, { ...base, lapel: 'plunge' });
    expect(plunge.lapel!.breakPt.y).toBeGreaterThan(classic.lapel!.breakPt.y + 5);
    const span = (d: typeof classic) => Math.max(...d.lapel!.worn.map((q) => q.x)) - Math.min(...d.lapel!.worn.map((q) => q.x));
    expect(span(wide)).toBeGreaterThan(span(classic) + 1.5);
    // A peak points up past its notch; a shawl has no step at all.
    const peak = draftOuter(m, { ...base, collar: 'peak' });
    expect(peak.lapel!.collarPoint).toBeDefined();
    const shawl = draftOuter(m, { ...base, collar: 'shawl' });
    expect(shawl.pieces.some((pc) => pc.kind === 'collar' || /collar/i.test(pc.name))).toBe(true);
  });
});
