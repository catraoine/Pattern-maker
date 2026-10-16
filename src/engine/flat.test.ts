import { describe, expect, it } from 'vitest';
import type { P } from './geometry';
import { DraftError, draftSkirt } from './skirt';
import { draftBodice } from './bodice';
import { randomArms, randomBody, rng } from './randomBodies';
import { SHAPES_FOR_LENGTH, draftSleeve } from './sleeve';
import { Flat, FlatView, bodiceFlat, skirtFlat } from './flat';

const xs = (pts: P[]) => pts.map((q) => q.x);
const width = (pts: P[]) => Math.max(...xs(pts)) - Math.min(...xs(pts));

/** Every number finite, each view mirror-symmetric about its centre, and the views side by side. */
function problems(f: Flat): string[] {
  const out: string[] = [];
  const all = f.views.flatMap((v) => [...v.shapes.flat(), ...v.lines.flatMap((l) => l.pts)]);
  if (all.some((q) => !Number.isFinite(q.x) || !Number.isFinite(q.y))) out.push('not finite');
  if (Math.min(...all.map((q) => q.y)) < -1e-6 || Math.max(...all.map((q) => q.y)) > f.height + 1e-6) out.push('outside its height');
  for (const v of f.views) {
    const s = v.shapes[0];
    const mid = (Math.min(...xs(s)) + Math.max(...xs(s))) / 2;
    const half = s.length / 2;
    for (let i = 0; i < half; i++) {
      const a = s[i];
      const b = s[s.length - 1 - i];
      if (Math.abs(a.x - mid + (b.x - mid)) > 1e-6 || Math.abs(a.y - b.y) > 1e-6) {
        out.push(`${v.label} not symmetric`);
        break;
      }
    }
  }
  const [front, back] = f.views;
  if (Math.max(...xs(front.shapes.flat())) >= Math.min(...xs(back.shapes.flat()))) out.push('views overlap');
  return out;
}

/** The view's width at height y: where its outline crosses that line, outermost. */
function across(v: FlatView, y: number): number {
  const s = v.shapes[0];
  const hits: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const a = s[i];
    const b = s[(i + 1) % s.length];
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) hits.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
  }
  return Math.max(...hits) - Math.min(...hits);
}

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };

