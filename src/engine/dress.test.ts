import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { DRESS_ZIPS, ZIP_BELOW_WAIST, draftDress, waistDartAt } from './dress';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng } from './randomBodies';
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
    for (let seed = 1; seed <= 150; seed++) {
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
});
