import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { draftBodice } from './bodice';
import { draftDress } from './dress';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { KEYHOLE, backBlocked, backDepthFor } from './backNeck';
import { bodiceGuide, dressGuide } from './instructions';
import { bodiceFlat } from './flat';
import { DEFAULT_BODICE, describeBodice, detailAllowed, validDetails } from '../garments';
import type { SewingGuide } from './instructions';

const titles = (g: SewingGuide) => g.steps.map((s) => s.title);
const ascii = (g: SewingGuide) => g.steps.filter((s) => /[^\x20-\x7e]/.test(s.title + s.text)).map((s) => s.title);

describe('back details', () => {
  it('drafts a scoop, V and keyhole back on 30 random bodies, every seam still matching', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const b = randomBody(rng(seed));
      for (const back of ['scoop', 'v', 'keyhole'] as const) {
        const d = draftBodice(b, { fit: 'regular', back });
        const bk = d.pieces.find((pc) => pc.name === 'Bodice back')!;
        expect(bk.meta.backNeck).toBe(back);
        // A low back is cut down at the centre; the zip still fits below it.
        if (back !== 'keyhole') expect(d.back.neckCentre.y).toBeCloseTo(backDepthFor(back, b.nape_to_waist), 5);
        else expect(taggedLength(bk.outline, 'keyhole')).toBeGreaterThan(KEYHOLE.length);
        expect(d.back.zipEnd.y).toBeLessThanOrEqual(d.back.waistCentre.y);
        for (const c of checkPattern(d.pieces)) if (!c.ok) failures.push(`seed ${seed} ${back}: ${c.label} (${c.detail})`);
        const dr = draftDress(b, { fit: 'regular', back }, { silhouette: 'a_line', length: 'knee' });
        for (const c of checkPattern(dr.pieces)) if (!c.ok) failures.push(`seed ${seed} ${back} dress: ${c.label} (${c.detail})`);
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('steps aside for tops, collars, a back yoke and, for a keyhole, a button front', () => {
    expect(backBlocked({ neckline: 'strapless' }, 'v')).toBeDefined();
    expect(backBlocked({ neckline: 'crew', collar: 'mandarin' }, 'scoop')).toBeDefined();
    expect(backBlocked({ neckline: 'crew', yoke: { back: 8 } }, 'v')).toBeDefined();
    expect(backBlocked({ neckline: 'crew', closure: 'front_buttons' }, 'keyhole')).toBeDefined();
    expect(backBlocked({ neckline: 'crew', closure: 'front_buttons' }, 'v')).toBeUndefined();
    // A collar can't be picked over a low back either; a save with both keeps the back.
    expect(detailAllowed({ ...DEFAULT_BODICE, back: 'v' }, 'collar', 'mandarin')).toBe(false);
    expect(validDetails({ ...DEFAULT_BODICE, collar: 'mandarin', back: 'v' })).toMatchObject({ collar: 'none', back: 'v' });
    expect(draftBodice(randomBody(rng(1)), { neckline: 'cami', back: 'v' }).pieces.every((pc) => !pc.meta.backNeck)).toBe(true);
    expect(describeBodice({ ...DEFAULT_BODICE, back: 'v' })).toMatch(/with a V back$/);
  });

  it('is sewn and drawn', () => {
    const b = randomBody(rng(8));
    for (const back of ['scoop', 'v', 'keyhole'] as const) {
      const d = draftBodice(b, { fit: 'regular', back });
      for (const edges of ['binding', 'facings', 'lined'] as const) {
        const g = bodiceGuide(d, { length: 'waist' }, 1.5, 1, { edges });
        expect(titles(g)).toEqual([...new Set(titles(g))]);
        expect(ascii(g)).toEqual([]);
        if (back === 'keyhole') {
          expect(titles(g)).toContain('Bind the keyhole');
          expect(titles(g).indexOf('Sew on the keyhole button')).toBeLessThan(titles(g).indexOf('Finish'));
          expect(g.steps.find((s) => s.title === 'Put in the zip')?.text).toMatch(/foot of the keyhole/);
        } else expect(titles(g)[2]).toBe('Stay the back neckline');
      }
      const dr = draftDress(b, { fit: 'regular', back }, { silhouette: 'a_line', length: 'knee' });
      const g = dressGuide(dr, { silhouette: 'a_line', length: 'knee' }, 2, 1, {});
      expect(titles(g)).toEqual([...new Set(titles(g))]);
      expect(titles(g)).toContain(back === 'keyhole' ? 'Sew on the keyhole button' : 'Stay the back neckline');
      if (back === 'keyhole') expect(g.steps.find((s) => s.title === 'Put in the zip')?.text).toMatch(/foot of the keyhole/);
      expect(bodiceFlat(d).views[1].lines.length).toBeGreaterThan(0);
    }
  });
});
