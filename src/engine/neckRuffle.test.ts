import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { draftBodice } from './bodice';
import { draftDress } from './dress';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { RUFFLE } from './collar';
import { SHIRR } from './shirred';
import { bodiceGuide, dressGuide } from './instructions';
import { bodiceFlat } from './flat';
import { DEFAULT_BODICE, describeBodice, detailAllowed, validDetails } from '../garments';
import { bodiceFabrics } from './fabrics';
import type { SewingGuide } from './instructions';

const titles = (g: SewingGuide) => g.steps.map((s) => s.title);
const ascii = (g: SewingGuide) => g.steps.filter((s) => /[^\x20-\x7e]/.test(s.title + s.text)).map((s) => s.title);

describe('ruffle neckline', () => {
  it('gathers into every neckline that rings the neck, on 30 random bodies', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const m = randomBody(rng(seed));
      for (const neckline of ['crew', 'scoop', 'v', 'square'] as const) {
        const d = draftBodice(m, { fit: 'regular', neckline, collar: 'ruffle' });
        expect(d.collar).toBe('ruffle');
        for (const c of checkPattern(d.pieces)) if (!c.ok) failures.push(`seed ${seed} ${neckline}: ${c.label} (${c.detail})`);
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('is cut twice the neckline, folded, and basted in before the neck is finished', () => {
    const m = randomBody(rng(4));
    const d = draftBodice(m, { fit: 'regular', neckline: 'v', collar: 'ruffle' });
    const r = d.pieces.find((pc) => pc.name === 'Neck ruffle')!;
    expect(r.cut).toBe('Cut 1 on fold');
    expect(taggedLength(r.outline, 'neck')).toBeCloseTo(RUFFLE.ratio * (d.neck / 2), 0);
    for (const edges of ['binding', 'facings'] as const) {
      const t = titles(bodiceGuide(d, { length: 'waist' }, 1.5, 1, { edges }));
      expect(t.indexOf('Attach the ruffle')).toBeGreaterThan(t.indexOf('Make the ruffle'));
      expect(t.indexOf('Attach the ruffle')).toBeLessThan(t.indexOf(edges === 'binding' ? 'Bind the neckline' : 'Face the neckline'));
    }
    const g = bodiceGuide(d, { length: 'waist' }, 1.5, 1, { edges: 'binding' });
    expect(g.steps.find((s) => s.title === 'Bind the neckline')!.text).toMatch(/over the ruffle/);
    expect(ascii(g)).toEqual([]);
    // On a button front it runs from front edge to front edge.
    const b = draftBodice(m, { fit: 'regular', neckline: 'crew', collar: 'ruffle', closure: 'front_buttons' });
    expect(checkPattern(b.pieces).filter((c) => !c.ok)).toEqual([]);
    // On a dress, and drawn round the neck.
    const dr = draftDress(m as never, { fit: 'regular', neckline: 'crew', collar: 'ruffle' }, { silhouette: 'a_line', length: 'knee' });
    expect(titles(dressGuide(dr, { silhouette: 'a_line', length: 'knee' }, 2, 1, {}))).toContain('Attach the ruffle');
    expect(bodiceFlat(d).views[0].shapes.length).toBeGreaterThan(bodiceFlat(draftBodice(m, { fit: 'regular', neckline: 'v' })).views[0].shapes.length);
    expect(describeBodice({ ...DEFAULT_BODICE, neckline: 'v', collar: 'ruffle' })).toMatch(/ruffled V-neck bodice/);
    expect(detailAllowed({ ...DEFAULT_BODICE, neckline: 'cami' }, 'collar', 'ruffle')).toBe(false);
  });
});

describe('shirred back', () => {
  it('pulls on with a shirred back on strapless, sweetheart and cami tops, every seam matching', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const m = randomBody(rng(seed));
      for (const neckline of ['strapless', 'sweetheart', 'cami'] as const)
        for (const length of ['waist', 'high_hip'] as const) {
          const d = draftBodice(m, { fit: 'regular', neckline, length, structure: 'shirred' });
          expect(d.shirred).toBeDefined();
          for (const c of checkPattern(d.pieces)) if (!c.ok) failures.push(`seed ${seed} ${neckline} ${length}: ${c.label} (${c.detail})`);
        }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('cuts the back wide on the fold, with no zip and no boning', () => {
    const m = randomBody(rng(6));
    const plain = draftBodice(m, { fit: 'regular', neckline: 'cami' });
    const d = draftBodice(m, { fit: 'regular', neckline: 'cami', structure: 'shirred' });
    expect(d.zipCm).toBe(0);
    expect(d.top!.boned).toBe(false);
    const back = d.pieces.find((pc) => pc.name === 'Bodice back')!;
    expect(back.cut).toBe('Cut 1 on fold');
    expect(back.lines.length).toBe(d.shirred!.rows);
    const width = (pc: typeof back) => Math.max(...pc.outline.points(4).map((q) => q.x));
    expect(width(back) / width(plain.pieces[1])).toBeCloseTo(SHIRR.ratio, 0);
    const g = bodiceGuide(d, { length: 'waist' }, 1.5, 1, { edges: 'binding' });
    const t = titles(g);
    expect(t).not.toContain('Put in the zip');
    expect(t.indexOf('Shirr the back')).toBeLessThan(t.indexOf('Sew the side seams'));
    expect(g.notions.join(' ')).toMatch(/shirring elastic/);
    expect(g.notions.join(' ')).not.toMatch(/zip|Hook/);
    expect(ascii(g)).toEqual([]);
    // Drawn with its rows across the back, as it sits.
    expect(bodiceFlat(d).views[1].lines.filter((l) => l.kind === 'stitch').length).toBeGreaterThan(5);
    expect(bodiceFabrics({ fit: 'regular', neckline: 'cami', structure: 'shirred' }).style).toMatch(/shirred/);
  });

  it('holds a strapless top up in place of boning, on a top but not a dress', () => {
    const c = { ...DEFAULT_BODICE, neckline: 'strapless' as const };
    expect(validDetails({ ...c, structure: 'shirred' }).structure).toBe('shirred');
    expect(validDetails(c).structure).toBe('boned');
    expect(validDetails({ ...c, structure: 'shirred' }, 'dress').structure).toBe('boned');
    expect(detailAllowed({ ...DEFAULT_BODICE }, 'structure', 'shirred')).toBe(false);
    expect(detailAllowed({ ...c, neckline: 'cami', structure: 'shirred' }, 'peplum', 'flared')).toBe(false);
    expect(describeBodice({ ...c, structure: 'shirred' })).toMatch(/strapless bodice with a shirred back/);
  });
});
