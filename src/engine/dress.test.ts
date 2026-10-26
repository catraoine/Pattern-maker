import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { DRESS_ZIPS, ZIP_BELOW_WAIST, draftDress, waistDartAt } from './dress';
import { roundDress } from './allRound';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng, sweep } from './randomBodies';
import { DraftError } from './skirt';
import { draftSleeve } from './sleeve';
import { dressGuide } from './instructions';
import { toCouture } from './couture';
import { dressFlat } from './flat';
import { dressSpec } from './spec';
import { SEAM_WIDTHS } from './allowances';
import type { SewingGuide } from './instructions';

const titles = (g: SewingGuide) => g.steps.map((s) => s.title);
const plain = (g: SewingGuide) => g.steps.filter((s) => /[^\x20-\x7e]/.test(s.title + s.text) || /\.\./.test(s.text)).map((s) => s.title);

describe('the dress', () => {
  it('drafts the skirt to the bodice: waist seams the same, darts in one line, one long zip', () => {
    const b = randomBody(rng(7));
    const d = draftDress(b, { fit: 'regular' }, { silhouette: 'a_line', length: 'knee' });
    const [bf, bb, sf, sb] = d.pieces;
    expect(d.pieces.map((pc) => pc.name)).toEqual(['Bodice front', 'Bodice back', 'Skirt front', 'Skirt back']);
    expect(Math.abs(taggedLength(bf.outline, 'waist') - taggedLength(sf.outline, 'waist'))).toBeLessThan(0.01);
    expect(Math.abs(taggedLength(bb.outline, 'waist') - taggedLength(sb.outline, 'waist'))).toBeLessThan(0.01);
    expect(Math.abs(waistDartAt(bf)! - waistDartAt(sf)!)).toBeLessThan(0.3);
    expect(Math.abs(waistDartAt(bb)! - waistDartAt(sb)!)).toBeLessThan(0.3);
    expect(DRESS_ZIPS).toContain(d.zipCm);
    expect(d.zipBelowWaist).toBeGreaterThanOrEqual(ZIP_BELOW_WAIST);
    // The bodice's zip mark moves down to the skirt.
    expect(bb.labels.some((l) => l.text === 'ZIP ENDS')).toBe(false);
    expect(sb.labels.some((l) => l.text === 'ZIP ENDS')).toBe(true);
    const labels = dressSpec(b, d).map((r) => r.label);
    expect(labels).toContain('Length, nape to hem');
    expect(labels.filter((l) => /zip/i.test(l))).toHaveLength(1);
    expect(labels.some((l) => /Waistband/.test(l))).toBe(false);
  });

  it('passes the seam check for 150 random bodies in every skirt shape and fit', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= sweep(150); seed++) {
      const body = randomBody(rng(seed));
      for (const fit of ['fitted', 'regular', 'relaxed'] as const)
        for (const silhouette of ['straight', 'pencil', 'a_line', 'trumpet', 'half_circle', 'circle'] as const) {
          let d;
          try {
            d = draftDress(body, { fit, darts: fit === 'relaxed' && seed % 2 ? 'bust' : 'bust_waist' }, { fit, silhouette, length: seed % 2 ? 'knee' : 'midi' });
          } catch (e) {
            if (e instanceof DraftError) continue;
            throw e;
          }
          for (const c of checkPattern(d.pieces, { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${seed} ${fit} ${silhouette}: ${c.label} ${c.detail}`);
        }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('writes the steps in dress order, quick and couture, with every finish and sleeves', () => {
    const r = rng(12);
    const body = randomBody(r);
    const arms = randomArms(body, r);
    const d = draftDress(body, {}, { silhouette: 'pencil', length: 'knee' });
    for (const sleeved of [false, true])
      for (const edges of ['binding', 'facings', 'lined'] as const) {
        const sleeve = sleeved ? draftSleeve(d.bodice, arms, { length: 'elbow', shape: 'straight', fit: 'regular', seamAllowance: 1.5, armholeAllowance: 1, hemAllowance: 2.5 }) : undefined;
        const g = dressGuide(d, { silhouette: 'pencil', length: 'knee' }, 2.2, 1.2, { edges, sleeve, seams: SEAM_WIDTHS.couture });
        const t = titles(g);
        expect(plain(g)).toEqual([]);
        expect(new Set(t).size).toBe(t.length);
        expect(t.indexOf('Sew the skirt darts')).toBeLessThan(t.indexOf('Join the bodice to the skirt'));
        expect(t.indexOf('Join the bodice to the skirt')).toBeLessThan(t.indexOf('Put in the zip'));
        expect(t.indexOf('Put in the zip')).toBeLessThan(t.indexOf('Sew the side seams'));
        expect(t[t.length - 2]).toBe('Hem');
        expect(g.steps.find((s) => s.title === 'Close the centre back')!.text).toContain('walking slit');
        expect(g.notions).toContain(`${d.zipCm} cm invisible zip`);
        expect(g.steps.map((s) => s.text).join(' ')).not.toMatch(/waistband|ZIP ENDS notch,/);
        if (sleeved) expect(t).toContain('Set in the sleeves');
        else if (edges === 'binding') expect(t).toContain('Bind the armholes');
        const c = toCouture(g, { garment: 'dress', cloth: 'wool', lined: edges === 'lined', traced: true, zipCm: d.zipCm });
        const ct = titles(c);
        expect(plain(c)).toEqual([]);
        expect(ct.indexOf('Stay the waist')).toBe(ct.indexOf('Join the bodice to the skirt') + 1);
        expect(ct).toContain('Hand-pick the zip');
        expect(c.steps.find((s) => s.title === 'Sew the skirt darts')!.text).toContain('front darts toward the centre front');
        expect(c.notions.some((n) => /grosgrain/.test(n))).toBe(true);
        expect(c.steps[c.steps.length - 1].text).not.toContain('final press.');
      }
  });

  it('draws the flat with the skirt hanging from the bodice and one zip', () => {
    const r = rng(3);
    for (let i = 0; i < 30; i++) {
      const body = randomBody(r);
      for (const silhouette of ['a_line', 'circle'] as const) {
        const d = draftDress(body, {}, { silhouette });
        const f = dressFlat(d, 'binding');
        const all = f.views.flatMap((v) => v.shapes.flat());
        expect(all.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))).toBe(true);
        const back = f.views[1];
        expect(back.lines.filter((l) => l.kind === 'zip')).toHaveLength(1);
        const zip = back.lines.find((l) => l.kind === 'zip')!;
        expect(Math.abs(zip.pts[1].y - zip.pts[0].y - d.zipCm)).toBeLessThan(1e-6);
        // Nape to hem, drawn to scale.
        expect(f.height).toBeGreaterThan(d.lengthCm - 3);
      }
    }
  });

  it('hems an A-line dress skirt narrowly, and a pencil one deep, and says so in the steps', () => {
    const body = randomBody(rng(7));
    for (const [silhouette, depth, more] of [['a_line', 2, 1], ['pencil', 4, 3]] as const) {
      const d = draftDress(body, {}, { silhouette, length: 'knee' });
      expect(d.skirt.pieces[0].allowances.hem).toBe(depth);
      const hem = dressGuide(d, { silhouette, length: 'knee' }, 2, 0.5).steps.find((s) => s.title === 'Hem')!;
      expect(hem.text).toMatch(new RegExp(`^Press up 1 cm, then ${more} cm more`));
    }
  });

  describe('with a raised waist', () => {
    it('cuts the bodice under the bust and drafts the skirt from there, hem where it was', () => {
      const b = randomBody(rng(7));
      const style = { fit: 'regular', darts: 'bust_waist' } as const;
      const skirt = { fit: 'regular', silhouette: 'a_line', length: 'mini' } as const;
      const n = draftDress(b, style, skirt);
      const d = draftDress(b, style, skirt, 'empire');
      expect(d.seamDrop).toBeLessThan(-4);
      expect(d.seamDrop).toBe(d.seamRange.min);
      const [bf, bb, sf, sb] = d.pieces;
      expect(Math.abs(taggedLength(bf.outline, 'waist') - taggedLength(sf.outline, 'waist'))).toBeLessThan(0.01);
      expect(Math.abs(taggedLength(bb.outline, 'waist') - taggedLength(sb.outline, 'waist'))).toBeLessThan(0.01);
      // The bodice dart stays open in the seam and the skirt dart sits under it.
      expect(Math.abs(waistDartAt(bf)! - waistDartAt(sf)!)).toBeLessThan(0.3);
      // The bodice ends higher, the skirt is longer, and the hem lands near the same place.
      const low = (pcs: typeof d.pieces) => Math.max(...pcs[0].outline.points().map((q) => q.y));
      expect(low(d.pieces)).toBeLessThan(low(n.pieces) + d.seamDrop + 1);
      expect(d.skirt.lengthCm).toBeGreaterThan(n.skirt.lengthCm - d.seamDrop - 3);
      expect(d.zipBelowWaist).toBeGreaterThanOrEqual(ZIP_BELOW_WAIST - d.seamDrop - 0.01 - (d.zipCm === DRESS_ZIPS[DRESS_ZIPS.length - 1] ? 99 : 0));
      const r = roundDress(d, b);
      expect(r.rings[0](0)).toBeLessThan(d.seamDrop + 2);
      expect(r.seamsMeet).toBe(true);
      // Halfway, and any dragged height within reach.
      expect(draftDress(b, style, skirt, 'raised').seamDrop).toBeCloseTo(d.seamDrop / 2, 0);
      expect(draftDress(b, style, skirt, { cm: -3 }).seamDrop).toBe(-3);
      expect(draftDress(b, style, skirt, { cm: -99 }).seamDrop).toBe(d.seamDrop);
      expect(draftDress(b, style, skirt, { cm: 99 }).seamDrop).toBeCloseTo(d.seamRange.max, 1);
    });

    it('keeps a princess-seamed or draped bodice at the waist', () => {
      const b = randomBody(rng(3));
      expect(draftDress(b, { fit: 'regular', princess: 'armhole' }, { silhouette: 'a_line', length: 'knee' }, 'empire').seamDrop).toBe(0);
      expect(draftDress(b, { fit: 'regular', neckline: 'cowl' }, { silhouette: 'a_line', length: 'knee' }, 'empire').seamDrop).toBe(0);
    });

    it('passes the seam check for 60 random bodies at empire, raised and low seams', () => {
      const failures: string[] = [];
      for (let seed = 1; seed <= sweep(60); seed++) {
        const body = randomBody(rng(seed));
        for (const at of ['empire', 'raised', 'low'] as const)
          for (const fit of ['fitted', 'regular', 'relaxed'] as const)
            for (const silhouette of ['straight', 'a_line', 'half_circle', 'slip'] as const) {
              let d;
              try {
                d = draftDress(body, { fit, darts: fit === 'relaxed' && seed % 2 ? 'bust' : 'bust_waist' }, { fit, silhouette, length: seed % 2 ? 'above_knee' : 'maxi' }, at);
              } catch (e) {
                if (e instanceof DraftError) continue;
                throw e;
              }
              if (at !== 'low' && d.seamDrop >= 0) failures.push(`${seed} ${at}: not raised`);
              for (const c of checkPattern(d.pieces, { finishedWaist: d.skirt.finishedWaist })) if (!c.ok) failures.push(`${seed} ${at} ${fit} ${silhouette}: ${c.label} ${c.detail}`);
            }
      }
      expect(failures.slice(0, 10)).toEqual([]);
    });
  });

  describe('with a dropped waist', () => {
    it('joins the skirt at the high hip, its hem where the natural-waist dress ends', () => {
      const b = randomBody(rng(7));
      const style = { fit: 'relaxed', darts: 'bust' } as const;
      const skirt = { fit: 'relaxed', silhouette: 'a_line', length: 'midi' } as const;
      const n = draftDress(b, style, skirt);
      const d = draftDress(b, style, skirt, 'dropped');
      expect(d.seamDrop).toBeCloseTo(b.waist_to_hip / 2, 0);
      expect(n.seamDrop).toBe(0);
      // A midi still ends at the mid-calf: the skirt is shorter by the drop, the bodice longer.
      expect(Math.abs(d.lengthCm - n.lengthCm)).toBeLessThan(1);
      expect(d.skirt.lengthCm).toBeCloseTo(n.skirt.lengthCm - d.seamDrop, 0);
      const [bf, bb, sf, sb] = d.pieces;
      expect(Math.abs(taggedLength(bf.outline, 'waist') - taggedLength(sf.outline, 'waist'))).toBeLessThan(0.01);
      expect(Math.abs(taggedLength(bb.outline, 'waist') - taggedLength(sb.outline, 'waist'))).toBeLessThan(0.01);
      // The bodice's hem is now the seam: sewn with a seam allowance, not turned up.
      expect(bf.outline.tags).not.toContain('hem');
      expect(bf.allowances.hem).toBeUndefined();
      expect(d.zipBelowWaist).toBeGreaterThanOrEqual(ZIP_BELOW_WAIST);
      // On the form, the ring round the body sits at the dropped seam and the hem as long as before.
      const r = roundDress(d, b);
      expect(r.rings[0](0)).toBeGreaterThan(d.seamDrop - 2);
      expect(Math.abs(r.lengthAt(0) - roundDress(n, b).lengthAt(0))).toBeLessThan(1.5);
      expect(r.seamsMeet).toBe(true);
      const g = dressGuide(d, skirt, 2.5, 1);
      expect(g.steps.find((s) => s.title === 'Join the bodice to the skirt')!.text).toMatch(/high hip/);
    });

    it('passes the seam check for 150 random bodies in every skirt shape and fit', () => {
      const failures: string[] = [];
      for (let seed = 1; seed <= sweep(150); seed++) {
        const body = randomBody(rng(seed));
        for (const fit of ['fitted', 'regular', 'relaxed'] as const)
          for (const silhouette of ['straight', 'pencil', 'a_line', 'trumpet', 'half_circle', 'circle', 'slip'] as const) {
            let d;
            try {
              d = draftDress(body, { fit, darts: fit === 'relaxed' && seed % 2 ? 'bust' : 'bust_waist' }, { fit, silhouette, length: seed % 2 ? 'knee' : 'midi' }, 'dropped');
            } catch (e) {
              if (e instanceof DraftError) continue;
              throw e;
            }
            for (const c of checkPattern(d.pieces, { finishedWaist: d.skirt.finishedWaist })) if (!c.ok) failures.push(`${seed} ${fit} ${silhouette}: ${c.label} ${c.detail}`);
          }
      }
      expect(failures.slice(0, 10)).toEqual([]);
    });
  });
});
