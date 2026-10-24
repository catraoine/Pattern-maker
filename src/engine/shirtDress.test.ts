import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { BUTTONS_STOP_ABOVE_HEM, buttonsOnSkirt, draftDress } from './dress';
import { dressGuide } from './instructions';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { dressFlat } from './flat';
import { describePattern } from '../screens/describe';
import { DEFAULT_BODICE } from '../garments';

const shirt = { fit: 'regular' as const, closure: 'front_buttons' as const, collar: 'shirt' as const };

describe('shirt dress', () => {
  it('buttons from the neck down the skirt, on 40 random bodies, every seam matching', () => {
    const failures: string[] = [];
    for (let s = 1; s <= 40; s++) {
      const silhouette = (['a_line', 'straight', 'gathered', 'trumpet'] as const)[s % 4];
      const d = draftDress(randomBody(rng(s)), shirt, { silhouette, length: s % 2 ? 'knee' : 'midi' });
      expect(d.zipCm).toBe(0);
      expect(d.bodice.closure).toBe('front_buttons');
      const names = d.pieces.map((pc) => `${pc.name}: ${pc.cut}`);
      expect(names).toEqual(expect.arrayContaining(['Skirt front: Cut 2 (1 pair)', 'Skirt back: Cut 1 on fold', 'Bodice back: Cut 1 on fold', 'Skirt front facing: Cut 2 (1 pair)', 'Collar stand: Cut 2 on fold']));
      const front = d.pieces.find((pc) => pc.name === 'Skirt front')!;
      const facing = d.pieces.find((pc) => pc.name === 'Skirt front facing')!;
      // The facing runs the full length of the opening it faces.
      expect(taggedLength(facing.outline, 'opening')).toBeCloseTo(taggedLength(front.outline, 'opening'), 0);
      const hemCF = Math.max(...front.outline.points(4).filter((q) => Math.abs(q.x) < 1e-6).map((q) => q.y));
      const at = d.skirtButtons!.at;
      expect(at.length).toBeGreaterThanOrEqual(2);
      expect(at[at.length - 1]).toBeLessThanOrEqual(hemCF - BUTTONS_STOP_ABOVE_HEM + 1e-6);
      expect(front.meta.buttons).toEqual(at);
      for (const c of checkPattern(d.pieces.filter((pc) => !pc.kind || pc.kind === 'collar'), { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${s} ${silhouette}: ${c.label} ${c.detail}`);
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('zips as before when the skirt can’t carry the buttons', () => {
    expect(buttonsOnSkirt({ silhouette: 'circle' })).toBe(false);
    expect(buttonsOnSkirt({ silhouette: 'a_line', pleats: 'box' })).toBe(false);
    expect(buttonsOnSkirt({ silhouette: 'a_line', asymHem: 'high_low' })).toBe(false);
    const d = draftDress(randomBody(rng(2)), shirt, { silhouette: 'circle', length: 'knee' });
    expect(d.bodice.closure).toBe('back_zip');
    expect(d.skirtButtons).toBeUndefined();
    expect(d.zipCm).toBeGreaterThan(0);
  });

  it('sews with one long facing, buttonholes down the skirt, and no zip', () => {
    const d = draftDress(randomBody(rng(3)), shirt, { silhouette: 'a_line', length: 'knee' });
    for (const edges of ['binding', 'facings', 'lined'] as const) {
      const g = dressGuide(d, { silhouette: 'a_line', length: 'knee' }, 2.5, 1, { edges });
      const titles = g.steps.map((s) => s.title);
      expect(new Set(titles).size).toBe(titles.length);
      expect(g.steps.filter((s) => /zip/i.test(s.title + s.text)).map((s) => s.title)).toEqual([]);
      expect(titles).not.toContain('Sew the skirt centre front');
      expect(titles.indexOf('Join the front facings at the waist')).toBeLessThan(titles.indexOf('Attach the front facings'));
      expect(titles.indexOf('Hem')).toBeLessThan(titles.indexOf('Make the buttonholes'));
      const total = d.bodice.buttons!.count + d.skirtButtons!.count;
      expect(g.steps.find((s) => s.title === 'Make the buttonholes')!.text).toMatch(new RegExp(`^Work ${total} buttonholes`));
      expect(g.notions.some((n) => /zip/.test(n))).toBe(false);
      expect(g.steps.filter((s) => /[^\x20-\x7e]/.test(s.title + s.text))).toEqual([]);
    }
    expect(dressFlat(d).views[1].lines.some((l) => l.kind === 'zip')).toBe(false);
    expect(describePattern({ garment: 'dress', fit: 'regular', bodice: { ...DEFAULT_BODICE, closure: 'front_buttons', collar: 'shirt' }, skirt: { fit: 'regular', silhouette: 'a_line', length: 'knee' } } as never)).toMatch(/shirt dress with a shirt collar/);
  });
});
