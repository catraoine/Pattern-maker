import { describe, expect, it } from 'vitest';
import type { P } from './geometry';
import { draftSkirt } from './skirt';
import { draftBodice } from './bodice';
import { bodiceFacings, liningPieces, waistbandPiece } from './finishing';
import { FABRIC_WIDTHS, Lay, layPlan, layPlans } from './layplan';
import { randomBody, rng } from './randomBodies';

const inside = (q: P, pts: P[]) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};

/** Every piece on the fabric, none overlapping another, fold pieces on the fold. */
function problems(lay: Lay): string[] {
  const out: string[] = [];
  for (const pl of lay.placements) {
    for (const q of pl.pts) if (q.x < -0.01 || q.x > lay.across + 0.01 || q.y < -0.01) out.push(`${pl.name} off the fabric`);
  }
  for (let y = 0.25; y < lay.length; y += 0.5)
    for (let x = 0.25; x < lay.across; x += 0.5) {
      const n = lay.placements.filter((pl) => inside({ x, y }, pl.pts)).length;
      if (n > 1) out.push(`overlap at ${x}, ${y}`);
    }
  return [...new Set(out)].slice(0, 5);
}

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };

describe('cutting layouts', () => {
  it('lays an A-line skirt on folded fabric, the front on the fold, nothing overlapping', () => {
    const d = draftSkirt(m);
    const pieces = [...d.pieces, waistbandPiece(d, 1.5)];
    for (const w of FABRIC_WIDTHS) {
      const lay = layPlan(pieces, w)!;
      expect(lay.folded).toBe(true);
      expect(problems(lay)).toEqual([]);
      const front = lay.placements.find((pl) => pl.name === 'Skirt front')!;
      expect(Math.min(...front.pts.map((q) => q.x))).toBeCloseTo(0, 6);
      expect(lay.placements.find((pl) => pl.name === 'Waistband')!.single).toBe(true);
      // A pair is never cut along the fold, or its two pieces would stay joined.
      for (const pl of lay.placements.filter((pl) => pl.name !== 'Skirt front')) expect(Math.min(...pl.pts.map((q) => q.x))).toBeGreaterThan(0.4);
      expect(lay.metres).toBeGreaterThan(d.lengthCm / 100);
      expect(lay.metres).toBeLessThan(3);
      expect(lay.efficiency).toBeGreaterThan(0.4);
      expect(lay.efficiency).toBeLessThanOrEqual(1);
    }
  });

  it('needs no more fabric on wider widths', () => {
    const d = draftSkirt(m, { silhouette: 'a_line', length: 'midi' });
    const pieces = [...d.pieces, waistbandPiece(d, 1.5)];
    const [a, b, c] = FABRIC_WIDTHS.map((w) => layPlan(pieces, w)!.length);
    expect(b).toBeLessThanOrEqual(a + 0.5);
    expect(c).toBeLessThanOrEqual(b + 0.5);
  });

  it('keeps every piece the same way up for a fabric with a nap', () => {
    const d = draftSkirt(m, { silhouette: 'a_line' });
    const lay = layPlan(d.pieces, 140, 'self', true)!;
    expect(lay.placements.some((pl) => pl.turned)).toBe(false);
    expect(problems(lay)).toEqual([]);
    expect(lay.length).toBeGreaterThanOrEqual(layPlan(d.pieces, 140)!.length - 0.01);
  });

  it('opens the fabric out for a circle skirt too wide for the fold, unfolding the front', () => {
    const d = draftSkirt(m, { silhouette: 'circle', length: 'knee' });
    const lay = layPlan(d.pieces, 115);
    if (!lay) return; // a full circle may not fit 115 cm at all
    expect(lay.folded).toBe(false);
    expect(problems(lay)).toEqual([]);
    expect(lay.placements.length).toBeGreaterThanOrEqual(3);
  });

  it('lays the lining separately, and a lined bodice in both fabrics', () => {
    const d = draftSkirt(m);
    const lining = draftSkirt(m, { lengthCm: d.lengthCm - 2.5 });
    const lays = layPlans([...d.pieces, ...liningPieces(lining), waistbandPiece(d, 1.5)], 140);
    expect(lays.map((l) => l.fabric)).toEqual(['self', 'lining']);
    expect(lays[1].placements.map((pl) => pl.name).sort()).toEqual(['Lining back', 'Lining front']);
    const b = draftBodice(randomBody(rng(3)));
    const lined = b.pieces.map((pc) => ({ ...pc, fabric: 'Self fabric and lining' }));
    expect(layPlans(lined, 140).map((l) => l.fabric)).toEqual(['self', 'lining']);
  });

  it('lays 100 random bodices with facings without overlaps', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const b = draftBodice(randomBody(rng(seed)), { neckline: (['crew', 'scoop', 'v', 'square', 'boat'] as const)[seed % 5] });
      const lay = layPlan([...b.pieces, ...bodiceFacings(b.pieces[0], b.pieces[1])], (FABRIC_WIDTHS as readonly (115 | 140 | 150)[])[seed % 3])!;
      expect(problems(lay), `seed ${seed}`).toEqual([]);
    }
  });
});
