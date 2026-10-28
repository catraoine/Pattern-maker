import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { checkPattern } from './qc';
import { randomBody, rng, sweep } from './randomBodies';
import { DraftError, draftSkirt, type Length } from './skirt';
import { draftDress } from './dress';
import { dressGuide, sewingGuide } from './instructions';
import { dressFlat, skirtFlat } from './flat';
import { skirtSpec } from './spec';
import { layPlan } from './layplan';
import { waistbandPiece } from './finishing';
import { rucheAllowed } from './ruche';
import { setSkirtDetail, skirtDetailAllowed, skirtDetailOf } from './skirtVolume';

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };
const LENGTHS: Length[] = ['above_knee', 'knee', 'midi', 'maxi'];

describe('ruched sides', () => {
  it('lengthens the side seams by half again below the hip, keeping the waist, the darts and the hem', () => {
    const plain = draftSkirt(m, { silhouette: 'pencil', length: 'knee' });
    const d = draftSkirt(m, { silhouette: 'pencil', length: 'knee', ruched: true });
    const r = d.ruche!;
    expect(r.from).toBe(23);
    expect(r.extra).toBeCloseTo((d.lengthCm - r.from) / 2, 0);
    for (const i of [0, 1]) {
      expect(taggedLength(d.pieces[i].outline, 'side') - taggedLength(plain.pieces[i].outline, 'side')).toBeCloseTo(r.extra, 1);
      expect(taggedLength(d.pieces[i].outline, 'waist')).toBeCloseTo(taggedLength(plain.pieces[i].outline, 'waist'), 3);
      expect(taggedLength(d.pieces[i].outline, 'hem')).toBeCloseTo(taggedLength(plain.pieces[i].outline, 'hem'), 3);
      expect(d.pieces[i].lines.map((l) => l.points())).toEqual(plain.pieces[i].lines.map((l) => l.points()));
    }
    expect(d.lengthCm).toBe(plain.lengthCm);
    expect(r.elastic).toBeLessThan(d.lengthCm - r.from);
    expect(checkPattern(d.pieces, { finishedWaist: d.finishedWaist }).filter((c) => !c.ok)).toEqual([]);
  });

  it('goes only on a straight or pencil skirt with plain side seams, one detail at a time', () => {
    expect(rucheAllowed({ silhouette: 'a_line' })).toBe(false);
    expect(rucheAllowed({ silhouette: 'pencil', pockets: 'inseam' })).toBe(false);
    expect(rucheAllowed({ silhouette: 'straight', slit: 'side' })).toBe(false);
    expect(skirtDetailAllowed({ silhouette: 'straight', length: 'knee', pleats: 'knife' }, 'ruched')).toBe(true);
    const c = setSkirtDetail({ silhouette: 'straight' as const, length: 'knee' as const, pleats: 'knife' as const }, 'ruched');
    expect(c).toEqual({ silhouette: 'straight', length: 'knee', ruched: true });
    expect(skirtDetailOf(setSkirtDetail(c, 'tiers'))).toBe('tiers');
    expect(draftSkirt(m, { silhouette: 'a_line', length: 'knee', ruched: true }).ruche).toBeUndefined();
    expect(draftSkirt(m, { silhouette: 'pencil', length: 'mini', lengthCm: 36, ruched: true }).ruche).toBeUndefined();
  });

  it('gives the elastic, the steps, the spec and drawings that stay in shape', () => {
    const st = { silhouette: 'straight' as const, length: 'midi' as const, ruched: true };
    const d = draftSkirt(m, st);
    const g = sewingGuide(d, st, 2);
    expect(g.notions.some((n) => /clear elastic/.test(n))).toBe(true);
    const t = g.steps.map((s) => s.title);
    expect(t.indexOf('Ruche the sides')).toBeGreaterThan(t.indexOf('Hem'));
    expect(skirtSpec(m, d).some((r) => /Ruched sides/.test(r.label))).toBe(true);
    // Drawn as worn: no longer than the plain skirt.
    const ys = (f: ReturnType<typeof skirtFlat>) => Math.max(...f.views[0].shapes.flat().map((q) => q.y));
    expect(ys(skirtFlat(d))).toBeCloseTo(ys(skirtFlat(draftSkirt(m, { ...st, ruched: undefined }))), 3);
    expect(skirtFlat(d).views[0].lines.length).toBeGreaterThan(skirtFlat(draftSkirt(m, { ...st, ruched: undefined })).views[0].lines.length);
  });

  it('ruches a seamed dress and a sheath, and passes every check for random bodies', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= sweep(40); seed++) {
      const body = randomBody(rng(seed + 4400));
      for (const length of LENGTHS)
        for (const silhouette of ['straight', 'pencil'] as const) {
          const tag = `${seed} ${silhouette} ${length}`;
          try {
            const d = draftSkirt(body, { fit: 'fitted', silhouette, length, ruched: true });
            if (!d.ruche) failures.push(`${tag}: skirt not ruched`);
            for (const c of checkPattern(d.pieces, { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${tag} skirt: ${c.label} ${c.detail}`);
            if (!layPlan([...d.pieces, waistbandPiece(d, 1.5)], 140)) failures.push(`${tag}: skirt does not lay out`);
            const dd = draftDress(body, { fit: 'fitted' }, { fit: 'fitted', silhouette, length, ruched: true });
            if (!dd.skirt.ruche) failures.push(`${tag}: dress not ruched`);
            for (const c of checkPattern(dd.pieces, { finishedWaist: dd.finishedWaist })) if (!c.ok) failures.push(`${tag} dress: ${c.label} ${c.detail}`);
            const sheath = draftDress(body, { fit: 'fitted' }, { fit: 'fitted', silhouette, length, ruched: true, noSeam: 'sheath' });
            if (!sheath.skirt.ruche) failures.push(`${tag}: sheath not ruched`);
            for (const c of checkPattern(sheath.pieces, { finishedWaist: sheath.finishedWaist })) if (!c.ok) failures.push(`${tag} sheath: ${c.label} ${c.detail}`);
            const sg = dressGuide(sheath, { silhouette, length }, 2.5, 0.8);
            if (!sg.steps.some((s) => s.title === 'Ruche the sides')) failures.push(`${tag}: sheath has no ruching step`);
            for (const v of dressFlat(sheath).views) for (const q of v.lines.flatMap((l) => l.pts)) if (!Number.isFinite(q.x + q.y)) failures.push(`${tag}: sheath flat`);
          } catch (e) {
            if (e instanceof DraftError) continue;
            throw e;
          }
        }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});
