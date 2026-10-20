import { describe, expect, it } from 'vitest';
import { draftBodice } from './bodice';
import { SHAPES_FOR_LENGTH, SLEEVE_EASE, SleeveLength, VENT_CM, draftSleeve } from './sleeve';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng } from './randomBodies';
import { DraftError } from './skirt';

const body = { full_bust: 92, high_bust: 86, waist: 76, neck: 35, shoulder_width: 38, shoulder_length: 12, across_back: 35, across_front: 32, nape_to_waist: 41, front_hps_to_waist: 44, bust_depth: 26, apex_separation: 18, armscye: 40 };
const arms = { arm_length: 59, upper_arm: 29, wrist: 16 };
const style = { seamAllowance: 1.5, armholeAllowance: 1, hemAllowance: 2.5 };
const lengths = ['short', 'elbow', 'three_quarter', 'long'] as const;

describe('set-in sleeves', () => {
  it('fits the crown to the armhole with the crown ease for the fit, a little more at the back', () => {
    for (const fit of ['fitted', 'regular', 'relaxed'] as const) {
      const b = draftBodice(body, { fit });
      const d = draftSleeve(b, arms, { ...style, length: 'long', shape: 'straight', fit });
      expect(d.crownEase.front + d.crownEase.back).toBeCloseTo(SLEEVE_EASE[fit].crown, 0);
      expect(d.crownEase.back).toBeGreaterThan(d.crownEase.front);
      expect(d.bicep).toBeCloseTo(arms.upper_arm + SLEEVE_EASE[fit].bicep, 0);
      expect(d.armhole.front + d.armhole.back).toBeCloseTo(b.armhole, 0);
      expect(d.capHeight).toBeGreaterThan(10);
      expect(d.capHeight).toBeLessThan(20);
      expect(d.lengthCm).toBe(60);
      expect(d.warnings).toEqual([]);
    }
  });

  it('turns a fitted long sleeve forward at the elbow with a trued dart, and gathers puff and bishop sleeves into a band', () => {
    const b = draftBodice(body);
    const long = draftSleeve(b, arms, { ...style, length: 'long', shape: 'fitted', fit: 'regular' });
    expect(long.elbowDart).toBe(2);
    // The elbow dart and the vent's tick.
    expect(long.pieces[0].lines).toHaveLength(2);
    expect(long.pieces[0].lines[0].points()).toHaveLength(3);
    const puff = draftSleeve(b, arms, { ...style, length: 'short', shape: 'puff', fit: 'regular' });
    expect(puff.pieces.map((pc) => pc.name)).toEqual(['Sleeve', 'Sleeve band']);
    expect(puff.gathers!.crown).toBeGreaterThan(8);
    expect(puff.hemCm).toBe(arms.upper_arm + 4);
    const bishop = draftSleeve(b, arms, { ...style, length: 'long', shape: 'bishop', fit: 'regular' });
    expect(bishop.gathers!.hem).toBeGreaterThan(20);
    expect(bishop.gathers!.crown).toBeUndefined();
  });

  it('asks for arm measurements, and refuses a shape the length does not allow', () => {
    const b = draftBodice(body);
    expect(() => draftSleeve(b, {}, { ...style, length: 'long', shape: 'straight', fit: 'regular' })).toThrow(DraftError);
    expect(() => draftSleeve(b, arms, { ...style, length: 'short', shape: 'bishop', fit: 'regular' })).toThrow(DraftError);
  });

  it('passes the seam check on 120 random bodies, every length, shape and fit', () => {
    const failures: string[] = [];
    let widened = 0;
    let total = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const r = rng(seed * 977);
      const b = randomBody(rng(seed));
      const a = randomArms(b, r);
      const fit = (['fitted', 'regular', 'relaxed'] as const)[seed % 3];
      const bd = draftBodice(b, { fit, neckline: (['crew', 'scoop', 'v', 'square', 'boat'] as const)[seed % 5] });
      for (const length of lengths)
        for (const shape of SHAPES_FOR_LENGTH[length as SleeveLength]) {
          const d = draftSleeve(bd, a, { ...style, length, shape, fit });
          total++;
          if (d.warnings.length) widened++;
          const pts = d.pieces[0].outline.points();
          if (pts.some((q) => !Number.isFinite(q.x) || !Number.isFinite(q.y))) failures.push(`seed ${seed} ${length} ${shape}: not finite`);
          for (const c of checkPattern([...bd.pieces, ...d.pieces]).filter((c) => /Sleeve/.test(c.label)))
            if (!c.ok) failures.push(`seed ${seed} ${fit} ${length} ${shape}: ${c.label} (${c.detail})`);
        }
    }
    expect(failures.slice(0, 10)).toEqual([]);
    // Widening to reach the armhole is for unusual arms, not the norm.
    expect(widened / total).toBeLessThan(0.05);
  });

  it('gives a fitted long sleeve a wrist vent on the back seam, and brings its hem back to the wrist', () => {
    const b = draftBodice(body);
    for (const wrist of [13, 15, 16, 18]) {
      const d = draftSleeve(b, { ...arms, wrist }, { ...style, length: 'long', shape: 'fitted', fit: 'regular' });
      expect(d.vent).toEqual({ lengthCm: VENT_CM, at: 'back seam' });
      // Wrist plus 6 cm, and no less than 20 cm round.
      expect(d.hemCm).toBeGreaterThanOrEqual(20);
      expect(d.hemCm).toBeGreaterThanOrEqual(wrist + 6 - 0.2);
      expect(d.hemCm).toBeLessThan(Math.max(wrist + 6, 20) + 1);
      const pc = d.pieces[0];
      // The vent is marked: its label, a tick into the sleeve at its top, and a notch on the back seam there.
      expect(pc.labels.some((l) => l.text === 'VENT')).toBe(true);
      const tick = pc.lines.find((ln) => ln.points().length === 2)!;
      expect(tick).toBeDefined();
      const top = tick.points()[0];
      const notch = pc.notches.find(([q]) => Math.hypot(q.x - top.x, q.y - top.y) < 1e-6)!;
      expect(notch).toBeDefined();
      expect(notch[1].x).toBeLessThan(0); // out of the piece, to the back
      // The vent top sits VENT_CM up the back seam from the hem corner, on the stitching line.
      const { pts, tags } = pc.outline.taggedPoints(48);
      const backSeam = pts.filter((_, i) => tags[i] === 'sleeve-back' || tags[i - 1] === 'sleeve-back');
      const hemCorner = backSeam.reduce((lo, q) => (q.y > lo.y ? q : lo));
      expect(Math.hypot(top.x - hemCorner.x, top.y - hemCorner.y)).toBeCloseTo(VENT_CM, 1);
      expect(checkPattern([...b.pieces, ...d.pieces]).filter((c) => /Sleeve/.test(c.label) && !c.ok)).toEqual([]);
    }
    // Other sleeves have no vent: a three-quarter fitted sleeve, a bishop, and a jacket sleeve.
    expect(draftSleeve(b, arms, { ...style, length: 'three_quarter', shape: 'fitted', fit: 'regular' }).vent).toBeUndefined();
    expect(draftSleeve(b, arms, { ...style, length: 'long', shape: 'bishop', fit: 'regular' }).vent).toBeUndefined();
    expect(draftSleeve(b, arms, { ...style, length: 'long', shape: 'fitted', fit: 'regular', outer: 'jacket' }).vent).toBeUndefined();
  });
});
