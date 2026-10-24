import { describe, expect, it } from 'vitest';
import { draftBodice } from './bodice';
import { draftDress } from './dress';
import { draftSkirt } from './skirt';
import { bodiceGuide, dressGuide, sewingGuide } from './instructions';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { bodiceFlat, dressFlat, skirtFlat } from './flat';
import { bodiceSpec, dressSpec, skirtSpec } from './spec';
import { describePattern } from '../screens/describe';
import { DEFAULT_BODICE, detailAllowed, validDetails } from '../garments';
import { edgesFor } from './corsetGuide';
import { wrapSkirtAllowed } from './wrapSkirt';

const ascii = (g: { steps: { title: string; text: string }[] }) => g.steps.filter((s) => /[^\x20-\x7e]/.test(s.title + s.text));

describe('wrap', () => {
  it('crosses over and ties, with no zip, on 40 random bodies, every seam matching', () => {
    const failures: string[] = [];
    for (let s = 1; s <= 40; s++) {
      const fit = (['fitted', 'regular', 'relaxed'] as const)[s % 3];
      const m = randomBody(rng(s));
      const d = draftBodice(m, { closure: 'wrap', fit, length: 'hip', neckline: 'scoop' });
      expect(d.closure).toBe('wrap');
      expect(d.zipCm).toBe(0);
      expect(d.wrap?.ties.outer).toBeGreaterThan(d.wrap!.ties.inner);
      const [front, back] = d.pieces;
      expect(front.cut).toBe('Cut 2 (1 pair)');
      expect(front.meta.wrap).toBe(true);
      expect(back.cut).toMatch(/on fold/i);
      // The edge crosses the centre front above the bust point, so the front covers the bust.
      expect(d.wrap!.cross.y).toBeLessThan(d.front.apex.y);
      for (const c of checkPattern(d.pieces.filter((pc) => !pc.kind))) if (!c.ok) failures.push(`${s} ${fit}: ${c.label} ${c.detail}`);
      const dress = draftDress(m, { closure: 'wrap', fit }, { silhouette: s % 2 ? 'a_line' : 'straight', length: 'knee' });
      expect(dress.zipCm).toBe(0);
      expect(dress.bodice.closure).toBe('wrap');
      for (const c of checkPattern(dress.pieces.filter((pc) => !pc.kind), { finishedWaist: dress.finishedWaist })) if (!c.ok) failures.push(`${s} dress: ${c.label} ${c.detail}`);
      const skirt = draftSkirt(m, { fit, silhouette: s % 2 ? 'a_line' : 'straight', length: 'knee', wrap: true });
      expect(skirt.zipCm).toBe(0);
      expect(skirt.wrap?.ties).toBeDefined();
      expect(skirt.waistband.cutLength).toBeGreaterThan(skirt.finishedWaist);
      for (const c of checkPattern(skirt.pieces.filter((pc) => !pc.kind), { finishedWaist: skirt.finishedWaist })) if (!c.ok) failures.push(`${s} skirt: ${c.label} ${c.detail}`);
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('keeps to a V neck at the waist, with no collar, princess seams or boning', () => {
    const c = { ...DEFAULT_BODICE, closure: 'wrap' as const };
    expect(detailAllowed(c, 'collar', 'mandarin')).toBe(false);
    expect(detailAllowed(c, 'princess', 'shoulder')).toBe(false);
    expect(detailAllowed(c, 'bustDart', 'neck')).toBe(false);
    const v = validDetails({ ...c, neckline: 'scoop', collar: 'peter_pan', length: 'hip' });
    expect(v.neckline).toBe('v');
    expect(v.collar).toBe('none');
    expect(v.length).toBe('waist');
    // Only a straight or A-line skirt wraps; a circle or pleats keep the zip.
    expect(wrapSkirtAllowed({ silhouette: 'a_line' })).toBe(true);
    expect(wrapSkirtAllowed({ silhouette: 'circle' })).toBe(false);
    expect(wrapSkirtAllowed({ silhouette: 'straight', pleats: 'knife' })).toBe(false);
    const m = randomBody(rng(3));
    expect(draftDress(m, { closure: 'wrap', fit: 'regular' }, { silhouette: 'circle', length: 'knee' }).bodice.closure).toBe('back_zip');
    expect(draftSkirt(m, { fit: 'regular', silhouette: 'circle', length: 'knee', wrap: true }).wrap).toBeUndefined();
  });

  it('sews up with ties and no zip, for every finish', () => {
    const m = randomBody(rng(4));
    const d = draftBodice(m, { closure: 'wrap', fit: 'regular', length: 'waist' });
    const dress = draftDress(m, { closure: 'wrap', fit: 'regular' }, { silhouette: 'a_line', length: 'knee' });
    for (const e of ['binding', 'facings', 'lined'] as const) {
      const edges = edgesFor(d, e);
      for (const g of [bodiceGuide(d, { length: 'waist' }, 1.2, 1, { edges }), dressGuide(dress, { silhouette: 'a_line', length: 'knee' }, 2.5, 1, { edges })]) {
        const titles = g.steps.map((s) => s.title);
        expect(new Set(titles).size).toBe(titles.length);
        expect(titles).toContain('Make the ties');
        expect(titles).toContain('Attach the ties');
        expect(titles.indexOf('Attach the ties')).toBeGreaterThan(titles.indexOf('Hem'));
        expect(titles).not.toContain('Put in the zip');
        expect(titles).not.toContain('Close the centre back');
        expect(g.steps.filter((s) => /zip|hook and eye|centre back edges/i.test(s.text))).toEqual([]);
        expect(ascii(g)).toEqual([]);
        expect(g.notions.some((n) => /zip/i.test(n))).toBe(false);
        expect(g.notions).toContain('A small snap');
      }
    }
    const dg = dressGuide(dress, { silhouette: 'a_line', length: 'knee' }, 2.5, 1, {});
    expect(dg.steps.map((s) => s.title)).toContain('Hem the skirt front edges');
    expect(dg.steps.find((s) => s.title === 'Cut out')!.text).toMatch(/skirt back on the fold, and the bodice front and the skirt front on both layers/);

    const skirt = draftSkirt(m, { fit: 'regular', silhouette: 'a_line', length: 'knee', wrap: true });
    const sg = sewingGuide(skirt, { silhouette: 'a_line', length: 'knee' }, 1.5, {});
    const st = sg.steps.map((s) => s.title);
    expect(st).toContain('Hem the front edges');
    expect(st).toContain('Make the tie hole');
    expect(st).not.toContain('Put in the zip');
    expect(sg.steps.filter((s) => /zip|hook and eye|HOOK/i.test(s.text))).toEqual([]);
    expect(ascii(sg)).toEqual([]);
  });

  it('is named, drawn and measured as a wrap', () => {
    const m = randomBody(rng(6));
    const d = draftBodice(m, { closure: 'wrap', fit: 'regular', length: 'waist' });
    const dress = draftDress(m, { closure: 'wrap', fit: 'regular' }, { silhouette: 'a_line', length: 'knee' });
    const skirt = draftSkirt(m, { fit: 'regular', silhouette: 'a_line', length: 'knee', wrap: true });
    expect(describePattern({ ...DEFAULT_BODICE, garment: 'bodice', closure: 'wrap' } as never)).toMatch(/wrap/i);
    expect(describePattern({ garment: 'dress', fit: 'regular', bodice: { ...DEFAULT_BODICE, closure: 'wrap' }, skirt: { fit: 'regular', silhouette: 'a_line', length: 'knee' } } as never)).toMatch(/A-line wrap dress/);
    expect(describePattern({ fit: 'regular', silhouette: 'a_line', length: 'knee', wrap: true } as never)).toMatch(/A-line wrap skirt/);
    for (const f of [bodiceFlat(d), dressFlat(dress), skirtFlat(skirt)]) expect(f.views.every((v) => !v.lines.some((l) => l.kind === 'zip'))).toBe(true);
    expect(bodiceSpec(m, d, 'waist').some((r) => /Wrap ties/.test(r.label))).toBe(true);
    expect(dressSpec(m, dress).some((r) => /zip/i.test(r.label))).toBe(false);
    expect(skirtSpec(m, skirt).some((r) => /Wrap ties/.test(r.label))).toBe(true);
  });
});