describe('technical flats', () => {
  it('draws a darted skirt at its finished waist and hip, with the back zip and seam', () => {
    const d = draftSkirt(m, { silhouette: 'straight' });
    const f = skirtFlat(d);
    expect(problems(f)).toEqual([]);
    const [front, back] = f.views;
    // The waistband is as wide as the finished waist, front and back together.
    expect(Math.abs(width(front.shapes[1]) + width(back.shapes[1]) - d.finishedWaist)).toBeLessThan(1.5);
    // At the hip the skirt is its full finished hip.
    const hipY = front.at.y - d.lengthCm + 20.5 + 1.3 + 3;
    expect(across(front, hipY) + across(back, hipY)).toBeGreaterThan(d.finishedHip - 2);
    expect(across(front, hipY) + across(back, hipY)).toBeLessThan(d.finishedHip + 2);
    expect(front.lines.filter((l) => l.kind === 'dart')).toHaveLength(2 * d.dartsPerSide.front);
    expect(front.lines.some((l) => l.kind === 'zip')).toBe(false);
    expect(back.lines.filter((l) => l.kind === 'zip')).toHaveLength(1);
  });

  it('opens a walking slit at the foot of the centre back seam', () => {
    const f = skirtFlat(draftSkirt(m, { silhouette: 'pencil' }), { slit: true });
    const back = f.views[1];
    const cb = (back.shapes[0][0].x + back.shapes[0][back.shapes[0].length - 1].x) / 2;
    const feet = back.lines.filter((l) => l.kind === 'seam' && l.pts.length === 2 && Math.abs(l.pts[1].y - f.height) < 3 && l.pts[0].x === cb && l.pts[1].x !== cb);
    expect(feet).toHaveLength(2);
  });

  it('draws every skirt shape for 100 bodies', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 100; seed++)
      for (const silhouette of ['straight', 'pencil', 'a_line', 'trumpet', 'circle'] as const) {
        let d;
        try {
          d = draftSkirt(randomBody(rng(seed)), { silhouette, length: (['mini', 'knee', 'midi', 'maxi'] as const)[seed % 4] });
        } catch (e) {
          if (e instanceof DraftError) continue;
          throw e;
        }
        for (const p of problems(skirtFlat(d, { slit: silhouette === 'pencil' }))) failures.push(`seed ${seed} ${silhouette}: ${p}`);
      }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('draws a bodice with its front and back side seams the same length, and binding stitched round the edges', () => {
    const d = draftBodice(randomBody(rng(5)));
    const f = bodiceFlat(d, 'binding');
    expect(problems(f)).toEqual([]);
    const [front, back] = f.views;
    // Front and back meet at the waist: the front's bust dart is sewn.
    expect(Math.max(...front.shapes[0].map((q) => q.y))).toBeCloseTo(Math.max(...back.shapes[0].map((q) => q.y)), 0);
    const waist = f.height - 0.5;
    expect(across(front, waist) + across(back, waist)).toBeGreaterThan(d.finishedWaist - 3);
    expect(across(front, waist) + across(back, waist)).toBeLessThan(d.finishedWaist + 3);
    expect(front.lines.filter((l) => l.kind === 'stitch').length).toBeGreaterThanOrEqual(4);
    expect(bodiceFlat(d, 'lined').views[0].lines.some((l) => l.kind === 'stitch')).toBe(false);
  });

  it('draws 200 random bodices in every style', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      const style = {
        neckline: (['crew', 'scoop', 'v', 'square', 'boat'] as const)[seed % 5],
        length: (['waist', 'high_hip', 'hip'] as const)[(seed >> 1) % 3],
        darts: (['bust_waist', 'bust', 'none'] as const)[(seed >> 2) % 3],
        fit: (['fitted', 'regular', 'relaxed'] as const)[(seed >> 3) % 3],
      };
      const d = draftBodice(randomBody(rng(seed)), style);
      const f = bodiceFlat(d, (['binding', 'facings', 'lined'] as const)[seed % 3]);
      for (const p of problems(f)) failures.push(`seed ${seed} ${JSON.stringify(style)}: ${p}`);
      const [front, back] = f.views;
      const foot = (v: FlatView) => Math.max(...v.shapes[0].map((q) => q.y));
      if (Math.abs(foot(front) - foot(back)) > 2.5) failures.push(`seed ${seed} ${JSON.stringify(style)}: front ${foot(front).toFixed(1)} back ${foot(back).toFixed(1)}`);
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('hangs sleeves from both armholes, front and back, for 40 bodies in every length and shape', () => {
    const r = rng(31);
    for (let i = 0; i < 40; i++) {
      const b = randomBody(r);
      const d = draftBodice(b, { length: 'waist' });
      const arms = randomArms(b, r);
      for (const length of ['short', 'elbow', 'three_quarter', 'long'] as const)
        for (const shape of SHAPES_FOR_LENGTH[length]) {
          const sl = draftSleeve(d, arms, { length, shape, fit: 'regular', seamAllowance: 1.5, armholeAllowance: 1, hemAllowance: 2.5 });
          const f = bodiceFlat(d, 'binding', sl);
          expect(problems(f), `${length} ${shape}`).toEqual([]);
          for (const v of f.views) {
            // Body, then a sleeve each side (and a band each side when gathered), mirrored.
            expect(v.shapes.length).toBe(sl.gathers ? 5 : 3);
            const body = width(v.shapes[0]);
            const all = width(v.shapes.flat());
            expect(all).toBeGreaterThan(body + 2);
            const bottom = Math.max(...v.shapes.slice(1).flat().map((q) => q.y));
            // Every sleeve reaches well below the shoulders.
            expect(bottom).toBeGreaterThan(Math.min(...v.shapes[0].map((q) => q.y)) + 12);
          }
        }
    }
  });
});
