import { describe, expect, it } from 'vitest';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng, sweep } from './randomBodies';
import { draftOuter } from './outerwear';
import { outerFlat } from './flat';
import { outerGuide } from './outerGuide';
import { outerSpec } from './spec';
import { CHEST, FLAP } from './jacketPockets';
import { EXAMPLE_VALUES } from '../measurements';

const m = EXAMPLE_VALUES as Parameters<typeof draftOuter>[0];
const names = (d: ReturnType<typeof draftOuter>) => d.pieces.map((pc) => pc.name);

describe('flap and chest pockets on jackets and coats', () => {
  it('cuts flap pockets where the welts go: the flap, its lining, the jets, a facing and the bags', () => {
    const welt = draftOuter(m, { kind: 'jacket', pockets: 'welt' });
    const d = draftOuter(m, { kind: 'jacket', pockets: 'flap' });
    expect(d.pocket?.kind).toBe('flap');
    expect(d.pocket?.h).toBeCloseTo(2 * FLAP.jet, 6);
    expect(d.pocket!.y).toBeCloseTo(welt.pocket!.y, 6);
    for (const n of ['Pocket flap', 'Flap lining', 'Jets', 'Pocket facing', 'Pocket bag']) expect(names(d)).toContain(n);
    const titles = outerGuide(d, 1.6).steps.map((s) => s.title);
    expect(titles).toContain('Make the flap pockets');
    expect(titles).not.toContain('Make the welt pockets');
    expect(outerFlat(d).views[0].lines.length).toBeGreaterThan(outerFlat(welt).views[0].lines.length);
    expect(outerSpec(m, d).some((r) => /Flap pockets/.test(r.label))).toBe(true);
  });

  it('places a chest welt on a princess front, clear of the lapel and rising toward the side', () => {
    for (const kind of ['jacket', 'coat'] as const) {
      const d = draftOuter(m, { kind, shaping: 'princess', chest: 'welt' });
      expect(d.chest).toBeDefined();
      const { a, b } = d.chest!;
      expect(a.y - b.y).toBeCloseTo(CHEST.rise, 6);
      expect(b.x - a.x).toBeGreaterThanOrEqual(CHEST.min);
      // Clear of the lapel as worn at that level.
      const lapelX = Math.max(...(d.lapel?.worn ?? []).filter((q) => Math.abs(q.y - a.y) < 1.5).map((q) => q.x));
      expect(a.x).toBeGreaterThan(lapelX);
      expect(names(d)).toEqual(expect.arrayContaining(['Chest welt', 'Chest pocket facing', 'Chest pocket bag']));
      expect(outerGuide(d, 2).steps.map((s) => s.title)).toContain('Make the chest pocket');
    }
  });

  it('leaves no chest pocket where the bust darts run, and the jacket as it was without the new pockets', () => {
    expect(draftOuter(m, { kind: 'jacket', shaping: 'darts', chest: 'welt' }).chest).toBeUndefined();
    const a = draftOuter(m, { kind: 'jacket' });
    const b = draftOuter(m, { kind: 'jacket', chest: 'none' });
    expect(JSON.stringify(b.pieces)).toBe(JSON.stringify(a.pieces));
  });

  it('passes every check for random bodies', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= sweep(40); seed++) {
      const r = rng(seed + 52000);
      const b = randomBody(r);
      const body = { ...b, ...randomArms(b, r) } as Parameters<typeof draftOuter>[0];
      for (const kind of ['jacket', 'coat'] as const)
        for (const shaping of ['darts', 'princess'] as const) {
          const d = draftOuter(body, { kind, shaping, pockets: 'flap', chest: 'welt' });
          const plain = draftOuter(body, { kind, shaping });
          const known = new Set(checkPattern(plain.pieces).filter((c) => !c.ok).map((c) => c.label + c.detail));
          for (const c of checkPattern(d.pieces)) if (!c.ok && !known.has(c.label + c.detail)) failures.push(`seed ${seed} ${kind} ${shaping}: ${c.label} (${c.detail})`);
          if (d.chest) expect(d.chest.b.x - d.chest.a.x).toBeGreaterThanOrEqual(CHEST.min - 1e-6);
        }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});
