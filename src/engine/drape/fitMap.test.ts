import { describe, expect, it } from 'vitest';
import { drapeDesign, type SweepDesign } from '../../drapeSweep';
import type { Saved } from '../../savedWork';

// The fit map (Cat's D, 2026-11-07): read off the garment as sewn, and pinned to the pattern's own ease, so it never
// disagrees with the measurement table.
const SHEATH: SweepDesign = {
  garment: 'dress',
  saved: { dress: { garment: 'dress', fit: 'fitted', bodice: { garment: 'bodice', fit: 'fitted', neckline: 'crew', length: 'waist', darts: 'bust_waist', sleeve: 'none', sleeveShape: 'straight', closure: 'back_zip', collar: 'none' }, skirt: { fit: 'fitted', silhouette: 'pencil', length: 'knee', asymHem: 'none' }, waistSeam: 'natural' } as Saved['dress'] },
  fibre: 'wool',
};
// The plunge slip (Look 07, live Nov 11): no whole ring at the bust, as the V is open there.
const PLUNGE_SLIP: SweepDesign = {
  garment: 'dress',
  saved: { dress: { garment: 'dress', fit: 'regular', bodice: { garment: 'bodice', fit: 'regular', neckline: 'plunge', length: 'waist', darts: 'bust_waist', sleeve: 'none', sleeveShape: 'straight', back: 'v' }, skirt: { fit: 'regular', silhouette: 'slip', length: 'maxi' } } as Saved['dress'] },
  fibre: 'cotton',
};
const A_LINE: SweepDesign = { garment: 'skirt', saved: { choices: { fit: 'regular', silhouette: 'a_line', length: 'knee', asymHem: 'none' } as Saved['choices'] }, fibre: 'wool' };

describe('the fit map', () => {
  it("labels the bust, waist and hip with the pattern's own ease", () => {
    const d = drapeDesign(SHEATH);
    expect(d.fitTags?.map((t) => t.name)).toEqual(['Bust', 'Waist', 'Hip']);
    // A fitted sheath: a few cm at each, never negative.
    for (const t of d.fitTags ?? []) expect(t.ease).toBeGreaterThan(0);
    for (const t of d.fitTags ?? []) expect(t.ease).toBeLessThan(8);
  }, 120_000);

  it('reads every point of the body of a garment, and never tighter than the cloth can go round', () => {
    const d = drapeDesign(SHEATH);
    const body = d.panels.filter((p) => p.role !== 'collar' && !p.hidden);
    let read = 0;
    let all = 0;
    for (const p of body)
      for (let i = 0; i < p.uv.length / 2; i++) {
        all++;
        const v = d.fit![p.base + i];
        if (Number.isFinite(v)) read++;
        // (A sheath drafted with ease is nowhere tight.)
        if (Number.isFinite(v)) expect(v).toBeGreaterThan(-0.5);
      }
    expect(read / all).toBeGreaterThan(0.95);
  }, 120_000);

  it('reads a flared skirt loose at its hem and close at its waist', () => {
    const d = drapeDesign(A_LINE);
    const pts = d.panels.flatMap((p) => Array.from({ length: p.uv.length / 2 }, (_, i) => p.base + i));
    const at = (lo: number, hi: number) => {
      const vs = pts.filter((k) => d.pos[k * 3 + 1] >= lo && d.pos[k * 3 + 1] < hi).map((k) => d.fit![k]).filter(Number.isFinite);
      return vs.reduce((a, v) => a + v, 0) / vs.length;
    };
    expect(at(2, 5)).toBeLessThan(5);
    expect(at(50, 58)).toBeGreaterThan(20);
  }, 120_000);

  it('reads a plunge bodice by its bust ease, not tight (CLO found it fine, Nov 11)', () => {
    const d = drapeDesign(PLUNGE_SLIP);
    expect(d.fitTags?.map((t) => t.name)).toEqual(['Bust', 'Waist', 'Hip']);
    // (Between the bust line and the waist seam: cm below the waist, as the form's levels run.)
    for (const p of d.panels.filter((p) => p.role !== 'collar' && !p.hidden))
      for (let i = 0; i < p.uv.length / 2; i++) {
        const k = p.base + i;
        const c = d.pos[k * 3 + 1];
        if (c < -17 || c > -2) continue;
        const v = d.fit![k];
        if (Number.isFinite(v)) expect(v).toBeGreaterThan(1.5);
      }
  }, 120_000);
});
