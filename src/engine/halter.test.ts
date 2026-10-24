import { describe, expect, it } from 'vitest';
import { draftBodice } from './bodice';
import { draftDress } from './dress';
import { bodiceGuide, dressGuide } from './instructions';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { bodiceFlat } from './flat';
import { bodiceSpec } from './spec';
import { describePattern } from '../screens/describe';
import { DEFAULT_BODICE, detailAllowed, validDetails } from '../garments';
import { HALTER } from './corset';

describe('halter neck', () => {
  it('rises to the neck with cut-in armholes, on 40 random bodies, every seam matching', () => {
    const failures: string[] = [];
    for (let s = 1; s <= 40; s++) {
      const fit = (['fitted', 'regular', 'relaxed'] as const)[s % 3];
      const m = randomBody(rng(s));
      const d = draftBodice(m, { neckline: 'halter', fit, length: (['waist', 'hip'] as const)[s % 2] });
      expect(d.top?.neckline).toBe('halter');
      expect(d.top?.boned).toBe(false);
      expect(d.top?.straps).toBeUndefined();
      const ties = d.top!.ties!;
      expect(ties.lengthCm).toBeGreaterThan(HALTER.tieTails);
      expect(ties.cutLengthCm).toBeGreaterThan(ties.lengthCm);
      const front = d.pieces.find((pc) => /front/i.test(pc.name))!;
      // The front reaches up to the neck: its top is well above the back's top edge.
      const top = (pts: { y: number }[]) => Math.min(...pts.map((q) => q.y));
      expect(top(front.outline.points(4))).toBeLessThan(d.back.neckCentre.y - 10);
      for (const c of checkPattern(d.pieces)) if (!c.ok) failures.push(`${s} ${fit}: ${c.label} ${c.detail}`);
      const dress = draftDress(m, { neckline: 'halter', fit }, { silhouette: 'a_line', length: 'knee' });
      for (const c of checkPattern(dress.pieces.filter((pc) => !pc.kind), { finishedWaist: dress.finishedWaist })) if (!c.ok) failures.push(`${s} dress: ${c.label} ${c.detail}`);
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('stays soft and sleeveless', () => {
    const c = { ...DEFAULT_BODICE, neckline: 'halter' as const };
    expect(detailAllowed(c, 'structure', 'boned')).toBe(false);
    expect(detailAllowed(c, 'sleeve', 'short')).toBe(false);
    expect(validDetails({ ...c, structure: 'boned' }).structure).toBe('none');
  });

  it('sews its ties on at the strap ends, for every finish', () => {
    const m = randomBody(rng(4));
    const d = draftBodice(m, { neckline: 'halter', fit: 'regular', length: 'waist' });
    for (const edges of ['binding', 'facings', 'lined'] as const) {
      const g = bodiceGuide(d, { length: 'waist' }, 1.2, 1, { edges });
      const titles = g.steps.map((s) => s.title);
      expect(new Set(titles).size).toBe(titles.length);
      expect(titles).toContain('Make the neck ties');
      expect(titles).not.toContain('Sew the shoulders');
      expect(titles.some((t) => /strap/i.test(t))).toBe(false);
      expect(edges === 'lined' ? titles.includes('Line the top edge') : titles.includes('Attach the ties')).toBe(true);
      expect(g.steps.filter((s) => /[^\x20-\x7e]/.test(s.title + s.text))).toEqual([]);
      expect(g.notions.some((n) => /ties/.test(n))).toBe(true);
    }
    const dress = draftDress(m, { neckline: 'halter', fit: 'regular' }, { silhouette: 'a_line', length: 'knee' });
    expect(dressGuide(dress, { silhouette: 'a_line', length: 'knee' }, 2.5, 1, {}).steps.map((s) => s.title)).toContain('Make the neck ties');
    expect(bodiceSpec(m, d, 'waist').some((r) => /Neck tie/.test(r.label))).toBe(true);
    expect(bodiceFlat(d).views[0].shapes.length).toBeGreaterThan(1);
    expect(describePattern({ ...DEFAULT_BODICE, neckline: 'halter' } as never)).toMatch(/halter bodice tied at the neck/);
  });
});
