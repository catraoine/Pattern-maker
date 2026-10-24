import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { draftBodice } from './bodice';
import { draftDress } from './dress';
import { draftSkirt } from './skirt';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { BOW } from './collar';
import { BELT, beltOf, beltPieces, dressBelt, skirtBelt, withBelt } from './belt';
import { bodiceGuide, dressGuide, sewingGuide } from './instructions';
import { bodiceFlat, dressFlat, skirtFlat } from './flat';
import { DEFAULT_BODICE, describeBodice, detailAllowed } from '../garments';
import type { SewingGuide } from './instructions';

const titles = (g: SewingGuide) => g.steps.map((s) => s.title);
const ascii = (g: SewingGuide) => g.steps.filter((s) => /[^\x20-\x7e]/.test(s.title + s.text)).map((s) => s.title);

describe('the pussy bow', () => {
  it('is drafted to the neckline on 30 random bodies, crew and V, its neck edge matching', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const b = randomBody(rng(seed));
      for (const neckline of ['crew', 'v'] as const) {
        const d = draftBodice(b, { fit: 'regular', neckline, collar: 'bow' });
        expect(d.collar).toBe('bow');
        const bow = d.pieces.find((pc) => pc.name === 'Bow')!;
        // The tie runs on past the centre front.
        expect(taggedLength(bow.outline, 'collar')).toBeGreaterThan(BOW.tie);
        for (const c of checkPattern(d.pieces)) if (!c.ok) failures.push(`seed ${seed} ${neckline}: ${c.label} (${c.detail})`);
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('goes only on a crew or V neck with the zip at the back', () => {
    const b = randomBody(rng(2));
    expect(draftBodice(b, { neckline: 'scoop', collar: 'bow' }).collar).toBe('none');
    expect(draftBodice(b, { closure: 'front_buttons', collar: 'bow' }).collar).toBe('none');
    expect(detailAllowed({ ...DEFAULT_BODICE, neckline: 'v' }, 'collar', 'bow')).toBe(true);
    expect(detailAllowed({ ...DEFAULT_BODICE, closure: 'front_buttons' }, 'collar', 'bow')).toBe(false);
    expect(describeBodice({ ...DEFAULT_BODICE, collar: 'bow' })).toMatch(/pussy-bow bodice/);
  });

  it('finishes the neck itself, and is sewn and drawn', () => {
    const d = draftBodice(randomBody(rng(5)), { fit: 'regular', collar: 'bow' });
    for (const edges of ['binding', 'facings', 'lined'] as const) {
      const g = bodiceGuide(d, { length: 'waist' }, 1.5, 1, { edges });
      expect(titles(g)).toContain('Make the bow ties');
      expect(titles(g)).toContain('Attach the bow');
      expect(titles(g)).not.toContain('Bind the neckline');
      expect(titles(g)).not.toContain('Face the neckline');
      expect(ascii(g)).toEqual([]);
      // No interfacing in a soft bias bow.
      expect(g.notions.some((n) => /interfacing/.test(n))).toBe(edges === 'facings');
    }
    const plain = bodiceFlat(draftBodice(randomBody(rng(5)), { fit: 'regular' }));
    expect(bodiceFlat(d).views[0].shapes.length).toBeGreaterThan(plain.views[0].shapes.length + 2);
  });
});

describe('the sash and belt loops', () => {
  it('cuts the sash to the waist plus two ties, and the loops to what they hold', () => {
    const b = beltOf('sash_loops', 72)!;
    expect(b.sash!.lengthCm).toBe(72 + 2 * BELT.sash.tie);
    expect(b.loops!.count).toBe(2);
    const own = beltOf('loops', 72)!;
    expect(own.sash).toBeUndefined();
    expect(own.loops!.count).toBe(4);
    expect(own.loops!.cutCm).toBe(BELT.loop.own + BELT.loop.ease + 2 * BELT.loop.turn);
    const [sash, loops] = beltPieces(b, 1.5);
    expect(sash.name).toBe('Sash');
    // Two halves, each half the sash.
    expect(taggedLength(sash.outline, 'centre')).toBeCloseTo(2 * BELT.sash.width, 5);
    expect(loops.name).toBe('Belt loops');
    expect(beltOf('none', 72)).toBeUndefined();
  });

  it('is left off a wrap, and loops off an elastic waist', () => {
    const m = randomBody(rng(4));
    expect(skirtBelt('sash', draftSkirt(m, { silhouette: 'a_line', length: 'knee', wrap: true }))).toBeUndefined();
    expect(skirtBelt('sash', draftSkirt(m, { silhouette: 'a_line', length: 'knee', waist: 'elastic' }))?.kind).toBe('sash');
    expect(skirtBelt('loops', draftSkirt(m, { silhouette: 'a_line', length: 'knee', waist: 'elastic' }))).toBeUndefined();
    const wrap = draftDress(m, { fit: 'regular', closure: 'wrap' }, { silhouette: 'a_line', length: 'knee' });
    expect(dressBelt('sash', wrap)).toBeUndefined();
  });

  it('is sewn and drawn on a skirt and on dresses with and without a waist seam', () => {
    const m = randomBody(rng(6));
    const sk = draftSkirt(m, { silhouette: 'a_line', length: 'knee' });
    for (const kind of ['sash', 'sash_loops', 'loops'] as const) {
      const belt = skirtBelt(kind, sk)!;
      const g = withBelt(sewingGuide(sk, { silhouette: 'a_line', length: 'knee' }, 1.5), belt, { band: true });
      expect(titles(g)).toEqual([...new Set(titles(g))]);
      expect(titles(g).includes('Make the sash')).toBe(kind !== 'loops');
      expect(titles(g).includes('Sew on the belt loops')).toBe(kind !== 'sash');
      expect(ascii(g)).toEqual([]);
      expect(skirtFlat(sk, belt).views[0].shapes.length).toBeGreaterThan(skirtFlat(sk).views[0].shapes.length);
    }
    for (const style of [{}, { noSeam: 'shift' as const }]) {
      const d = draftDress(m, { fit: 'regular' }, { silhouette: 'a_line', length: 'knee', ...style });
      const belt = dressBelt('sash_loops', d)!;
      const g = withBelt(dressGuide(d, { silhouette: 'a_line', length: 'knee' }, 2, 1, {}), belt, { band: false });
      expect(titles(g).indexOf('Make the sash')).toBeLessThan(titles(g).indexOf('Finish'));
      const flat = dressFlat(d, 'binding', { belt });
      // The sash and its knot on the front, the sash and two loops on the back.
      expect(flat.views[1].shapes.length).toBe(dressFlat(d).views[1].shapes.length + 3);
      expect(flat.views[0].shapes.length).toBe(dressFlat(d).views[0].shapes.length + 6);
    }
  });
});
