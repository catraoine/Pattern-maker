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

describe('sleeve length anywhere, cap and flutter sleeves', () => {
  const b = draftBodice(body);
  const polyLen = (pts: { x: number; y: number }[]) => pts.slice(1).reduce((s, q, i) => s + Math.hypot(q.x - pts[i].x, q.y - pts[i].y), 0);
  const edge = (d: ReturnType<typeof draftSleeve>, tag: string) => {
    const { pts, tags } = d.pieces[0].outline.taggedPoints(24);
    return pts.filter((_, i) => tags[i] === tag || (i > 0 && tags[i - 1] === tag));
  };

  it('sets the length anywhere from just below the underarm to the wrist, keeping the crown', () => {
    const named = draftSleeve(b, arms, { ...style, length: 'elbow', shape: 'straight', fit: 'regular' });
    expect(named.length.cm).toBe(named.lengthCm);
    expect(named.length.named.long).toBe(60);
    for (const cm of [named.length.min, 30, 40, 50, named.length.max]) {
      const length = cm < 32 ? 'short' : cm < 43 ? 'elbow' : cm < 53 ? 'three_quarter' : 'long';
      const d = draftSleeve(b, arms, { ...style, length, shape: 'straight', fit: 'regular', lengthCm: cm });
      expect(d.lengthCm).toBeCloseTo(cm, 0);
      expect(d.capHeight).toBeCloseTo(named.capHeight, 0);
      expect(d.crownEase.front + d.crownEase.back).toBeCloseTo(named.crownEase.front + named.crownEase.back, 0);
      expect(checkPattern([...b.pieces, ...d.pieces]).filter((c) => /Sleeve/.test(c.label) && !c.ok)).toEqual([]);
    }
    // Past the ends, it stops at the underarm plus 3 cm and at the wrist.
    expect(draftSleeve(b, arms, { ...style, length: 'short', shape: 'straight', fit: 'regular', lengthCm: 2 }).lengthCm).toBeCloseTo(named.length.min, 0);
    expect(draftSleeve(b, arms, { ...style, length: 'long', shape: 'straight', fit: 'regular', lengthCm: 90 }).lengthCm).toBe(60);
  });

  it('narrows a fitted sleeve smoothly between the named lengths, and darts it only well past the elbow', () => {
    const at = (length: 'elbow' | 'three_quarter' | 'long', cm?: number) => draftSleeve(b, arms, { ...style, length, shape: 'fitted', fit: 'regular', ...(cm ? { lengthCm: cm } : {}) });
    const e = at('elbow');
    const q = at('three_quarter');
    const mid = at('three_quarter', (e.lengthCm + q.lengthCm) / 2 + 1);
    expect(mid.hemCm).toBeLessThan(e.hemCm + 0.5);
    expect(mid.hemCm).toBeGreaterThan(q.hemCm - 0.5);
    expect(at('long', 52).vent).toBeDefined();
  });

  it('cuts a cap sleeve 2.5 cm below the underarm with a small hem, and ignores the slider', () => {
    const d = draftSleeve(b, arms, { ...style, length: 'short', shape: 'cap', fit: 'regular', lengthCm: 40 });
    expect(d.lengthCm).toBeCloseTo(d.capHeight + 2.5, 1);
    expect(d.pieces).toHaveLength(1);
    expect(d.pieces[0].allowances.hem).toBe(1.5);
    expect(d.pieces[0].meta.cap).toBe(true);
  });

  it('fans a flutter out to twice the bicep at the hem, with matching underseams and a narrow hem', () => {
    const plain = draftSleeve(b, arms, { ...style, length: 'short', shape: 'straight', fit: 'regular' });
    const d = draftSleeve(b, arms, { ...style, length: 'short', shape: 'flutter', fit: 'regular' });
    expect(d.hemCm).toBeCloseTo(d.bicep * 2, 0);
    expect(d.crownEase.front + d.crownEase.back).toBeCloseTo(plain.crownEase.front + plain.crownEase.back, 1);
    expect(polyLen(edge(d, 'sleeve-front'))).toBeCloseTo(polyLen(edge(d, 'sleeve-back')), 1);
    expect(d.pieces[0].allowances.hem).toBe(1);
    expect(d.pieces[0].meta.flutter).toBe(true);
    // Longer on the slider, it still fans to twice the bicep.
    const long = draftSleeve(b, arms, { ...style, length: 'short', shape: 'flutter', fit: 'regular', lengthCm: 26 });
    expect(long.lengthCm).toBe(26);
    expect(long.hemCm).toBeCloseTo(long.bicep * 2, 0);
  });
});
