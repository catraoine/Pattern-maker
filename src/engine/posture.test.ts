import { describe, expect, it } from 'vitest';
import { add, len, p, sub } from './geometry';
import { draftBodice } from './bodice';
import { DraftError, centreDrops, draftSkirt } from './skirt';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { checkMeasurements } from '../measurements';

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };
const centreWaist = (pc: { outline: { start: { y: number } } }) => pc.outline.start.y;

describe('centre front and back waist to hip', () => {
  it('raises the centre front for a tummy and lowers the centre back for a sway back', () => {
    const d = draftSkirt({ ...m, front_waist_to_hip: 22.5, back_waist_to_hip: 18.5 });
    expect(centreWaist(d.pieces[0])).toBeCloseTo(-2, 9);
    expect(centreWaist(d.pieces[1])).toBeCloseTo(2, 9);
    expect(d.pieces[0].draft!.points[0].note).toMatch(/2\.0 cm above/);
  });

  it('keeps the standard drops without them, and caps a big difference at 4 cm', () => {
    expect(centreDrops(m)).toEqual({ front: 0, back: 1 });
    expect(centreDrops({ ...m, back_waist_to_hip: 10 }).back).toBe(4);
    expect(checkMeasurements({ ...m, back_waist_to_hip: 10 }, 'cm', 'skirt').some((c) => c.id === 'back_waist_to_hip')).toBe(true);
  });

  it('passes the seam check for 300 random bodies with their own posture, every block shape', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 300; seed++) {
      const r = rng(seed * 7919);
      const body = randomBody(rng(seed));
      const posture = { ...body, front_waist_to_hip: body.waist_to_hip + (r() * 6 - 2), back_waist_to_hip: body.waist_to_hip + (r() * 5 - 3) };
      for (const silhouette of ['straight', 'pencil', 'a_line', 'trumpet'] as const) {
        let d;
        try {
          d = draftSkirt(posture, { silhouette, length: 'knee' });
        } catch (e) {
          if (e instanceof DraftError) continue;
          throw e;
        }
        for (const c of checkPattern(d.pieces, { finishedWaist: d.finishedWaist }))
          if (!c.ok) failures.push(`seed ${seed} ${silhouette}: ${c.label} (${c.detail})`);
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});

describe('shoulder slope', () => {
  const body = randomBody(rng(11));
  const standard = draftBodice(body);
  // What each slope measures on the standard draft: centre waist to shoulder point.
  const nw = body.neck / 5 - 0.2;
  const at = (from: { x: number; y: number }, length: number, deg: number) =>
    add(from, p(length * Math.cos((deg * Math.PI) / 180), length * Math.sin((deg * Math.PI) / 180)));
  const backReach = (deg: number) => len(sub(at(p(nw, -2), body.shoulder_length + 1, deg), p(0, body.nape_to_waist)));
  const frontReach = (deg: number) => len(sub(at(p(nw - 0.2, -2), body.shoulder_length, deg), standard.front.waistCentre));

  it('gives the standard angles when the slopes match a standard figure', () => {
    const d = draftBodice({ ...body, back_shoulder_slope: backReach(18), front_shoulder_slope: frontReach(22) });
    expect(d.shoulderSlope.back).toBeCloseTo(18, 1);
    expect(d.shoulderSlope.front).toBeCloseTo(22, 1);
  });

  it('squares the shoulder for a longer slope and drops it for a shorter one', () => {
    const square = draftBodice({ ...body, back_shoulder_slope: backReach(12), front_shoulder_slope: frontReach(15) });
    const sloping = draftBodice({ ...body, back_shoulder_slope: backReach(26), front_shoulder_slope: frontReach(28) });
    expect(square.shoulderSlope.back).toBeCloseTo(12, 1);
    expect(square.shoulderSlope.front).toBeCloseTo(15, 1);
    expect(sloping.shoulderSlope.back).toBeCloseTo(26, 1);
    expect(sloping.shoulderSlope.front).toBeCloseTo(28, 1);
    expect(square.warnings).toEqual([]);
  });

  it('falls back to the standard angle with a warning when the slope cannot be met', () => {
    const d = draftBodice({ ...body, back_shoulder_slope: body.nape_to_waist - 5 });
    expect(d.shoulderSlope.back).toBe(18);
    expect(d.warnings.some((w) => /back shoulder slope/.test(w))).toBe(true);
  });

  it('passes the seam check for 300 random bodies with square to sloping shoulders, every style', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 300; seed++) {
      const r = rng(seed * 104729);
      const b = randomBody(rng(seed));
      const std = draftBodice(b);
      const bnw = b.neck / 5 - 0.2;
      const back = len(sub(at(p(bnw, -2), b.shoulder_length + 1, 10 + r() * 18), p(0, b.nape_to_waist)));
      const front = len(sub(at(p(bnw - 0.2, -2), b.shoulder_length, 12 + r() * 18), std.front.waistCentre));
      const style = {
        neckline: (['crew', 'scoop', 'v', 'square', 'boat'] as const)[seed % 5],
        length: (['waist', 'high_hip', 'hip'] as const)[(seed >> 1) % 3],
        darts: (['bust_waist', 'bust', 'none'] as const)[(seed >> 2) % 3],
        fit: (['fitted', 'regular', 'relaxed'] as const)[(seed >> 3) % 3],
      };
      const d = draftBodice({ ...b, back_shoulder_slope: back, front_shoulder_slope: front }, style);
      for (const c of checkPattern(d.pieces, { finishedWaist: d.finishedWaist }))
        if (!c.ok) failures.push(`seed ${seed} ${JSON.stringify(style)}: ${c.label} (${c.detail})`);
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});
