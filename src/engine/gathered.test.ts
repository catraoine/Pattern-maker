import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { GATHERS, GATHER_RATIO, draftSkirt } from './skirt';
import { draftDress } from './dress';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { dressGuide, sewingGuide } from './instructions';

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };

describe('gathered skirt', () => {
  it('cuts straight panels, the waist times the fit’s fullness, gathered into the band', () => {
    for (const fit of ['fitted', 'regular', 'relaxed'] as const) {
      const d = draftSkirt(m, { fit, silhouette: 'gathered', length: 'midi' });
      const [front, back] = d.pieces;
      const waist = 2 * (taggedLength(front.outline, 'waist') + taggedLength(back.outline, 'waist'));
      expect(d.gathers!.into).toBe(d.finishedWaist);
      expect(Math.abs(waist - Math.max(d.finishedWaist * GATHER_RATIO[fit], m.full_hip + 20))).toBeLessThan(0.6);
      expect(Math.abs(d.hemCm - waist)).toBeLessThan(0.6);
      expect(taggedLength(front.outline, 'side')).toBeCloseTo(taggedLength(back.outline, 'side'), 5);
      expect(front.fold).toBeDefined();
      expect(back.fold).toBeUndefined();
      expect(d.zipCm).toBeGreaterThan(0);
      expect(d.dartsPerSide).toEqual({ front: 0, back: 0 });
    }
  });

  it('takes the fullness chosen (In testing) in place of the fit’s, on a skirt and a fitted dress', () => {
    for (const gathers of ['soft', 'full', 'dramatic'] as const) {
      const d = draftSkirt(m, { fit: 'fitted', silhouette: 'gathered', length: 'midi', gathers });
      const [front, back] = d.pieces;
      const waist = 2 * (taggedLength(front.outline, 'waist') + taggedLength(back.outline, 'waist'));
      expect(Math.abs(waist - Math.max(d.finishedWaist * GATHERS[gathers], m.full_hip + 20))).toBeLessThan(0.6);
      expect(checkPattern(d.pieces).filter((c) => !c.ok)).toEqual([]);
    }
    const body = randomBody(rng(3));
    const soft = draftDress(body, { fit: 'fitted' }, { fit: 'fitted', silhouette: 'gathered', length: 'maxi' });
    const dramatic = draftDress(body, { fit: 'fitted' }, { fit: 'fitted', silhouette: 'gathered', length: 'maxi', gathers: 'dramatic' });
    expect(dramatic.skirt.gathers!.round).toBeGreaterThan(soft.skirt.gathers!.round * 1.5);
  });

  it('stays on folded fabric however big the waist, and always clears the hip', () => {
    const big = draftSkirt({ ...m, waist: 140, full_hip: 150 }, { fit: 'relaxed', silhouette: 'gathered', length: 'knee' });
    expect(big.gathers!.round / 4 + 2 * 1.5).toBeLessThanOrEqual(68.01);
    const small = draftSkirt({ ...m, waist: 50, full_hip: 110 }, { fit: 'fitted', silhouette: 'gathered', length: 'knee' });
    expect(small.gathers!.round).toBeGreaterThanOrEqual(130);
  });

  it('pulls on with elastic: the back on the fold, gathered into a casing that passes the hips', () => {
    const d = draftSkirt(m, { silhouette: 'gathered', length: 'knee', waist: 'elastic' });
    expect(d.elastic).toBeDefined();
    expect(d.zipCm).toBe(0);
    expect(d.pieces[1].fold).toBeDefined();
    expect(d.gathers!.into).toBeGreaterThanOrEqual(m.full_hip + 6);
    const g = sewingGuide(d, { silhouette: 'gathered', length: 'knee' }, 2);
    const titles = g.steps.map((s) => s.title);
    expect(titles.indexOf('Gather the waist')).toBeLessThan(titles.indexOf('Attach the waistband'));
    expect(g.steps.find((s) => s.title === 'Attach the waistband')!.text).not.toMatch(/nothing needs easing/);
  });

  it('gathers the waist before the band goes on, with no darts, and takes no pleats or high-low hem', () => {
    const d = draftSkirt(m, { silhouette: 'gathered', length: 'knee', pleats: 'box', asymHem: 'high_low', pockets: 'inseam' });
    expect(d.volume).toBeUndefined();
    expect(d.asym).toBeUndefined();
    expect(d.pocket).toBeDefined();
    const g = sewingGuide(d, { silhouette: 'gathered', length: 'knee' }, 2);
    const titles = g.steps.map((s) => s.title);
    expect(titles).not.toContain('Sew the darts');
    expect(titles.indexOf('Sew the side seams')).toBeLessThan(titles.indexOf('Gather the waist'));
    expect(titles.indexOf('Gather the waist')).toBeLessThan(titles.indexOf('Attach the waistband'));
    expect(checkPattern(d.pieces).filter((c) => !c.ok)).toEqual([]);
  });

  it('gathers into a dress bodice, on 60 random bodies', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 60; seed++) {
      const body = randomBody(rng(seed));
      const fit = (['fitted', 'regular', 'relaxed'] as const)[seed % 3];
      const d = draftDress(body, { fit }, { fit, silhouette: 'gathered', length: seed % 2 ? 'knee' : 'midi' });
      const seamRound = 2 * (taggedLength(d.bodice.pieces[0].outline, 'waist') + taggedLength(d.bodice.pieces[1].outline, 'waist'));
      if (Math.abs(d.skirt.gathers!.into - seamRound) > 1) failures.push(`${seed}: gathers into ${d.skirt.gathers!.into}, seam ${seamRound}`);
      for (const c of checkPattern(d.pieces, { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${seed} ${fit}: ${c.label} ${c.detail}`);
    }
    expect(failures.slice(0, 10)).toEqual([]);
    const d = draftDress(randomBody(rng(3)), {}, { silhouette: 'gathered', length: 'knee' });
    const g = dressGuide(d, { silhouette: 'gathered', length: 'knee' }, 3, 2);
    const titles = g.steps.map((s) => s.title);
    expect(titles.indexOf('Gather the waist')).toBe(titles.indexOf('Join the bodice to the skirt') - 1);
    expect(g.steps.find((s) => s.title === 'Join the bodice to the skirt')!.text).not.toMatch(/dart/);
  });
});
