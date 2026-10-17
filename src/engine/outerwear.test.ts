import { describe, expect, it } from 'vitest';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng } from './randomBodies';
import { taggedLength } from './geometry';
import { OUTER_EASE, OUTER_LENGTHS, OuterKind, draftOuter } from './outerwear';
import { outerFlat } from './flat';
import { outerGuide } from './outerGuide';
import { EXAMPLE_VALUES } from '../measurements';

const m = EXAMPLE_VALUES as Parameters<typeof draftOuter>[0];

describe('jackets and coats', () => {
  it('drafts a jacket with its collar, facings, pockets and lining', () => {
    const d = draftOuter(m, { kind: 'jacket' });
    const names = d.pieces.map((pc) => pc.name);
    expect(names).toEqual(['Jacket front', 'Jacket back', 'Sleeve', 'Collar', 'Front facing', 'Patch pocket', 'Front lining', 'Back lining', 'Sleeve lining']);
    expect(d.finishedBust).toBe(m.full_bust! + OUTER_EASE.jacket.regular);
    expect(d.lapel).toBeDefined();
    expect(d.buttons.at.length).toBeGreaterThanOrEqual(2);
    // The collar's neck edge is the back neck and the front neck seam to the gorge.
    const collar = d.pieces.find((pc) => pc.name === 'Collar')!;
    const back = d.pieces.find((pc) => pc.name === 'Jacket back')!;
    const front = d.pieces.find((pc) => pc.name === 'Jacket front')!;
    expect(taggedLength(collar.outline, 'neck')).toBeCloseTo(taggedLength(back.outline, 'neck') + taggedLength(front.outline, 'neck'), 0);
    // The gorge sews collar to lapel: the same length on both.
    expect(taggedLength(collar.outline, 'gorge')).toBeCloseTo(taggedLength(front.outline, 'gorge'), 1);
  });

  it('cuts the facing and the lining to meet along one line', () => {
    const d = draftOuter(m, { kind: 'jacket' });
    const facing = d.pieces.find((pc) => pc.name === 'Front facing')!;
    const lining = d.pieces.find((pc) => pc.name === 'Front lining')!;
    expect(taggedLength(facing.outline, 'lining')).toBeCloseTo(taggedLength(lining.outline, 'lining'), 0);
  });

  it('makes a coat longer than its jacket, and flares an A-line', () => {
    const jacket = draftOuter(m, { kind: 'jacket', length: 'hip' });
    const coat = draftOuter(m, { kind: 'coat', length: 'knee', flare: 'straight' });
    const swing = draftOuter(m, { kind: 'coat', length: 'knee', flare: 'a_line' });
    expect(coat.lengthCm).toBeGreaterThan(jacket.lengthCm + 30);
    expect(swing.finishedHem).toBeGreaterThan(coat.finishedHem + 8);
  });

  it('asks for the knee before making a coat', () => {
    const { waist_to_knee: _k, ...rest } = m;
    void _k;
    expect(() => draftOuter(rest, { kind: 'coat' })).toThrow(/waist to knee/);
  });

  it('drafts every style for 30 random bodies, passing every pattern check', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const r = rng(seed);
      const body = randomBody(r);
      const b = { ...body, ...randomArms(body, r), waist_to_knee: body.waist_to_knee ?? 58 };
      for (const kind of ['jacket', 'coat'] as OuterKind[]) {
        for (const fit of ['fitted', 'regular', 'relaxed'] as const) {
          for (const shaping of ['darts', 'princess', 'boxy'] as const) {
            for (const front of ['single', 'double'] as const) {
              for (const collar of ['notched', 'stand', 'collarless'] as const) {
                const length = OUTER_LENGTHS[kind][(seed + collar.length) % 3];
                const style = { kind, fit, shaping, front, collar, length };
                let d;
                try {
                  d = draftOuter(b, style);
                } catch (e) {
                  failures.push(`${seed} ${JSON.stringify(style)}: ${(e as Error).message}`);
                  continue;
                }
                const bad = checkPattern(d.pieces.filter((pc) => !pc.kind || pc.kind === 'collar')).filter((c) => !c.ok);
                if (bad.length) failures.push(`${seed} ${JSON.stringify(style)}: ${bad.map((c) => `${c.label} ${c.detail ?? ''}`).join('; ')}`);
                for (const pc of d.pieces) if (pc.outline.points().some((q) => !Number.isFinite(q.x + q.y))) failures.push(`${seed} ${pc.name} not finite`);
                if (seed <= 5) {
                  expect(outerFlat(d).views).toHaveLength(2);
                  expect(outerGuide(d, 2).steps.length).toBeGreaterThan(10);
                }
              }
            }
          }
        }
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});
