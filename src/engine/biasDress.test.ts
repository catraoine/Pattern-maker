import { describe, expect, it } from 'vitest';
import { draftDress } from './dress';
import { dressGuide } from './instructions';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { dressFlat } from './flat';
import { taggedLength } from './geometry';
import { describePattern } from '../screens/describe';
import { DEFAULT_BODICE } from '../garments';
import { lookFabric } from '../collection';
import { EXAMPLE_BODY } from '../measurements';

// The bias slip dress (In testing, Cat 2026-11-11, SS27 Look 07): a shift's shape with no waist seam, each piece cut
// whole on the bias, no zip, and a slip's strap beside a low, narrow scoop.
const NECK = { frontDepth: 14.5, width: 3.5, backDepth: 18, fullness: 0.6, strap: 4 };
const bias = (m: Parameters<typeof draftDress>[0], length: 'knee' | 'midi' | 'maxi' = 'maxi') =>
  draftDress(m, { fit: 'regular', neckline: 'scoop', sleeve: 'none', darts: 'bust', neck: NECK }, { silhouette: 'straight', length, noSeam: 'bias', flareCm: 24, slit: 'none' });

describe('bias slip dress', () => {
  it('cuts front and back whole on the bias with no zip, on 40 random bodies, every seam matching', () => {
    const failures: string[] = [];
    for (let s = 1; s <= 40; s++) {
      const m = randomBody(rng(s));
      const d = bias(m, (['knee', 'midi', 'maxi'] as const)[s % 3]);
      expect(d.noSeam).toBe('bias');
      const cut = d.pieces.filter((pc) => !pc.kind);
      expect(cut.map((pc) => pc.name)).toEqual(['Dress front', 'Dress back']);
      for (const pc of cut) {
        expect(pc.meta.whole, pc.name).toBe(true);
        expect(pc.meta.bias, pc.name).toBe(true);
        expect(pc.cut).toBe('Cut 1, single layer, on the bias');
        expect(pc.fold).toBeUndefined();
        // Its grain at 45 degrees to the centre line.
        expect(Math.abs(pc.grain![1].x - pc.grain![0].x)).toBeCloseTo(Math.abs(pc.grain![1].y - pc.grain![0].y), 6);
        expect(pc.labels.some((l) => /ZIP/.test(l.text)), pc.name).toBe(false);
        // Both straps, each as wide as asked, front and back the same so they sew without easing.
        expect(taggedLength(pc.outline, 'shoulder') / 2).toBeCloseTo(4, 1);
      }
      expect(d.zipCm).toBe(0);
      expect(d.overHead).toBe(true);
      // No zip: nothing below the bust is smaller than the body's bust, or the draft says so.
      if (d.finishedWaist < m.full_bust) expect(d.warnings.join(' ')).toMatch(/over your head/);
      for (const c of checkPattern(cut, { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${s}: ${c.label} ${c.detail}`);
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it("runs the armhole in a hollow curve from the strap's end, never out past the underarm", () => {
    for (let s = 1; s <= 20; s++) {
      const d = bias(randomBody(rng(s)));
      for (const pc of d.bodice.pieces.filter((q) => !q.kind)) {
        const { pts, tags } = pc.outline.taggedPoints(16);
        const arm = pts.filter((_, i) => tags[i] === 'armhole');
        const under = arm[arm.length - 1].x;
        expect(Math.max(...arm.map((q) => q.x)), `${s} ${pc.name}`).toBeLessThanOrEqual(under + 0.05);
      }
    }
  });

  it('lets the scoop go lower than a shift lets it, to 2 cm above the bust point', () => {
    const m = randomBody(rng(3));
    const deep = { ...NECK, frontDepth: 40 };
    const slip = draftDress(m, { fit: 'regular', neckline: 'scoop', sleeve: 'none', darts: 'bust', neck: deep }, { silhouette: 'straight', length: 'maxi', noSeam: 'bias' });
    const shift = draftDress(m, { fit: 'regular', neckline: 'scoop', sleeve: 'none', darts: 'bust', neck: { ...deep, strap: undefined } }, { silhouette: 'straight', length: 'maxi', noSeam: 'shift' });
    const top = (d: typeof slip) => d.bodice.pieces[0].outline.start.y;
    expect(top(slip) - top(shift)).toBeCloseTo(3, 1);
    expect(slip.bodice.front.apex.y - top(slip)).toBeCloseTo(2, 1);
  });

  it('is sewn with no zip: stayed at the neck and armholes, hung, and its hem rolled', () => {
    const d = bias(randomBody(rng(7)));
    const g = dressGuide(d, { silhouette: 'straight', length: 'maxi' }, 3, 3, {});
    const titles = g.steps.map((st) => st.title);
    expect(titles).not.toContain('Put in the zip');
    expect(titles).not.toContain('Close the centre back');
    expect(titles).toContain('Stay the neckline and armholes');
    const all = g.steps.map((st) => st.text).join(' ');
    expect(all).not.toMatch(/zip|centre back|on the fold|hook and eye/i);
    expect(all).toMatch(/single layer/);
    expect(all).toMatch(/Hang the dress up for a day/);
    expect(g.notions.join(' ')).not.toMatch(/zip|hook/i);
    expect(g.notions.join(' ')).toMatch(/stay tape/i);
    expect(d.pieces[0].allowances.hem).toBe(3);
  });

  it('draws as a flat, and is named a bias slip dress', () => {
    const d = bias(randomBody(rng(9)));
    const flat = dressFlat(d);
    expect(flat.views.length).toBeGreaterThanOrEqual(2);
    expect(describePattern({ garment: 'dress', fit: 'regular', bodice: { ...DEFAULT_BODICE, neckline: 'scoop' }, skirt: { fit: 'regular', silhouette: 'straight', length: 'maxi', noSeam: 'bias' } })).toMatch(/bias slip dress/);
  });

  it('reads a sheer satin as a satin that is only faintly see-through', () => {
    expect(lookFabric('Ivory sheer silk satin')).toMatchObject({ fibre: 'silk', special: 'satin', seeThrough: 'faint' });
    expect(lookFabric('Gold python silk satin').seeThrough).toBeUndefined();
    expect(lookFabric('Ice sheer silk organza')).toMatchObject({ special: 'sheer' });
  });

  it('says so when the dress cut whole on the bias is wider than cloth is sold', () => {
    const wide = (flareCm: number, length: 'midi' | 'maxi') =>
      draftDress(EXAMPLE_BODY as Parameters<typeof draftDress>[0], { fit: 'regular', neckline: 'scoop', sleeve: 'none', darts: 'bust', neck: NECK }, { silhouette: 'straight', length, noSeam: 'bias', flareCm, slit: 'none' }).warnings.filter((w) => /wider than most cloth/.test(w));
    expect(wide(24, 'maxi')).toHaveLength(1);
    expect(wide(16, 'maxi')).toEqual([]);
    expect(wide(24, 'midi')).toEqual([]);
  });
});
